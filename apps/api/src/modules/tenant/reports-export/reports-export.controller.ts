import {
  Controller, Post, Get, Body, Query, Req,
  HttpCode, HttpStatus, UseGuards, Param,
  BadRequestException, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { Public } from '../../../core/auth/public.decorator';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';
import { ExcelBuilderService, ReportType } from './services/excel-builder.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { TenantSettingsService } from '../tenant-settings/tenant-settings.service';
import { ExportJobData } from './reports-export.worker';
import { Sale, Branch } from '@nivo/database';

type ExportFilters = { startDate?: string; endDate?: string; branchId?: string };

@ApiTags('Reports Export')
@Controller('reports/export')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsExportController {
  constructor(
    @InjectQueue(QUEUE_NAMES.REPORTS_EXPORT)
    private readonly exportQueue: Queue,
    private readonly connectionManager: TenantConnectionManager,
    private readonly excelBuilder: ExcelBuilderService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly settingsService: TenantSettingsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private getTenantInfo(req: Request) {
    const user = req.user as any;
    return {
      tenantId: user.tenant_id as string,
      databaseName: (req as any).tenantConnection?.options?.database as string ?? user.database_name,
    };
  }

  private filtersFromQuery(query: any): ExportFilters {
    return {
      startDate: query.start_date,
      endDate:   query.end_date,
      branchId:  query.branch_id,
    };
  }

  // ── GET /reports/export/download  → synchronous Excel stream ────────────────

  @Get('download')
  async downloadExcel(
    @Req() req: Request,
    @Query('report_type') reportType: string,
    @Query() query: Record<string, string>,
  ) {
    if (!reportType) throw new BadRequestException('report_type is required');

    const { tenantId, databaseName } = this.getTenantInfo(req);
    const connection = await this.connectionManager.getConnection(databaseName);

    const [primaryColor, businessName] = await Promise.all([
      this.settingsService.getValue(connection, 'branding.primary_color', '#3B82F6'),
      this.settingsService.getValue(connection, 'ticket.business_name', 'Nivo POS'),
    ]);

    const buffer = await this.excelBuilder.build(
      connection,
      reportType as ReportType,
      this.filtersFromQuery(query),
      primaryColor,
      businessName,
    );

    const date = new Date().toISOString().slice(0, 10);
    const filename = `${reportType}-${date}.xlsx`;

    const response = (req as any).res;
    response.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.byteLength,
    });
    response.end(buffer);
  }

  // ── POST /reports/export/pdf  → async PDF via BullMQ, returns jobId ─────────

  @Post('pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 5 PDF jobs per minute per user
  async enqueuePdf(
    @Req() req: Request,
    @Body() body: { report_type: string; start_date?: string; end_date?: string; branch_id?: string },
  ) {
    if (!body.report_type) throw new BadRequestException('report_type is required');

    const { tenantId, databaseName } = this.getTenantInfo(req);

    const jobData: ExportJobData = {
      action:       'download-pdf',
      tenantId,
      databaseName,
      reportType:   body.report_type as ReportType,
      filters: {
        startDate: body.start_date,
        endDate:   body.end_date,
        branchId:  body.branch_id,
      },
    };

    const job = await this.exportQueue.add('download-pdf', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 86400 }, // keep 24h
      removeOnFail:     { age: 86400 },
    });

    return { jobId: job.id, status: 'queued' };
  }

  // ── POST /reports/export/send  → async distribution via BullMQ ──────────────

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 5 sends per minute per user
  async enqueueSend(
    @Req() req: Request,
    @Body() body: {
      report_type: string;
      format: 'excel' | 'pdf';
      channel: 'email' | 'whatsapp';
      recipient: string;
      subject?: string;
      message?: string;
      start_date?: string;
      end_date?: string;
      branch_id?: string;
    },
  ) {
    const { report_type, format, channel, recipient } = body;
    if (!report_type || !channel || !recipient) {
      throw new BadRequestException('report_type, channel, and recipient are required');
    }

    const { tenantId, databaseName } = this.getTenantInfo(req);

    const jobData: ExportJobData = {
      action:       'send',
      tenantId,
      databaseName,
      reportType:   report_type as ReportType,
      filters: {
        startDate: body.start_date,
        endDate:   body.end_date,
        branchId:  body.branch_id,
      },
      channel,
      recipient,
      subject: body.subject,
      message: body.message,
    };

    const job = await this.exportQueue.add('send-report', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400 },
      removeOnFail:     { age: 86400 },
    });

    return { jobId: job.id, status: 'queued' };
  }

  // ── GET /reports/export/status/:jobId  → poll job state ─────────────────────

  @Get('status/:jobId')
  async getStatus(@Param('jobId') jobId: string) {
    const job = await this.exportQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Job not found');

    const state    = await job.getState();
    const progress = job.progress as number | undefined;
    const result   = job.returnvalue as { downloadUrl?: string } | undefined;
    const failedReason = job.failedReason;

    return {
      jobId,
      state,   // waiting | active | completed | failed | delayed
      progress: progress ?? 0,
      downloadUrl: result?.downloadUrl,
      error: failedReason,
    };
  }

  // ── GET /reports/export/print-token  → one-time JWT for print pages ──────────

  @Get('print-token')
  generatePrintToken(
    @Req() req: Request,
    @Query('report_type') reportType: string,
    @Query() query: Record<string, string>,
  ) {
    const { tenantId, databaseName } = this.getTenantInfo(req);
    const filters = {
      startDate: query.start_date ?? '',
      endDate:   query.end_date ?? '',
      branchId:  query.branch_id ?? '',
    };
    const token = this.pdfGenerator.generatePrintToken(tenantId, databaseName, reportType, filters);
    return { token };
  }

  // ── GET /reports/export/print-data  → called by print page (token-auth) ──────

  @Get('print-data')
  @SkipThrottle()
  @Public()
  async getPrintData(
    @Query('token') token: string,
    @Query('report_type') reportType: string,
    @Query() query: Record<string, string>,
  ) {
    if (!token) throw new UnauthorizedException('Print token required');

    let payload: any;
    try {
      payload = this.jwtService.verify(token, { secret: this.config.get('JWT_SECRET') });
    } catch {
      throw new UnauthorizedException('Invalid or expired print token');
    }
    if (payload.purpose !== 'print') throw new UnauthorizedException('Invalid token purpose');

    const { database_name, filters: tokenFilters } = payload;
    const mergedFilters = { ...tokenFilters };

    const connection = await this.connectionManager.getConnection(database_name);

    const [primaryColor, businessName] = await Promise.all([
      this.settingsService.getValue(connection, 'branding.primary_color', '#3B82F6'),
      this.settingsService.getValue(connection, 'ticket.business_name', 'Nivo POS'),
    ]);

    const type = (reportType ?? payload.report_type) as ReportType;
    const rows = await this.fetchPrintRows(connection, type, mergedFilters);

    return {
      reportType: type,
      businessName,
      primaryColor,
      period: { start: mergedFilters.startDate ?? '', end: mergedFilters.endDate ?? '' },
      summary: await this.fetchSummary(connection, type, mergedFilters),
      rows,
      chartData: this.buildChartData(type, rows),
    };
  }

  private async fetchSummary(connection: any, type: ReportType, filters: any) {
    if (type !== 'sales') return {};
    const result = await connection.query(`
      SELECT COUNT(*) AS total_sales, SUM(total_amount) AS total_revenue, AVG(total_amount) AS avg_ticket
      FROM sales WHERE status = 'completed'
      ${filters.startDate ? `AND created_at >= '${filters.startDate}'` : ''}
      ${filters.endDate   ? `AND created_at <= '${filters.endDate}'`   : ''}
      ${filters.branchId  ? `AND branch_id = '${filters.branchId}'`    : ''}
    `);
    const r = result[0] ?? {};
    return {
      total_sales:    Number(r.total_sales ?? 0),
      total_revenue:  Number(r.total_revenue ?? 0),
      avg_ticket:     Number(r.avg_ticket ?? 0),
    };
  }

  private async fetchPrintRows(connection: any, type: ReportType, filters: any) {
    switch (type) {
      case 'sales': {
        const qb = connection.getRepository(Sale)
          .createQueryBuilder('sale')
          .leftJoinAndSelect('sale.employee', 'emp')
          .leftJoinAndSelect('sale.branch', 'branch')
          .leftJoinAndSelect('sale.customer', 'cust')
          .where('sale.status = :s', { s: 'completed' });
        if (filters.branchId)  qb.andWhere('sale.branch_id = :b', { b: filters.branchId });
        if (filters.startDate) qb.andWhere('sale.created_at >= :sd', { sd: filters.startDate });
        if (filters.endDate)   qb.andWhere('sale.created_at <= :ed', { ed: filters.endDate });
        return qb.orderBy('sale.created_at', 'DESC').take(100).getMany();
      }
      case 'profitability':
        return connection.query(`
          SELECT COALESCE(b.name,'Sin marca') AS brand,
                 SUM(si.quantity)::int AS units,
                 SUM(si.quantity*si.unit_price) AS revenue,
                 SUM(si.quantity*COALESCE(pv.cost_price,0)) AS cost
          FROM sale_items si
          JOIN sales s ON s.id=si.sale_id AND s.status='completed'
            ${filters.startDate ? `AND s.created_at>='${filters.startDate}'` : ''}
            ${filters.endDate   ? `AND s.created_at<='${filters.endDate}'`   : ''}
            ${filters.branchId  ? `AND s.branch_id='${filters.branchId}'`    : ''}
          LEFT JOIN product_variants pv ON pv.id=si.variant_id
          LEFT JOIN products p ON p.id=pv.product_id
          LEFT JOIN brands b ON b.id=p.brand_id
          GROUP BY b.name ORDER BY revenue DESC
        `);
      case 'audits':
        return connection.query(`
          SELECT DATE(ps.closed_at) AS date, COUNT(*)::int AS session_count, SUM(ps.difference) AS difference
          FROM pos_sessions ps WHERE ps.status='closed'
            ${filters.startDate ? `AND ps.closed_at>='${filters.startDate}'` : ''}
            ${filters.endDate   ? `AND ps.closed_at<='${filters.endDate}'`   : ''}
            ${filters.branchId  ? `AND ps.branch_id='${filters.branchId}'`   : ''}
          GROUP BY DATE(ps.closed_at) ORDER BY date DESC
        `);
      case 'performance':
        return connection.query(`
          SELECT COALESCE(e.name,'Sin asignar') AS seller,
                 COUNT(DISTINCT s.id)::int AS sale_count,
                 SUM(s.total_amount) AS total_revenue,
                 AVG(s.total_amount) AS avg_ticket,
                 COALESCE(SUM(si.quantity)::numeric/NULLIF(COUNT(DISTINCT s.id),0),0) AS upt
          FROM sales s
          LEFT JOIN employees e ON e.id=s.employee_id
          LEFT JOIN sale_items si ON si.sale_id=s.id
          WHERE s.status='completed'
            ${filters.startDate ? `AND s.created_at>='${filters.startDate}'` : ''}
            ${filters.endDate   ? `AND s.created_at<='${filters.endDate}'`   : ''}
            ${filters.branchId  ? `AND s.branch_id='${filters.branchId}'`    : ''}
          GROUP BY e.name ORDER BY total_revenue DESC
        `);
      default:
        return [];
    }
  }

  private buildChartData(type: ReportType, rows: any[]) {
    if (type === 'profitability') {
      return rows.map((r) => ({
        brand: r.brand, units: Number(r.units),
        margin: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0,
      }));
    }
    if (type === 'performance') {
      return rows.map((r) => ({ seller: r.seller, total_revenue: Number(r.total_revenue) }));
    }
    return undefined;
  }
}
