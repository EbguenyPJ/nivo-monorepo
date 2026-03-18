import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Roles('super-admin')
  create(@Body() body: { name: string; subdomain: string; owner_email: string; owner_password: string; plan_name: string }) {
    return this.tenantsService.create(body);
  }

  @Get()
  @Roles('super-admin', 'soporte')
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.tenantsService.findAll(+page, +limit);
  }

  @Get('dashboard/metrics')
  @Roles('super-admin')
  getDashboardMetrics() {
    return this.tenantsService.getDashboardMetrics();
  }

  @Get(':id')
  @Roles('super-admin', 'soporte')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Put(':id/theme')
  @Roles('super-admin')
  updateTheme(@Param('id') id: string, @Body() body: { logo_url?: string; theme_settings?: Record<string, unknown> }) {
    return this.tenantsService.updateTheme(id, body);
  }
}
