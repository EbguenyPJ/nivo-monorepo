import { Module, Global } from '@nestjs/common';
import { StripeTenantService } from './stripe-tenant.service';

/**
 * Global module that provides Stripe tenant-level payment services.
 * Used by layaways, orders, and any other module that needs to create PaymentIntents.
 */
@Global()
@Module({
  providers: [StripeTenantService],
  exports: [StripeTenantService],
})
export class TenantPaymentsModule {}
