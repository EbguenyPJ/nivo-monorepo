import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { EmailJobData } from '../interfaces/whatsapp-job.interface';

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private readonly isProduction: boolean;
  private readonly testRecipient: string;

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {
    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
    this.testRecipient = this.config.get<string>('MAIL_USER', 'nivo.demo2@gmail.com');
  }

  async send(job: EmailJobData): Promise<{ messageId: string }> {
    const recipient = this.resolveRecipient(job.to);

    const attachments = (job.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: a.content,
      path: a.path,
      contentType: a.contentType,
    }));

    const result = await this.mailer.sendMail({
      to: recipient,
      subject: job.subject,
      html: job.html,
      text: job.text,
      attachments,
    });

    this.logger.log(`Email sent to ${recipient} — messageId: ${result.messageId} subject="${job.subject}"`);
    return { messageId: result.messageId };
  }

  async sendWithAttachmentUrl(
    to: string,
    subject: string,
    html: string,
    attachmentUrl: string,
    attachmentName: string,
  ): Promise<{ messageId: string }> {
    return this.send({
      to,
      subject,
      html,
      attachments: [{ filename: attachmentName, path: attachmentUrl }],
    });
  }

  private resolveRecipient(to: string): string {
    if (!this.isProduction) {
      this.logger.debug(`[DEV] Overriding email recipient ${to} → ${this.testRecipient}`);
      return this.testRecipient;
    }
    return to;
  }
}
