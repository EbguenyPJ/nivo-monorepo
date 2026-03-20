import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant, Subscription } from '@nivo/database';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Subscription]),
    NotificationsModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
