import { Module } from '@nestjs/common';
import { TenantIntegrationsController } from './tenant-integrations.controller';
import { TenantIntegrationsService } from './tenant-integrations.service';
import { EncryptionService } from '../../../core/crypto/encryption.service';

@Module({
  controllers: [TenantIntegrationsController],
  providers: [TenantIntegrationsService, EncryptionService],
  exports: [TenantIntegrationsService, EncryptionService],
})
export class TenantIntegrationsModule {}
