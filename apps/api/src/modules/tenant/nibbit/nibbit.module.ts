import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Tenant } from '@nivo/database';
import { TenantDbModule } from '../../../core/database/tenant-db.module';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';
import { RequisitionsModule } from '../requisitions/requisitions.module';
import { ReportsExportModule } from '../reports-export/reports-export.module';
import { NivoMailerModule } from '../mailer/mailer.module';
import { NibbitController } from './nibbit.controller';
import { NibbitService } from './nibbit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    TenantDbModule,
    RequisitionsModule,
    ReportsExportModule,
    NivoMailerModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  controllers: [NibbitController],
  providers: [NibbitService],
})
export class NibbitModule {}
