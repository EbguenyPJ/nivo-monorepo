import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Support')
@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin', 'soporte')
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('tenant_id') tenantId?: string,
    @Query('search') search?: string,
  ) {
    return this.supportService.findAll(+page, +limit, {
      status,
      priority,
      tenant_id: tenantId,
      search,
    });
  }

  @Get('tickets/stats')
  getStats() {
    return this.supportService.getStats();
  }

  @Get('tickets/:id')
  findOne(@Param('id') id: string) {
    return this.supportService.findOne(id);
  }

  @Post('tickets')
  create(
    @Body() body: { tenant_id: string; tenant_name: string; subject: string; category?: string; message: string },
  ) {
    return this.supportService.create(body);
  }

  @Post('tickets/:id/messages')
  addMessage(
    @Param('id') id: string,
    @Body() body: { sender_type: string; sender_name: string; message: string },
  ) {
    return this.supportService.addMessage(id, body);
  }

  @Patch('tickets/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.supportService.updateStatus(id, body.status);
  }
}
