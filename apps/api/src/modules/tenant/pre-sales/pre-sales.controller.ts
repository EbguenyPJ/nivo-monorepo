import {
  Controller, Get, Post, Param, Body, Query, Req, UseGuards,
} from '@nestjs/common';
import { PreSalesService } from './pre-sales.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@Controller('api/v1/mobile/pre-sales')
export class PreSalesController {
  constructor(private readonly service: PreSalesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.tenantConnection, {
      branch_id: body.branch_id ?? req.user.branch_id,
      employee_id: req.user.sub,
      customer_id: body.customer_id,
      items: body.items,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('lookup')
  async lookupQr(@Req() req: any, @Query('qr') qr: string) {
    return this.service.findByQr(req.tenantConnection, qr);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req.tenantConnection, id);
  }
}
