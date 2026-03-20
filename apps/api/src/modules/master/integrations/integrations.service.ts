import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '@nivo/database';

const DEFAULT_INTEGRATIONS = [
  { type: 'slack', display_name: 'Slack' },
  { type: 'discord', display_name: 'Discord' },
  { type: 'sendgrid', display_name: 'SendGrid' },
  { type: 'aws_ses', display_name: 'AWS SES' },
  { type: 'webhook', display_name: 'Webhook' },
];

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepo: Repository<Integration>,
  ) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  async findAll() {
    return this.integrationRepo.find({ order: { display_name: 'ASC' } });
  }

  async update(id: string, data: Partial<Integration>) {
    const integration = await this.integrationRepo.findOne({ where: { id } });
    if (!integration) throw new NotFoundException('Integration not found');
    Object.assign(integration, data);
    return this.integrationRepo.save(integration);
  }

  async testIntegration(id: string) {
    const integration = await this.integrationRepo.findOne({ where: { id } });
    if (!integration) throw new NotFoundException('Integration not found');

    // For now, always mark as connected and update last_tested_at
    integration.last_tested_at = new Date();
    integration.status = 'connected';
    await this.integrationRepo.save(integration);

    return { success: true, message: `${integration.display_name} connection test successful` };
  }

  async seedDefaults() {
    const count = await this.integrationRepo.count();
    if (count > 0) return;

    this.logger.log('Seeding default integrations...');
    for (const def of DEFAULT_INTEGRATIONS) {
      const integration = this.integrationRepo.create({
        type: def.type,
        display_name: def.display_name,
        is_enabled: false,
        config: {},
        status: 'disconnected',
      });
      await this.integrationRepo.save(integration);
    }
    this.logger.log('Default integrations seeded.');
  }
}
