import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Queue } from 'bullmq';
import { Tenant, Subscription, PlanConfig, Product, Sale, Customer, Employee, Branch } from '@nivo/database';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(PlanConfig)
    private readonly planConfigRepo: Repository<PlanConfig>,
    @InjectQueue(QUEUE_NAMES.TENANT_PROVISIONING)
    private readonly provisioningQueue: Queue,
    private readonly tenantConnectionManager: TenantConnectionManager,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Build a plan_name -> monthly_price map from the plan_configs table.
   */
  private async getPlanPrices(): Promise<Record<string, number>> {
    const plans = await this.planConfigRepo.find();
    const map: Record<string, number> = {};
    for (const p of plans) {
      map[p.plan_name] = Number(p.monthly_price) || 0;
    }
    return map;
  }

  /**
   * Build a plan_name -> display_name map from the plan_configs table.
   */
  private async getPlanLabels(): Promise<Record<string, string>> {
    const plans = await this.planConfigRepo.find();
    const map: Record<string, string> = {};
    for (const p of plans) {
      map[p.plan_name] = p.display_name;
    }
    return map;
  }

  async create(data: { name: string; subdomain: string; owner_email: string; owner_password: string; plan_name?: string }) {
    const existing = await this.tenantRepo.findOne({ where: { subdomain: data.subdomain } });
    if (existing) throw new ConflictException('Subdomain already taken');

    const databaseName = `tenant_db_${data.subdomain.replace(/[^a-z0-9]/g, '_')}`;

    const tenant = this.tenantRepo.create({
      name: data.name,
      subdomain: data.subdomain,
      database_name: databaseName,
      theme_settings: {},
      is_active: true,
    });

    await this.tenantRepo.save(tenant);

    // Create subscription record immediately if a plan was selected
    if (data.plan_name) {
      const subscription = this.subscriptionRepo.create({
        tenant_id: tenant.id,
        plan_name: data.plan_name,
        status: 'active',
      });
      await this.subscriptionRepo.save(subscription);
    }

    // Enqueue async DB provisioning
    await this.provisioningQueue.add('provision-tenant', {
      tenant_id: tenant.id,
      database_name: databaseName,
      owner_email: data.owner_email,
      owner_password: data.owner_password,
      plan_name: data.plan_name,
    });

    // Auto-generate notification
    await this.notificationsService.create({
      type: 'tenant_registered',
      title: 'Nueva zapatería registrada',
      message: `${data.name} se ha registrado en la plataforma${data.plan_name ? ` con plan ${data.plan_name}` : ' como prueba gratuita'}.`,
      tenant_id: tenant.id,
      tenant_name: data.name,
    });

    return { ...tenant, message: 'Tenant created. Database provisioning in progress.' };
  }

  async findAll(page: number, limit: number, filters?: { search?: string; status?: string; plan?: string }) {
    const qb = this.tenantRepo
      .createQueryBuilder('tenant')
      .leftJoinAndSelect('tenant.subscriptions', 'sub')
      .orderBy('tenant.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters?.search) {
      qb.andWhere('(LOWER(tenant.name) LIKE :search OR LOWER(tenant.subdomain) LIKE :search)', {
        search: `%${filters.search.toLowerCase()}%`,
      });
    }

    if (filters?.status === 'active') {
      qb.andWhere('tenant.is_active = :isActive', { isActive: true });
    } else if (filters?.status === 'inactive') {
      qb.andWhere('tenant.is_active = :isActive', { isActive: false });
    }

    if (filters?.plan) {
      qb.andWhere('sub.plan_name = :plan', { plan: filters.plan });
    }

    const [tenants, total] = await qb.getManyAndCount();

    return { data: tenants, total, page, limit };
  }

  async findOne(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id }, relations: ['subscriptions'] });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async toggleStatus(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    tenant.is_active = !tenant.is_active;
    await this.tenantRepo.save(tenant);

    await this.notificationsService.create({
      type: tenant.is_active ? 'tenant_activated' : 'tenant_suspended',
      title: tenant.is_active ? 'Zapatería activada' : 'Zapatería suspendida',
      message: `${tenant.name} fue ${tenant.is_active ? 'activada' : 'suspendida'}.`,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
    });

    return { ...tenant, message: tenant.is_active ? 'Tenant activado' : 'Tenant suspendido' };
  }

  async updateTheme(id: string, data: { logo_url?: string; theme_settings?: Record<string, unknown> }) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (data.logo_url !== undefined) tenant.logo_url = data.logo_url;
    if (data.theme_settings !== undefined) tenant.theme_settings = data.theme_settings;

    return this.tenantRepo.save(tenant);
  }

  async getUsageMetrics(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    try {
      const connection = await this.tenantConnectionManager.getConnection(tenant.database_name);

      const productRepo = connection.getRepository(Product);
      const saleRepo = connection.getRepository(Sale);
      const customerRepo = connection.getRepository(Customer);
      const employeeRepo = connection.getRepository(Employee);
      const branchRepo = connection.getRepository(Branch);

      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      // Product count
      const totalProducts = await productRepo.count();

      // Branches count
      const totalBranches = await branchRepo.count();

      // Customer count
      const totalCustomers = await customerRepo.count();

      // Employees count
      const totalEmployees = await employeeRepo.count();

      // Sales this month
      const salesThisMonth = await saleRepo
        .createQueryBuilder('sale')
        .where('sale.status = :status', { status: 'completed' })
        .andWhere('sale.created_at >= :start', { start: firstOfMonth })
        .getCount();

      // Revenue this month
      const revenueResult = await saleRepo
        .createQueryBuilder('sale')
        .select('SUM(sale.total_amount)', 'total')
        .where('sale.status = :status', { status: 'completed' })
        .andWhere('sale.created_at >= :start', { start: firstOfMonth })
        .getRawOne();
      const revenueThisMonth = parseFloat(revenueResult?.total || '0');

      // Sales last month (for comparison)
      const salesLastMonth = await saleRepo
        .createQueryBuilder('sale')
        .where('sale.status = :status', { status: 'completed' })
        .andWhere('sale.created_at >= :start', { start: firstOfLastMonth })
        .andWhere('sale.created_at < :end', { end: firstOfMonth })
        .getCount();

      // Last activity (most recent sale as proxy for usage)
      const lastSale = await saleRepo
        .createQueryBuilder('sale')
        .orderBy('sale.created_at', 'DESC')
        .getOne();
      const lastActivity = lastSale?.created_at?.toString() || null;

      // Total sales all time
      const totalSalesAllTime = await saleRepo.count({ where: { status: 'completed' } });

      return {
        totalProducts,
        totalBranches,
        totalCustomers,
        totalEmployees,
        salesThisMonth,
        salesLastMonth,
        revenueThisMonth,
        totalSalesAllTime,
        lastActivity,
      };
    } catch (error) {
      this.logger.warn(`Could not connect to tenant DB ${tenant.database_name}: ${(error as Error).message}`);
      return {
        totalProducts: 0,
        totalBranches: 0,
        totalCustomers: 0,
        totalEmployees: 0,
        salesThisMonth: 0,
        salesLastMonth: 0,
        revenueThisMonth: 0,
        totalSalesAllTime: 0,
        lastActivity: null,
        error: 'No se pudo conectar a la base de datos del tenant',
      };
    }
  }

  async checkSubdomain(subdomain: string) {
    const existing = await this.tenantRepo.findOne({ where: { subdomain } });
    return { available: !existing };
  }

  async updateTenantCredentials(id: string, data: { admin_email?: string; admin_password?: string }) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    try {
      const connection = await this.tenantConnectionManager.getConnection(tenant.database_name);
      const employeeRepo = connection.getRepository(Employee);

      // Find the admin employee (role = 'admin')
      const admin = await employeeRepo.findOne({ where: { role: 'admin' } });
      if (!admin) throw new NotFoundException('Admin employee not found in tenant database');

      if (data.admin_email) {
        admin.email = data.admin_email;
      }
      if (data.admin_password) {
        const bcrypt = await import('bcrypt');
        admin.password_hash = await bcrypt.hash(data.admin_password, 10);
      }

      await employeeRepo.save(admin);
      return { message: 'Credenciales actualizadas correctamente' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.warn(`Could not connect to tenant DB: ${(error as Error).message}`);
      throw new NotFoundException('No se pudo conectar a la base de datos del tenant');
    }
  }

  async update(id: string, data: Partial<Tenant>) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // If subdomain is being changed, check uniqueness
    if (data.subdomain && data.subdomain !== tenant.subdomain) {
      const existing = await this.tenantRepo.findOne({ where: { subdomain: data.subdomain } });
      if (existing) throw new ConflictException('Subdomain already taken');
    }

    Object.assign(tenant, data);
    await this.tenantRepo.save(tenant);

    return this.tenantRepo.findOne({ where: { id }, relations: ['subscriptions'] });
  }

  async getDailyActivity(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    try {
      const connection = await this.tenantConnectionManager.getConnection(tenant.database_name);
      const saleRepo = connection.getRepository(Sale);

      const now = new Date();
      const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

      const results = await saleRepo
        .createQueryBuilder('sale')
        .select("TO_CHAR(sale.created_at, 'YYYY-MM-DD')", 'day')
        .addSelect('COUNT(*)::int', 'sales')
        .where('sale.status = :status', { status: 'completed' })
        .andWhere('sale.created_at >= :start', { start: sevenDaysAgo })
        .groupBy("TO_CHAR(sale.created_at, 'YYYY-MM-DD')")
        .orderBy('day', 'ASC')
        .getRawMany();

      // Fill in missing days with 0
      const activity: { day: string; sales: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);
        const dayStr = d.toISOString().slice(0, 10);
        const found = results.find((r: any) => r.day === dayStr);
        activity.push({ day: dayStr, sales: found ? Number(found.sales) : 0 });
      }

      return activity;
    } catch (error) {
      this.logger.warn(`Could not connect to tenant DB ${tenant.database_name}: ${(error as Error).message}`);
      return [];
    }
  }

  async cancelSubscription(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id }, relations: ['subscriptions'] });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const activeSub = tenant.subscriptions?.find((s) => s.status === 'active');
    if (!activeSub) throw new NotFoundException('No active subscription found');

    activeSub.status = 'canceled';
    activeSub.updated_at = new Date();
    await this.subscriptionRepo.save(activeSub);

    await this.notificationsService.create({
      type: 'subscription_canceled',
      title: 'Suscripción cancelada',
      message: `La suscripción de ${tenant.name} (plan ${activeSub.plan_name}) fue cancelada.`,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
    });

    return { message: 'Suscripción cancelada exitosamente', subscription: activeSub };
  }

  async changePlan(id: string, newPlan: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id }, relations: ['subscriptions'] });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const activeSub = tenant.subscriptions?.find((s) => s.status === 'active');
    if (activeSub) {
      const oldPlan = activeSub.plan_name;
      activeSub.plan_name = newPlan;
      await this.subscriptionRepo.save(activeSub);

      await this.notificationsService.create({
        type: 'subscription_upgraded',
        title: 'Plan de suscripción cambiado',
        message: `${tenant.name} cambió de plan ${oldPlan} a ${newPlan}.`,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
      });

      return { message: `Plan actualizado a ${newPlan}`, subscription: activeSub };
    }

    // Create new subscription if none active
    const newSub = this.subscriptionRepo.create({
      tenant_id: tenant.id,
      plan_name: newPlan,
      status: 'active',
    });
    await this.subscriptionRepo.save(newSub);

    await this.notificationsService.create({
      type: 'subscription_upgraded',
      title: 'Nueva suscripción creada',
      message: `${tenant.name} inició suscripción con plan ${newPlan}.`,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
    });

    return { message: `Suscripción creada con plan ${newPlan}`, subscription: newSub };
  }

  async getDashboardMetrics() {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Load plan prices from DB
    const planPrices = await this.getPlanPrices();
    const planLabels = await this.getPlanLabels();

    // All tenants
    const allTenants = await this.tenantRepo.find({
      relations: ['subscriptions'],
      order: { created_at: 'DESC' },
    });

    const total = allTenants.length;
    const active = allTenants.filter((t) => t.is_active).length;
    const inactive = total - active;

    // This month vs last month registrations
    const thisMonth = allTenants.filter((t) => new Date(t.created_at) >= firstOfMonth).length;
    const lastMonth = allTenants.filter(
      (t) => new Date(t.created_at) >= firstOfLastMonth && new Date(t.created_at) < firstOfMonth,
    ).length;

    // All subscriptions
    const allSubs = await this.subscriptionRepo.find();

    // Plan distribution
    const planCounts: Record<string, number> = {};
    for (const sub of allSubs) {
      const plan = sub.plan_name || 'unknown';
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    }
    const planDistribution = Object.entries(planCounts).map(([name, count]) => ({ name, count }));

    // MRR calculation — using real plan prices from plan_configs
    const activeSubs = allSubs.filter((s) => s.status === 'active');
    const mrr = activeSubs.reduce((sum, s) => sum + (planPrices[s.plan_name] || 0), 0);

    // Churn: canceled in this month / active at start of month
    const canceledThisMonth = allSubs.filter(
      (s) => s.status === 'canceled' && new Date(s.updated_at) >= firstOfMonth,
    ).length;
    const activeStartOfMonth = allSubs.filter(
      (s) => new Date(s.created_at) < firstOfMonth && s.status !== 'canceled',
    ).length;
    const churnRate = activeStartOfMonth > 0 ? (canceledThisMonth / activeStartOfMonth) * 100 : 0;

    // Monthly growth data (last 6 months)
    const monthlyGrowth: { month: string; tenants: number; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthLabel = monthStart.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });

      const tenantsInMonth = allTenants.filter(
        (t) => new Date(t.created_at) >= monthStart && new Date(t.created_at) < monthEnd,
      ).length;

      // Revenue: active subs that existed during this month
      const subsInMonth = allSubs.filter(
        (s) => new Date(s.created_at) < monthEnd && (s.status === 'active' || new Date(s.updated_at) >= monthStart),
      );
      const monthRevenue = subsInMonth.reduce((sum, s) => sum + (planPrices[s.plan_name] || 0), 0);

      monthlyGrowth.push({ month: monthLabel, tenants: tenantsInMonth, revenue: monthRevenue });
    }

    // Activity feed (recent events)
    const activityFeed: { type: string; message: string; time: string; tenantName?: string }[] = [];

    // Recent registrations
    const recentTenants = allTenants.slice(0, 5);
    for (const t of recentTenants) {
      activityFeed.push({
        type: 'registration',
        message: `${t.name} se registró en la plataforma`,
        time: t.created_at.toString(),
        tenantName: t.name,
      });
    }

    // Recent subscription changes
    const recentSubs = [...allSubs]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
    for (const s of recentSubs) {
      const tenant = allTenants.find((t) => t.id === s.tenant_id);
      if (!tenant) continue;
      if (s.status === 'canceled') {
        activityFeed.push({
          type: 'cancellation',
          message: `${tenant.name} canceló su suscripción`,
          time: s.updated_at.toString(),
          tenantName: tenant.name,
        });
      } else if (s.status === 'past_due') {
        activityFeed.push({
          type: 'payment_issue',
          message: `Error de cobro en ${tenant.name}`,
          time: s.updated_at.toString(),
          tenantName: tenant.name,
        });
      } else if (s.plan_name !== 'basic' && planLabels[s.plan_name]) {
        activityFeed.push({
          type: 'upgrade',
          message: `${tenant.name} actualizó a plan ${planLabels[s.plan_name]}`,
          time: s.updated_at.toString(),
          tenantName: tenant.name,
        });
      }
    }

    // Sort feed by time and take latest 10
    activityFeed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return {
      kpis: {
        total,
        active,
        inactive,
        thisMonth,
        lastMonth,
        mrr,
        churnRate: Math.round(churnRate * 10) / 10,
        activeSubs: activeSubs.length,
      },
      planDistribution,
      monthlyGrowth,
      activityFeed: activityFeed.slice(0, 10),
    };
  }
}
