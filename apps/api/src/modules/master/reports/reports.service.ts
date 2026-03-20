import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, Subscription } from '@nivo/database';

const PLAN_PRICES: Record<string, number> = {
  basic: 499,
  professional: 999,
  enterprise: 2499,
};

@Injectable()
export class MasterReportsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async getMrrHistory(months: number) {
    const now = new Date();
    const result: { month: string; mrr: number; tenants: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthLabel = monthStart.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });

      const subs = await this.subscriptionRepo
        .createQueryBuilder('sub')
        .where('sub.created_at < :monthEnd', { monthEnd })
        .andWhere('(sub.status = :active OR (sub.status != :active AND sub.updated_at >= :monthStart))', {
          active: 'active',
          monthStart,
        })
        .getMany();

      const mrr = subs.reduce((sum, s) => sum + (PLAN_PRICES[s.plan_name] || 0), 0);

      const tenantCount = await this.tenantRepo
        .createQueryBuilder('t')
        .where('t.created_at < :monthEnd', { monthEnd })
        .andWhere('t.is_active = :active', { active: true })
        .getCount();

      result.push({ month: monthLabel, mrr, tenants: tenantCount });
    }

    return result;
  }

  async getRevenueReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const allSubs = await this.subscriptionRepo.find();
    const allTenants = await this.tenantRepo.find();

    const activeSubs = allSubs.filter((s) => s.status === 'active');
    const totalRevenue = activeSubs.reduce((sum, s) => sum + (PLAN_PRICES[s.plan_name] || 0), 0);

    const newTenants = allTenants.filter(
      (t) => new Date(t.created_at) >= start && new Date(t.created_at) <= end,
    ).length;

    const churnedTenants = allSubs.filter(
      (s) => s.status === 'canceled' && new Date(s.updated_at) >= start && new Date(s.updated_at) <= end,
    ).length;

    const avgRevenuePerTenant = activeSubs.length > 0 ? Math.round(totalRevenue / activeSubs.length) : 0;

    const totalAtStart = allSubs.filter((s) => new Date(s.created_at) < start).length;
    const retentionRate = totalAtStart > 0
      ? Math.round(((totalAtStart - churnedTenants) / totalAtStart) * 100 * 10) / 10
      : 100;

    return { totalRevenue, newTenants, churnedTenants, avgRevenuePerTenant, retentionRate };
  }

  async getRetentionData() {
    const now = new Date();
    const result: { month: string; retentionRate: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
      const monthLabel = monthStart.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });

      // Active subs at end of previous month
      const prevActive = await this.subscriptionRepo
        .createQueryBuilder('sub')
        .where('sub.created_at < :monthStart', { monthStart })
        .andWhere('(sub.status = :active OR (sub.updated_at >= :monthStart))', { active: 'active', monthStart })
        .getCount();

      // Of those, how many survived (still active or not canceled during this month)
      const survived = await this.subscriptionRepo
        .createQueryBuilder('sub')
        .where('sub.created_at < :monthStart', { monthStart })
        .andWhere('sub.status = :active', { active: 'active' })
        .getCount();

      const retentionRate = prevActive > 0 ? Math.round((survived / prevActive) * 100 * 10) / 10 : 100;

      result.push({ month: monthLabel, retentionRate });
    }

    return result;
  }

  async getTenantGrowth(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const result: { month: string; newTenants: number; churned: number; net: number }[] = [];

    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const monthStart = new Date(current);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      const monthLabel = monthStart.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });

      const newTenants = await this.tenantRepo
        .createQueryBuilder('t')
        .where('t.created_at >= :monthStart AND t.created_at < :monthEnd', { monthStart, monthEnd })
        .getCount();

      const churned = await this.subscriptionRepo
        .createQueryBuilder('sub')
        .where('sub.status = :canceled', { canceled: 'canceled' })
        .andWhere('sub.updated_at >= :monthStart AND sub.updated_at < :monthEnd', { monthStart, monthEnd })
        .getCount();

      result.push({ month: monthLabel, newTenants, churned, net: newTenants - churned });

      current.setMonth(current.getMonth() + 1);
    }

    return result;
  }

  async exportCsv(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const tenants = await this.tenantRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.subscriptions', 'sub')
      .where('t.created_at >= :start AND t.created_at <= :end', { start, end })
      .orderBy('t.created_at', 'DESC')
      .getMany();

    const header = 'name,subdomain,plan,status,revenue,created_at';
    const rows = tenants.map((t) => {
      const activeSub = t.subscriptions?.find((s) => s.status === 'active');
      const plan = activeSub?.plan_name || 'none';
      const status = t.is_active ? 'active' : 'inactive';
      const revenue = PLAN_PRICES[plan] || 0;
      const createdAt = t.created_at.toISOString();
      return `"${t.name}","${t.subdomain}","${plan}","${status}",${revenue},"${createdAt}"`;
    });

    return [header, ...rows].join('\n');
  }
}
