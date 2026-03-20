import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant, Subscription, PlanConfig } from '@nivo/database';
import { MasterReportsController } from './reports.controller';
import { MasterReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Subscription, PlanConfig])],
  controllers: [MasterReportsController],
  providers: [MasterReportsService],
})
export class MasterReportsModule {}
