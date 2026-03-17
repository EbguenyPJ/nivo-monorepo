import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MasterDbModule } from './core/database/master-db.module';
import { TenantDbModule } from './core/database/tenant-db.module';
import { AuthModule } from './core/auth/auth.module';
import { QueueModule } from './core/queue/queue.module';
import { TenantConnectionMiddleware } from './core/database/tenant-connection.middleware';
import { TenantsModule } from './modules/master/tenants/tenants.module';
import { SubscriptionsModule } from './modules/master/subscriptions/subscriptions.module';
import { StripeWebhooksModule } from './modules/master/stripe-webhooks/stripe-webhooks.module';
import { SuperAdminModule } from './modules/master/super-admin/super-admin.module';
import { InventoryModule } from './modules/tenant/inventory/inventory.module';
import { PosModule } from './modules/tenant/pos/pos.module';
import { EmployeesModule } from './modules/tenant/employees/employees.module';
import { CustomersModule } from './modules/tenant/customers/customers.module';
import { ChatModule } from './modules/tenant/chat/chat.module';
import { JobsModule } from './modules/tenant/jobs/jobs.module';
import { ReportsModule } from './modules/tenant/reports/reports.module';
import { BranchesModule } from './modules/tenant/branches/branches.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    MasterDbModule,
    TenantDbModule,
    AuthModule,
    QueueModule,
    // Master modules
    TenantsModule,
    SubscriptionsModule,
    StripeWebhooksModule,
    SuperAdminModule,
    // Tenant modules
    InventoryModule,
    PosModule,
    EmployeesModule,
    CustomersModule,
    ChatModule,
    JobsModule,
    ReportsModule,
    BranchesModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantConnectionMiddleware)
      .exclude('api/v1/auth/(.*)', 'api/v1/tenants/(.*)', 'api/v1/webhooks/(.*)', 'api/v1/health', 'api/docs(.*)')
      .forRoutes('*');
  }
}
