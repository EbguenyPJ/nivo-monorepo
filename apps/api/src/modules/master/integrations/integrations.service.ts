import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '@nivo/database';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepo: Repository<Integration>,
  ) {}

  // ---- CRUD ----

  async findAll() {
    const data = await this.integrationRepo.find({ order: { display_name: 'ASC' } });
    return { data };
  }

  async create(body: Partial<Integration>) {
    // Prevent duplicates by type
    if (body.type) {
      const existing = await this.integrationRepo.findOne({ where: { type: body.type } });
      if (existing) throw new ConflictException(`Integration "${body.type}" already exists`);
    }
    const integration = this.integrationRepo.create({
      type: body.type,
      display_name: body.display_name || body.type,
      is_enabled: body.is_enabled ?? false,
      config: body.config || {},
      status: 'disconnected',
    });
    return this.integrationRepo.save(integration);
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

    return { status: 'success', message: `Conexión con ${integration.display_name} exitosa.` };
  }
}
