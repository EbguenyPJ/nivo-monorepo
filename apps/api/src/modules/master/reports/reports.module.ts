import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant, Subscription } from '@nivo/database';
import { MasterReportsController } from './reports.controller';
import { MasterReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Subscription])],
  controllers: [MasterReportsController],
  providers: [MasterReportsService],
})
export class MasterReportsModule {}
