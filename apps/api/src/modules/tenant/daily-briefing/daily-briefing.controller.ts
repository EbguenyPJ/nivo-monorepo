import { Controller, Get, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '@nivo/database';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';
import { DailyBriefingService } from './daily-briefing.service';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class DailyBriefingController {
  constructor(
    private readonly briefingService: DailyBriefingService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly connectionManager: TenantConnectionManager,
  ) {}

  @Get('daily-brief')
  async getDailyBrief(@Req() req: any) {
    let connection = req.tenantConnection;
    let tenantName = req.tenant?.name || 'Tu negocio';

    if (!connection && req.user?.tenant_id) {
      const tenant = await this.tenantRepo.findOne({ where: { id: req.user.tenant_id } });
      if (!tenant) throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
      connection = await this.connectionManager.getConnection(tenant.database_name);
      tenantName = tenant.name;
    }

    if (!connection) {
      throw new HttpException('No tenant context available', HttpStatus.BAD_REQUEST);
    }

    return this.briefingService.generateBrief(connection, tenantName);
  }
}
