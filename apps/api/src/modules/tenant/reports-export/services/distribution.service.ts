import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

export interface DistributionPayload {
  channel: 'email' | 'whatsapp';
  recipient: string;           // email address or E.164 phone (+521234567890)
  subject?: string;            // for email
  message?: string;            // optional body text
  attachmentUrl: string;       // public or presigned URL to the file
  attachmentName: string;      // e.g. "reporte-ventas-2025.pdf"
  reportTitle: string;         // human-readable report name
  businessName: string;
}

@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  // WhatsApp Cloud API (Meta)
  private readonly waToken:   string;
  private readonly waPhoneId: string;

  // Resend (email)
  private readonly resendKey:  string;
  private readonly fromEmail:  string;

  constructor(private readonly config: ConfigService) {
    this.waToken   = config.get('WHATSAPP_TOKEN', '');
    this.waPhoneId = config.get('WHATSAPP_PHONE_ID', '');
    this.resendKey = config.get('RESEND_API_KEY', '');
    this.fromEmail = config.get('SMTP_FROM', 'reportes@nivo.app');
  }

  async send(payload: DistributionPayload): Promise<void> {
    if (payload.channel === 'email') {
      await this.sendEmail(payload);
    } else {
      await this.sendWhatsApp(payload);
    }
  }

  // ─── Email via Resend ────────────────────────────────────────────────────────

  private async sendEmail(p: DistributionPayload): Promise<void> {
    if (!this.resendKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping email send');
      return;
    }

    const subject = p.subject || `${p.reportTitle} — ${p.businessName}`;
    const body = {
      from: `${p.businessName} <${this.fromEmail}>`,
      to:   [p.recipient],
      subject,
      html: this.buildEmailHtml(p),
    };

    const response = await this.httpPost('https://api.resend.com/emails', body, {
      Authorization: `Bearer ${this.resendKey}`,
      'Content-Type': 'application/json',
    });

    this.logger.log(`Email sent to ${p.recipient}: ${JSON.stringify(response)}`);
  }

  private buildEmailHtml(p: DistributionPayload): string {
    const message = p.message
      ? `<p style="color:#374151;margin:16px 0;">${p.message}</p>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Inter,system-ui,sans-serif;background:#f4f4f5;padding:32px;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <h2 style="color:#18181b;margin:0 0 8px;">${p.reportTitle}</h2>
          <p style="color:#71717a;margin:0 0 24px;font-size:14px;">${p.businessName}</p>
          ${message}
          <a
            href="${p.attachmentUrl}"
            style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;"
          >
            ⬇️ Descargar ${p.attachmentName}
          </a>
          <p style="color:#a1a1aa;font-size:11px;margin-top:32px;">
            Este enlace expira en 24 horas. Generado con Nivo POS.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  // ─── WhatsApp via Meta Cloud API ─────────────────────────────────────────────

  private async sendWhatsApp(p: DistributionPayload): Promise<void> {
    if (!this.waToken || !this.waPhoneId) {
      this.logger.warn('WHATSAPP_TOKEN / WHATSAPP_PHONE_ID not configured — skipping WhatsApp send');
      return;
    }

    // WhatsApp requires a public URL for document messages
    const body = {
      messaging_product: 'whatsapp',
      to: p.recipient.replace(/\s/g, ''),
      type: 'document',
      document: {
        link: p.attachmentUrl,
        caption: p.message || `${p.reportTitle} — ${p.businessName}`,
        filename: p.attachmentName,
      },
    };

    const response = await this.httpPost(
      `https://graph.facebook.com/v19.0/${this.waPhoneId}/messages`,
      body,
      {
        Authorization: `Bearer ${this.waToken}`,
        'Content-Type': 'application/json',
      },
    );

    this.logger.log(`WhatsApp sent to ${p.recipient}: ${JSON.stringify(response)}`);
  }

  // ─── Minimal HTTP helper (avoids heavy axios dep) ────────────────────────────

  private httpPost(url: string, body: object, headers: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const parsed = new URL(url);
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(data) },
      };
      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}
