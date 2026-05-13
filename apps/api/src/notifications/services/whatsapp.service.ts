import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
  WhatsAppJobData,
  MetaWhatsAppResponse,
  MetaWhatsAppError,
} from '../interfaces/whatsapp-job.interface';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly testRecipient: string;
  private readonly isProduction: boolean;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.phoneNumberId =
      this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') ||
      this.config.get<string>('WHATSAPP_PHONE_ID', '');
    this.accessToken =
      this.config.get<string>('WHATSAPP_ACCESS_TOKEN') ||
      this.config.get<string>('WHATSAPP_TOKEN', '');
    this.baseUrl = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;
    this.testRecipient = this.config.get<string>('WHATSAPP_RECIPIENT_NUMBER', '+522228124824');
    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
  }

  async sendTemplate(job: WhatsAppJobData): Promise<MetaWhatsAppResponse> {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error(
        'WhatsApp credentials not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)',
      );
    }

    const recipient = this.resolveRecipient(job.to);

    const payload = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: job.templateName,
        language: { code: job.language },
        components: job.components,
      },
    };

    try {
      const { data } = await firstValueFrom(
        this.http.post<MetaWhatsAppResponse>(this.baseUrl, payload, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15_000,
        }),
      );

      this.logger.log(
        `WhatsApp template "${job.templateName}" sent to ${recipient} — message_id: ${data.messages?.[0]?.id}`,
      );

      return data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 0;
        const metaError = error.response?.data as MetaWhatsAppError | undefined;
        const errorMsg = metaError?.error?.message ?? error.message;
        const errorCode = metaError?.error?.code ?? 0;

        this.logger.error(
          `Meta API error [${status}] code=${errorCode}: ${errorMsg} — template="${job.templateName}" to=${recipient}`,
        );

        if (status === 429 || status >= 500) {
          throw new Error(`Meta API retryable error [${status}]: ${errorMsg}`);
        }

        throw new Error(`Meta API fatal error [${status}] code=${errorCode}: ${errorMsg}`);
      }

      throw error;
    }
  }

  async sendDocument(
    to: string,
    documentUrl: string,
    filename: string,
    caption: string,
  ): Promise<MetaWhatsAppResponse> {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WhatsApp credentials not configured');
    }

    const recipient = this.resolveRecipient(to);

    const payload = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'document',
      document: {
        link: documentUrl,
        caption,
        filename,
      },
    };

    const { data } = await firstValueFrom(
      this.http.post<MetaWhatsAppResponse>(this.baseUrl, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      }),
    );

    this.logger.log(`WhatsApp document "${filename}" sent to ${recipient} — message_id: ${data.messages?.[0]?.id}`);
    return data;
  }

  private resolveRecipient(to: string): string {
    const sanitized = to.replace(/\D/g, '');

    if (!this.isProduction) {
      const overridden = this.testRecipient.replace(/\D/g, '');
      this.logger.debug(`[DEV] Overriding recipient ${sanitized} → ${overridden}`);
      return overridden;
    }

    return sanitized;
  }
}
