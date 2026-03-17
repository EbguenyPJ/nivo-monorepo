import { Module, Global } from '@nestjs/common';
import { TenantConnectionManager } from './tenant-connection.manager';

@Global()
@Module({
  providers: [TenantConnectionManager],
  exports: [TenantConnectionManager],
})
export class TenantDbModule {}
