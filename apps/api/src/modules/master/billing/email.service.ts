import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Send an invoice-error notification to the tenant admin.
   * Uses SendGrid REST API if SENDGRID_API_KEY is set,
   * otherwise logs the email content (dev mode).
   */
  async sendInvoiceError(params: {
    to: string;
    tenantName: string;
    invoiceId: string;
    invoiceDescription: string;
    errorMessage: string;
    retryUrl: string;
  }): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM', 'facturacion@nivo.com');
    const apiKey = this.config.get<string>('SENDGRID_API_KEY', '');

    const subject = `⚠️ Error al generar tu factura de Nivo`;
    const html = this.buildErrorEmailHtml(params);
    const text = this.buildErrorEmailText(params);

    if (apiKey) {
      await this.sendViaSendGrid({ apiKey, from, to: params.to, subject, html, text });
    } else {
      this.logger.warn(
        `[EMAIL - no provider configured] To: ${params.to} | Subject: ${subject}\n${text}`,
      );
    }
  }

  /**
   * Send an invoice-ready notification with download links.
   */
  async sendInvoiceReady(params: {
    to: string;
    tenantName: string;
    invoiceDescription: string;
    satUuid: string;
    xmlUrl: string;
    pdfUrl: string;
  }): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM', 'facturacion@nivo.com');
    const apiKey = this.config.get<string>('SENDGRID_API_KEY', '');

    const subject = `✅ Tu factura de Nivo está lista`;
    const html = this.buildReadyEmailHtml(params);
    const text = this.buildReadyEmailText(params);

    if (apiKey) {
      await this.sendViaSendGrid({ apiKey, from, to: params.to, subject, html, text });
    } else {
      this.logger.log(
        `[EMAIL - no provider configured] To: ${params.to} | Subject: ${subject}\n${text}`,
      );
    }
  }

  // ─── SendGrid REST ────────────────────────────────────────────────────────

  private async sendViaSendGrid(params: {
    apiKey: string;
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    const body = {
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.from, name: 'Nivo Facturación' },
      subject: params.subject,
      content: [
        { type: 'text/plain', value: params.text },
        { type: 'text/html', value: params.html },
      ],
    };

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`SendGrid error (${res.status}): ${err}`);
      } else {
        this.logger.log(`Email sent to ${params.to}: ${params.subject}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send email via SendGrid: ${err}`);
    }
  }

  // ─── Email templates ──────────────────────────────────────────────────────

  private buildErrorEmailHtml(p: {
    tenantName: string;
    invoiceDescription: string;
    errorMessage: string;
    retryUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
    <h2 style="margin: 0 0 8px; color: #92400e;">⚠️ Error al generar tu factura de Nivo</h2>
    <p style="margin: 0; color: #78350f; font-size: 14px;">Hola <strong>${p.tenantName}</strong>, tuvimos un problema al timbrar tu recibo.</p>
  </div>

  <p><strong>Concepto:</strong> ${p.invoiceDescription}</p>

  <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
    <p style="margin: 0; font-size: 13px; color: #991b1b;"><strong>Motivo del error:</strong></p>
    <p style="margin: 8px 0 0; font-size: 13px; color: #7f1d1d;">${p.errorMessage}</p>
  </div>

  <p style="font-size: 14px; color: #4b5563;">
    Tu pago está completamente seguro. Sin embargo, el CFDI 4.0 requiere que los datos fiscales
    coincidan exactamente con tu Constancia de Situación Fiscal del SAT.
  </p>

  <p style="font-size: 14px; color: #4b5563;">
    Por favor, entra a Nivo, verifica tus datos fiscales en <strong>Mi Suscripción → Datos de Facturación</strong>
    y usa el botón de reintento.
  </p>

  <a href="${p.retryUrl}"
     style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
    🔄 Ir a reintentar facturación
  </a>

  <p style="margin-top: 32px; font-size: 12px; color: #9ca3af;">
    Nivo · Soporte: soporte@nivo.com
  </p>
</body>
</html>`;
  }

  private buildErrorEmailText(p: {
    tenantName: string;
    invoiceDescription: string;
    errorMessage: string;
    retryUrl: string;
  }): string {
    return [
      `Hola ${p.tenantName},`,
      ``,
      `Tuvimos un problema al generar tu factura de Nivo.`,
      `Concepto: ${p.invoiceDescription}`,
      `Motivo: ${p.errorMessage}`,
      ``,
      `Tu pago está seguro. Por favor, corrige tus datos fiscales en Mi Suscripción → Datos de Facturación y reintenta.`,
      ``,
      `Reintento: ${p.retryUrl}`,
      ``,
      `— Equipo Nivo`,
    ].join('\n');
  }

  private buildReadyEmailHtml(p: {
    tenantName: string;
    invoiceDescription: string;
    satUuid: string;
    xmlUrl: string;
    pdfUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
    <h2 style="margin: 0 0 8px; color: #065f46;">✅ Tu factura de Nivo está lista</h2>
    <p style="margin: 0; color: #047857; font-size: 14px;">Hola <strong>${p.tenantName}</strong>, tu CFDI ha sido timbrado correctamente.</p>
  </div>

  <p><strong>Concepto:</strong> ${p.invoiceDescription}</p>
  <p><strong>Folio Fiscal (UUID):</strong> <code style="font-size: 13px;">${p.satUuid}</code></p>

  <div style="display: flex; gap: 12px; margin-top: 16px;">
    <a href="${p.pdfUrl}" style="display: inline-block; background: #ef4444; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
      📄 Descargar PDF
    </a>
    <a href="${p.xmlUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
      📋 Descargar XML
    </a>
  </div>

  <p style="margin-top: 32px; font-size: 12px; color: #9ca3af;">
    Nivo · Soporte: soporte@nivo.com
  </p>
</body>
</html>`;
  }

  private buildReadyEmailText(p: {
    tenantName: string;
    invoiceDescription: string;
    satUuid: string;
    xmlUrl: string;
    pdfUrl: string;
  }): string {
    return [
      `Hola ${p.tenantName},`,
      ``,
      `Tu CFDI ha sido timbrado correctamente.`,
      `Concepto: ${p.invoiceDescription}`,
      `UUID SAT: ${p.satUuid}`,
      ``,
      `PDF: ${p.pdfUrl}`,
      `XML: ${p.xmlUrl}`,
      ``,
      `— Equipo Nivo`,
    ].join('\n');
  }
}
