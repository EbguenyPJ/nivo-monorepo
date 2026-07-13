import { Module } from '@nestjs/common';
import { TenantUploadsController } from './uploads.controller';

@Module({
  controllers: [TenantUploadsController],
})
export class TenantUploadsModule {}
