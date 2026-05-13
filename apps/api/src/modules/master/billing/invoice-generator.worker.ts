import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';
import { BillingService } from './billing.service';
import { PacService } from './pac.service';
import { StorageService } from './storage.service';
import { EmailService } from './email.service';

@Processor(QUEUE_NAMES.INVOICE_GENERATION)
export class InvoiceGeneratorWorker extends WorkerHost {
  private readonly logger = new Logger(InvoiceGeneratorWorker.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly pacService: PacService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<{ invoiceId: string }>): Promise<void> {
    const { invoiceId } = job.data;
    this.logger.log(`Processing CFDI generation for invoice ${invoiceId}`);

    // ── 1. Load invoice, billing profile, and tenant ──────────────────────
    const { invoice, profile, tenant } = await this.billingService.getInvoiceWithProfile(invoiceId);

    // ── 2. Skip if tenant has opted out of auto-invoicing ─────────────────
    if (!profile || !profile.requires_invoice) {
      this.logger.log(`Invoice ${invoiceId}: requires_invoice=false or no profile — skipping CFDI`);
      return;
    }

    // ── 3. Build CFDI payload ─────────────────────────────────────────────
    const periodLabel = invoice.period_start
      ? new Date(invoice.period_start).toLocaleDateString('es-MX', {
          month: 'long',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

    const description =
      invoice.description ||
      `Suscripción Nivo${tenant?.name ? ` — ${tenant.name}` : ''} — ${periodLabel}`;

    const payload = this.pacService.buildPayload({
      totalMxn: Number(invoice.amount_total),
      description,
      periodLabel,
      emisorRfc:    this.config.get<string>('PAC_EMISOR_RFC', ''),
      emisorNombre: this.config.get<string>('PAC_EMISOR_NOMBRE', ''),
      emisorRegimen:this.config.get<string>('PAC_EMISOR_REGIMEN', '601'),
      emisorCp:     this.config.get<string>('PAC_EMISOR_CP', ''),
      receptorRfc:    profile.rfc,
      receptorNombre: profile.legal_name,
      receptorCp:     profile.zip_code,
      receptorRegimen:profile.tax_regime,
      receptorCfdiUse:profile.cfdi_use,
    });

    // ── 4. Stamp with PAC ─────────────────────────────────────────────────
    let stampResult: { cfdiId: string; satUuid: string };
    try {
      stampResult = await this.pacService.stamp(payload);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.logger.error(`PAC stamp failed for invoice ${invoiceId}: ${errMsg}`);
      await this.billingService.markFailed(invoiceId, errMsg);

      // Send error email to tenant admin
      if (tenant) {
        const adminEmail = this.config.get<string>('SUPPORT_EMAIL', 'soporte@nivo.com');
        const posAdminUrl = this.config.get<string>('POS_ADMIN_URL', 'http://localhost:3001');
        await this.emailService.sendInvoiceError({
          to: adminEmail, // in a real scenario: tenant admin email; using support for now
          tenantName: tenant.name,
          invoiceId,
          invoiceDescription: description,
          errorMessage: errMsg,
          retryUrl: `${posAdminUrl}/dashboard/subscription`,
        });
      }
      throw err; // Re-throw so BullMQ marks the job as failed (enables retries)
    }

    // ── 5. Download XML and PDF ───────────────────────────────────────────
    let xmlUrl = '';
    let pdfUrl = '';
    try {
      const [xmlBuffer, pdfBuffer] = await Promise.all([
        this.pacService.downloadXml(stampResult.cfdiId),
        this.pacService.downloadPdf(stampResult.cfdiId),
      ]);
      [xmlUrl, pdfUrl] = await Promise.all([
        this.storageService.saveInvoiceXml(invoiceId, xmlBuffer),
        this.storageService.saveInvoicePdf(invoiceId, pdfBuffer),
      ]);
    } catch (downloadErr: any) {
      // Files failed to download/save — still mark as stamped but without URLs
      this.logger.error(`Failed to store invoice files for ${invoiceId}: ${downloadErr?.message}`);
      xmlUrl = '';
      pdfUrl = '';
    }

    // ── 6. Update invoice record ──────────────────────────────────────────
    await this.billingService.markStamped(
      invoiceId,
      stampResult.satUuid,
      stampResult.cfdiId,
      xmlUrl,
      pdfUrl,
    );

    this.logger.log(`Invoice ${invoiceId} stamped successfully. UUID: ${stampResult.satUuid}`);

    // ── 7. Send success notification ──────────────────────────────────────
    if (tenant && xmlUrl && pdfUrl) {
      const adminEmail = this.config.get<string>('SUPPORT_EMAIL', 'soporte@nivo.com');
      await this.emailService.sendInvoiceReady({
        to: adminEmail,
        tenantName: tenant.name,
        invoiceDescription: description,
        satUuid: stampResult.satUuid,
        xmlUrl,
        pdfUrl,
      }).catch((e) => this.logger.warn(`Success email failed: ${e?.message}`));
    }
  }
}
