import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationJobData } from '../interfaces/whatsapp-job.interface';
import { WhatsAppService } from '../services/whatsapp.service';
import { EmailNotificationService } from '../services/email.service';

export const NOTIFICATIONS_QUEUE = 'notifications-queue';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailNotificationService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { type, payload } = job.data;

    this.logger.log(
      `[Job Enqueued] Processing ${job.id} — type="${type}" attempt=${job.attemptsMade + 1}/${job.opts.attempts ?? 3}`,
    );

    switch (type) {
      case 'whatsapp':
        await this.whatsapp.sendTemplate(payload);
        break;

      case 'email':
        await this.email.send(payload);
        break;

      default:
        throw new Error(`Unknown notification type: ${(job.data as any).type}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>): void {
    const { type } = job.data;
    const target = type === 'whatsapp'
      ? (job.data.payload as any).to
      : (job.data.payload as any).to;

    this.logger.log(
      `[AUDIT] Job ${job.id} COMPLETED — type="${type}" to="${target}" duration=${Date.now() - job.timestamp}ms`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NotificationJobData>, error: Error): void {
    const { type } = job.data;
    this.logger.error(
      `[AUDIT] Job ${job.id} FAILED — type="${type}" attempt=${job.attemptsMade}/${job.opts.attempts ?? 3} error="${error.message}"`,
    );
  }
}
