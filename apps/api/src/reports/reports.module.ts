import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NivoNotificationsModule } from '../notifications/notifications.module';
import { ReportsController } from './reports.controller';
import { ReportsProcessor, REPORTS_QUEUE } from './processors/reports.processor';
import { PdfRendererService } from './services/pdf-renderer.service';
import { FileStorageService } from './services/file-storage.service';
import { ReportingGuard } from './guards/reporting.guard';

@Module({
  imports: [
    BullModule.registerQueue({
      name: REPORTS_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 86_400 },
      },
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '60s' },
      }),
    }),
    NivoNotificationsModule,
  ],
  controllers: [ReportsController],
  providers: [
    ReportsProcessor,
    PdfRendererService,
    FileStorageService,
    ReportingGuard,
  ],
  exports: [PdfRendererService, FileStorageService, ReportingGuard],
})
export class NivoReportsModule {}
