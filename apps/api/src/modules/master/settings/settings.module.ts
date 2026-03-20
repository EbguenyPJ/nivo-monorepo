import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanConfig, SystemSetting } from '@nivo/database';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanConfig, SystemSetting])],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
