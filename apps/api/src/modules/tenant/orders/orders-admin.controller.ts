import {
  Controller, Get, Put, Param, Body, Query, Req, UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrdersAdminController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('fulfillment_type') fulfillmentType?: string,
    @Query('branch_id') branchId?: string,
    @Query('search') search?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listOrders(req.tenantConnection, {
      status,
      fulfillment_type: fulfillmentType,
      branch_id: branchId,
      search,
      start_date: startDate,
      end_date: endDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req.tenantConnection, id);
  }

  @Put(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.service.updateOrderStatus(
      req.tenantConnection,
      id,
      body.status,
      req.user?.sub,
    );
  }

  @Put(':id/cancel')
  async cancel(@Req() req: any, @Param('id') id: string) {
    return this.service.cancelOrder(req.tenantConnection, id);
  }
}
