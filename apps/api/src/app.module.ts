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
import { NotificationsModule } from './modules/master/notifications/notifications.module';
import { MasterReportsModule } from './modules/master/reports/reports.module';
import { SettingsModule } from './modules/master/settings/settings.module';
import { IntegrationsModule } from './modules/master/integrations/integrations.module';
import { SupportModule } from './modules/master/support/support.module';
import { InventoryModule } from './modules/tenant/inventory/inventory.module';
import { PosModule } from './modules/tenant/pos/pos.module';
import { EmployeesModule } from './modules/tenant/employees/employees.module';
import { CustomersModule } from './modules/tenant/customers/customers.module';
import { ChatModule } from './modules/tenant/chat/chat.module';
import { JobsModule } from './modules/tenant/jobs/jobs.module';
import { ReportsModule } from './modules/tenant/reports/reports.module';
import { BranchesModule } from './modules/tenant/branches/branches.module';
import { CatalogsModule } from './modules/tenant/catalogs/catalogs.module';
import { BrandsModule } from './modules/tenant/brands/brands.module';
import { CollectionsModule } from './modules/tenant/collections/collections.module';
import { TenantUploadsModule } from './modules/tenant/uploads/uploads.module';
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
    NotificationsModule,
    MasterReportsModule,
    SettingsModule,
    IntegrationsModule,
    SupportModule,
    // Tenant modules
    InventoryModule,
    PosModule,
    EmployeesModule,
    CustomersModule,
    ChatModule,
    JobsModule,
    ReportsModule,
    BranchesModule,
    CatalogsModule,
    BrandsModule,
    CollectionsModule,
    TenantUploadsModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantConnectionMiddleware)
      .exclude('api/v1/auth/(.*)', 'api/v1/tenants/(.*)', 'api/v1/notifications/(.*)', 'api/v1/webhooks/(.*)', 'api/v1/reports/(.*)', 'api/v1/settings/(.*)', 'api/v1/integrations/(.*)', 'api/v1/support/(.*)', 'api/v1/health', 'api/docs(.*)')
      .forRoutes('*');
  }
}
