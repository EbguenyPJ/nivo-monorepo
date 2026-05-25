import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Tenant-level Stripe service for B2C payments (orders & layaway installments).
 * Uses the platform's Stripe account in test mode.
 */
@Injectable()
export class StripeTenantService {
  private readonly logger = new Logger(StripeTenantService.name);
  private readonly stripe: Stripe;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY', '');
    this.isConfigured = !!secretKey && !secretKey.includes('your_stripe');
    this.stripe = new Stripe(secretKey || 'sk_test_placeholder', {
      apiVersion: '2025-02-24.acacia',
    });

    if (!this.isConfigured) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not configured — payments will use simulated mode',
      );
    }
  }

  /**
   * Create a PaymentIntent for a layaway installment.
   * Returns the client_secret so the mobile app can present Stripe PaymentSheet.
   */
  async createLayawayPaymentIntent(params: {
    amount: number;
    layaway_id: string;
    layaway_folio: string;
    customer_email?: string;
    customer_name?: string;
  }): Promise<{ client_secret: string; payment_intent_id: string }> {
    const amountCents = Math.round(params.amount * 100);

    if (amountCents < 1000) {
      throw new BadRequestException(
        'El monto minimo para pago con tarjeta es $10.00 MXN',
      );
    }

    if (!this.isConfigured) {
      // Simulated mode: return a fake client_secret for development
      const fakeId = `pi_sim_layaway_${Date.now()}`;
      this.logger.warn(`Simulated PaymentIntent: ${fakeId} for $${params.amount}`);
      return {
        client_secret: `${fakeId}_secret_simulated`,
        payment_intent_id: fakeId,
      };
    }

    try {
      const pi = await this.stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'mxn',
        metadata: {
          type: 'layaway_payment',
          layaway_id: params.layaway_id,
          layaway_folio: params.layaway_folio,
        },
        description: `Abono apartado ${params.layaway_folio}`,
        receipt_email: params.customer_email,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      });

      this.logger.log(
        `PaymentIntent ${pi.id} created for layaway ${params.layaway_folio}: $${params.amount} MXN`,
      );

      return {
        client_secret: pi.client_secret!,
        payment_intent_id: pi.id,
      };
    } catch (err: any) {
      this.logger.error(`Stripe PaymentIntent failed: ${err.message}`);
      throw new BadRequestException(
        'No se pudo inicializar el pago con tarjeta. Intenta de nuevo.',
      );
    }
  }

  /**
   * Create a PaymentIntent for an online order.
   */
  async createOrderPaymentIntent(params: {
    amount: number;
    order_id: string;
    order_folio: string;
    customer_email?: string;
    customer_name?: string;
  }): Promise<{ client_secret: string; payment_intent_id: string }> {
    const amountCents = Math.round(params.amount * 100);

    if (amountCents < 1000) {
      throw new BadRequestException(
        'El monto minimo para pago con tarjeta es $10.00 MXN',
      );
    }

    if (!this.isConfigured) {
      const fakeId = `pi_sim_order_${Date.now()}`;
      this.logger.warn(`Simulated PaymentIntent: ${fakeId} for $${params.amount}`);
      return {
        client_secret: `${fakeId}_secret_simulated`,
        payment_intent_id: fakeId,
      };
    }

    try {
      const pi = await this.stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'mxn',
        metadata: {
          type: 'order_payment',
          order_id: params.order_id,
          order_folio: params.order_folio,
        },
        description: `Pedido ${params.order_folio}`,
        receipt_email: params.customer_email,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      });

      this.logger.log(
        `PaymentIntent ${pi.id} created for order ${params.order_folio}: $${params.amount} MXN`,
      );

      return {
        client_secret: pi.client_secret!,
        payment_intent_id: pi.id,
      };
    } catch (err: any) {
      this.logger.error(`Stripe PaymentIntent failed: ${err.message}`);
      throw new BadRequestException(
        'No se pudo inicializar el pago con tarjeta. Intenta de nuevo.',
      );
    }
  }

  /**
   * Verify a PaymentIntent has succeeded (called after mobile app presents PaymentSheet).
   */
  async verifyPaymentIntent(paymentIntentId: string): Promise<{
    verified: boolean;
    amount: number;
    metadata: Record<string, string>;
  }> {
    if (!this.isConfigured || paymentIntentId.startsWith('pi_sim_')) {
      // Simulated mode: always succeed
      const amount = 0; // caller should use the original amount
      return { verified: true, amount, metadata: {} };
    }

    try {
      const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      if (pi.status === 'succeeded') {
        return {
          verified: true,
          amount: pi.amount / 100,
          metadata: (pi.metadata as Record<string, string>) ?? {},
        };
      }

      this.logger.warn(
        `PaymentIntent ${paymentIntentId} status is '${pi.status}', expected 'succeeded'`,
      );
      return { verified: false, amount: 0, metadata: {} };
    } catch (err: any) {
      this.logger.error(`Failed to verify PaymentIntent: ${err.message}`);
      return { verified: false, amount: 0, metadata: {} };
    }
  }
}
