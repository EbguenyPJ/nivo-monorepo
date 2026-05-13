import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { TenantSettingsModule } from './modules/tenant/tenant-settings/tenant-settings.module';
import { PricingModule } from './modules/tenant/pricing/pricing.module';
import { StorageLocationsModule } from './modules/tenant/storage-locations/storage-locations.module';
import { PurchasingModule } from './modules/tenant/purchasing/purchasing.module';
import { AuditsModule } from './modules/tenant/audits/audits.module';
import { LoyaltyModule } from './modules/tenant/loyalty/loyalty.module';
import { LayawaysModule } from './modules/tenant/layaways/layaways.module';
import { CreditAccountsModule } from './modules/tenant/credit-accounts/credit-accounts.module';
import { DashboardModule } from './modules/tenant/dashboard/dashboard.module';
import { ExpensesModule } from './modules/tenant/expenses/expenses.module';
import { TenantIntegrationsModule } from './modules/tenant/tenant-integrations/tenant-integrations.module';
import { RequisitionsModule } from './modules/tenant/requisitions/requisitions.module';
import { BillingModule } from './modules/master/billing/billing.module';
import { ReportsExportModule } from './modules/tenant/reports-export/reports-export.module';
import { MobileCatalogModule } from './modules/tenant/mobile-catalog/mobile-catalog.module';
import { MobileAuthModule } from './modules/tenant/mobile-auth/mobile-auth.module';
import { MobileOrdersModule } from './modules/tenant/orders/orders.module';
import { PreSalesModule } from './modules/tenant/pre-sales/pre-sales.module';
import { DeliveryModule } from './modules/tenant/delivery/delivery.module';
import { NivoNotificationsModule } from './notifications/notifications.module';
import { NivoReportsModule } from './reports/reports.module';
import { NivoMailerModule } from './modules/tenant/mailer/mailer.module';
import { LogisticsModule } from './modules/tenant/logistics/logistics.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
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
    BillingModule,
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
    TenantSettingsModule,
    PricingModule,
    StorageLocationsModule,
    PurchasingModule,
    AuditsModule,
    LoyaltyModule,
    LayawaysModule,
    CreditAccountsModule,
    DashboardModule,
    ExpensesModule,
    TenantIntegrationsModule,
    RequisitionsModule,
    ReportsExportModule,
    // Mobile modules
    MobileCatalogModule,
    MobileAuthModule,
    MobileOrdersModule,
    PreSalesModule,
    DeliveryModule,
    NivoNotificationsModule,
    NivoReportsModule,
    NivoMailerModule,
    LogisticsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantConnectionMiddleware)
      .exclude('api/v1/auth/(.*)', 'api/v1/tenants/(.*)', 'api/v1/notifications/(.*)', 'api/v1/webhooks/(.*)', 'api/v1/reports/(.*)', 'api/v1/settings/(.*)', 'api/v1/integrations/(.*)', 'api/v1/support/(.*)', 'api/v1/tenant-support/(.*)', 'api/v1/tenant-subscription/(.*)', 'api/v1/billing/(.*)', 'api/v1/health', 'api/docs(.*)', 'api/v1/reports/export/status/(.*)')
      .forRoutes('*');
  }
}
