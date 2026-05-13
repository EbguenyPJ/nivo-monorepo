import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TenantBillingProfile, BillingInvoice, Tenant } from '@nivo/database';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { InvoiceGeneratorWorker } from './invoice-generator.worker';
import { PacService } from './pac.service';
import { StorageService } from './storage.service';
import { EmailService } from './email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantBillingProfile, BillingInvoice, Tenant]),
    BullModule.registerQueue({ name: QUEUE_NAMES.INVOICE_GENERATION }),
  ],
  controllers: [BillingController],
  providers: [
    BillingService,
    InvoiceGeneratorWorker,
    PacService,
    StorageService,
    EmailService,
  ],
  exports: [BillingService],
})
export class BillingModule {}
