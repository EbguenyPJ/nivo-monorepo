import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { Sale, Branch, Employee, SaleItem, ProductVariant, PosSession, Inventory } from '@nivo/database';

@Injectable()
export class ReportsService {
  constructor(
    @InjectQueue('report-generation')
    private readonly reportQueue: Queue,
  ) {}

  async getSummary(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
    branchId?: string,
  ) {
    const saleRepo = connection.getRepository(Sale);

    const countQb = saleRepo.createQueryBuilder('sale').where('sale.status = :status', { status: 'completed' });
    const aggQb = saleRepo
      .createQueryBuilder('sale')
      .select('SUM(sale.total_amount)', 'total_revenue')
      .addSelect('AVG(sale.total_amount)', 'avg_ticket')
      .where('sale.status = :status', { status: 'completed' });

    if (branchId) {
      countQb.andWhere('sale.branch_id = :branchId', { branchId });
      aggQb.andWhere('sale.branch_id = :branchId', { branchId });
    }
    if (startDate) {
      countQb.andWhere('sale.created_at >= :startDate', { startDate });
      aggQb.andWhere('sale.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      countQb.andWhere('sale.created_at <= :endDate', { endDate });
      aggQb.andWhere('sale.created_at <= :endDate', { endDate });
    }

    const totalSales = await countQb.getCount();
    const result = await aggQb.getRawOne();

    return {
      total_sales: totalSales,
      total_revenue: parseFloat(result?.total_revenue || '0'),
      avg_ticket: parseFloat(result?.avg_ticket || '0'),
    };
  }

  async getSales(
    connection: DataSource,
    options: { startDate?: string; endDate?: string; limit?: number; offset?: number; branchId?: string },
  ) {
    const saleRepo = connection.getRepository(Sale);
    const qb = saleRepo
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.employee', 'employee')
      .leftJoinAndSelect('sale.branch', 'branch')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.items', 'items')
      .orderBy('sale.created_at', 'DESC');

    if (options.branchId) {
      qb.andWhere('sale.branch_id = :branchId', { branchId: options.branchId });
    }
    if (options.startDate) {
      qb.andWhere('sale.created_at >= :startDate', { startDate: options.startDate });
    }
    if (options.endDate) {
      qb.andWhere('sale.created_at <= :endDate', { endDate: options.endDate });
    }

    const limit = options.limit || 20;
    const offset = options.offset || 0;
    qb.take(limit).skip(offset);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getDailySales(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
    branchId?: string,
  ) {
    const saleRepo = connection.getRepository(Sale);
    const qb = saleRepo
      .createQueryBuilder('sale')
      .select("DATE(sale.created_at)", 'date')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.total_amount)', 'revenue')
      .where('sale.status = :status', { status: 'completed' })
      .groupBy("DATE(sale.created_at)")
      .orderBy("DATE(sale.created_at)", 'ASC');

    if (branchId) {
      qb.andWhere('sale.branch_id = :branchId', { branchId });
    }
    if (startDate) {
      qb.andWhere('sale.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('sale.created_at <= :endDate', { endDate });
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      date: r.date,
      count: parseInt(r.count, 10),
      revenue: parseFloat(r.revenue || '0'),
    }));
  }

  /**
   * Cross-branch comparison for the General dashboard.
   * Returns per-branch KPIs: revenue, sales count, avg ticket, employee count.
   */
  async getBranchComparison(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
  ) {
    const saleRepo = connection.getRepository(Sale);
    const branchRepo = connection.getRepository(Branch);
    const employeeRepo = connection.getRepository(Employee);

    // Get all active branches
    const branches = await branchRepo.find({ where: { is_active: true }, order: { name: 'ASC' } });

    // Sales aggregation per branch
    const salesQb = saleRepo
      .createQueryBuilder('sale')
      .select('sale.branch_id', 'branch_id')
      .addSelect('COUNT(sale.id)', 'total_sales')
      .addSelect('SUM(sale.total_amount)', 'total_revenue')
      .addSelect('AVG(sale.total_amount)', 'avg_ticket')
      .where('sale.status = :status', { status: 'completed' })
      .groupBy('sale.branch_id');

    if (startDate) salesQb.andWhere('sale.created_at >= :startDate', { startDate });
    if (endDate) salesQb.andWhere('sale.created_at <= :endDate', { endDate });

    const salesRows = await salesQb.getRawMany();
    const salesMap = new Map(salesRows.map((r) => [r.branch_id, r]));

    // Employee count per branch
    const empCounts = await employeeRepo
      .createQueryBuilder('emp')
      .select('emp.branch_id', 'branch_id')
      .addSelect('COUNT(emp.id)', 'count')
      .where('emp.is_active = :active', { active: true })
      .groupBy('emp.branch_id')
      .getRawMany();
    const empMap = new Map(empCounts.map((r) => [r.branch_id, parseInt(r.count, 10)]));

    return {
      branches: branches.map((b) => {
        const sales = salesMap.get(b.id);
        return {
          branch_id: b.id,
          branch_name: b.name,
          total_revenue: parseFloat(sales?.total_revenue || '0'),
          total_sales: parseInt(sales?.total_sales || '0', 10),
          avg_ticket: parseFloat(sales?.avg_ticket || '0'),
          employee_count: empMap.get(b.id) || 0,
        };
      }),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PAYMENT METHOD BREAKDOWN — for donut chart in Sales report
  // ═══════════════════════════════════════════════════════════════════

  async getPaymentBreakdown(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
    branchId?: string,
  ) {
    const qb = connection.getRepository(Sale)
      .createQueryBuilder('s')
      .select('s.payment_method', 'method')
      .addSelect('COUNT(s.id)', 'count')
      .addSelect('SUM(s.total_amount)', 'total')
      .where('s.status = :status', { status: 'completed' })
      .groupBy('s.payment_method')
      .orderBy('SUM(s.total_amount)', 'DESC');

    if (branchId)   qb.andWhere('s.branch_id = :branchId', { branchId });
    if (startDate)  qb.andWhere('s.created_at >= :startDate', { startDate });
    if (endDate)    qb.andWhere('s.created_at <= :endDate', { endDate });

    const rows = await qb.getRawMany();
    const LABELS: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', mixed: 'Mixto', online: 'En línea' };
    return rows.map((r) => ({
      method: r.method as string,
      label: LABELS[r.method] ?? r.method,
      count: parseInt(r.count) || 0,
      total: parseFloat(r.total) || 0,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DAY-OF-WEEK VOLUME — ticket count per day of week
  // ═══════════════════════════════════════════════════════════════════

  async getDayOfWeekVolume(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
    branchId?: string,
  ) {
    const params: any[] = [];
    let idx = 1;
    let sql = `
      SELECT EXTRACT(DOW FROM created_at)::int AS dow, COUNT(*)::int AS count
      FROM sales
      WHERE status = 'completed'
    `;
    if (branchId)  { sql += ` AND branch_id = $${idx++}`;      params.push(branchId); }
    if (startDate) { sql += ` AND created_at >= $${idx++}`;    params.push(startDate); }
    if (endDate)   { sql += ` AND created_at <= $${idx++}`;    params.push(endDate); }
    sql += ' GROUP BY dow ORDER BY dow';

    const rows: any[] = await connection.query(sql, params);
    const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    // Ensure all 7 days present
    const map = new Map(rows.map((r) => [Number(r.dow), Number(r.count)]));
    return Array.from({ length: 7 }, (_, i) => ({
      dow: i,
      day_name: DAY_NAMES[i],
      count: map.get(i) ?? 0,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SELLER PERFORMANCE — leaderboard with avg ticket + UPT
  // ═══════════════════════════════════════════════════════════════════

  async getSellerPerformance(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
    branchId?: string,
  ) {
    const params: any[] = [];
    let idx = 1;
    let sql = `
      SELECT
        e.id AS employee_id,
        e.name AS employee_name,
        COUNT(DISTINCT s.id)::int AS sale_count,
        COALESCE(SUM(s.total_amount), 0) AS revenue,
        COALESCE(SUM(si.quantity), 0)::int AS units_sold
      FROM sales s
      JOIN employees e ON e.id = s.employee_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed'
    `;
    if (branchId)  { sql += ` AND s.branch_id = $${idx++}`;   params.push(branchId); }
    if (startDate) { sql += ` AND s.created_at >= $${idx++}`; params.push(startDate); }
    if (endDate)   { sql += ` AND s.created_at <= $${idx++}`; params.push(endDate); }
    sql += ' GROUP BY e.id, e.name ORDER BY revenue DESC';

    const rows: any[] = await connection.query(sql, params);
    return rows.map((r) => {
      const saleCount = Number(r.sale_count) || 1;
      const revenue   = parseFloat(r.revenue) || 0;
      const units     = Number(r.units_sold) || 0;
      return {
        employee_id:   r.employee_id,
        employee_name: r.employee_name,
        sale_count: saleCount,
        revenue,
        avg_ticket: Math.round((revenue / saleCount) * 100) / 100,
        upt: Math.round((units / saleCount) * 10) / 10,
        units_sold: units,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SELL-THROUGH RATE — sold units / (sold + available) per branch
  // ═══════════════════════════════════════════════════════════════════

  async getSellThrough(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
  ) {
    // Units sold per branch in period
    const soldParams: any[] = [];
    let idx = 1;
    let soldSql = `
      SELECT s.branch_id, COALESCE(SUM(si.quantity), 0)::int AS sold_units
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed'
    `;
    if (startDate) { soldSql += ` AND s.created_at >= $${idx++}`; soldParams.push(startDate); }
    if (endDate)   { soldSql += ` AND s.created_at <= $${idx++}`; soldParams.push(endDate); }
    soldSql += ' GROUP BY s.branch_id';

    const soldRows: any[] = await connection.query(soldSql, soldParams);
    const soldMap = new Map(soldRows.map((r) => [r.branch_id, Number(r.sold_units)]));

    // Current available stock per branch
    const stockQb = connection.getRepository(Inventory)
      .createQueryBuilder('inv')
      .select('inv.branch_id', 'branch_id')
      .addSelect('COALESCE(SUM(inv.stock_available), 0)', 'stock');
    const stockRows = await stockQb.groupBy('inv.branch_id').getRawMany();
    const stockMap = new Map(stockRows.map((r) => [r.branch_id, parseFloat(r.stock) || 0]));

    // All active branches
    const branches = await connection.getRepository(Branch).find({ where: { is_active: true }, order: { name: 'ASC' } });

    return branches.map((b) => {
      const sold  = soldMap.get(b.id)  ?? 0;
      const stock = stockMap.get(b.id) ?? 0;
      const total = sold + stock;
      return {
        branch_id:   b.id,
        branch_name: b.name,
        sold_units:  sold,
        stock_units: Math.round(stock),
        rate: total > 0 ? Math.round((sold / total) * 1000) / 10 : 0,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CASH DIFFERENCE TREND — POS session differences over time
  // ═══════════════════════════════════════════════════════════════════

  async getCashDifferenceTrend(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
    branchId?: string,
  ) {
    const params: any[] = [];
    let idx = 1;
    let sql = `
      SELECT
        DATE(ps.closed_at) AS date,
        COALESCE(SUM(ps.difference), 0) AS total_difference,
        COUNT(*)::int AS session_count
      FROM pos_sessions ps
      WHERE ps.status = 'closed' AND ps.closed_at IS NOT NULL
    `;
    if (branchId)  { sql += ` AND ps.branch_id = $${idx++}`;   params.push(branchId); }
    if (startDate) { sql += ` AND ps.closed_at >= $${idx++}`;  params.push(startDate); }
    if (endDate)   { sql += ` AND ps.closed_at <= $${idx++}`;  params.push(endDate); }
    sql += ' GROUP BY DATE(ps.closed_at) ORDER BY DATE(ps.closed_at)';

    const rows: any[] = await connection.query(sql, params);
    return rows.map((r) => ({
      date:             r.date,
      difference:       parseFloat(r.total_difference) || 0,
      session_count:    Number(r.session_count),
    }));
  }

  async enqueueExport(tenant: any) {
    await this.reportQueue.add('generate-report', {
      database_name: tenant.database_name,
      report_type: 'sales-csv',
      tenant_id: tenant.id,
    });

    return { message: 'Report generation queued. You will be notified when ready.' };
  }
}
