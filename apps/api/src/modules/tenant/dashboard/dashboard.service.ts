import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  Sale, SaleItem, ProductVariant, Product, Brand,
  Inventory, InventoryAudit, InventoryTransfer, InventoryAdjustment,
  Employee,
} from '@nivo/database';

@Injectable()
export class DashboardService {

  // ═══════════════════════════════════════════════════════════════════
  //  MAIN KPIs — Revenue, Gross Profit, Shrinkage, Avg Ticket
  // ═══════════════════════════════════════════════════════════════════

  async getKpis(connection: DataSource, filters: {
    branch_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const saleRepo = connection.getRepository(Sale);

    // ── Base query for completed sales in range ──
    const qb = saleRepo.createQueryBuilder('s')
      .leftJoin('s.items', 'si')
      .where('s.status = :status', { status: 'completed' });

    if (filters.branch_id) qb.andWhere('s.branch_id = :bid', { bid: filters.branch_id });
    if (filters.start_date) qb.andWhere('s.created_at >= :start', { start: filters.start_date });
    if (filters.end_date) qb.andWhere('s.created_at <= :end', { end: filters.end_date });

    // Net revenue = sum of sale totals
    const revenueResult = await qb
      .select('COALESCE(SUM(s.total_amount), 0)', 'net_revenue')
      .addSelect('COUNT(DISTINCT s.id)', 'sale_count')
      .getRawOne();

    const netRevenue = parseFloat(revenueResult.net_revenue) || 0;
    const saleCount = parseInt(revenueResult.sale_count) || 0;
    const avgTicket = saleCount > 0 ? netRevenue / saleCount : 0;

    // ── COGS from sale items (uses unit_cost_at_sale when available, falls back to current variant cost) ──
    const cogsQb = connection.createQueryBuilder()
      .select(`COALESCE(SUM(
        CASE
          WHEN si.unit_cost_at_sale IS NOT NULL
            THEN si.unit_cost_at_sale * si.quantity
          ELSE COALESCE(pv.cost, 0) * si.quantity
        END
      ), 0)`, 'total_cogs')
      .from(SaleItem, 'si')
      .innerJoin(Sale, 's', 's.id = si.sale_id')
      .leftJoin(ProductVariant, 'pv', 'pv.id = si.variant_id')
      .where('s.status = :status', { status: 'completed' });

    if (filters.branch_id) cogsQb.andWhere('s.branch_id = :bid', { bid: filters.branch_id });
    if (filters.start_date) cogsQb.andWhere('s.created_at >= :start', { start: filters.start_date });
    if (filters.end_date) cogsQb.andWhere('s.created_at <= :end', { end: filters.end_date });

    const cogsResult = await cogsQb.getRawOne();
    const totalCogs = parseFloat(cogsResult.total_cogs) || 0;
    const grossProfit = netRevenue - totalCogs;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // ── Shrinkage: sum of negative adjustments in the period ──
    const shrinkageQb = connection.getRepository(InventoryAdjustment).createQueryBuilder('adj')
      .select('COALESCE(SUM(ABS(adj.quantity)), 0)', 'shrinkage_units')
      .where('adj.quantity < 0')
      .andWhere("adj.reason NOT IN ('sale', 'transfer', 'return')");

    if (filters.branch_id) shrinkageQb.andWhere('adj.branch_id = :bid', { bid: filters.branch_id });
    if (filters.start_date) shrinkageQb.andWhere('adj.created_at >= :start', { start: filters.start_date });
    if (filters.end_date) shrinkageQb.andWhere('adj.created_at <= :end', { end: filters.end_date });

    let shrinkageUnits = 0;
    try {
      const shrinkageResult = await shrinkageQb.getRawOne();
      shrinkageUnits = parseInt(shrinkageResult.shrinkage_units) || 0;
    } catch {
      // Table or column may not exist yet in some tenants
    }

    // ── Previous period comparison (same duration, shifted back) ──
    let prevNetRevenue = 0;
    let prevGrossProfit = 0;
    let prevSaleCount = 0;
    if (filters.start_date && filters.end_date) {
      const start = new Date(filters.start_date);
      const end = new Date(filters.end_date);
      const durationMs = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - durationMs);
      const prevEnd = new Date(start);

      const prevRevQb = saleRepo.createQueryBuilder('s')
        .select('COALESCE(SUM(s.total_amount), 0)', 'net_revenue')
        .addSelect('COUNT(DISTINCT s.id)', 'sale_count')
        .where('s.status = :status', { status: 'completed' })
        .andWhere('s.created_at >= :start', { start: prevStart.toISOString() })
        .andWhere('s.created_at <= :end', { end: prevEnd.toISOString() });

      if (filters.branch_id) prevRevQb.andWhere('s.branch_id = :bid', { bid: filters.branch_id });

      const prevResult = await prevRevQb.getRawOne();
      prevNetRevenue = parseFloat(prevResult.net_revenue) || 0;
      prevSaleCount = parseInt(prevResult.sale_count) || 0;

      // Previous COGS
      const prevCogsQb = connection.createQueryBuilder()
        .select(`COALESCE(SUM(
          CASE
            WHEN si.unit_cost_at_sale IS NOT NULL
              THEN si.unit_cost_at_sale * si.quantity
            ELSE COALESCE(pv.cost, 0) * si.quantity
          END
        ), 0)`, 'total_cogs')
        .from(SaleItem, 'si')
        .innerJoin(Sale, 's', 's.id = si.sale_id')
        .leftJoin(ProductVariant, 'pv', 'pv.id = si.variant_id')
        .where('s.status = :status', { status: 'completed' })
        .andWhere('s.created_at >= :start', { start: prevStart.toISOString() })
        .andWhere('s.created_at <= :end', { end: prevEnd.toISOString() });

      if (filters.branch_id) prevCogsQb.andWhere('s.branch_id = :bid', { bid: filters.branch_id });

      const prevCogsResult = await prevCogsQb.getRawOne();
      prevGrossProfit = prevNetRevenue - (parseFloat(prevCogsResult.total_cogs) || 0);
    }

    const revenueChange = prevNetRevenue > 0
      ? ((netRevenue - prevNetRevenue) / prevNetRevenue) * 100 : 0;
    const profitChange = prevGrossProfit > 0
      ? ((grossProfit - prevGrossProfit) / prevGrossProfit) * 100 : 0;
    const ticketChange = prevSaleCount > 0
      ? ((avgTicket - (prevNetRevenue / prevSaleCount)) / (prevNetRevenue / prevSaleCount)) * 100 : 0;

    return {
      net_revenue: netRevenue,
      net_revenue_change: Math.round(revenueChange * 10) / 10,
      gross_profit: grossProfit,
      gross_margin: Math.round(grossMargin * 10) / 10,
      gross_profit_change: Math.round(profitChange * 10) / 10,
      shrinkage_units: shrinkageUnits,
      avg_ticket: Math.round(avgTicket * 100) / 100,
      avg_ticket_change: Math.round(ticketChange * 10) / 10,
      sale_count: saleCount,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PROFITABILITY TREND — daily revenue + gross profit over time
  // ═══════════════════════════════════════════════════════════════════

  async getProfitabilityTrend(connection: DataSource, filters: {
    branch_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const qb = connection.createQueryBuilder()
      .select("DATE(s.created_at)", 'date')
      .addSelect('COALESCE(SUM(s.total_amount), 0)', 'revenue')
      .addSelect(`COALESCE(SUM(
        CASE
          WHEN si.unit_cost_at_sale IS NOT NULL
            THEN si.unit_cost_at_sale * si.quantity
          ELSE COALESCE(pv.cost, 0) * si.quantity
        END
      ), 0)`, 'cogs')
      .addSelect('COUNT(DISTINCT s.id)', 'sales')
      .from(Sale, 's')
      .leftJoin(SaleItem, 'si', 'si.sale_id = s.id')
      .leftJoin(ProductVariant, 'pv', 'pv.id = si.variant_id')
      .where('s.status = :status', { status: 'completed' });

    if (filters.branch_id) qb.andWhere('s.branch_id = :bid', { bid: filters.branch_id });
    if (filters.start_date) qb.andWhere('s.created_at >= :start', { start: filters.start_date });
    if (filters.end_date) qb.andWhere('s.created_at <= :end', { end: filters.end_date });

    qb.groupBy("DATE(s.created_at)")
      .orderBy("DATE(s.created_at)", 'ASC');

    const rows = await qb.getRawMany();

    return rows.map((r) => ({
      date: r.date,
      revenue: parseFloat(r.revenue) || 0,
      gross_profit: (parseFloat(r.revenue) || 0) - (parseFloat(r.cogs) || 0),
      sales: parseInt(r.sales) || 0,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  OPERATIONAL ALERTS — pending audits, stale transfers, low stock
  // ═══════════════════════════════════════════════════════════════════

  async getAlerts(connection: DataSource, branchId?: string) {
    const alerts: { type: string; severity: 'critical' | 'warning' | 'info'; title: string; description: string; count?: number }[] = [];

    // 1. Pending audits (draft or counting)
    try {
      const auditQb = connection.getRepository(InventoryAudit).createQueryBuilder('a')
        .where('a.status IN (:...statuses)', { statuses: ['draft', 'counting', 'review'] });
      if (branchId) auditQb.andWhere('a.branch_id = :bid', { bid: branchId });
      const pendingAudits = await auditQb.getCount();
      if (pendingAudits > 0) {
        alerts.push({
          type: 'pending_audits',
          severity: 'warning',
          title: 'Auditorias pendientes',
          description: `${pendingAudits} auditoria${pendingAudits > 1 ? 's' : ''} sin completar`,
          count: pendingAudits,
        });
      }
    } catch { /* table may not exist */ }

    // 2. Stale transfers (in_transit > 3 days)
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const transferQb = connection.getRepository(InventoryTransfer).createQueryBuilder('t')
        .where('t.status = :status', { status: 'in_transit' })
        .andWhere('t.shipped_at <= :cutoff', { cutoff: threeDaysAgo.toISOString() });
      if (branchId) {
        transferQb.andWhere('(t.origin_branch_id = :bid OR t.destination_branch_id = :bid)', { bid: branchId });
      }
      const staleTransfers = await transferQb.getCount();
      if (staleTransfers > 0) {
        alerts.push({
          type: 'stale_transfers',
          severity: 'critical',
          title: 'Transferencias estancadas',
          description: `${staleTransfers} transferencia${staleTransfers > 1 ? 's' : ''} en transito por mas de 3 dias`,
          count: staleTransfers,
        });
      }
    } catch { /* table may not exist */ }

    // 3. Low stock models (stock_available <= stock_minimum)
    try {
      const invQb = connection.getRepository(Inventory).createQueryBuilder('i')
        .where('i.stock_available <= i.stock_minimum')
        .andWhere('i.stock_minimum > 0');
      if (branchId) invQb.andWhere('i.branch_id = :bid', { bid: branchId });
      const lowStockCount = await invQb.getCount();
      if (lowStockCount > 0) {
        alerts.push({
          type: 'low_stock',
          severity: lowStockCount > 10 ? 'critical' : 'warning',
          title: 'Stock bajo',
          description: `${lowStockCount} variante${lowStockCount > 1 ? 's' : ''} por debajo del minimo`,
          count: lowStockCount,
        });
      }
    } catch { /* table may not exist */ }

    // 4. Transfers with discrepancies pending review
    try {
      const discrepancyQb = connection.getRepository(InventoryTransfer).createQueryBuilder('t')
        .where('t.status = :status', { status: 'discrepancy' });
      if (branchId) {
        discrepancyQb.andWhere('(t.origin_branch_id = :bid OR t.destination_branch_id = :bid)', { bid: branchId });
      }
      const discrepancyCount = await discrepancyQb.getCount();
      if (discrepancyCount > 0) {
        alerts.push({
          type: 'transfer_discrepancy',
          severity: 'warning',
          title: 'Discrepancias en transferencias',
          description: `${discrepancyCount} transferencia${discrepancyCount > 1 ? 's' : ''} con diferencias por revisar`,
          count: discrepancyCount,
        });
      }
    } catch { /* table may not exist */ }

    return alerts;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TOP 5 MOST PROFITABLE PRODUCTS
  // ═══════════════════════════════════════════════════════════════════

  async getTopProfitable(connection: DataSource, filters: {
    branch_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) {
    const limit = filters.limit || 5;

    const qb = connection.createQueryBuilder()
      .select('p.id', 'product_id')
      .addSelect('p.name', 'product_name')
      .addSelect('b.name', 'brand_name')
      .addSelect('SUM(si.subtotal)', 'revenue')
      .addSelect(`SUM(
        CASE
          WHEN si.unit_cost_at_sale IS NOT NULL
            THEN si.unit_cost_at_sale * si.quantity
          ELSE COALESCE(pv.cost, 0) * si.quantity
        END
      )`, 'cogs')
      .addSelect('SUM(si.quantity)', 'units_sold')
      .from(SaleItem, 'si')
      .innerJoin(Sale, 's', 's.id = si.sale_id')
      .innerJoin(ProductVariant, 'pv', 'pv.id = si.variant_id')
      .innerJoin(Product, 'p', 'p.id = pv.product_id')
      .leftJoin(Brand, 'b', 'b.id = p.brand_id')
      .where('s.status = :status', { status: 'completed' });

    if (filters.branch_id) qb.andWhere('s.branch_id = :bid', { bid: filters.branch_id });
    if (filters.start_date) qb.andWhere('s.created_at >= :start', { start: filters.start_date });
    if (filters.end_date) qb.andWhere('s.created_at <= :end', { end: filters.end_date });

    qb.groupBy('p.id')
      .addGroupBy('p.name')
      .addGroupBy('b.name')
      .orderBy(`SUM(si.subtotal) - SUM(
        CASE
          WHEN si.unit_cost_at_sale IS NOT NULL
            THEN si.unit_cost_at_sale * si.quantity
          ELSE COALESCE(pv.cost, 0) * si.quantity
        END
      )`, 'DESC')
      .limit(limit);

    const rows = await qb.getRawMany();

    return rows.map((r) => {
      const revenue = parseFloat(r.revenue) || 0;
      const cogs = parseFloat(r.cogs) || 0;
      const profit = revenue - cogs;
      return {
        product_id: r.product_id,
        product_name: r.product_name,
        brand_name: r.brand_name || null,
        revenue,
        cogs,
        profit,
        margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
        units_sold: parseInt(r.units_sold) || 0,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PROFITABILITY DRILL-DOWN — groupable by brand, collection, seller
  // ═══════════════════════════════════════════════════════════════════

  async getProfitabilityReport(connection: DataSource, filters: {
    branch_id?: string;
    start_date?: string;
    end_date?: string;
    group_by: 'brand' | 'collection' | 'seller';
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;

    let groupField: string;
    let groupName: string;
    let joinClause: string;

    switch (filters.group_by) {
      case 'brand':
        groupField = 'b.id';
        groupName = "COALESCE(b.name, 'Sin marca')";
        joinClause = '';
        break;
      case 'collection':
        groupField = 'col.id';
        groupName = "COALESCE(col.name, 'Sin coleccion')";
        joinClause = '';
        break;
      case 'seller':
        groupField = 's.employee_id';
        groupName = "COALESCE(e.name, 'Desconocido')";
        joinClause = '';
        break;
      default:
        groupField = 'b.id';
        groupName = "COALESCE(b.name, 'Sin marca')";
    }

    // Build raw query for flexibility
    let sql = `
      SELECT
        ${groupField} as group_id,
        ${groupName} as group_name,
        COUNT(DISTINCT s.id) as sale_count,
        SUM(si.quantity) as units_sold,
        SUM(si.subtotal) as revenue,
        SUM(
          CASE
            WHEN si.unit_cost_at_sale IS NOT NULL
              THEN si.unit_cost_at_sale * si.quantity
            ELSE COALESCE(pv.cost, 0) * si.quantity
          END
        ) as cogs
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      INNER JOIN product_variants pv ON pv.id = si.variant_id
      INNER JOIN products p ON p.id = pv.product_id
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN employees e ON e.id = s.employee_id
    `;

    // Collection join requires going through collection_products
    if (filters.group_by === 'collection') {
      sql += ` LEFT JOIN collection_products cp ON cp.product_id = p.id
               LEFT JOIN collections col ON col.id = cp.collection_id`;
    }

    sql += ` WHERE s.status = 'completed'`;

    const params: any[] = [];
    let paramIdx = 1;

    if (filters.branch_id) {
      sql += ` AND s.branch_id = $${paramIdx++}`;
      params.push(filters.branch_id);
    }
    if (filters.start_date) {
      sql += ` AND s.created_at >= $${paramIdx++}`;
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      sql += ` AND s.created_at <= $${paramIdx++}`;
      params.push(filters.end_date);
    }

    sql += ` GROUP BY ${groupField}, ${groupName}`;
    sql += ` ORDER BY SUM(si.subtotal) - SUM(
      CASE
        WHEN si.unit_cost_at_sale IS NOT NULL
          THEN si.unit_cost_at_sale * si.quantity
        ELSE COALESCE(pv.cost, 0) * si.quantity
      END
    ) DESC`;

    // Count total groups
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) sub`;
    const countResult = await connection.query(countSql, params);
    const total = parseInt(countResult[0]?.total) || 0;

    sql += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, (page - 1) * limit);

    const rows = await connection.query(sql, params);

    const items = rows.map((r: any) => {
      const revenue = parseFloat(r.revenue) || 0;
      const cogs = parseFloat(r.cogs) || 0;
      const profit = revenue - cogs;
      return {
        group_id: r.group_id,
        group_name: r.group_name,
        sale_count: parseInt(r.sale_count) || 0,
        units_sold: parseInt(r.units_sold) || 0,
        revenue,
        cogs,
        profit,
        margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
      };
    });

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
}
