import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const QUEUE_NAMES = {
  TENANT_PROVISIONING: 'tenant-provisioning',
  LOW_STOCK_ALERTS: 'low-stock-alerts',
  REPORT_GENERATION: 'report-generation',
  INVOICE_GENERATION: 'invoice-generation',
  REPORTS_EXPORT: 'reports-export',
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.TENANT_PROVISIONING },
      { name: QUEUE_NAMES.LOW_STOCK_ALERTS },
      { name: QUEUE_NAMES.REPORT_GENERATION },
      { name: QUEUE_NAMES.INVOICE_GENERATION },
      { name: QUEUE_NAMES.REPORTS_EXPORT },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
