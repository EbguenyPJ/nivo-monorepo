import { Module } from '@nestjs/common';
import { StripeWebhooksController } from './stripe-webhooks.controller';
import { StripeWebhooksService } from './stripe-webhooks.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [StripeWebhooksController],
  providers: [StripeWebhooksService],
})
export class StripeWebhooksModule {}
