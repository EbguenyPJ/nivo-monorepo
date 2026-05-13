import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './services/whatsapp.service';
import { EmailNotificationService } from './services/email.service';
import { NotificationsProcessor, NOTIFICATIONS_QUEUE } from './processors/notifications.processor';

@Module({
  imports: [
    HttpModule.register({ timeout: 15_000 }),
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get('MAIL_HOST', config.get('SMTP_HOST', 'smtp.gmail.com')),
          port: Number(config.get('MAIL_PORT', config.get('SMTP_PORT', 587))),
          secure: false,
          auth: {
            user: config.get('MAIL_USER', config.get('SMTP_USER', '')),
            pass: config.get('MAIL_PASS', config.get('SMTP_PASS', '')),
          },
        },
        defaults: {
          from: config.get(
            'MAIL_FROM',
            config.get('SMTP_FROM', '"Nivo Demo" <nivo.demo2@gmail.com>'),
          ),
        },
      }),
    }),
  ],
  providers: [WhatsAppService, EmailNotificationService, NotificationsProcessor],
  exports: [WhatsAppService, EmailNotificationService, BullModule],
})
export class NivoNotificationsModule {}
