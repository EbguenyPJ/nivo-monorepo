import pg from 'pg';
import { upsert } from '../../db/connection.js';

const PLANS = [
  {
    plan_name: 'free', display_name: 'Gratis', description: '1 sucursal, funcionalidad básica',
    monthly_price: 0, annual_price: 0, sort_order: 0,
    max_branches: 1, max_users: 2, storage_limit_gb: 1,
    mod_transfers: false, mod_invoicing: false, mod_loyalty: false,
    mod_advanced_reports: false, mod_ecommerce: false, mod_custom_branding: false,
    support_level: 'community', support_type: 'email', support_hours: 'Lunes a viernes',
    support_description: 'Email con respuesta en 48h',
  },
  {
    plan_name: 'starter', display_name: 'Starter', description: '2 sucursales, módulos básicos',
    monthly_price: 499, annual_price: 4990, sort_order: 1,
    max_branches: 2, max_users: 5, storage_limit_gb: 5,
    mod_transfers: true, mod_invoicing: false, mod_loyalty: false,
    mod_advanced_reports: false, mod_ecommerce: false, mod_custom_branding: false,
    support_level: 'standard', support_type: 'email', support_hours: 'Lunes a viernes 9-18h',
    support_description: 'Email con respuesta en 24h',
  },
  {
    plan_name: 'basico', display_name: 'Básico', description: '3 sucursales, traspasos y lealtad',
    monthly_price: 999, annual_price: 9990, sort_order: 2,
    max_branches: 3, max_users: 10, storage_limit_gb: 10,
    mod_transfers: true, mod_invoicing: false, mod_loyalty: true,
    mod_advanced_reports: false, mod_ecommerce: false, mod_custom_branding: false,
    support_level: 'priority', support_type: 'chat', support_hours: 'Lunes a sábado 9-20h',
    support_description: 'Chat con respuesta en 4h',
  },
  {
    plan_name: 'pro', display_name: 'Pro', description: '5 sucursales, reportes avanzados, e-commerce',
    monthly_price: 1999, annual_price: 19990, sort_order: 3,
    max_branches: 5, max_users: 25, storage_limit_gb: 50,
    mod_transfers: true, mod_invoicing: true, mod_loyalty: true,
    mod_advanced_reports: true, mod_ecommerce: true, mod_custom_branding: true,
    support_level: 'premium', support_type: 'whatsapp', support_hours: 'Lunes a domingo 8-22h',
    support_description: 'WhatsApp con respuesta en 1h',
  },
  {
    plan_name: 'enterprise', display_name: 'Enterprise', description: 'Sucursales ilimitadas, soporte dedicado',
    monthly_price: 4999, annual_price: 49990, sort_order: 4,
    max_branches: 99, max_users: 999, storage_limit_gb: 500,
    mod_transfers: true, mod_invoicing: true, mod_loyalty: true,
    mod_advanced_reports: true, mod_ecommerce: true, mod_custom_branding: true,
    support_level: 'dedicated', support_type: 'phone', support_hours: '24/7',
    support_description: 'Soporte telefónico dedicado 24/7',
  },
];

export async function seedPlanConfigs(pool: pg.Pool): Promise<void> {
  for (const plan of PLANS) {
    await upsert(pool, 'plan_configs', { ...plan, is_active: true }, ['plan_name']);
  }
  console.log(`  ${PLANS.length} plan configs seeded`);
}
