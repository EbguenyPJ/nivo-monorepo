export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string; filename?: string };
  video?: { link: string };
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters: WhatsAppTemplateParameter[];
}

export interface WhatsAppJobData {
  to: string;
  templateName: string;
  language: string;
  components: WhatsAppTemplateComponent[];
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export type NotificationJobData =
  | { type: 'whatsapp'; payload: WhatsAppJobData }
  | { type: 'email'; payload: EmailJobData };

export interface MetaWhatsAppResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string; message_status?: string }[];
}

export interface MetaWhatsAppError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}
