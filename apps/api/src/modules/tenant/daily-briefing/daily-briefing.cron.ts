import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, Employee } from '@nivo/database';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';
import { DailyBriefingService } from './daily-briefing.service';
import { NivoMailerService } from '../mailer/mailer.service';

@Injectable()
export class DailyBriefingCron {
  private readonly logger = new Logger(DailyBriefingCron.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly connectionManager: TenantConnectionManager,
    private readonly briefingService: DailyBriefingService,
    private readonly mailerService: NivoMailerService,
  ) {}

  @Cron('0 7 * * *', { name: 'daily-briefing', timeZone: 'America/Mexico_City' })
  async handleDailyBriefing() {
    this.logger.log('Starting daily briefing generation for all active tenants...');

    const tenants = await this.tenantRepo.find({ where: { is_active: true } });

    for (const tenant of tenants) {
      try {
        const connection = await this.connectionManager.getConnection(tenant.database_name);
        const brief = await this.briefingService.generateBrief(connection, tenant.name);
        const html = this.briefingService.buildEmailHtml(brief);

        const adminEmails = await this.getAdminEmails(connection);

        for (const email of adminEmails) {
          await this.mailerService.send({
            to: email,
            subject: `Nivo Briefing — ${brief.date} — $${brief.sales_yesterday.total_revenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })} en ventas`,
            html,
          });
        }

        this.logger.log(`Briefing sent for ${tenant.name} to ${adminEmails.length} admin(s)`);
      } catch (err: any) {
        this.logger.error(`Failed to generate briefing for ${tenant.name}: ${err.message}`);
      }
    }
  }

  private async getAdminEmails(connection: import('typeorm').DataSource): Promise<string[]> {
    const admins = await connection.query(`
      SELECT e.email FROM employees e
      INNER JOIN roles r ON r.id = e.role_id
      WHERE r.name = 'admin' AND e.is_active = true AND e.email IS NOT NULL
    `);
    return admins.map((a: any) => a.email).filter(Boolean);
  }
}
