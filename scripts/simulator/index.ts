/**
 * Nivo Demo — Motor de Simulación Cronológica (180 días)
 *
 * Usage:
 *   1. docker compose -f docker-compose.demo.yml up -d
 *   2. cd scripts/simulator && pnpm install
 *   3. pnpm simulate
 */

import { getMasterPool, getTenantPool, createTenantDatabase, closeAll } from './db/connection.js';
import { createMasterSchema, createTenantSchema } from './db/schema.js';
import { seedSuperAdmin } from './factories/master/super-admin.factory.js';
import { seedPlanConfigs } from './factories/master/plan-config.factory.js';
import { seedTenant, seedSubscription, seedBillingProfile, TenantRecord } from './factories/master/tenant.factory.js';
import { seedIntegrations, seedSystemSettings } from './factories/master/integration.factory.js';
import { createSupportTicket } from './factories/master/support-ticket.factory.js';
import { createNotification } from './factories/master/notification.factory.js';
import { TENANT_PROFILES, TenantProfile } from './config/tenants.js';
import { SIM_START_DATE, SIM_END_DATE, TOTAL_DAYS } from './config/constants.js';
import { seedRng, chance, pick } from './engine/probability.js';
import { setupTenantStaticData, TenantSetupResult } from './factories/tenant/setup.factory.js';
import { simulateDay, DayContext } from './factories/tenant/daily-ops.factory.js';

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   NIVO DEMO — Motor de Simulación Cronológica          ║');
  console.log('║   180 días de datos hiperrealistas                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`  Periodo: ${SIM_START_DATE.toISOString().split('T')[0]} → ${SIM_END_DATE.toISOString().split('T')[0]}`);
  console.log(`  Total días: ${TOTAL_DAYS}`);
  console.log(`  Tenants: ${TENANT_PROFILES.length}`);
  console.log();

  seedRng(42); // Deterministic

  const startTime = Date.now();
  const masterPool = getMasterPool();

  // ─── STEP 1: Master DB Schema ──────────────────────────────
  console.log('▸ Step 1: Creating master DB schema...');
  await createMasterSchema(masterPool);

  // ─── STEP 2: Seed master data ──────────────────────────────
  console.log('▸ Step 2: Seeding master data...');

  // Clear re-run artifacts (FK-safe order)
  await masterPool.query(`DELETE FROM "ticket_attachments"`).catch(() => {});
  await masterPool.query(`DELETE FROM "ticket_messages"`).catch(() => {});
  await masterPool.query(`DELETE FROM "support_tickets"`).catch(() => {});
  await masterPool.query(`DELETE FROM "billing_invoices"`).catch(() => {});
  await masterPool.query(`DELETE FROM "notifications"`).catch(() => {});

  await seedSuperAdmin(masterPool);
  console.log('  Super admin created: admin@nivo.com');

  await seedPlanConfigs(masterPool);
  await seedIntegrations(masterPool);
  await seedSystemSettings(masterPool);

  // ─── STEP 3: Create tenants & their databases ──────────────
  console.log('▸ Step 3: Provisioning tenants...');
  const tenantRecords: TenantRecord[] = [];

  for (const profile of TENANT_PROFILES) {
    const tenantCreatedAt = new Date(SIM_START_DATE);
    tenantCreatedAt.setDate(tenantCreatedAt.getDate() + profile.activeSinceMonth * 30);

    const record = await seedTenant(masterPool, profile, tenantCreatedAt);
    tenantRecords.push(record);

    // Subscription
    let subStatus = 'active';
    if (profile.churnMonth !== undefined) subStatus = 'canceled';
    await seedSubscription(masterPool, record.id, profile.plan, subStatus, tenantCreatedAt);

    // Billing profile
    await seedBillingProfile(masterPool, record.id, profile);

    // Notification
    await createNotification(
      masterPool, 'tenant_created', 'Nuevo tenant registrado',
      `${profile.name} se ha registrado con el plan ${profile.plan}`,
      record.id, profile.name, tenantCreatedAt
    );

    console.log(`  ✓ ${profile.name} (${profile.subdomain}) — Plan: ${profile.plan}, DB: ${record.dbName}`);
  }

  // ─── STEP 4: Create tenant databases & seed static data ────
  console.log('\n▸ Step 4: Provisioning tenant databases & catalogs...');
  const tenantSetups = new Map<string, { record: TenantRecord; setup: TenantSetupResult; pool: ReturnType<typeof getTenantPool> }>();

  for (const record of tenantRecords) {
    console.log(`\n  ── ${record.profile.name} ──`);
    await createTenantDatabase(record.dbName);
    const pool = getTenantPool(record.dbName);
    await createTenantSchema(pool);

    const tenantCreatedAt = new Date(SIM_START_DATE);
    tenantCreatedAt.setDate(tenantCreatedAt.getDate() + record.profile.activeSinceMonth * 30);

    const setup = await setupTenantStaticData(pool, record.profile, tenantCreatedAt);
    tenantSetups.set(record.id, { record, setup, pool });
  }

  // ─── STEP 5: The Time Loop — 180 Days ──────────────────────
  console.log('\n▸ Step 5: Running the 180-day simulation...\n');

  for (let dayIndex = 0; dayIndex < TOTAL_DAYS; dayIndex++) {
    const currentDate = new Date(SIM_START_DATE);
    currentDate.setDate(currentDate.getDate() + dayIndex);

    const dayStr = currentDate.toISOString().split('T')[0];
    const dow = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][currentDate.getDay()];

    if (dayIndex % 7 === 0) {
      const pct = ((dayIndex / TOTAL_DAYS) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  Day ${dayIndex + 1}/${TOTAL_DAYS} (${pct}%) — ${dayStr} ${dow} — ${elapsed}s elapsed`);
    }

    // Iterate over each tenant
    for (const [tenantId, { record, setup, pool }] of tenantSetups) {
      const profile = record.profile;

      // Check if tenant is active on this day
      const tenantStartDay = profile.activeSinceMonth * 30;
      if (dayIndex < tenantStartDay) continue;

      // Check if tenant has churned
      if (profile.churnMonth !== undefined && dayIndex > profile.churnMonth * 30) continue;

      // Handle plan upgrade
      if (profile.upgradePlan && dayIndex === profile.upgradePlan.month * 30) {
        console.log(`    ★ ${profile.name}: Upgrade to ${profile.upgradePlan.newPlan}`);

        // Update subscription in master
        await masterPool.query(
          `UPDATE subscriptions SET plan_name = $1, updated_at = $2 WHERE tenant_id = $3`,
          [profile.upgradePlan.newPlan, currentDate.toISOString(), tenantId]
        );

        await createNotification(
          masterPool, 'subscription_upgrade',
          `${profile.name} subió a plan ${profile.upgradePlan.newPlan}`,
          `El tenant ${profile.name} ha actualizado su suscripción`,
          tenantId, profile.name, currentDate
        );

        // Add new branches
        if (profile.upgradePlan.newBranches > setup.branchIds.length) {
          const newBranchCount = profile.upgradePlan.newBranches - setup.branchIds.length;
          for (let nb = 0; nb < newBranchCount; nb++) {
            const branchNum = setup.branchIds.length + nb + 1;
            const bId = await pool.query(
              `INSERT INTO branches (name, code, is_active, created_at) VALUES ($1, $2, true, $3) RETURNING id`,
              [`Sucursal Nueva ${branchNum}`, `SUC-NEW-${branchNum}`, currentDate.toISOString()]
            );
            setup.branchIds.push(bId.rows[0].id);

            // Add a cash register
            const crId = await pool.query(
              `INSERT INTO cash_registers (branch_id, name, is_active) VALUES ($1, $2, true) RETURNING id`,
              [bId.rows[0].id, 'Caja 1']
            );
            setup.cashRegisterIds.set(bId.rows[0].id, [crId.rows[0].id]);
          }
        }
      }

      // Support tickets
      if (chance(profile.supportTicketRate / 30)) {
        const ticketStatus = profile.profile === 'churn' ? 'open' : pick(['open', 'in_progress', 'resolved', 'closed']);
        await createSupportTicket(masterPool, tenantId, profile.name, profile.profile, currentDate, ticketStatus);
      }

      // Simulate the day's operations
      const ctx: DayContext = {
        date: currentDate,
        dayIndex: dayIndex - tenantStartDay,
        profile,
        setup,
        pool,
        activeSessions: new Map(),
      };

      try {
        await simulateDay(ctx);
      } catch (err: any) {
        // Log but continue — don't let one tenant crash the whole simulation
        if (!err.message?.includes('unique constraint')) {
          console.error(`    ⚠ ${profile.name} day ${dayIndex}: ${err.message}`);
        }
      }
    }

    // Monthly billing invoices (every 30 days)
    if (dayIndex > 0 && dayIndex % 30 === 0) {
      for (const [tenantId, { record }] of tenantSetups) {
        if (record.profile.churnMonth !== undefined && dayIndex > record.profile.churnMonth * 30) continue;

        const planPrices: Record<string, number> = {
          free: 0, starter: 499, basico: 999, pro: 1999, enterprise: 4999,
        };
        const amount = planPrices[record.profile.plan] || 0;
        if (amount === 0) continue;

        const periodStart = new Date(currentDate);
        periodStart.setDate(periodStart.getDate() - 30);

        // Churn tenants get past_due status on their last invoice
        const isChurnLastInvoice = record.profile.churnMonth !== undefined &&
          dayIndex >= (record.profile.churnMonth - 1) * 30;
        const invoiceStatus = isChurnLastInvoice ? 'past_due' : 'paid';

        await masterPool.query(
          `INSERT INTO billing_invoices (tenant_id, stripe_invoice_id, amount_total, amount_subtotal, amount_tax, status, description, period_start, period_end, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            tenantId, `inv_demo_${tenantId.substring(0, 6)}_${dayIndex}`,
            amount, amount / 1.16, amount - amount / 1.16,
            invoiceStatus,
            `Plan ${record.profile.plan} — Periodo ${periodStart.toISOString().split('T')[0]} a ${currentDate.toISOString().split('T')[0]}`,
            periodStart.toISOString(), currentDate.toISOString(), currentDate.toISOString(),
          ]
        );
      }
    }
  }

  // ─── STEP 6: Final stats ───────────────────────────────────
  console.log('\n▸ Step 6: Final statistics...\n');

  for (const [tenantId, { record, pool }] of tenantSetups) {
    const salesCount = await pool.query(`SELECT COUNT(*) FROM sales`);
    const ordersCount = await pool.query(`SELECT COUNT(*) FROM orders`);
    const layawaysCount = await pool.query(`SELECT COUNT(*) FROM layaways`);
    const returnsCount = await pool.query(`SELECT COUNT(*) FROM sale_returns`);
    const transfersCount = await pool.query(`SELECT COUNT(*) FROM inventory_transfers`);
    const expensesCount = await pool.query(`SELECT COUNT(*) FROM expenses`);
    const totalRevenue = await pool.query(`SELECT COALESCE(SUM(total_amount), 0) as total FROM sales`);

    console.log(`  ${record.profile.name}:`);
    console.log(`    Sales: ${salesCount.rows[0].count} | Orders: ${ordersCount.rows[0].count} | Layaways: ${layawaysCount.rows[0].count}`);
    console.log(`    Returns: ${returnsCount.rows[0].count} | Transfers: ${transfersCount.rows[0].count} | Expenses: ${expensesCount.rows[0].count}`);
    console.log(`    Revenue: $${parseFloat(totalRevenue.rows[0].total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Simulation complete in ${totalTime}s`);

  await closeAll();
}

main().catch(err => {
  console.error('❌ Simulation failed:', err);
  closeAll().then(() => process.exit(1));
});
