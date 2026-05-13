import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { REPORTS_QUEUE } from './processors/reports.processor';
import { ReportJobData, ReportType } from './interfaces/report-job.interface';

const VALID_TYPES: ReportType[] = [
  'sales', 'profitability', 'audits', 'performance', 'dashboard', 'inventory',
];

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    @InjectQueue(REPORTS_QUEUE)
    private readonly reportsQueue: Queue,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async generate(
    @Req() req: Request,
    @Body()
    body: {
      report_type: string;
      start_date?: string;
      end_date?: string;
      branch_id?: string;
      channel?: 'email' | 'whatsapp' | 'both';
      recipient?: string;
      recipient_name?: string;
    },
  ) {
    if (!body.report_type || !VALID_TYPES.includes(body.report_type as ReportType)) {
      throw new BadRequestException(
        `report_type is required and must be one of: ${VALID_TYPES.join(', ')}`,
      );
    }

    const user = req.user as any;
    const tenantId = user.tenant_id as string;
    const databaseName =
      (req as any).tenantConnection?.options?.database as string ??
      user.database_name;

    const jobData: ReportJobData = {
      tenantId,
      databaseName,
      reportType: body.report_type as ReportType,
      filters: {
        startDate: body.start_date,
        endDate: body.end_date,
        branchId: body.branch_id,
      },
      distribution: body.recipient
        ? {
            channel: body.channel ?? 'email',
            recipient: body.recipient,
            recipientName: body.recipient_name,
          }
        : undefined,
      requestedBy: user.sub,
    };

    const job = await this.reportsQueue.add('generate-report', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 86_400 },
    });

    return {
      jobId: job.id,
      status: 'queued',
      message: `Generación de "${body.report_type}" encolada`,
    };
  }

  @Get('status/:jobId')
  async getStatus(@Param('jobId') jobId: string) {
    const job = await this.reportsQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Job not found');

    const state = await job.getState();
    const progress = job.progress as number | undefined;
    const result = job.returnvalue as { pdfUrl?: string } | undefined;

    return {
      jobId,
      state,
      progress: progress ?? 0,
      pdfUrl: result?.pdfUrl,
      error: job.failedReason,
    };
  }
}
