import {
  Controller, Get, Post, Put, Param, Body, Query, Req, UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@Controller('api/v1/mobile/orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: any, @Body() body: any) {
    return this.service.createOrder(req.tenantConnection, req.user.customer_id, {
      fulfillment_type: body.fulfillment_type,
      pickup_branch_id: body.pickup_branch_id,
      shipping_address: body.shipping_address,
      stripe_payment_intent_id: body.stripe_payment_intent_id,
      items: body.items,
      notes: body.notes,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async myOrders(@Req() req: any) {
    return this.service.findByCustomer(req.tenantConnection, req.user.customer_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pending')
  async pending(@Req() req: any, @Query('branch_id') branchId?: string) {
    return this.service.getPendingOrders(req.tenantConnection, branchId ?? req.user.branch_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('delivery')
  async deliveryOrders(@Req() req: any, @Query('branch_id') branchId?: string) {
    return this.service.getDeliveryOrders(req.tenantConnection, branchId ?? req.user.branch_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req.tenantConnection, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/picking')
  async picking(@Req() req: any, @Param('id') id: string) {
    return this.service.getOrderForPicking(req.tenantConnection, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/verify-pick')
  async verifyPick(@Req() req: any, @Param('id') id: string, @Body() body: { barcode: string }) {
    return this.service.verifyPick(req.tenantConnection, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/mark-packed')
  async markPacked(@Req() req: any, @Param('id') id: string) {
    return this.service.markPacked(req.tenantConnection, id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/out-for-delivery')
  async outForDelivery(@Req() req: any, @Param('id') id: string) {
    return this.service.markOutForDelivery(req.tenantConnection, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/picked-up')
  async pickedUp(@Req() req: any, @Param('id') id: string) {
    return this.service.markPickedUp(req.tenantConnection, id);
  }
}
