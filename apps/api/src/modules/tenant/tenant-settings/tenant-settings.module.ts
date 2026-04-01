import { Module } from '@nestjs/common';
import { TenantSettingsService } from './tenant-settings.service';
import { TenantSettingsController } from './tenant-settings.controller';

@Module({
  providers: [TenantSettingsService],
  controllers: [TenantSettingsController],
  exports: [TenantSettingsService],
})
export class TenantSettingsModule {}
