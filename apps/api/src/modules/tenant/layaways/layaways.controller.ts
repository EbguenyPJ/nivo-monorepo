import { Controller, Get, Post, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { LayawaysService } from './layaways.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';

@ApiTags('Layaways')
@Controller('layaways')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LayawaysController {
  constructor(private readonly layawaysService: LayawaysService) {}

  @Get()
  findAll(
    @Req() req: Request,
    @Query('branch_id') branchId?: string,
    @Query('status') status?: string,
    @Query('customer_id') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.layawaysService.findAll(req.tenantConnection!, {
      branch_id: branchId,
      status,
      customer_id: customerId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('kpis')
  getKpis(@Req() req: Request, @Query('branch_id') branchId?: string) {
    return this.layawaysService.getKpis(req.tenantConnection!, branchId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.layawaysService.findOne(req.tenantConnection!, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: any) {
    return this.layawaysService.create(req.tenantConnection!, {
      ...body,
      employee_id: body.employee_id || (req as any).user?.sub,
    });
  }

  @Post(':id/payment')
  makePayment(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.layawaysService.makePayment(req.tenantConnection!, {
      layaway_id: id,
      ...body,
      employee_id: body.employee_id || (req as any).user?.sub,
    });
  }

  @Post(':id/cancel')
  cancel(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.layawaysService.cancel(req.tenantConnection!, {
      layaway_id: id,
      forfeit: body.forfeit ?? false,
      employee_id: (req as any).user?.sub,
    });
  }
}
