import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  Sale, SaleItem, ProductVariant, Product, Brand,
  Inventory, PosSession, CashTransaction,
} from '@nivo/database';

export interface DailyBriefData {
  date: string;
  tenant_name: string;
  sales_yesterday: {
    total_revenue: number;
    sale_count: number;
    avg_ticket: number;
  };
  sales_day_before: {
    total_revenue: number;
    sale_count: number;
    avg_ticket: number;
  };
  change_percent: number;
  low_stock_alerts: {
    count: number;
    items: { product_name: string; variant_sku: string; branch_name: string; stock: number; minimum: number }[];
  };
  cash_discrepancies: {
    count: number;
    items: { branch_name: string; employee_name: string; expected: number; actual: number; difference: number }[];
  };
  top_product: { name: string; units: number; revenue: number } | null;
  greeting: string;
}

@Injectable()
export class DailyBriefingService {
  private readonly logger = new Logger(DailyBriefingService.name);

  async generateBrief(
    connection: DataSource,
    tenantName: string,
    referenceDate?: Date,
  ): Promise<DailyBriefData> {
    const now = referenceDate || new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(now);
    dayBefore.setDate(dayBefore.getDate() - 2);

    const yStart = this.startOfDay(yesterday);
    const yEnd = this.endOfDay(yesterday);
    const dbStart = this.startOfDay(dayBefore);
    const dbEnd = this.endOfDay(dayBefore);

    const [salesYesterday, salesDayBefore, lowStock, cashDiscrepancies, topProduct] =
      await Promise.all([
        this.getSalesSummary(connection, yStart, yEnd),
        this.getSalesSummary(connection, dbStart, dbEnd),
        this.getLowStockAlerts(connection),
        this.getCashDiscrepancies(connection, yStart, yEnd),
        this.getTopProduct(connection, yStart, yEnd),
      ]);

    const change = salesDayBefore.total_revenue > 0
      ? ((salesYesterday.total_revenue - salesDayBefore.total_revenue) / salesDayBefore.total_revenue) * 100
      : 0;

    const hour = now.getHours();
    let greeting: string;
    if (hour < 12) greeting = 'Buenos días';
    else if (hour < 18) greeting = 'Buenas tardes';
    else greeting = 'Buenas noches';

    return {
      date: yesterday.toISOString().split('T')[0],
      tenant_name: tenantName,
      sales_yesterday: salesYesterday,
      sales_day_before: salesDayBefore,
      change_percent: Math.round(change * 10) / 10,
      low_stock_alerts: lowStock,
      cash_discrepancies: cashDiscrepancies,
      top_product: topProduct,
      greeting,
    };
  }

  private async getSalesSummary(
    conn: DataSource,
    start: string,
    end: string,
  ): Promise<{ total_revenue: number; sale_count: number; avg_ticket: number }> {
    const result = await conn.createQueryBuilder()
      .select('COALESCE(SUM(s.total_amount), 0)', 'revenue')
      .addSelect('COUNT(DISTINCT s.id)', 'cnt')
      .from(Sale, 's')
      .where('s.status = :status', { status: 'completed' })
      .andWhere('s.created_at >= :start', { start })
      .andWhere('s.created_at <= :end', { end })
      .getRawOne();

    const revenue = parseFloat(result.revenue) || 0;
    const count = parseInt(result.cnt) || 0;

    return {
      total_revenue: revenue,
      sale_count: count,
      avg_ticket: count > 0 ? Math.round((revenue / count) * 100) / 100 : 0,
    };
  }

  private async getLowStockAlerts(conn: DataSource) {
    const rows = await conn.query(`
      SELECT
        p.name AS product_name,
        pv.sku AS variant_sku,
        b.name AS branch_name,
        i.stock_available AS stock,
        i.stock_minimum AS minimum
      FROM inventory i
      INNER JOIN product_variants pv ON pv.id = i.variant_id
      INNER JOIN products p ON p.id = pv.product_id
      INNER JOIN branches b ON b.id = i.branch_id
      WHERE i.stock_available <= i.stock_minimum
        AND i.stock_minimum > 0
      ORDER BY (i.stock_minimum - i.stock_available) DESC
      LIMIT 10
    `);

    return {
      count: rows.length,
      items: rows.map((r: any) => ({
        product_name: r.product_name,
        variant_sku: r.variant_sku || 'N/A',
        branch_name: r.branch_name,
        stock: parseInt(r.stock) || 0,
        minimum: parseInt(r.minimum) || 0,
      })),
    };
  }

  private async getCashDiscrepancies(conn: DataSource, start: string, end: string) {
    const rows = await conn.query(`
      SELECT
        b.name AS branch_name,
        e.name AS employee_name,
        ps.cash_expected AS expected,
        ps.cash_actual AS actual,
        (ps.cash_actual - ps.cash_expected) AS difference
      FROM pos_sessions ps
      INNER JOIN branches b ON b.id = ps.branch_id
      INNER JOIN employees e ON e.id = ps.employee_id
      WHERE ps.closed_at IS NOT NULL
        AND ps.closed_at >= $1
        AND ps.closed_at <= $2
        AND ps.cash_actual IS NOT NULL
        AND ps.cash_expected IS NOT NULL
        AND ABS(ps.cash_actual - ps.cash_expected) > 1
      ORDER BY ABS(ps.cash_actual - ps.cash_expected) DESC
      LIMIT 10
    `, [start, end]);

    return {
      count: rows.length,
      items: rows.map((r: any) => ({
        branch_name: r.branch_name,
        employee_name: r.employee_name,
        expected: parseFloat(r.expected) || 0,
        actual: parseFloat(r.actual) || 0,
        difference: parseFloat(r.difference) || 0,
      })),
    };
  }

  private async getTopProduct(conn: DataSource, start: string, end: string) {
    const rows = await conn.query(`
      SELECT
        p.name,
        SUM(si.quantity) AS units,
        SUM(si.subtotal) AS revenue
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      INNER JOIN product_variants pv ON pv.id = si.variant_id
      INNER JOIN products p ON p.id = pv.product_id
      WHERE s.status = 'completed'
        AND s.created_at >= $1
        AND s.created_at <= $2
      GROUP BY p.id, p.name
      ORDER BY SUM(si.subtotal) DESC
      LIMIT 1
    `, [start, end]);

    if (rows.length === 0) return null;
    return {
      name: rows[0].name,
      units: parseInt(rows[0].units) || 0,
      revenue: parseFloat(rows[0].revenue) || 0,
    };
  }

  buildEmailHtml(brief: DailyBriefData): string {
    const changeTxt = brief.change_percent >= 0
      ? `+${brief.change_percent}% vs antier`
      : `${brief.change_percent}% vs antier`;
    const changeColor = brief.change_percent >= 0 ? '#10b981' : '#ef4444';

    const lowStockRows = brief.low_stock_alerts.items
      .map(i => `<tr><td style="padding:6px 12px;border-bottom:1px solid #333">${i.product_name}</td><td style="padding:6px 12px;border-bottom:1px solid #333">${i.branch_name}</td><td style="padding:6px 12px;border-bottom:1px solid #333;color:#ef4444">${i.stock}/${i.minimum}</td></tr>`)
      .join('');

    const cashRows = brief.cash_discrepancies.items
      .map(i => {
        const diffColor = i.difference < 0 ? '#ef4444' : '#f59e0b';
        return `<tr><td style="padding:6px 12px;border-bottom:1px solid #333">${i.branch_name}</td><td style="padding:6px 12px;border-bottom:1px solid #333">${i.employee_name}</td><td style="padding:6px 12px;border-bottom:1px solid #333;color:${diffColor}">$${i.difference.toFixed(2)}</td></tr>`;
      })
      .join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;color:#e5e5e5">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px">
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="font-size:24px;font-weight:700;margin:0;color:#fff">Nivo Daily Briefing</h1>
      <p style="color:#737373;font-size:14px;margin:4px 0 0">${brief.tenant_name} &mdash; ${brief.date}</p>
    </div>

    <div style="background:#171717;border-radius:12px;padding:24px;margin-bottom:16px;border:1px solid #262626">
      <p style="margin:0 0 8px;font-size:14px;color:#a3a3a3">${brief.greeting}. Ayer cerraste con:</p>
      <p style="margin:0;font-size:36px;font-weight:700;color:#fff">$${brief.sales_yesterday.total_revenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
      <p style="margin:4px 0 0;font-size:14px;color:${changeColor}">${changeTxt}</p>
      <div style="display:flex;gap:24px;margin-top:16px">
        <div><span style="color:#737373;font-size:12px">Ventas</span><br><strong>${brief.sales_yesterday.sale_count}</strong></div>
        <div><span style="color:#737373;font-size:12px">Ticket prom.</span><br><strong>$${brief.sales_yesterday.avg_ticket.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></div>
        ${brief.top_product ? `<div><span style="color:#737373;font-size:12px">Top producto</span><br><strong>${brief.top_product.name}</strong></div>` : ''}
      </div>
    </div>

    ${brief.low_stock_alerts.count > 0 ? `
    <div style="background:#171717;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #262626">
      <h3 style="margin:0 0 12px;font-size:16px;color:#f59e0b">&#x26A0; ${brief.low_stock_alerts.count} producto${brief.low_stock_alerts.count > 1 ? 's' : ''} bajo stock minimo</h3>
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <tr style="color:#737373;font-size:11px;text-transform:uppercase"><th style="text-align:left;padding:6px 12px">Producto</th><th style="text-align:left;padding:6px 12px">Sucursal</th><th style="text-align:left;padding:6px 12px">Stock</th></tr>
        ${lowStockRows}
      </table>
    </div>` : ''}

    ${brief.cash_discrepancies.count > 0 ? `
    <div style="background:#171717;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #262626">
      <h3 style="margin:0 0 12px;font-size:16px;color:#ef4444">&#x1F4B0; ${brief.cash_discrepancies.count} arqueo${brief.cash_discrepancies.count > 1 ? 's' : ''} con diferencia</h3>
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <tr style="color:#737373;font-size:11px;text-transform:uppercase"><th style="text-align:left;padding:6px 12px">Sucursal</th><th style="text-align:left;padding:6px 12px">Empleado</th><th style="text-align:left;padding:6px 12px">Dif.</th></tr>
        ${cashRows}
      </table>
    </div>` : ''}

    <p style="text-align:center;color:#525252;font-size:12px;margin-top:32px">Generado automaticamente por Nivo &mdash; no responder a este correo</p>
  </div>
</body>
</html>`;
  }

  private startOfDay(d: Date): string {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy.toISOString();
  }

  private endOfDay(d: Date): string {
    const copy = new Date(d);
    copy.setHours(23, 59, 59, 999);
    return copy.toISOString();
  }
}
