import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Tenant } from '@nivo/database';
import { TenantDbModule } from '../../../core/database/tenant-db.module';
import { DailyBriefingService } from './daily-briefing.service';
import { DailyBriefingController } from './daily-briefing.controller';
import { DailyBriefingCron } from './daily-briefing.cron';
import { NivoMailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Tenant]),
    TenantDbModule,
    NivoMailerModule,
  ],
  controllers: [DailyBriefingController],
  providers: [DailyBriefingService, DailyBriefingCron],
  exports: [DailyBriefingService],
})
export class DailyBriefingModule {}
