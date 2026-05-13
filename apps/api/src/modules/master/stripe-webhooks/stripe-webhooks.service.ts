import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BillingService } from '../billing/billing.service';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';

@Injectable()
export class StripeWebhooksService {
  private readonly logger = new Logger(StripeWebhooksService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly billingService: BillingService,
    @InjectQueue(QUEUE_NAMES.BILLING_TASKS)
    private readonly billingTasksQueue: Queue,
  ) {
    this.stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY', ''), {
      apiVersion: '2024-12-18.acacia',
    });
  }

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      return JSON.parse(rawBody.toString()) as Stripe.Event;
    }
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      this.logger.error(`Stripe signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid Stripe signature');
    }
  }

  async handleWebhook(body: any, signature: string) {
    const event = this.constructEvent(body, signature);
    this.logger.log(`Received Stripe event: ${event.type}`);

    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handlePaymentSucceeded(invoice: any) {
    this.logger.log(`Payment succeeded for subscription: ${invoice.subscription}`);

    // 1. Update subscription status + current_period_end
    if (invoice.subscription) {
      await this.subscriptionsService.updateStatusWithPeriod(
        invoice.subscription,
        'active',
        invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      );
    }

    // 2. Resolve tenant from subscription
    const tenantId = await this.resolveTenantId(invoice.subscription);
    if (!tenantId) {
      this.logger.warn(`Could not resolve tenant for subscription ${invoice.subscription}`);
      return;
    }

    // 3. Create billing_invoice record (idempotent — no duplicate on webhook retry)
    const amountPaid = (invoice.amount_paid || invoice.total || 0) / 100;
    const description = this.buildInvoiceDescription(invoice);
    const billingInvoice = await this.billingService.createInvoiceRecord({
      tenantId,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: invoice.subscription || null,
      amountTotal: amountPaid,
      description,
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd:   invoice.period_end   ? new Date(invoice.period_end   * 1000) : null,
    });

    // 4. Enqueue CFDI generation (async — worker checks requires_invoice before doing anything)
    await this.billingService.enqueueInvoiceGeneration(billingInvoice.id);

    // 5. Enqueue billing notification tasks (email + invoice delivery)
    const customerEmail = invoice.customer_email || this.config.get('MAIL_FROM_ADDRESS', 'nivo.demo2@gmail.com');
    await this.billingTasksQueue.add('payment-notification', {
      tenantId,
      invoiceId: billingInvoice.id,
      email: customerEmail,
      amount: amountPaid,
      description,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
  }

  private async handleSubscriptionDeleted(subscription: any) {
    this.logger.log(`Subscription deleted: ${subscription.id}`);
    await this.subscriptionsService.updateStatus(subscription.id, 'canceled');
  }

  /** Resolve tenant_id from stripe_subscription_id via our subscriptions table */
  private async resolveTenantId(stripeSubscriptionId: string): Promise<string | null> {
    if (!stripeSubscriptionId) return null;
    try {
      const sub = await this.subscriptionsService.findByStripeId(stripeSubscriptionId);
      return sub?.tenant_id ?? null;
    } catch {
      return null;
    }
  }

  private buildInvoiceDescription(invoice: any): string {
    const lines: any[] = invoice.lines?.data || [];
    if (lines.length > 0 && lines[0].description) return lines[0].description;
    if (invoice.period_start) {
      const monthLabel = new Date(invoice.period_start * 1000).toLocaleDateString('es-MX', {
        month: 'long', year: 'numeric',
      });
      return `Suscripción Nivo — ${monthLabel}`;
    }
    return 'Suscripción Nivo';
  }
}
