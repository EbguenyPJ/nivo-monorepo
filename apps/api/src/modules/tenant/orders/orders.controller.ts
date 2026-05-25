import {
  Controller, Get, Post, Put, Param, Body, Query, Req, UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Order } from '@nivo/database';
import { OrdersService } from './orders.service';
import { StripeTenantService } from '../payments/stripe-tenant.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@Controller('mobile/orders')
export class OrdersController {
  constructor(
    private readonly service: OrdersService,
    private readonly stripeService: StripeTenantService,
  ) {}

  /** Transform raw order entity to the shape the mobile B2C app expects */
  private toSummary(order: any) {
    const firstItem = order.items?.[0];
    const firstImage =
      firstItem?.variant?.images?.[0] ??
      firstItem?.variant?.product?.images?.[0] ??
      firstItem?.variant?.product?.image_url ??
      null;
    return {
      id: order.id,
      order_number: order.order_number,
      folio: `ORD-${String(order.order_number ?? '').padStart(4, '0')}`,
      status: order.status,
      fulfillment_type: order.fulfillment_type,
      total_amount: order.total_amount,
      item_count: order.items?.length ?? 0,
      first_image_url: firstImage,
      first_product_name: firstItem?.variant?.product?.name ?? null,
      created_at: order.created_at,
    };
  }

  private toDetail(order: any) {
    return {
      ...this.toSummary(order),
      items: (order.items ?? []).map((item: any) => ({
        variant_id: item.variant_id,
        product_name: item.variant?.product?.name ?? 'Producto',
        sku: item.variant?.sku ?? '',
        attributes: item.variant?.attributes ?? {},
        image_url: item.variant?.images?.[0] ?? item.variant?.product?.images?.[0] ?? null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      })),
      pickup_branch_name: order.pickup_branch?.name ?? null,
      shipping_address: order.shipping_address ?? null,
      paid_at: order.paid_at,
      completed_at: order.completed_at,
    };
  }

  /**
   * Create an order and a Stripe PaymentIntent.
   * Returns the order + client_secret so the mobile app can present PaymentSheet.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: any, @Body() body: any) {
    // 1. Create the order as pending_payment
    const order = await this.service.createOrder(
      req.tenantConnection,
      req.user.customer_id,
      {
        fulfillment_type: body.fulfillment_type,
        pickup_branch_id: body.pickup_branch_id,
        shipping_address: body.shipping_address,
        items: body.items,
        notes: body.notes,
        // Don't pass stripe_payment_intent_id yet — it's pending
      },
    );

    const totalAmount = Number(order.total_amount) || 0;
    const folio = `ORD-${String(order.order_number ?? '').padStart(4, '0')}`;

    // 2. Create a Stripe PaymentIntent
    const pi = await this.stripeService.createOrderPaymentIntent({
      amount: totalAmount,
      order_id: order.id,
      order_folio: folio,
      customer_email: req.user.email,
      customer_name: req.user.name,
    });

    return {
      id: order.id,
      client_secret: pi.client_secret,
      payment_intent_id: pi.payment_intent_id,
    };
  }

  /**
   * Confirm an order payment after the mobile app has presented
   * the PaymentSheet and the user has paid.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/confirm-payment')
  async confirmPayment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const { payment_intent_id } = body;

    if (!payment_intent_id) {
      throw new BadRequestException('Se requiere payment_intent_id');
    }

    const order = await this.service.findOne(req.tenantConnection, id);

    // Verify ownership
    if (order.customer_id !== req.user.customer_id) {
      throw new BadRequestException('No autorizado');
    }

    // Verify with Stripe
    const verification = await this.stripeService.verifyPaymentIntent(
      payment_intent_id,
    );

    if (!verification.verified) {
      throw new BadRequestException(
        'El pago no fue verificado. Contacta soporte si se realizo el cargo.',
      );
    }

    // Update order to paid status (no employeeId — this is a customer self-service payment)
    await this.service.updateOrderStatus(
      req.tenantConnection,
      id,
      'paid',
    );

    // Update stripe_payment_intent_id on the order
    await req.tenantConnection!
      .getRepository(Order)
      .update(id, {
        stripe_payment_intent_id: payment_intent_id,
        paid_at: new Date(),
      });

    return this.toDetail(await this.service.findOne(req.tenantConnection, id));
  }

  /** GET /mobile/orders — returns { items, total } for the mobile B2C app */
  @UseGuards(JwtAuthGuard)
  @Get()
  async myOrdersRoot(@Req() req: any) {
    const raw = await this.service.findByCustomer(req.tenantConnection, req.user.customer_id);
    const items = raw.map((o: any) => this.toSummary(o));
    return { items, total: items.length };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async myOrders(@Req() req: any) {
    const raw = await this.service.findByCustomer(req.tenantConnection, req.user.customer_id);
    const items = raw.map((o: any) => this.toSummary(o));
    return { items, total: items.length };
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
  @Get('pickup')
  async pickupOrders(@Req() req: any, @Query('branch_id') branchId?: string) {
    return this.service.getPickupOrders(req.tenantConnection, branchId ?? req.user.branch_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pickup/:id/scan')
  async scanPickupQR(@Req() req: any, @Param('id') id: string) {
    return this.service.getPickupByQR(req.tenantConnection, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('pickup/:id/confirm')
  async confirmPickup(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { signature_url: string; recipient_name: string },
  ) {
    return this.service.confirmPickupWithSignature(
      req.tenantConnection, id, body, req.user.sub,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const order = await this.service.findOne(req.tenantConnection, id);
    return this.toDetail(order);
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
