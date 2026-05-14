import pg from 'pg';
import { upsert } from '../../db/connection.js';

export async function seedIntegrations(pool: pg.Pool): Promise<void> {
  const integrations = [
    { type: 'stripe', display_name: 'Stripe Payments', is_enabled: true, status: 'active' },
    { type: 'email', display_name: 'Email (SMTP)', is_enabled: true, status: 'active' },
    { type: 'whatsapp', display_name: 'WhatsApp Business', is_enabled: true, status: 'active' },
    { type: 'facturama', display_name: 'Facturama (CFDI)', is_enabled: false, status: 'inactive' },
  ];

  for (const i of integrations) {
    await upsert(pool, 'integrations', {
      type: i.type,
      display_name: i.display_name,
      is_enabled: i.is_enabled,
      config: null,
      status: i.status,
    }, ['type']);
  }
}

export async function seedSystemSettings(pool: pg.Pool): Promise<void> {
  const settings = [
    { key: 'platform.name', value: 'Nivo', value_type: 'string', category: 'platform', description: 'Nombre de la plataforma' },
    { key: 'platform.version', value: '1.0.0', value_type: 'string', category: 'platform', description: 'Versión actual' },
    { key: 'billing.currency', value: 'MXN', value_type: 'string', category: 'billing', description: 'Moneda por defecto' },
    { key: 'billing.tax_rate', value: '16', value_type: 'number', category: 'billing', description: 'Tasa de IVA %' },
    { key: 'support.email', value: 'soporte@nivo.com', value_type: 'string', category: 'support', description: 'Email de soporte' },
    { key: 'demo.mode', value: 'true', value_type: 'boolean', category: 'platform', description: 'Modo demo activo' },
  ];

  for (const s of settings) {
    await upsert(pool, 'system_settings', { ...s, is_secret: false }, ['key']);
  }
}
