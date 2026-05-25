import {
  Controller, Get, Post, Param, Body, Req, UseGuards,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LayawaysService } from './layaways.service';
import { StripeTenantService } from '../payments/stripe-tenant.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

/**
 * Customer-facing layaway endpoints for the mobile B2C app.
 * Scoped to the authenticated customer's layaways.
 */
@ApiTags('Mobile Layaways')
@Controller('mobile/layaways')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MobileLayawaysController {
  constructor(
    private readonly layawaysService: LayawaysService,
    private readonly stripeService: StripeTenantService,
  ) {}

  /** Transform raw layaway entity to the shape the mobile B2C app expects */
  private toDetail(layaway: any) {
    const firstItem = layaway.items?.[0];
    const firstImage =
      firstItem?.variant?.images?.[0] ??
      firstItem?.variant?.product?.images?.[0] ??
      firstItem?.variant?.product?.image_url ??
      null;
    return {
      id: layaway.id,
      folio: `APT-${String(layaway.folio_number ?? '').padStart(4, '0')}`,
      total_amount: Number(layaway.total_amount) || 0,
      balance_due: Number(layaway.balance_due) || 0,
      down_payment: Number(layaway.down_payment) || 0,
      status: layaway.status,
      due_date: layaway.due_date,
      item_count: layaway.items?.length ?? 0,
      branch_name: layaway.branch?.name ?? '',
      first_image_url: firstImage,
      first_product_name: firstItem?.variant?.product?.name ?? null,
      customer_id: layaway.customer_id,
      created_at: layaway.created_at,
      items: (layaway.items ?? []).map((item: any) => ({
        variant_id: item.variant_id,
        product_name: item.variant?.product?.name ?? 'Producto',
        sku: item.variant?.sku ?? '',
        attributes: item.variant?.attributes ?? {},
        image_url: item.variant?.images?.[0] ?? item.variant?.product?.images?.[0] ?? item.variant?.product?.image_url ?? null,
        quantity: item.quantity,
        unit_price: Number(item.unit_price) || 0,
        subtotal: Number(item.subtotal) || 0,
      })),
      payments: (layaway.payments ?? []).map((pmt: any) => ({
        id: pmt.id,
        amount: Number(pmt.amount) || 0,
        payment_method: pmt.payment_method ?? 'efectivo',
        created_at: pmt.created_at,
      })),
    };
  }

  private toSummary(layaway: any) {
    const firstItem = layaway.items?.[0];
    const firstImage =
      firstItem?.variant?.images?.[0] ??
      firstItem?.variant?.product?.images?.[0] ??
      firstItem?.variant?.product?.image_url ??
      null;
    return {
      id: layaway.id,
      folio: `APT-${String(layaway.folio_number ?? '').padStart(4, '0')}`,
      total_amount: Number(layaway.total_amount) || 0,
      balance_due: Number(layaway.balance_due) || 0,
      down_payment: Number(layaway.down_payment) || 0,
      status: layaway.status,
      due_date: layaway.due_date,
      item_count: layaway.items?.length ?? 0,
      branch_name: layaway.branch?.name ?? '',
      first_image_url: firstImage,
      first_product_name: firstItem?.variant?.product?.name ?? null,
      created_at: layaway.created_at,
    };
  }

  /** List the authenticated customer's layaways */
  @Get()
  async myLayaways(@Req() req: any) {
    const result = await this.layawaysService.findAll(req.tenantConnection!, {
      customer_id: req.user.customer_id,
      page: 1,
      limit: 50,
    });
    const rawItems = (result as any).items ?? [];
    const items = rawItems.map((l: any) => this.toSummary(l));
    return { items, total: items.length };
  }

  /** Get a single layaway detail (only if it belongs to the customer) */
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const layaway = await this.layawaysService.findOne(req.tenantConnection!, id);
    // Ensure the layaway belongs to the authenticated customer
    if (layaway.customer_id !== req.user.customer_id) {
      throw new ForbiddenException('No autorizado');
    }
    return this.toDetail(layaway);
  }

  /**
   * Step 1: Create a Stripe PaymentIntent for a layaway installment.
   * Returns { client_secret, payment_intent_id } so the mobile app
   * can present the Stripe PaymentSheet.
   */
  @Post('pay')
  async createPaymentIntent(@Req() req: any, @Body() body: any) {
    const { layaway_id, amount } = body;

    if (!layaway_id || !amount) {
      throw new BadRequestException('Se requiere layaway_id y amount');
    }

    // Verify ownership
    const layaway = await this.layawaysService.findOne(
      req.tenantConnection!,
      layaway_id,
    );
    if (layaway.customer_id !== req.user.customer_id) {
      throw new ForbiddenException('No autorizado');
    }
    if (layaway.status !== 'active') {
      throw new BadRequestException('Este apartado ya no acepta pagos');
    }

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      throw new BadRequestException('Monto invalido');
    }
    if (parsedAmount > Number(layaway.balance_due)) {
      throw new BadRequestException(
        `El monto ($${parsedAmount}) excede el saldo pendiente ($${layaway.balance_due})`,
      );
    }

    const folio = `APT-${String(layaway.folio_number ?? '').padStart(4, '0')}`;

    const result = await this.stripeService.createLayawayPaymentIntent({
      amount: parsedAmount,
      layaway_id,
      layaway_folio: folio,
      customer_email: req.user.email,
      customer_name: req.user.name,
    });

    return {
      client_secret: result.client_secret,
      payment_intent_id: result.payment_intent_id,
    };
  }

  /**
   * Step 2: Confirm a layaway payment after the mobile app has successfully
   * presented the PaymentSheet and the user has paid.
   * Records the payment in the DB.
   */
  @Post('confirm-payment')
  async confirmPayment(@Req() req: any, @Body() body: any) {
    const { layaway_id, payment_intent_id, amount } = body;

    if (!layaway_id || !payment_intent_id || !amount) {
      throw new BadRequestException(
        'Se requiere layaway_id, payment_intent_id y amount',
      );
    }

    // Verify ownership
    const layaway = await this.layawaysService.findOne(
      req.tenantConnection!,
      layaway_id,
    );
    if (layaway.customer_id !== req.user.customer_id) {
      throw new ForbiddenException('No autorizado');
    }

    // Verify the PaymentIntent succeeded with Stripe
    const verification = await this.stripeService.verifyPaymentIntent(
      payment_intent_id,
    );

    if (!verification.verified) {
      throw new BadRequestException(
        'El pago no fue verificado. Contacta soporte si se realizo el cargo.',
      );
    }

    // Record the payment in the database
    // employee_id is NOT NULL in layaway_payments, so use the layaway's original employee
    const parsedAmount = parseFloat(amount);
    const updatedLayaway = await this.layawaysService.makePayment(
      req.tenantConnection!,
      {
        layaway_id,
        amount: parsedAmount,
        payment_method: 'card',
        employee_id: layaway.employee_id,
        reference: payment_intent_id,
      },
    );

    return this.toDetail(updatedLayaway);
  }
}
