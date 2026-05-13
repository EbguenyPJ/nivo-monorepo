import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';
import { TenantSettingsService } from '../tenant-settings/tenant-settings.service';
import { ExcelBuilderService, ReportType } from './services/excel-builder.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { S3Service } from './services/s3.service';
import { DistributionService } from './services/distribution.service';
import { ReportsGateway } from './reports.gateway';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';

export interface ExportJobData {
  // Job type
  action: 'download-excel' | 'download-pdf' | 'send';

  // Tenant info
  tenantId: string;
  databaseName: string;

  // Report params
  reportType: ReportType;
  filters: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
  };

  // Distribution (only for 'send' action)
  channel?: 'email' | 'whatsapp';
  recipient?: string;
  message?: string;
  subject?: string;
}

@Processor(QUEUE_NAMES.REPORTS_EXPORT)
export class ReportsExportWorker extends WorkerHost {
  private readonly logger = new Logger(ReportsExportWorker.name);

  constructor(
    private readonly connectionManager: TenantConnectionManager,
    private readonly settingsService: TenantSettingsService,
    private readonly excelBuilder: ExcelBuilderService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly s3: S3Service,
    private readonly distribution: DistributionService,
    private readonly gateway: ReportsGateway,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ExportJobData>): Promise<{ downloadUrl: string; isLocal: boolean }> {
    const { action, tenantId, databaseName, reportType, filters } = job.data;

    this.logger.log(`[${job.id}] Processing ${action} — ${reportType} for tenant ${tenantId}`);

    this.gateway.emitToTenant(tenantId, {
      jobId: job.id!,
      status: 'started',
      message: action === 'download-excel'
        ? 'Construyendo archivo Excel...'
        : 'Iniciando generación de PDF...',
      progress: 5,
    });

    try {
      const connection = await this.connectionManager.getConnection(databaseName);

      // Resolve tenant branding
      const [primaryColor, businessName] = await Promise.all([
        this.settingsService.getValue(connection, 'branding.primary_color', '#3B82F6'),
        this.settingsService.getValue(connection, 'ticket.business_name', 'Nivo POS'),
      ]);

      let buffer: Buffer;
      let contentType: string;
      let ext: string;

      // ── Phase 1: Generate file ───────────────────────────────────────────────
      if (action === 'download-excel') {
        await job.updateProgress(20);
        this.gateway.emitToTenant(tenantId, { jobId: job.id!, status: 'progress', progress: 20 });

        buffer = await this.excelBuilder.build(
          connection, reportType, filters, primaryColor, businessName,
        );
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        ext = 'xlsx';
      } else {
        // PDF (both download-pdf and send)
        await job.updateProgress(15);
        this.gateway.emitToTenant(tenantId, {
          jobId: job.id!, status: 'progress', progress: 15,
          message: 'Lanzando navegador invisible...',
        });

        buffer = await this.pdfGenerator.generate(
          tenantId, databaseName, reportType,
          {
            startDate: filters.startDate ?? '',
            endDate:   filters.endDate ?? '',
            branchId:  filters.branchId ?? '',
          },
        );
        contentType = 'application/pdf';
        ext = 'pdf';
      }

      await job.updateProgress(60);
      this.gateway.emitToTenant(tenantId, {
        jobId: job.id!, status: 'progress', progress: 60, message: 'Subiendo archivo...',
      });

      // ── Phase 2: Upload to S3 / local ────────────────────────────────────────
      const dateStr = new Date().toISOString().slice(0, 10);
      const key = `temp-reports/${tenantId}/${reportType}-${dateStr}-${job.id}.${ext}`;
      const { url, isLocal } = await this.s3.upload(key, buffer, contentType);

      const apiBase = this.config.get('API_URL', 'http://localhost:3000');
      const publicUrl = this.s3.resolvePublicUrl(url, apiBase);

      await job.updateProgress(80);

      // ── Phase 3: Distribute (only for 'send') ────────────────────────────────
      if (action === 'send' && job.data.channel && job.data.recipient) {
        this.gateway.emitToTenant(tenantId, {
          jobId: job.id!, status: 'progress', progress: 80,
          message: job.data.channel === 'email' ? 'Enviando por correo...' : 'Enviando por WhatsApp...',
        });

        await this.distribution.send({
          channel:       job.data.channel,
          recipient:     job.data.recipient,
          subject:       job.data.subject,
          message:       job.data.message,
          attachmentUrl: publicUrl,
          attachmentName: `${reportType}-${dateStr}.${ext}`,
          reportTitle:   this.reportLabel(reportType),
          businessName,
        });
      }

      await job.updateProgress(100);
      this.gateway.emitToTenant(tenantId, {
        jobId: job.id!,
        status: 'ready',
        downloadUrl: publicUrl,
        progress: 100,
        message: action === 'send'
          ? `Reporte enviado exitosamente ✅`
          : `Reporte listo para descargar`,
      });

      this.logger.log(`[${job.id}] Completed — ${publicUrl}`);
      return { downloadUrl: publicUrl, isLocal };
    } catch (err: any) {
      this.logger.error(`[${job.id}] Failed: ${err.message}`, err.stack);
      this.gateway.emitToTenant(tenantId, {
        jobId: job.id!,
        status: 'error',
        message: `Error al generar el reporte: ${err.message}`,
      });
      throw err;
    }
  }

  private reportLabel(type: ReportType): string {
    const labels: Record<ReportType, string> = {
      sales:         'Reporte de Ventas',
      profitability: 'Reporte de Rentabilidad',
      audits:        'Reporte de Arqueos',
      performance:   'Reporte de Rendimiento',
      dashboard:     'Resumen del Dashboard',
    };
    return labels[type] ?? 'Reporte';
  }
}
