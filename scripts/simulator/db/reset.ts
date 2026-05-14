/**
 * Drops all demo tenant databases and clears master tables.
 * Usage: pnpm reset
 */

import { getMasterPool, closeAll } from './connection.js';
import { TENANT_PROFILES } from '../config/tenants.js';

async function main(): Promise<void> {
  console.log('⚠ Resetting nivo-demo databases...\n');

  const pool = getMasterPool();

  // Drop tenant databases
  for (const profile of TENANT_PROFILES) {
    const dbName = `nivo_tenant_${profile.subdomain}`;
    try {
      // Terminate connections
      await pool.query(`
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [dbName]);

      await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      console.log(`  Dropped: ${dbName}`);
    } catch (err: any) {
      console.error(`  Failed to drop ${dbName}: ${err.message}`);
    }
  }

  // Clear master tables (order matters for FK constraints)
  const tables = [
    'ticket_attachments', 'ticket_messages', 'support_tickets',
    'billing_invoices', 'tenant_billing_profiles',
    'notifications', 'subscriptions',
    'tenants', 'plan_configs', 'integrations',
    'system_settings', 'super_admins',
  ];

  for (const table of tables) {
    try {
      await pool.query(`DELETE FROM "${table}"`);
      console.log(`  Cleared: ${table}`);
    } catch (err: any) {
      console.log(`  Skip: ${table} (${err.message.substring(0, 50)})`);
    }
  }

  console.log('\n✅ Reset complete');
  await closeAll();
}

main().catch(err => {
  console.error('Failed:', err);
  closeAll().then(() => process.exit(1));
});
