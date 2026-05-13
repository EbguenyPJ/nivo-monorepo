import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';

@Processor(QUEUE_NAMES.BILLING_TASKS)
export class BillingTasksWorker extends WorkerHost {
  private readonly logger = new Logger(BillingTasksWorker.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    super();
    const host = this.config.get('MAIL_HOST') || this.config.get('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get('MAIL_PORT') || this.config.get('SMTP_PORT', 587),
        secure: false,
        auth: {
          user: this.config.get('MAIL_USER') || this.config.get('SMTP_USER'),
          pass: this.config.get('MAIL_PASS') || this.config.get('SMTP_PASS'),
        },
      });
    }
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'payment-notification':
        await this.handlePaymentNotification(job.data);
        break;
      case 'generate-invoice':
        await this.handleGenerateInvoice(job.data);
        break;
      default:
        this.logger.warn(`Unknown billing task: ${job.name}`);
    }
  }

  private async handlePaymentNotification(data: {
    tenantId: string;
    invoiceId: string;
    email: string;
    amount: number;
    description: string;
  }) {
    const from = this.config.get('MAIL_FROM') || this.config.get('SMTP_FROM', 'Nivo <noreply@nivo.mx>');

    if (!this.transporter) {
      this.logger.warn(`[BILLING] SMTP not configured — would send to ${data.email}: ${data.description} ($${data.amount})`);
      return;
    }

    await this.transporter.sendMail({
      from,
      to: data.email,
      subject: `Pago recibido — ${data.description}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 8px; color: #065f46;">Pago recibido exitosamente</h2>
          </div>
          <p><strong>Concepto:</strong> ${data.description}</p>
          <p><strong>Monto:</strong> $${data.amount.toFixed(2)} MXN</p>
          <p style="color: #6b7280; font-size: 14px;">
            Tu factura se generará automáticamente y recibirás un correo con los archivos XML y PDF.
          </p>
          <p style="margin-top: 32px; font-size: 12px; color: #9ca3af;">Nivo — Sistema POS</p>
        </div>
      `,
    });

    this.logger.log(`Payment notification sent to ${data.email}`);
  }

  private async handleGenerateInvoice(data: {
    tenantId: string;
    amount: number;
    email: string;
  }) {
    this.logger.log(`Generate invoice task for tenant ${data.tenantId}, amount: $${data.amount}, email: ${data.email}`);
  }
}
