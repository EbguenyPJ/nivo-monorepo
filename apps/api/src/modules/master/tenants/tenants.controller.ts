import { Controller, Get, Post, Put, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // ─── Public (no auth) ──────────────────────────────────────────
  @Get('mobile/available')
  listMobileAvailable() {
    return this.tenantsService.listMobileAvailable();
  }

  // ─── Protected (super-admin / soporte) ─────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin')
  create(@Body() body: { name: string; subdomain: string; owner_email: string; owner_password: string; plan_name: string }) {
    return this.tenantsService.create(body);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin', 'soporte')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
  ) {
    return this.tenantsService.findAll(+page, +limit, { search, status, plan });
  }

  @Get('dashboard/metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin')
  getDashboardMetrics() {
    return this.tenantsService.getDashboardMetrics();
  }

  @Get('check-subdomain')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin')
  checkSubdomain(@Query('subdomain') subdomain: string) {
    return this.tenantsService.checkSubdomain(subdomain);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin', 'soporte')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Get(':id/usage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin', 'soporte')
  getUsageMetrics(@Param('id') id: string) {
    return this.tenantsService.getUsageMetrics(id);
  }

  @Get(':id/activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin', 'soporte')
  getDailyActivity(@Param('id') id: string) {
    return this.tenantsService.getDailyActivity(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin')
  update(
    @Param('id') id: string,
    @Body() body: Partial<{
      name: string;
      subdomain: string;
      rfc: string;
      razon_social: string;
      regimen_fiscal: string;
      codigo_postal_fiscal: string;
      direccion_fiscal: string;
      override_max_branches: number;
      override_max_users: number;
      override_storage_limit_gb: number;
      override_notes: string;
      override_mod_transfers: boolean | null;
      override_mod_invoicing: boolean | null;
      override_mod_loyalty: boolean | null;
      override_mod_advanced_reports: boolean | null;
      override_mod_ecommerce: boolean | null;
      override_mod_custom_branding: boolean | null;
      override_mod_mobile: boolean | null;
      override_mod_nibbit: boolean | null;
      override_support_type: string | null;
      override_support_hours: string | null;
    }>,
  ) {
    return this.tenantsService.update(id, body);
  }

  @Patch(':id/credentials')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin')
  updateCredentials(
    @Param('id') id: string,
    @Body() body: { admin_email?: string; admin_password?: string },
  ) {
    return this.tenantsService.updateTenantCredentials(id, body);
  }

  @Patch(':id/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin')
  toggleStatus(@Param('id') id: string) {
    return this.tenantsService.toggleStatus(id);
  }

  @Patch(':id/plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin')
  changePlan(@Param('id') id: string, @Body() body: { plan_name: string }) {
    return this.tenantsService.changePlan(id, body.plan_name);
  }

  @Put(':id/theme')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin')
  updateTheme(@Param('id') id: string, @Body() body: { logo_url?: string; theme_settings?: Record<string, unknown> }) {
    return this.tenantsService.updateTheme(id, body);
  }

  @Patch(':id/cancel-subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super-admin')
  cancelSubscription(@Param('id') id: string) {
    return this.tenantsService.cancelSubscription(id);
  }
}
