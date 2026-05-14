import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '@nivo/database';
import { TenantDbModule } from '../../../core/database/tenant-db.module';
import { NibbitController } from './nibbit.controller';
import { NibbitService } from './nibbit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    TenantDbModule,
  ],
  controllers: [NibbitController],
  providers: [NibbitService],
})
export class NibbitModule {}
