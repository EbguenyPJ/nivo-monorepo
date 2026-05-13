import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StripeWebhooksController } from './stripe-webhooks.controller';
import { StripeWebhooksService } from './stripe-webhooks.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BillingModule } from '../billing/billing.module';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';

@Module({
  imports: [
    SubscriptionsModule,
    BillingModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.BILLING_TASKS }),
  ],
  controllers: [StripeWebhooksController],
  providers: [StripeWebhooksService],
})
export class StripeWebhooksModule {}
