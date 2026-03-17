import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'report-generation' })],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
