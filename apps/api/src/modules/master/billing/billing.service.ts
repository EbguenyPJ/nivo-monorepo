import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TenantBillingProfile, BillingInvoice, Tenant } from '@nivo/database';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(TenantBillingProfile)
    private readonly profileRepo: Repository<TenantBillingProfile>,
    @InjectRepository(BillingInvoice)
    private readonly invoiceRepo: Repository<BillingInvoice>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectQueue(QUEUE_NAMES.INVOICE_GENERATION)
    private readonly invoiceQueue: Queue,
  ) {}

  // ─── Billing Profile ─────────────────────────────────────────────────────

  async getProfile(tenantId: string): Promise<TenantBillingProfile | null> {
    return this.profileRepo.findOne({ where: { tenant_id: tenantId } });
  }

  async upsertProfile(
    tenantId: string,
    data: {
      rfc: string;
      legal_name: string;
      zip_code: string;
      tax_regime: string;
      cfdi_use?: string;
      requires_invoice?: boolean;
    },
  ): Promise<TenantBillingProfile> {
    let profile = await this.profileRepo.findOne({ where: { tenant_id: tenantId } });

    if (profile) {
      Object.assign(profile, data);
    } else {
      profile = this.profileRepo.create({ tenant_id: tenantId, ...data });
    }

    return this.profileRepo.save(profile);
  }

  // ─── Invoice History ──────────────────────────────────────────────────────

  async getInvoices(
    tenantId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: BillingInvoice[]; total: number; page: number; pages: number }> {
    const [data, total] = await this.invoiceRepo.findAndCount({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── Create Invoice Record (from Stripe webhook) ──────────────────────────

  async createInvoiceRecord(params: {
    tenantId: string;
    stripeInvoiceId: string;
    stripeSubscriptionId: string | null;
    amountTotal: number; // MXN total with IVA
    description: string;
    periodStart: Date | null;
    periodEnd: Date | null;
  }): Promise<BillingInvoice> {
    // Avoid duplicates — Stripe may retry webhooks
    const existing = await this.invoiceRepo.findOne({
      where: { stripe_invoice_id: params.stripeInvoiceId },
    });
    if (existing) {
      this.logger.warn(`Invoice already exists for Stripe invoice ${params.stripeInvoiceId}`);
      return existing;
    }

    const subtotal = Math.round((params.amountTotal / 1.16) * 100) / 100;
    const tax = Math.round((params.amountTotal - subtotal) * 100) / 100;

    const invoice = this.invoiceRepo.create({
      tenant_id: params.tenantId,
      stripe_invoice_id: params.stripeInvoiceId,
      stripe_subscription_id: params.stripeSubscriptionId,
      amount_total: params.amountTotal,
      amount_subtotal: subtotal,
      amount_tax: tax,
      description: params.description,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      cfdi_status: 'pending',
    });

    return this.invoiceRepo.save(invoice);
  }

  /** Enqueue CFDI generation job for a freshly created invoice */
  async enqueueInvoiceGeneration(invoiceId: string): Promise<void> {
    await this.invoiceQueue.add(
      'generate-cfdi',
      { invoiceId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log(`Enqueued CFDI generation for invoice ${invoiceId}`);
  }

  // ─── Retry Failed Invoice ─────────────────────────────────────────────────

  async retryInvoice(invoiceId: string, tenantId: string): Promise<void> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.tenant_id !== tenantId) throw new ForbiddenException();
    if (invoice.cfdi_status !== 'failed') {
      throw new ForbiddenException(`Invoice is not in failed state (current: ${invoice.cfdi_status})`);
    }

    // Reset to pending so the worker picks it up fresh
    invoice.cfdi_status = 'pending';
    invoice.pac_error = null;
    await this.invoiceRepo.save(invoice);

    await this.enqueueInvoiceGeneration(invoiceId);
  }

  // ─── Callbacks (called by worker) ────────────────────────────────────────

  async markStamped(
    invoiceId: string,
    satUuid: string,
    pacCfdiId: string,
    xmlUrl: string,
    pdfUrl: string,
  ): Promise<void> {
    await this.invoiceRepo.update(invoiceId, {
      cfdi_status: 'stamped',
      sat_uuid: satUuid,
      pac_cfdi_id: pacCfdiId,
      xml_url: xmlUrl,
      pdf_url: pdfUrl,
      pac_error: null,
    });
  }

  async markFailed(invoiceId: string, errorMessage: string): Promise<void> {
    await this.invoiceRepo.update(invoiceId, {
      cfdi_status: 'failed',
      pac_error: errorMessage,
    });
  }

  // ─── Helpers for the worker ───────────────────────────────────────────────

  async getInvoiceWithProfile(invoiceId: string): Promise<{
    invoice: BillingInvoice;
    profile: TenantBillingProfile | null;
    tenant: Tenant | null;
  }> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);

    const [profile, tenant] = await Promise.all([
      this.profileRepo.findOne({ where: { tenant_id: invoice.tenant_id } }),
      this.tenantRepo.findOne({ where: { id: invoice.tenant_id } }),
    ]);

    return { invoice, profile, tenant };
  }
}
