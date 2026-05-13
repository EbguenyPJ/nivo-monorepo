import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class StripeWebhooksService {
  private readonly logger = new Logger(StripeWebhooksService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly billingService: BillingService,
  ) {}

  async handleWebhook(body: any, _signature: string) {
    // TODO: Verify Stripe signature in production
    // const stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY'));
    // const event = stripe.webhooks.constructEvent(body, signature, this.config.get('STRIPE_WEBHOOK_SECRET'));

    const event = body;
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

    // 1. Update subscription status
    await this.subscriptionsService.updateStatus(invoice.subscription, 'active');

    // 2. Resolve tenant from subscription
    const tenantId = await this.resolveTenantId(invoice.subscription);
    if (!tenantId) {
      this.logger.warn(`Could not resolve tenant for subscription ${invoice.subscription}`);
      return;
    }

    // 3. Create billing_invoice record (idempotent — no duplicate on webhook retry)
    const billingInvoice = await this.billingService.createInvoiceRecord({
      tenantId,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: invoice.subscription || null,
      amountTotal: (invoice.amount_paid || invoice.total || 0) / 100, // Stripe sends cents
      description: this.buildInvoiceDescription(invoice),
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd:   invoice.period_end   ? new Date(invoice.period_end   * 1000) : null,
    });

    // 4. Enqueue CFDI generation (async — worker checks requires_invoice before doing anything)
    await this.billingService.enqueueInvoiceGeneration(billingInvoice.id);
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
