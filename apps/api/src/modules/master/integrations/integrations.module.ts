import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Integration } from '@nivo/database';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Integration])],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}
