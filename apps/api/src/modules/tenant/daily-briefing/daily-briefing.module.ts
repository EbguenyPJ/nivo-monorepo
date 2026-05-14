import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DailyBriefingService } from './daily-briefing.service';
import { DailyBriefingController } from './daily-briefing.controller';
import { DailyBriefingCron } from './daily-briefing.cron';
import { NivoMailerModule } from '../mailer/mailer.module';

@Module({
  imports: [ScheduleModule.forRoot(), NivoMailerModule],
  controllers: [DailyBriefingController],
  providers: [DailyBriefingService, DailyBriefingCron],
  exports: [DailyBriefingService],
})
export class DailyBriefingModule {}
