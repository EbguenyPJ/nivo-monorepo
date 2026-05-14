import pg from 'pg';
import { v4 as uuid } from 'uuid';
import { insert, insertMany, query } from '../../db/connection.js';
import { TenantProfile } from '../../config/tenants.js';
import { TenantSetupResult } from './setup.factory.js';
import {
  pick, pickN, randomInt, randomFloat, chance, poissonSample,
  clamp, randomPhone, gaussian,
} from '../../engine/probability.js';
import { dailyVolumeMultiplier, randomSaleHour, randomMinute } from '../../engine/curves.js';
import { TOTAL_DAYS } from '../../config/constants.js';

export interface DayContext {
  date: Date;
  dayIndex: number;
  profile: TenantProfile;
  setup: TenantSetupResult;
  pool: pg.Pool;
  // Active sessions per branch for this day
  activeSessions: Map<string, { sessionId: string; employeeId: string }>;
}

// ─── Main Day Runner ─────────────────────────────────────────
export async function simulateDay(ctx: DayContext): Promise<void> {
  const multiplier = dailyVolumeMultiplier(ctx.date, ctx.dayIndex, TOTAL_DAYS, ctx.profile.profile);
  if (multiplier <= 0.01) return; // Dead tenant (churn past cutoff)

  // Open POS sessions for each branch
  await openDaySessions(ctx);

  // Sales
  await simulateSales(ctx, multiplier);

  // Expenses (probabilistic)
  await simulateExpenses(ctx);

  // Layaways (probabilistic)
  await simulateLayaways(ctx);

  // Returns (probabilistic, based on previous sales)
  await simulateReturns(ctx);

  // Transfers (weekly-ish)
  if (ctx.date.getDay() === 1 || ctx.date.getDay() === 4) {
    await simulateTransfers(ctx);
  }

  // Purchasing / requisitions (when stock low)
  if (ctx.dayIndex % 14 === 0 && ctx.profile.profile !== 'churn') {
    await simulatePurchasing(ctx);
  }

  // Audits (monthly)
  if (ctx.date.getDate() === 1 && ctx.profile.auditFrequency > 0) {
    await simulateAudit(ctx);
  }

  // Online orders (for B2C / high-online tenants)
  if (ctx.profile.onlinePercentage > 10) {
    await simulateOnlineOrders(ctx, multiplier);
  }

  // Pre-sales QR
  if (chance(0.15)) {
    await simulatePreSales(ctx);
  }

  // Credit transactions (charges and payments)
  if (ctx.profile.creditRate > 0) {
    await simulateCreditOps(ctx);
  }

  // Expire overdue layaways
  await expireOverdueLayaways(ctx);

  // Close POS sessions
  await closeDaySessions(ctx);
}

// ─── POS Sessions ────────────────────────────────────────────
async function openDaySessions(ctx: DayContext): Promise<void> {
  ctx.activeSessions = new Map();

  for (const branchId of ctx.setup.branchIds) {
    const registers = ctx.setup.cashRegisterIds.get(branchId) || [];
    if (registers.length === 0) continue;

    // Pick a cashier for this branch
    const branchEmployees = await query(ctx.pool,
      `SELECT id FROM employees WHERE branch_id = $1 AND role = 'cashier' AND is_active = true LIMIT 1`,
      [branchId]
    );
    const employeeId = branchEmployees.rows[0]?.id || ctx.setup.employeeIds[1]; // fallback to manager

    const openTime = new Date(ctx.date);
    openTime.setHours(8, randomInt(0, 30), 0);
    const openingAmount = randomFloat(1500, 3000);

    const sessionId = await insert(ctx.pool, 'pos_sessions', {
      employee_id: employeeId, branch_id: branchId,
      cash_register_id: registers[0],
      opening_amount: openingAmount,
      status: 'open',
      opened_at: openTime.toISOString(),
    });

    // Cash-in transaction for opening
    await insert(ctx.pool, 'cash_transactions', {
      session_id: sessionId, employee_id: employeeId,
      type: 'cash_in', amount: openingAmount,
      description: 'Fondo de caja inicial',
      created_at: openTime.toISOString(),
    });

    ctx.activeSessions.set(branchId, { sessionId, employeeId });
  }
}

async function closeDaySessions(ctx: DayContext): Promise<void> {
  for (const [branchId, session] of ctx.activeSessions) {
    const closeTime = new Date(ctx.date);
    closeTime.setHours(20, randomInt(0, 59), 0);

    // Calculate expected cash from transactions
    const txResult = await query(ctx.pool,
      `SELECT COALESCE(SUM(CASE WHEN type IN ('sale_cash', 'cash_in', 'layaway_payment') THEN amount
                              WHEN type IN ('refund', 'cash_out') THEN -amount ELSE 0 END), 0) as expected
       FROM cash_transactions WHERE session_id = $1`,
      [session.sessionId]
    );
    const expectedAmount = parseFloat(txResult.rows[0].expected);

    // Human error: cashier declares slightly different amount
    const hasDifference = chance(0.15); // 15% chance of cash difference
    const difference = hasDifference
      ? randomFloat(-250, 100) // negative = faltante, more common
      : 0;
    const closingAmount = expectedAmount + difference;

    await query(ctx.pool,
      `UPDATE pos_sessions SET status = 'closed', closing_amount = $1, expected_amount = $2,
       difference = $3, closed_at = $4, closed_by = $5 WHERE id = $6`,
      [closingAmount, expectedAmount, difference, closeTime.toISOString(), session.employeeId, session.sessionId]
    );

    // Audit transaction if there's a difference
    if (hasDifference) {
      await insert(ctx.pool, 'cash_transactions', {
        session_id: session.sessionId, employee_id: session.employeeId,
        type: 'audit', amount: 0,
        description: difference < 0 ? `Faltante de caja: $${Math.abs(difference).toFixed(2)}` : `Sobrante de caja: $${difference.toFixed(2)}`,
        declared_amount: closingAmount, expected_amount: expectedAmount, difference,
        created_at: closeTime.toISOString(),
      });
    }
  }
}

// ─── Sales ───────────────────────────────────────────────────
async function simulateSales(ctx: DayContext, multiplier: number): Promise<void> {
  for (const branchId of ctx.setup.branchIds) {
    const session = ctx.activeSessions.get(branchId);
    if (!session) continue;

    const [minSales, maxSales] = ctx.profile.dailySalesRange;
    const baseSales = randomFloat(minSales, maxSales);
    const salesCount = Math.max(0, Math.round(baseSales * multiplier));

    for (let s = 0; s < salesCount; s++) {
      // Skip online sales here (handled separately)
      if (chance(ctx.profile.onlinePercentage / 100)) continue;

      await createSale(ctx, branchId, session.sessionId, session.employeeId);
    }
  }
}

async function createSale(
  ctx: DayContext,
  branchId: string,
  sessionId: string,
  employeeId: string,
  saleType: string = 'in_store'
): Promise<string | null> {
  // Pick 1-4 random variants that have stock in this branch
  const itemCount = randomInt(1, 4);
  const stockResult = await query(ctx.pool,
    `SELECT i.variant_id, i.stock_available, pv.cost, pv.price_override, p.base_price
     FROM inventory i
     JOIN product_variants pv ON pv.id = i.variant_id
     JOIN products p ON p.id = pv.product_id
     WHERE i.branch_id = $1 AND i.stock_available > 0 AND pv.is_active = true
     ORDER BY random() LIMIT $2`,
    [branchId, itemCount]
  );

  if (stockResult.rows.length === 0) return null;

  const saleTime = new Date(ctx.date);
  const hour = randomSaleHour();
  saleTime.setHours(hour, randomMinute(), randomInt(0, 59));

  let totalAmount = 0;
  let discountAmount = 0;
  const items: any[] = [];

  for (const row of stockResult.rows) {
    const qty = 1;
    const unitPrice = parseFloat(row.price_override || row.base_price);
    const discount = chance(0.15) ? randomFloat(0, unitPrice * 0.2) : 0;
    const subtotal = (unitPrice - discount) * qty;
    totalAmount += subtotal;
    discountAmount += discount * qty;

    items.push({
      variant_id: row.variant_id,
      quantity: qty,
      unit_price: unitPrice,
      discount,
      subtotal,
      unit_cost_at_sale: parseFloat(row.cost),
    });
  }

  const taxAmount = totalAmount * 0.16;
  const customerId = chance(0.4) ? pick(ctx.setup.customerIds) : null;

  // Payment method distribution
  let paymentMethod: string;
  const payRoll = Math.random();
  if (payRoll < 0.45) paymentMethod = 'cash';
  else if (payRoll < 0.80) paymentMethod = 'card';
  else paymentMethod = 'mixed';

  const saleId = await insert(ctx.pool, 'sales', {
    pos_session_id: sessionId, customer_id: customerId,
    employee_id: employeeId, branch_id: branchId,
    total_amount: totalAmount, discount_amount: discountAmount,
    tax_amount: taxAmount, payment_method: paymentMethod,
    sale_type: saleType, status: 'completed',
    created_at: saleTime.toISOString(),
  });

  // Sale items
  for (const item of items) {
    await insert(ctx.pool, 'sale_items', { sale_id: saleId, ...item });

    // Decrement inventory
    await query(ctx.pool,
      `UPDATE inventory SET stock_available = stock_available - $1, updated_at = $2
       WHERE variant_id = $3 AND branch_id = $4`,
      [item.quantity, saleTime.toISOString(), item.variant_id, branchId]
    );
  }

  // Sale payments
  if (paymentMethod === 'mixed') {
    const cashPortion = randomFloat(totalAmount * 0.3, totalAmount * 0.7);
    const cashPmId = ctx.setup.paymentMethodIds.get('Efectivo')!;
    const cardPmId = ctx.setup.paymentMethodIds.get('Tarjeta de débito')!;

    await insert(ctx.pool, 'sale_payments', {
      sale_id: saleId, payment_method_id: cashPmId,
      payment_method_name: 'Efectivo', amount: cashPortion,
      created_at: saleTime.toISOString(),
    });
    await insert(ctx.pool, 'sale_payments', {
      sale_id: saleId, payment_method_id: cardPmId,
      payment_method_name: 'Tarjeta de débito', amount: totalAmount - cashPortion,
      reference: `REF-${randomInt(100000, 999999)}`,
      created_at: saleTime.toISOString(),
    });
  } else {
    const pmName = paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta de crédito';
    const pmId = ctx.setup.paymentMethodIds.get(pmName)!;
    await insert(ctx.pool, 'sale_payments', {
      sale_id: saleId, payment_method_id: pmId,
      payment_method_name: pmName, amount: totalAmount,
      reference: paymentMethod === 'card' ? `REF-${randomInt(100000, 999999)}` : null,
      created_at: saleTime.toISOString(),
    });
  }

  // Cash transaction for cash portion
  if (paymentMethod === 'cash' || paymentMethod === 'mixed') {
    const cashAmount = paymentMethod === 'cash' ? totalAmount : randomFloat(totalAmount * 0.3, totalAmount * 0.7);
    await insert(ctx.pool, 'cash_transactions', {
      session_id: sessionId, employee_id: employeeId,
      type: 'sale_cash', amount: cashAmount,
      created_at: saleTime.toISOString(),
    });
  }

  // Loyalty points (if active and customer identified)
  if (ctx.setup.loyaltyConfigId && customerId) {
    const pointsEarned = Math.floor(totalAmount / 10);
    if (pointsEarned > 0) {
      const currentPoints = await query(ctx.pool,
        `SELECT loyalty_points FROM customers WHERE id = $1`, [customerId]
      );
      const balanceAfter = (parseInt(currentPoints.rows[0]?.loyalty_points || '0')) + pointsEarned;

      await insert(ctx.pool, 'loyalty_ledgers', {
        customer_id: customerId, sale_id: saleId,
        type: 'earned', points_earned: pointsEarned, points_spent: 0,
        balance_after: balanceAfter,
        description: `Puntos por venta $${totalAmount.toFixed(2)}`,
        employee_id: employeeId, created_at: saleTime.toISOString(),
      });

      await query(ctx.pool,
        `UPDATE customers SET loyalty_points = $1 WHERE id = $2`,
        [balanceAfter, customerId]
      );
    }
  }

  return saleId;
}

// ─── Returns ─────────────────────────────────────────────────
async function simulateReturns(ctx: DayContext): Promise<void> {
  if (!chance(ctx.profile.returnRate * 3)) return; // Scale probability

  // Find a recent sale to return
  const recentSale = await query(ctx.pool,
    `SELECT s.id, s.branch_id, s.employee_id, si.id as item_id, si.variant_id,
            si.quantity, si.unit_price, si.subtotal
     FROM sales s JOIN sale_items si ON si.sale_id = s.id
     WHERE s.status = 'completed' AND s.created_at > $1
     ORDER BY random() LIMIT 1`,
    [new Date(ctx.date.getTime() - 7 * 86400000).toISOString()]
  );

  if (recentSale.rows.length === 0) return;
  const sale = recentSale.rows[0];
  const session = ctx.activeSessions.get(sale.branch_id);
  if (!session) return;

  const returnTime = new Date(ctx.date);
  returnTime.setHours(randomInt(10, 18), randomMinute(), 0);

  const refundMethod = pick(['cash', 'card_reversal', 'store_credit']) as 'cash' | 'card_reversal' | 'store_credit';
  const refundAmount = parseFloat(sale.subtotal);

  const returnId = await insert(ctx.pool, 'sale_returns', {
    sale_id: sale.id, employee_id: session.employeeId,
    branch_id: sale.branch_id, pos_session_id: session.sessionId,
    refund_amount: refundAmount, refund_method: refundMethod,
    cancellation_reason_id: pick(ctx.setup.cancellationReasonIds),
    reason: pick(['Talla incorrecta', 'Defecto de fábrica', 'No le gustó', 'Error de cajero']),
    created_at: returnTime.toISOString(),
  });

  await insert(ctx.pool, 'sale_return_items', {
    sale_return_id: returnId, sale_item_id: sale.item_id,
    variant_id: sale.variant_id,
    quantity: parseInt(sale.quantity), unit_price: parseFloat(sale.unit_price),
    subtotal: refundAmount,
    disposition: chance(0.85) ? 'floor' : 'shrinkage',
  });

  // Return stock
  await query(ctx.pool,
    `UPDATE inventory SET stock_available = stock_available + $1 WHERE variant_id = $2 AND branch_id = $3`,
    [parseInt(sale.quantity), sale.variant_id, sale.branch_id]
  );

  // Update sale status
  await query(ctx.pool,
    `UPDATE sales SET status = 'partial_return' WHERE id = $1`, [sale.id]
  );

  // Cash refund transaction
  if (refundMethod === 'cash') {
    await insert(ctx.pool, 'cash_transactions', {
      session_id: session.sessionId, employee_id: session.employeeId,
      type: 'refund', amount: -refundAmount,
      description: 'Devolución de venta',
      created_at: returnTime.toISOString(),
    });
  }
}

// ─── Expenses ────────────────────────────────────────────────
async function simulateExpenses(ctx: DayContext): Promise<void> {
  const count = poissonSample(ctx.profile.expenseFrequency * 0.3); // Scale down, not every day
  for (let e = 0; e < count; e++) {
    const branchId = pick(ctx.setup.branchIds);
    const session = ctx.activeSessions.get(branchId);
    const expenseTime = new Date(ctx.date);
    expenseTime.setHours(randomInt(9, 18), randomMinute(), 0);

    const amount = randomFloat(50, 5000);
    const paymentSource = pick(['cash', 'bank', 'petty_cash']);

    await insert(ctx.pool, 'expenses', {
      branch_id: branchId,
      category_id: pick(ctx.setup.expenseCategoryIds),
      employee_id: session?.employeeId || ctx.setup.adminEmployeeId,
      pos_session_id: paymentSource === 'cash' ? session?.sessionId : null,
      amount, description: pick([
        'Compra de material de limpieza', 'Pago de servicio de internet',
        'Reparación de estante', 'Papelería y etiquetas',
        'Mantenimiento de equipo', 'Gasolina para entregas',
        'Compra de bolsas y empaques', 'Servicio de electricidad',
      ]),
      payment_source: paymentSource,
      receipt_url: chance(0.6) ? `/uploads/receipts/expense-${uuid().substring(0, 8)}.jpg` : null,
      date: ctx.date.toISOString().split('T')[0],
      is_cancelled: false,
      created_at: expenseTime.toISOString(),
    });

    if (paymentSource === 'cash' && session) {
      await insert(ctx.pool, 'cash_transactions', {
        session_id: session.sessionId, employee_id: session.employeeId,
        type: 'cash_out', amount: -amount,
        description: 'Gasto operativo',
        created_at: expenseTime.toISOString(),
      });
    }
  }
}

// ─── Layaways ────────────────────────────────────────────────
async function simulateLayaways(ctx: DayContext): Promise<void> {
  if (!chance(ctx.profile.layawayRate)) return;

  const branchId = pick(ctx.setup.branchIds);
  const session = ctx.activeSessions.get(branchId);
  if (!session) return;

  const customerId = pick(ctx.setup.customerIds);
  const layawayTime = new Date(ctx.date);
  layawayTime.setHours(randomInt(10, 18), randomMinute(), 0);

  // Pick 1-3 variants with stock
  const stockResult = await query(ctx.pool,
    `SELECT i.variant_id, pv.cost, pv.price_override, p.base_price
     FROM inventory i JOIN product_variants pv ON pv.id = i.variant_id
     JOIN products p ON p.id = pv.product_id
     WHERE i.branch_id = $1 AND i.stock_available > 0
     ORDER BY random() LIMIT $2`,
    [branchId, randomInt(1, 3)]
  );

  if (stockResult.rows.length === 0) return;

  let totalAmount = 0;
  const items: any[] = [];
  for (const row of stockResult.rows) {
    const unitPrice = parseFloat(row.price_override || row.base_price);
    const subtotal = unitPrice;
    totalAmount += subtotal;
    items.push({ variant_id: row.variant_id, quantity: 1, unit_price: unitPrice, discount: 0, subtotal });
  }

  const downPayment = randomFloat(totalAmount * 0.2, totalAmount * 0.5);
  const dueDate = new Date(ctx.date.getTime() + randomInt(14, 45) * 86400000);

  // Determine status based on due date vs today
  let status = 'active';
  const now = new Date();
  if (dueDate < now && chance(0.3)) {
    status = 'cancelled_forfeited'; // Expired layaway
  } else if (chance(0.2) && ctx.dayIndex > 30) {
    status = 'paid_delivered';
  }

  const layawayId = await insert(ctx.pool, 'layaways', {
    customer_id: customerId, branch_id: branchId,
    employee_id: session.employeeId,
    total_amount: totalAmount, down_payment: downPayment,
    balance_due: totalAmount - downPayment,
    status, due_date: dueDate.toISOString().split('T')[0],
    pos_session_id: session.sessionId,
    created_at: layawayTime.toISOString(),
  });

  for (const item of items) {
    await insert(ctx.pool, 'layaway_items', { layaway_id: layawayId, ...item });
  }

  // Initial payment
  await insert(ctx.pool, 'layaway_payments', {
    layaway_id: layawayId, amount: downPayment,
    payment_method: pick(['Efectivo', 'Tarjeta de débito']),
    employee_id: session.employeeId, pos_session_id: session.sessionId,
    created_at: layawayTime.toISOString(),
  });

  // Cash transaction
  await insert(ctx.pool, 'cash_transactions', {
    session_id: session.sessionId, employee_id: session.employeeId,
    type: 'layaway_payment', amount: downPayment,
    description: `Enganche apartado #${layawayId.substring(0, 8)}`,
    created_at: layawayTime.toISOString(),
  });
}

// ─── Transfers ───────────────────────────────────────────────
async function simulateTransfers(ctx: DayContext): Promise<void> {
  if (ctx.setup.branchIds.length < 2) return;
  if (!chance(ctx.profile.transferFrequency / 7)) return;

  const branches = shuffleArray([...ctx.setup.branchIds]);
  const originBranch = branches[0];
  const destBranch = branches[1];
  const transferTime = new Date(ctx.date);
  transferTime.setHours(randomInt(9, 14), randomMinute(), 0);

  // Pick variants to transfer
  const stockResult = await query(ctx.pool,
    `SELECT i.variant_id, i.stock_available
     FROM inventory i WHERE i.branch_id = $1 AND i.stock_available > 3
     ORDER BY random() LIMIT $2`,
    [originBranch, randomInt(2, 8)]
  );

  if (stockResult.rows.length === 0) return;

  const status = pick(['completed', 'completed', 'completed', 'in_transit', 'discrepancy']);

  const transferId = await insert(ctx.pool, 'inventory_transfers', {
    origin_branch_id: originBranch, destination_branch_id: destBranch,
    status, created_by_id: ctx.setup.adminEmployeeId,
    received_by_id: status === 'completed' ? ctx.setup.employeeIds[1] : null,
    shipped_at: transferTime.toISOString(),
    received_at: status === 'completed' ? new Date(transferTime.getTime() + 86400000).toISOString() : null,
    notes: null,
    discrepancy_notes: status === 'discrepancy' ? 'Faltaron 2 pares en la caja recibida' : null,
    created_at: transferTime.toISOString(),
  });

  for (const row of stockResult.rows) {
    const sentQty = randomInt(1, Math.min(3, parseInt(row.stock_available)));
    const receivedQty = status === 'discrepancy' ? Math.max(0, sentQty - 1) : (status === 'completed' ? sentQty : null);

    await insert(ctx.pool, 'inventory_transfer_items', {
      transfer_id: transferId, variant_id: row.variant_id,
      sent_quantity: sentQty, received_quantity: receivedQty,
    });

    if (status === 'completed' || status === 'discrepancy') {
      // Decrement origin, increment destination
      await query(ctx.pool,
        `UPDATE inventory SET stock_available = stock_available - $1 WHERE variant_id = $2 AND branch_id = $3`,
        [sentQty, row.variant_id, originBranch]
      );
      if (receivedQty && receivedQty > 0) {
        await query(ctx.pool,
          `UPDATE inventory SET stock_available = stock_available + $1 WHERE variant_id = $2 AND branch_id = $3`,
          [receivedQty, row.variant_id, destBranch]
        );
      }
    }
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Purchasing ──────────────────────────────────────────────
async function simulatePurchasing(ctx: DayContext): Promise<void> {
  if (ctx.setup.supplierIds.length === 0) return;

  const branchId = pick(ctx.setup.branchIds);
  const purchaseTime = new Date(ctx.date);
  purchaseTime.setHours(10, 0, 0);

  // Find low-stock variants
  const lowStock = await query(ctx.pool,
    `SELECT i.variant_id, i.stock_available, i.stock_minimum, i.stock_maximum, pv.cost
     FROM inventory i JOIN product_variants pv ON pv.id = i.variant_id
     WHERE i.branch_id = $1 AND i.stock_available <= i.stock_minimum
     ORDER BY random() LIMIT 20`,
    [branchId]
  );

  if (lowStock.rows.length < 3) return;

  // Create requisition
  let totalEstimatedCost = 0;
  const reqItems: any[] = [];
  for (const row of lowStock.rows) {
    const suggestedQty = parseInt(row.stock_maximum) - parseInt(row.stock_available);
    const cost = parseFloat(row.cost) * suggestedQty;
    totalEstimatedCost += cost;
    reqItems.push({
      variant_id: row.variant_id,
      suggested_quantity: suggestedQty,
      current_stock: parseInt(row.stock_available),
      max_stock: parseInt(row.stock_maximum),
      estimated_cost: cost,
      supplier_id: pick(ctx.setup.supplierIds),
    });
  }

  const reqId = await insert(ctx.pool, 'purchase_requisitions', {
    branch_id: branchId, status: 'approved',
    total_estimated_cost: totalEstimatedCost, total_items: reqItems.length,
    approved_by_id: ctx.setup.adminEmployeeId,
    approved_at: purchaseTime.toISOString(),
    created_at: purchaseTime.toISOString(),
  });

  for (const item of reqItems) {
    await insert(ctx.pool, 'requisition_items', { requisition_id: reqId, ...item });
  }

  // Create PO from requisition (group by supplier)
  const bySupplier = new Map<string, typeof reqItems>();
  for (const item of reqItems) {
    const sid = item.supplier_id;
    if (!bySupplier.has(sid)) bySupplier.set(sid, []);
    bySupplier.get(sid)!.push(item);
  }

  for (const [supplierId, items] of bySupplier) {
    const totalCost = items.reduce((s, i) => s + i.estimated_cost, 0);
    const poStatus = pick(['received', 'received', 'ordered', 'partial']);
    const expectedDate = new Date(ctx.date.getTime() + randomInt(3, 14) * 86400000);

    const poId = await insert(ctx.pool, 'purchase_orders', {
      supplier_id: supplierId, branch_id: branchId,
      status: poStatus, total_cost: totalCost,
      invoice_number: chance(0.7) ? `FAC-${randomInt(10000, 99999)}` : null,
      created_by_id: ctx.setup.adminEmployeeId,
      received_by_id: poStatus === 'received' ? ctx.setup.employeeIds[1] : null,
      expected_date: expectedDate.toISOString().split('T')[0],
      received_at: poStatus === 'received' ? expectedDate.toISOString() : null,
      requisition_id: reqId,
      created_at: purchaseTime.toISOString(),
    });

    for (const item of items) {
      const orderedQty = item.suggested_quantity;
      const receivedQty = poStatus === 'received' ? orderedQty : (poStatus === 'partial' ? Math.floor(orderedQty * 0.6) : null);

      await insert(ctx.pool, 'purchase_order_items', {
        purchase_order_id: poId, variant_id: item.variant_id,
        ordered_quantity: orderedQty, received_quantity: receivedQty,
        unit_cost: item.estimated_cost / orderedQty,
      });

      // Update inventory if received
      if (receivedQty && receivedQty > 0) {
        await query(ctx.pool,
          `UPDATE inventory SET stock_available = stock_available + $1 WHERE variant_id = $2 AND branch_id = $3`,
          [receivedQty, item.variant_id, branchId]
        );
      }
    }

    // Account payable
    await insert(ctx.pool, 'accounts_payable', {
      supplier_id: supplierId, purchase_order_id: poId,
      amount: totalCost, paid_amount: poStatus === 'received' ? totalCost : 0,
      due_date: new Date(ctx.date.getTime() + 30 * 86400000).toISOString().split('T')[0],
      status: poStatus === 'received' ? 'paid' : 'pending',
    });
  }
}

// ─── Audits ──────────────────────────────────────────────────
async function simulateAudit(ctx: DayContext): Promise<void> {
  if (!chance(ctx.profile.auditFrequency / 4)) return;

  const branchId = pick(ctx.setup.branchIds);
  const auditTime = new Date(ctx.date);
  auditTime.setHours(7, 0, 0);

  const auditType = chance(0.7) ? 'partial' : 'full';

  const auditId = await insert(ctx.pool, 'inventory_audits', {
    branch_id: branchId, type: auditType,
    status: 'completed',
    branch_locked: false,
    created_by_id: ctx.setup.adminEmployeeId,
    closed_by_id: ctx.setup.adminEmployeeId,
    started_at: auditTime.toISOString(),
    completed_at: new Date(auditTime.getTime() + 3600000 * 4).toISOString(),
    notes: auditType === 'full' ? 'Auditoría mensual completa' : 'Auditoría parcial de sección',
    created_at: auditTime.toISOString(),
  });

  // Get inventory items for this branch
  const invResult = await query(ctx.pool,
    `SELECT i.variant_id, i.stock_available, pv.cost
     FROM inventory i JOIN product_variants pv ON pv.id = i.variant_id
     WHERE i.branch_id = $1
     ORDER BY random() LIMIT $2`,
    [branchId, auditType === 'full' ? 50 : 15]
  );

  for (const row of invResult.rows) {
    const expected = parseInt(row.stock_available);
    // 80% match, 20% have discrepancy
    const counted = chance(0.8) ? expected : expected + randomInt(-3, 2);
    const diff = counted - expected;

    await insert(ctx.pool, 'inventory_audit_items', {
      audit_id: auditId, variant_id: row.variant_id,
      expected_quantity: expected, counted_quantity: Math.max(0, counted),
      difference: diff,
      item_status: diff === 0 ? 'accepted' : 'accepted',
      adjustment_reason: diff !== 0 ? pick(['Merma', 'Error de conteo previo', 'Robo hormiga', 'Producto dañado']) : null,
      unit_cost: parseFloat(row.cost),
    });

    // Apply adjustment if discrepancy
    if (diff !== 0) {
      await insert(ctx.pool, 'inventory_adjustments', {
        audit_id: auditId, variant_id: row.variant_id,
        branch_id: branchId, reason: 'audit',
        quantity: diff,
        financial_impact: diff * parseFloat(row.cost),
        approved_by_id: ctx.setup.adminEmployeeId,
        notes: `Ajuste por auditoría: diferencia de ${diff} unidades`,
        created_at: auditTime.toISOString(),
      });

      await query(ctx.pool,
        `UPDATE inventory SET stock_available = $1 WHERE variant_id = $2 AND branch_id = $3`,
        [Math.max(0, counted), row.variant_id, branchId]
      );
    }
  }
}

// ─── Online Orders (B2C / Mobile) ────────────────────────────
async function simulateOnlineOrders(ctx: DayContext, multiplier: number): Promise<void> {
  const orderCount = poissonSample(ctx.profile.onlinePercentage / 20 * multiplier);

  for (let o = 0; o < orderCount; o++) {
    const branchId = pick(ctx.setup.branchIds);
    const customerId = pick(ctx.setup.customerIds);
    const orderTime = new Date(ctx.date);
    orderTime.setHours(randomInt(8, 22), randomMinute(), 0);

    const fulfillmentType = pick(['bopis', 'delivery', 'ship_to_home']) as 'bopis' | 'delivery' | 'ship_to_home';

    // Pick items
    const stockResult = await query(ctx.pool,
      `SELECT i.variant_id, pv.cost, pv.price_override, p.base_price
       FROM inventory i JOIN product_variants pv ON pv.id = i.variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE i.branch_id = $1 AND i.stock_available > 0
       ORDER BY random() LIMIT $2`,
      [branchId, randomInt(1, 3)]
    );

    if (stockResult.rows.length === 0) continue;

    let totalAmount = 0;
    const items: any[] = [];
    for (const row of stockResult.rows) {
      const unitPrice = parseFloat(row.price_override || row.base_price);
      totalAmount += unitPrice;
      items.push({
        variant_id: row.variant_id, quantity: 1,
        unit_price: unitPrice, discount: 0, subtotal: unitPrice,
        is_picked: chance(0.7), picked_barcode: null,
      });
    }

    const statusOptions = ['pending_payment', 'paid', 'picking', 'packed', 'ready_for_pickup', 'delivered', 'cancelled'];
    const statusWeights = [0.05, 0.10, 0.05, 0.05, 0.10, 0.60, 0.05];
    let status = statusOptions[0];
    let roll = Math.random();
    for (let i = 0; i < statusWeights.length; i++) {
      roll -= statusWeights[i];
      if (roll <= 0) { status = statusOptions[i]; break; }
    }

    const orderId = await insert(ctx.pool, 'orders', {
      customer_id: customerId, branch_id: branchId,
      fulfillment_type: fulfillmentType, status,
      total_amount: totalAmount, discount_amount: 0,
      tax_amount: totalAmount * 0.16,
      stripe_payment_intent_id: status !== 'pending_payment' ? `pi_demo_${uuid().substring(0, 12)}` : null,
      shipping_address: fulfillmentType !== 'bopis' ? JSON.stringify({
        street: `Calle ${randomInt(1, 50)} #${randomInt(100, 999)}`,
        city: 'Puebla', state: 'Puebla', zip: '72000',
      }) : null,
      pickup_branch_id: fulfillmentType === 'bopis' ? branchId : null,
      paid_at: status !== 'pending_payment' ? orderTime.toISOString() : null,
      completed_at: status === 'delivered' ? new Date(orderTime.getTime() + 86400000 * randomInt(1, 3)).toISOString() : null,
      created_at: orderTime.toISOString(),
    });

    for (const item of items) {
      await insert(ctx.pool, 'order_items', { order_id: orderId, ...item });
    }

    // GPS tracking for delivery orders
    if (fulfillmentType === 'delivery' && (status === 'out_for_delivery' || status === 'delivered')) {
      const baseLat = 19.0414;
      const baseLng = -98.2063;
      const trackingPoints = randomInt(5, 15);

      for (let t = 0; t < trackingPoints; t++) {
        const trackTime = new Date(orderTime.getTime() + t * 300000); // every 5 min
        await query(ctx.pool,
          `INSERT INTO order_tracking (order_id, latitude, longitude, timestamp) VALUES ($1, $2, $3, $4)`,
          [orderId, baseLat + randomFloat(-0.05, 0.05), baseLng + randomFloat(-0.05, 0.05), trackTime.toISOString()]
        );
      }

      // Delivery proof
      if (status === 'delivered') {
        await insert(ctx.pool, 'delivery_proofs', {
          order_id: orderId,
          employee_id: ctx.setup.employeeIds[randomInt(1, ctx.setup.employeeIds.length - 1)],
          latitude: baseLat + randomFloat(-0.01, 0.01),
          longitude: baseLng + randomFloat(-0.01, 0.01),
          photo_url: `/uploads/delivery/proof-${uuid().substring(0, 8)}.jpg`,
          recipient_name: `${pick(['Juan', 'María', 'Carlos', 'Ana'])} ${pick(['García', 'López', 'Martínez'])}`,
          status: 'delivered',
          delivered_at: new Date(orderTime.getTime() + 86400000).toISOString(),
        });
      }
    }

    // Decrement inventory for completed orders
    if (['paid', 'picking', 'packed', 'ready_for_pickup', 'delivered', 'picked_up'].includes(status)) {
      for (const item of items) {
        await query(ctx.pool,
          `UPDATE inventory SET stock_available = GREATEST(0, stock_available - $1) WHERE variant_id = $2 AND branch_id = $3`,
          [item.quantity, item.variant_id, branchId]
        );
      }
    }
  }
}

// ─── Pre-Sales (QR) ─────────────────────────────────────────
async function simulatePreSales(ctx: DayContext): Promise<void> {
  const branchId = pick(ctx.setup.branchIds);
  const employeeId = pick(ctx.setup.employeeIds);
  const customerId = chance(0.6) ? pick(ctx.setup.customerIds) : null;

  const itemCount = randomInt(1, 3);
  const items: { variant_id: string; quantity: number; unit_price: number; subtotal: number }[] = [];
  let totalAmount = 0;

  for (let i = 0; i < itemCount; i++) {
    const variantId = pick(ctx.setup.variantIds);
    const qty = 1;
    const price = randomFloat(400, 2500);
    const subtotal = Math.round(price * qty * 100) / 100;
    items.push({ variant_id: variantId, quantity: qty, unit_price: price, subtotal });
    totalAmount += subtotal;
  }

  const expiresAt = new Date(ctx.date.getTime() + 86400000 * randomInt(1, 3));
  const qrCode = `QR-${uuid().substring(0, 12).toUpperCase()}`;
  const status = chance(0.3) ? 'converted' : chance(0.1) ? 'expired' : 'open';

  const preSaleId = await insert(ctx.pool, 'pre_sales', {
    branch_id: branchId,
    employee_id: employeeId,
    customer_id: customerId,
    status,
    total_amount: totalAmount,
    qr_code: qrCode,
    expires_at: expiresAt.toISOString(),
    created_at: ctx.date.toISOString(),
  });

  for (const item of items) {
    await insert(ctx.pool, 'pre_sale_items', {
      pre_sale_id: preSaleId,
      ...item,
    });
  }
}

// ─── Credit Operations ──────────────────────────────────────
async function simulateCreditOps(ctx: DayContext): Promise<void> {
  const creditAccounts = await query(ctx.pool,
    `SELECT id, customer_id, credit_limit, current_balance FROM credit_accounts WHERE is_active = true`
  );
  if (creditAccounts.rows.length === 0) return;

  // Credit charges — some sales go on credit
  if (chance(ctx.profile.creditRate)) {
    const account = pick(creditAccounts.rows);
    const available = parseFloat(account.credit_limit) - parseFloat(account.current_balance);
    if (available < 500) return;

    const chargeAmount = Math.round(randomFloat(500, Math.min(available, 3000)) * 100) / 100;
    const newBalance = parseFloat(account.current_balance) + chargeAmount;
    const dueDate = new Date(ctx.date.getTime() + 86400000 * 30);

    const branchId = pick(ctx.setup.branchIds);
    const employeeId = pick(ctx.setup.employeeIds);
    const session = ctx.activeSessions.get(branchId);

    await insert(ctx.pool, 'credit_transactions', {
      credit_account_id: account.id,
      type: 'charge',
      amount: chargeAmount,
      balance_after: Math.round(newBalance * 100) / 100,
      sale_id: null,
      payment_method: null,
      reference: `Venta a crédito ${ctx.date.toISOString().split('T')[0]}`,
      due_date: dueDate.toISOString().split('T')[0],
      employee_id: employeeId,
      pos_session_id: session?.sessionId || null,
      created_at: ctx.date.toISOString(),
    });

    await query(ctx.pool,
      `UPDATE credit_accounts SET current_balance = $1, updated_at = $2 WHERE id = $3`,
      [Math.round(newBalance * 100) / 100, ctx.date.toISOString(), account.id]
    );
  }

  // Credit payments — customers pay down balances
  if (chance(0.2)) {
    const withBalance = creditAccounts.rows.filter((a: any) => parseFloat(a.current_balance) > 0);
    if (withBalance.length === 0) return;

    const account = pick(withBalance);
    const balance = parseFloat(account.current_balance);
    const paymentAmount = Math.round(randomFloat(Math.min(balance, 300), balance) * 100) / 100;
    const newBalance = Math.round((balance - paymentAmount) * 100) / 100;

    const branchId = pick(ctx.setup.branchIds);
    const employeeId = pick(ctx.setup.employeeIds);
    const session = ctx.activeSessions.get(branchId);

    await insert(ctx.pool, 'credit_transactions', {
      credit_account_id: account.id,
      type: 'payment',
      amount: paymentAmount,
      balance_after: newBalance,
      sale_id: null,
      payment_method: pick(['cash', 'card', 'transfer']),
      reference: `Abono a cuenta ${ctx.date.toISOString().split('T')[0]}`,
      due_date: null,
      employee_id: employeeId,
      pos_session_id: session?.sessionId || null,
      created_at: ctx.date.toISOString(),
    });

    await query(ctx.pool,
      `UPDATE credit_accounts SET current_balance = $1, updated_at = $2 WHERE id = $3`,
      [newBalance, ctx.date.toISOString(), account.id]
    );
  }
}

// ─── Expire Overdue Layaways ────────────────────────────────
async function expireOverdueLayaways(ctx: DayContext): Promise<void> {
  const dateStr = ctx.date.toISOString().split('T')[0];
  await query(ctx.pool,
    `UPDATE layaways SET status = 'cancelled_forfeited', updated_at = $1
     WHERE status = 'active' AND due_date < $2`,
    [ctx.date.toISOString(), dateStr]
  );
}
