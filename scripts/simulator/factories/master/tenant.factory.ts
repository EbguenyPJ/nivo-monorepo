import pg from 'pg';
import { query, upsert } from '../../db/connection.js';
import { TenantProfile } from '../../config/tenants.js';

export interface TenantRecord {
  id: string;
  dbName: string;
  profile: TenantProfile;
}

export async function seedTenant(
  pool: pg.Pool,
  profile: TenantProfile,
  createdAt: Date
): Promise<TenantRecord> {
  const dbName = `nivo_tenant_${profile.subdomain}`;

  const id = await upsert(pool, 'tenants', {
    name: profile.name,
    subdomain: profile.subdomain,
    database_name: dbName,
    logo_url: `/uploads/logos/${profile.subdomain}-logo.png`,
    theme_settings: JSON.stringify({ primaryColor: '#3B82F6', mode: 'dark' }),
    stripe_customer_id: `cus_demo_${profile.subdomain}`,
    rfc: profile.rfc,
    razon_social: profile.razonSocial,
    regimen_fiscal: profile.regimenFiscal,
    codigo_postal_fiscal: profile.codigoPostalFiscal,
    is_active: profile.churnMonth ? false : true,
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
  }, ['subdomain']);

  return { id, dbName, profile };
}

export async function seedSubscription(
  pool: pg.Pool,
  tenantId: string,
  planName: string,
  status: string,
  createdAt: Date,
  periodEnd?: Date
): Promise<string> {
  // Delete existing subscription for this tenant before inserting
  await query(pool, `DELETE FROM "subscriptions" WHERE "tenant_id" = $1`, [tenantId]);

  const result = await query(pool,
    `INSERT INTO "subscriptions" ("tenant_id", "stripe_subscription_id", "plan_name", "status", "current_period_end", "created_at", "updated_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      tenantId,
      `sub_demo_${tenantId.substring(0, 8)}`,
      planName,
      status,
      periodEnd?.toISOString() || new Date(Date.now() + 30 * 86400000).toISOString(),
      createdAt.toISOString(),
      createdAt.toISOString(),
    ]
  );
  return result.rows[0].id;
}

export async function seedBillingProfile(
  pool: pg.Pool,
  tenantId: string,
  profile: TenantProfile
): Promise<void> {
  await upsert(pool, 'tenant_billing_profiles', {
    tenant_id: tenantId,
    rfc: profile.rfc.substring(0, 13),
    legal_name: profile.razonSocial,
    zip_code: profile.codigoPostalFiscal,
    tax_regime: profile.regimenFiscal,
    cfdi_use: 'G03',
    requires_invoice: profile.plan === 'enterprise' || profile.plan === 'pro',
  }, ['tenant_id']);
}
