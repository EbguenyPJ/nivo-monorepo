import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class NivoMailerService {
  private readonly logger = new Logger(NivoMailerService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get('SMTP_PORT', 587),
        secure: this.config.get('SMTP_SECURE', 'false') === 'true',
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
    }
  }

  async send(opts: MailOptions) {
    if (!this.transporter) {
      this.logger.warn('SMTP not configured, skipping email send');
      return { skipped: true };
    }

    const from = this.config.get('SMTP_FROM', 'Nivo <noreply@nivo.mx>');

    const result = await this.transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    this.logger.log(`Email sent to ${opts.to}: ${result.messageId}`);
    return { messageId: result.messageId };
  }

  async sendOrderConfirmation(email: string, orderFolio: string, total: number, items: { name: string; qty: number; price: number }[]) {
    const itemRows = items.map((i) =>
      `<tr><td>${i.name}</td><td>${i.qty}</td><td>$${i.price.toFixed(2)}</td></tr>`,
    ).join('');

    return this.send({
      to: email,
      subject: `Confirmación de pedido ${orderFolio}`,
      html: `
        <h2>¡Gracias por tu pedido!</h2>
        <p>Tu pedido <strong>${orderFolio}</strong> ha sido confirmado.</p>
        <table border="1" cellpadding="8" cellspacing="0">
          <tr><th>Producto</th><th>Cant.</th><th>Precio</th></tr>
          ${itemRows}
        </table>
        <p><strong>Total: $${total.toFixed(2)}</strong></p>
      `,
    });
  }

  async sendLayawayReminder(email: string, customerName: string, balance: number, dueDate: string) {
    return this.send({
      to: email,
      subject: 'Recordatorio de apartado - Nivo',
      html: `
        <h2>Hola ${customerName},</h2>
        <p>Te recordamos que tienes un saldo pendiente de <strong>$${balance.toFixed(2)}</strong> en tu apartado.</p>
        <p>Fecha límite: <strong>${dueDate}</strong></p>
        <p>Puedes realizar tu abono desde la app o visitando tu sucursal.</p>
      `,
    });
  }

  async sendReadyForPickup(email: string, orderFolio: string, branchName: string, branchAddress: string) {
    return this.send({
      to: email,
      subject: `Tu pedido ${orderFolio} está listo para recoger`,
      html: `
        <h2>¡Tu pedido está listo!</h2>
        <p>El pedido <strong>${orderFolio}</strong> está listo para recoger en:</p>
        <p><strong>${branchName}</strong><br>${branchAddress}</p>
        <p>Presenta tu QR de la app al llegar a la tienda.</p>
      `,
    });
  }
}
