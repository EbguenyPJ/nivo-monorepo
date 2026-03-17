import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class StripeWebhooksService {
  private readonly logger = new Logger(StripeWebhooksService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
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
    await this.subscriptionsService.updateStatus(invoice.subscription, 'active');
  }

  private async handleSubscriptionDeleted(subscription: any) {
    this.logger.log(`Subscription deleted: ${subscription.id}`);
    await this.subscriptionsService.updateStatus(subscription.id, 'canceled');
  }
}
