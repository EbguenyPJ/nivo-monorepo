import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { TenantIntegrationsService } from './tenant-integrations.service';

@ApiTags('Tenant Integrations')
@Controller('tenant-integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantIntegrationsController {
  constructor(private readonly service: TenantIntegrationsService) {}

  /** List all available integrations and their current configuration status */
  @Get()
  list(@Req() req: any) {
    return this.service.listIntegrations(req.tenantConnection);
  }

  /** Get integration logs — MUST be before :type routes */
  @Get('logs/all')
  logs(
    @Req() req: any,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getLogs(
      req.tenantConnection,
      type,
      parseInt(page || '0'),
      parseInt(limit || '20'),
    );
  }

  /** Get a single integration's details */
  @Get(':type')
  getOne(@Req() req: any, @Param('type') type: string) {
    return this.service.getIntegration(req.tenantConnection, type);
  }

  /** Save or update integration credentials */
  @Post(':type')
  save(
    @Req() req: any,
    @Param('type') type: string,
    @Body() body: { credentials: Record<string, any>; is_active?: boolean },
  ) {
    return this.service.saveIntegration(req.tenantConnection, type, body);
  }

  /** Toggle integration active/inactive */
  @Patch(':type/toggle')
  toggle(
    @Req() req: any,
    @Param('type') type: string,
    @Body() body: { is_active: boolean },
  ) {
    return this.service.toggleActive(req.tenantConnection, type, body.is_active);
  }

  /** Test connection to the external service */
  @Post(':type/test')
  test(@Req() req: any, @Param('type') type: string) {
    return this.service.testConnection(req.tenantConnection, type);
  }

  /** Delete an integration configuration (credentials removed, logs preserved) */
  @Delete(':type')
  remove(@Req() req: any, @Param('type') type: string) {
    return this.service.deleteIntegration(req.tenantConnection, type);
  }
}
