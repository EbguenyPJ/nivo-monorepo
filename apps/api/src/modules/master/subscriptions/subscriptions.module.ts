import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription, Tenant, PlanConfig } from '@nivo/database';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { TenantSubscriptionController } from './tenant-subscription.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Tenant, PlanConfig])],
  controllers: [SubscriptionsController, TenantSubscriptionController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
