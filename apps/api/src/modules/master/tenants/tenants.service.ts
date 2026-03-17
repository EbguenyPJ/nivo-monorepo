import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { Tenant } from '@nivo/database';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectQueue(QUEUE_NAMES.TENANT_PROVISIONING)
    private readonly provisioningQueue: Queue,
  ) {}

  async create(data: { name: string; subdomain: string; owner_email: string; owner_password: string; plan_name: string }) {
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

    // Enqueue async DB provisioning
    await this.provisioningQueue.add('provision-tenant', {
      tenant_id: tenant.id,
      database_name: databaseName,
      owner_email: data.owner_email,
      owner_password: data.owner_password,
      plan_name: data.plan_name,
    });

    return { ...tenant, message: 'Tenant created. Database provisioning in progress.' };
  }

  async findAll(page: number, limit: number) {
    const [tenants, total] = await this.tenantRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return { data: tenants, total, page, limit };
  }

  async findOne(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id }, relations: ['subscriptions'] });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateTheme(id: string, data: { logo_url?: string; theme_settings?: Record<string, unknown> }) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (data.logo_url !== undefined) tenant.logo_url = data.logo_url;
    if (data.theme_settings !== undefined) tenant.theme_settings = data.theme_settings;

    return this.tenantRepo.save(tenant);
  }
}
