import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin')
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('plans')
  getPlans() {
    return this.settingsService.getPlans();
  }

  @Get('plans/:id')
  getPlanById(@Param('id') id: string) {
    return this.settingsService.getPlanById(id);
  }

  @Post('plans')
  createPlan(@Body() body: Record<string, any>) {
    return this.settingsService.createPlan(body);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.settingsService.updatePlan(id, body);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.settingsService.deletePlan(id);
  }

  @Get()
  getSettings(@Query('category') category?: string) {
    return this.settingsService.getSettings(category);
  }

  @Patch()
  bulkUpdateSettings(@Body() body: { settings: { key: string; value: string }[] }) {
    return this.settingsService.bulkUpdateSettings(body.settings);
  }
}
