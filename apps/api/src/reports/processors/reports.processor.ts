import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PdfRendererService } from '../services/pdf-renderer.service';
import { FileStorageService } from '../services/file-storage.service';
import {
  ReportJobData,
  ReportResult,
  REPORT_LABELS,
} from '../interfaces/report-job.interface';
import { NotificationJobData } from '../../notifications/interfaces/whatsapp-job.interface';

export const REPORTS_QUEUE = 'reports-queue';

@Processor(REPORTS_QUEUE)
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(
    private readonly renderer: PdfRendererService,
    private readonly storage: FileStorageService,
    @InjectQueue('notifications-queue')
    private readonly notificationsQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<ReportResult> {
    const { tenantId, databaseName, reportType, filters, distribution } = job.data;
    const label = REPORT_LABELS[reportType] ?? 'Reporte';

    this.logger.log(
      `[Job Enqueued] ${job.id} — "${label}" tenant=${tenantId} type=${reportType}`,
    );

    // ── Phase 1: Render PDF via Puppeteer ──────────────────────────────────
    await job.updateProgress(10);

    const { buffer, tempPath } = await this.renderer.render(
      tenantId,
      databaseName,
      reportType,
      {
        startDate: filters.startDate ?? '',
        endDate: filters.endDate ?? '',
        branchId: filters.branchId ?? '',
      },
    );

    await job.updateProgress(50);

    // ── Phase 2: Upload to S3 ──────────────────────────────────────────────
    const dateStr = new Date().toISOString().slice(0, 10);
    const s3Key = `temp-reports/${tenantId}/${reportType}-${dateStr}-${job.id}.pdf`;

    const { url: pdfUrl } = await this.storage.upload(s3Key, buffer, 'application/pdf');

    await job.updateProgress(75);

    // ── Phase 3: Cleanup temp file ─────────────────────────────────────────
    await this.storage.cleanupTempFile(tempPath);

    // ── Phase 4: Chain notification ────────────────────────────────────────
    if (distribution?.recipient) {
      const filename = `${reportType}-${dateStr}.pdf`;

      if (distribution.channel === 'email' || distribution.channel === 'both') {
        const emailJob: NotificationJobData = {
          type: 'email',
          payload: {
            to: distribution.recipient,
            subject: `${label} — Nivo`,
            html: this.buildReportEmailHtml(label, pdfUrl, filename, distribution.recipientName),
            attachments: [{ filename, path: pdfUrl }],
          },
        };
        await this.notificationsQueue.add('report-email', emailJob);
        this.logger.log(`[Message Sent] Email notification enqueued for ${distribution.recipient}`);
      }

      if (distribution.channel === 'whatsapp' || distribution.channel === 'both') {
        const waJob: NotificationJobData = {
          type: 'whatsapp',
          payload: {
            to: distribution.recipient,
            templateName: 'report_ready',
            language: 'es_MX',
            components: [
              {
                type: 'header',
                parameters: [
                  { type: 'document', document: { link: pdfUrl, filename } },
                ],
              },
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: label },
                  { type: 'text', text: dateStr },
                ],
              },
            ],
          },
        };
        await this.notificationsQueue.add('report-whatsapp', waJob);
        this.logger.log(`[Message Sent] WhatsApp notification enqueued for ${distribution.recipient}`);
      }
    }

    await job.updateProgress(100);

    const result: ReportResult = {
      pdfUrl,
      s3Key,
      sizeBytes: buffer.byteLength,
      generatedAt: new Date().toISOString(),
    };

    this.logger.log(`[Job Complete] ${job.id} — ${pdfUrl} (${buffer.byteLength} bytes)`);
    return result;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ReportJobData>): void {
    this.logger.log(
      `[AUDIT] Report ${job.id} COMPLETED — type="${job.data.reportType}" tenant=${job.data.tenantId} duration=${Date.now() - job.timestamp}ms`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ReportJobData>, error: Error): void {
    this.logger.error(
      `[AUDIT] Report ${job.id} FAILED — type="${job.data.reportType}" attempt=${job.attemptsMade}/${job.opts.attempts ?? 2} error="${error.message}"`,
    );
  }

  private buildReportEmailHtml(
    label: string,
    pdfUrl: string,
    filename: string,
    recipientName?: string,
  ): string {
    const greeting = recipientName ? `Hola ${recipientName},` : 'Hola,';
    return `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <div style="background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;color:#1e3a5f;">📊 ${label}</h2>
          <p style="margin:0;color:#3b82f6;font-size:14px;">Tu reporte está listo</p>
        </div>
        <p>${greeting}</p>
        <p>Se ha generado exitosamente tu <strong>${label}</strong>. Puedes descargarlo con el siguiente enlace:</p>
        <a href="${pdfUrl}"
           style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
          ⬇️ Descargar ${filename}
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          Este enlace expira en 1 hora. Generado con Nivo POS.
        </p>
      </div>
    `;
  }
}
