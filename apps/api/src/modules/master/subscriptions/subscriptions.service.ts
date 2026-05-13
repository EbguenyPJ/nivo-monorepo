import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '@nivo/database';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async findByTenant(tenantId: string) {
    return this.subscriptionRepo.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }

  async createOrUpdate(tenantId: string, data: Partial<Subscription>) {
    let subscription = await this.subscriptionRepo.findOne({ where: { tenant_id: tenantId } });

    if (subscription) {
      Object.assign(subscription, data);
    } else {
      subscription = this.subscriptionRepo.create({ tenant_id: tenantId, ...data });
    }

    return this.subscriptionRepo.save(subscription);
  }

  async updateStatus(stripeSubscriptionId: string, status: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: stripeSubscriptionId },
    });
    if (subscription) {
      subscription.status = status;
      return this.subscriptionRepo.save(subscription);
    }
  }

  async findByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: stripeSubscriptionId },
    });
  }
}
