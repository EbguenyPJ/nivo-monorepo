import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { ReportsExportController } from './reports-export.controller';
import { ReportsExportWorker } from './reports-export.worker';
import { ReportsGateway } from './reports.gateway';
import { ExcelBuilderService } from './services/excel-builder.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { S3Service } from './services/s3.service';
import { DistributionService } from './services/distribution.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.REPORTS_EXPORT }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '30s' },
      }),
    }),
    TenantSettingsModule,
  ],
  controllers: [ReportsExportController],
  providers: [
    ReportsExportWorker,
    ReportsGateway,
    ExcelBuilderService,
    PdfGeneratorService,
    S3Service,
    DistributionService,
  ],
  exports: [ReportsGateway, S3Service, PdfGeneratorService],
})
export class ReportsExportModule {}
