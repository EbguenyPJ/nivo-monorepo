import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Tenant,
  Subscription,
  SuperAdmin,
  Notification,
  PlanConfig,
  SystemSetting,
  Integration,
  SupportTicket,
  TicketMessage,
  TicketAttachment,
  TenantBillingProfile,
  BillingInvoice,
} from '@nivo/database';

const masterEntities = [
  Tenant,
  Subscription,
  SuperAdmin,
  Notification,
  PlanConfig,
  SystemSetting,
  Integration,
  SupportTicket,
  TicketMessage,
  TicketAttachment,
  TenantBillingProfile,
  BillingInvoice,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('MASTER_DB_HOST', 'localhost'),
        port: config.get<number>('MASTER_DB_PORT', 5432),
        username: config.get('MASTER_DB_USERNAME', 'nivo_admin'),
        password: config.get('MASTER_DB_PASSWORD', 'nivo_secret_2024'),
        database: config.get('MASTER_DB_NAME', 'nivo_master_db'),
        entities: masterEntities,
        synchronize: config.get('NODE_ENV') === 'development',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature(masterEntities),
  ],
  exports: [TypeOrmModule],
})
export class MasterDbModule {}
