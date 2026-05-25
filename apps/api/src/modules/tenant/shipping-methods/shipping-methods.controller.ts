import { Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { ShippingMethodsService } from './shipping-methods.service';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';

@Controller('shipping-methods')
export class ShippingMethodsController {
  constructor(
    private readonly service: ShippingMethodsService,
    private readonly tenantManager: TenantConnectionManager,
  ) {}

  @Get()
  async findAll(@Req() req: any) {
    const conn = await this.tenantManager.getConnection(req['tenantDb']);
    return this.service.findAll(conn);
  }

  @Get('admin')
  async findAllAdmin(@Req() req: any) {
    const conn = await this.tenantManager.getConnection(req['tenantDb']);
    return this.service.findAllAdmin(conn);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: any) {
    const conn = await this.tenantManager.getConnection(req['tenantDb']);
    return this.service.create(conn, dto);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const conn = await this.tenantManager.getConnection(req['tenantDb']);
    return this.service.update(conn, id, dto);
  }

  @Post('calculate')
  async calculate(@Req() req: any, @Body() body: { subtotal: number }) {
    const conn = await this.tenantManager.getConnection(req['tenantDb']);
    return this.service.calculate(conn, body.subtotal);
  }
}
