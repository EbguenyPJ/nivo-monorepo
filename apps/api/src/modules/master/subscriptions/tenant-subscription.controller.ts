import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { Tenant, Subscription, PlanConfig, Branch, Employee } from '@nivo/database';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';

@ApiTags('Tenant Subscription')
@Controller('tenant-subscription')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantSubscriptionController {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(PlanConfig)
    private readonly planConfigRepo: Repository<PlanConfig>,
    private readonly connectionManager: TenantConnectionManager,
  ) {}

  /**
   * GET /tenant-subscription/me
   * Returns current plan, usage metrics, and effective feature flags.
   * Available to any authenticated tenant user.
   */
  @Get('me')
  async getMySubscription(@Req() req: Request) {
    const tenantId = (req.user as any)?.tenant_id;
    if (!tenantId) return null;

    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      relations: ['subscriptions'],
    });
    if (!tenant) return null;

    const subscription = tenant.subscriptions?.find((s) => s.status === 'active') || tenant.subscriptions?.[0] || null;
    const plan = subscription?.plan_name
      ? await this.planConfigRepo.findOne({ where: { plan_name: subscription.plan_name } })
      : null;

    // Resolve effective limits (tenant overrides take precedence over plan defaults)
    const effective = {
      max_branches:     tenant.override_max_branches     ?? plan?.max_branches     ?? 1,
      max_users:        tenant.override_max_users        ?? plan?.max_users        ?? 2,
      storage_limit_gb: tenant.override_storage_limit_gb ?? plan?.storage_limit_gb ?? 0,
      mod_transfers:    tenant.override_mod_transfers    ?? plan?.mod_transfers    ?? false,
      mod_invoicing:    tenant.override_mod_invoicing    ?? plan?.mod_invoicing    ?? false,
      mod_loyalty:      tenant.override_mod_loyalty      ?? plan?.mod_loyalty      ?? false,
      mod_advanced_reports: tenant.override_mod_advanced_reports ?? plan?.mod_advanced_reports ?? false,
      mod_ecommerce:         tenant.override_mod_ecommerce         ?? plan?.mod_ecommerce         ?? false,
      mod_custom_branding:   tenant.override_mod_custom_branding   ?? plan?.mod_custom_branding   ?? false,
      support_type:          tenant.override_support_type          ?? plan?.support_type          ?? 'email',
      support_hours:    tenant.override_support_hours    ?? plan?.support_hours    ?? null,
    };

    // Usage from tenant DB
    let usage = { branches: 0, employees: 0 };
    try {
      const conn = await this.connectionManager.getConnection(tenant.database_name);
      const [branches, employees] = await Promise.all([
        conn.getRepository(Branch).count(),
        conn.getRepository(Employee).count(),
      ]);
      usage = { branches, employees };
    } catch {
      // DB may not be provisioned yet
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        is_active: tenant.is_active,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            plan_name: subscription.plan_name,
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            created_at: subscription.created_at,
          }
        : null,
      plan: plan
        ? {
            id: plan.id,
            plan_name: plan.plan_name,
            display_name: plan.display_name,
            description: plan.description,
            monthly_price: Number(plan.monthly_price),
            annual_price: Number(plan.annual_price),
            support_level: plan.support_level,
            support_type: plan.support_type,
            support_hours: plan.support_hours,
            support_description: plan.support_description,
          }
        : null,
      effective,
      usage,
    };
  }

  /**
   * GET /tenant-subscription/plans
   * Returns all active plans so the tenant can compare and upgrade.
   * Publicly accessible (only JWT required, no super-admin role).
   */
  @Get('plans')
  async getAvailablePlans() {
    const plans = await this.planConfigRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC', monthly_price: 'ASC' },
    });

    return plans.map((p) => ({
      id: p.id,
      plan_name: p.plan_name,
      display_name: p.display_name,
      description: p.description,
      monthly_price: Number(p.monthly_price),
      annual_price: Number(p.annual_price),
      max_branches: p.max_branches,
      max_users: p.max_users,
      storage_limit_gb: p.storage_limit_gb,
      mod_transfers: p.mod_transfers,
      mod_invoicing: p.mod_invoicing,
      mod_loyalty: p.mod_loyalty,
      mod_advanced_reports: p.mod_advanced_reports,
      mod_ecommerce: p.mod_ecommerce,
      support_level: p.support_level,
      support_type: p.support_type,
      support_hours: p.support_hours,
      support_description: p.support_description,
      stripe_price_id_monthly: p.stripe_price_id_monthly,
      stripe_price_id_annual: p.stripe_price_id_annual,
    }));
  }
}
