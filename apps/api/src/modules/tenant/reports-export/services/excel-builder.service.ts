import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Sale, SaleItem, ProductVariant } from '@nivo/database';

// Lazy import — exceljs is heavy, only loaded when actually building
let ExcelJS: any;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToArgb(hex: string): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 'FF3B82F6';
  return `FF${clean.toUpperCase()}`;
}

/** Lightened version of brand color for alternating rows */
function lightenArgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = Math.min(255, parseInt(clean.slice(0, 2), 16) + 180);
  const g = Math.min(255, parseInt(clean.slice(2, 4), 16) + 180);
  const b = Math.min(255, parseInt(clean.slice(4, 6), 16) + 180);
  return `FF${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

function currencyMXN(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export type ReportType = 'sales' | 'profitability' | 'audits' | 'performance' | 'dashboard';

export interface ExcelFilters {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}

@Injectable()
export class ExcelBuilderService {
  private readonly logger = new Logger(ExcelBuilderService.name);

  async build(
    connection: DataSource,
    reportType: ReportType,
    filters: ExcelFilters,
    brandColor = '#3B82F6',
    businessName = 'Nivo POS',
  ): Promise<Buffer> {
    if (!ExcelJS) ExcelJS = (await import('exceljs')).default;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Nivo POS';
    wb.created = new Date();

    const argbBrand  = hexToArgb(brandColor);
    const argbLight  = lightenArgb(brandColor.replace('#', ''));

    switch (reportType) {
      case 'sales':
        await this.buildSalesSheet(wb, connection, filters, argbBrand, argbLight, businessName);
        break;
      case 'profitability':
        await this.buildProfitabilitySheet(wb, connection, filters, argbBrand, argbLight, businessName);
        break;
      case 'audits':
        await this.buildAuditsSheet(wb, connection, filters, argbBrand, argbLight, businessName);
        break;
      case 'performance':
        await this.buildPerformanceSheet(wb, connection, filters, argbBrand, argbLight, businessName);
        break;
      default:
        await this.buildSalesSheet(wb, connection, filters, argbBrand, argbLight, businessName);
    }

    const buffer = await wb.xlsx.writeBuffer();
    this.logger.log(`Excel built: ${reportType}, ${(buffer as Buffer).byteLength} bytes`);
    return Buffer.from(buffer);
  }

  // ─── Sales Sheet ────────────────────────────────────────────────────────────

  private async buildSalesSheet(
    wb: any, connection: DataSource, filters: ExcelFilters,
    argbBrand: string, argbLight: string, businessName: string,
  ) {
    const ws = wb.addWorksheet('Ventas', { views: [{ state: 'frozen', ySplit: 3 }] });

    // Title row
    ws.mergeCells('A1:H1');
    const title = ws.getCell('A1');
    title.value = `${businessName} — Reporte de Ventas`;
    title.font = { bold: true, size: 14, color: { argb: argbBrand } };
    title.alignment = { horizontal: 'center' };

    // Date range row
    ws.mergeCells('A2:H2');
    const sub = ws.getCell('A2');
    sub.value = `Periodo: ${filters.startDate ?? '—'} al ${filters.endDate ?? '—'}`;
    sub.font = { italic: true, size: 10, color: { argb: 'FF71717A' } };
    sub.alignment = { horizontal: 'center' };

    // Header row
    const headers = ['Ticket', 'Fecha', 'Cliente', 'Cajero', 'Sucursal', 'Método Pago', 'Artículos', 'Total'];
    const headerRow = ws.getRow(3);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbBrand } };
      cell.alignment = { horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
    });

    // Column widths
    ws.columns = [
      { width: 12 }, { width: 20 }, { width: 22 }, { width: 20 },
      { width: 20 }, { width: 16 }, { width: 12 }, { width: 14 },
    ];

    // Data
    const saleRepo = connection.getRepository(Sale);
    const qb = saleRepo
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.employee', 'emp')
      .leftJoinAndSelect('sale.branch', 'branch')
      .leftJoinAndSelect('sale.customer', 'cust')
      .where('sale.status = :status', { status: 'completed' });

    if (filters.branchId) qb.andWhere('sale.branch_id = :b', { b: filters.branchId });
    if (filters.startDate) qb.andWhere('sale.created_at >= :s', { s: filters.startDate });
    if (filters.endDate)   qb.andWhere('sale.created_at <= :e', { e: filters.endDate });
    qb.orderBy('sale.created_at', 'DESC').take(10000);

    const sales = await qb.getMany();
    const PAYMENT_LABELS: Record<string, string> = {
      cash: 'Efectivo', card: 'Tarjeta', mixed: 'Mixto', online: 'En línea',
    };

    sales.forEach((s, idx) => {
      const row = ws.getRow(idx + 4);
      const alt = idx % 2 === 0;
      const bg = alt ? argbLight : 'FFFAFAFA';

      const values = [
        s.id.slice(0, 8).toUpperCase(),
        new Date(s.created_at).toLocaleDateString('es-MX'),
        (s as any).customer?.name ?? '—',
        (s as any).employee?.name ?? '—',
        (s as any).branch?.name ?? '—',
        PAYMENT_LABELS[(s as any).payment_method] ?? (s as any).payment_method ?? '—',
        (s as any).item_count ?? 0,
        s.total_amount,
      ];

      values.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        if (ci === 7) {
          // Total — numeric format
          cell.numFmt = '"$"#,##0.00';
          cell.alignment = { horizontal: 'right' };
          cell.font = { bold: true };
        }
      });
    });

    // Totals row
    const totalRow = ws.addRow([
      '', '', '', '', '', '', 'TOTAL',
      sales.reduce((acc, s) => acc + Number(s.total_amount), 0),
    ]);
    totalRow.eachCell((cell: any, col: number) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbBrand } };
      if (col === 8) cell.numFmt = '"$"#,##0.00';
    });
  }

  // ─── Profitability Sheet ─────────────────────────────────────────────────────

  private async buildProfitabilitySheet(
    wb: any, connection: DataSource, filters: ExcelFilters,
    argbBrand: string, argbLight: string, businessName: string,
  ) {
    const ws = wb.addWorksheet('Rentabilidad', { views: [{ state: 'frozen', ySplit: 3 }] });

    ws.mergeCells('A1:G1');
    ws.getCell('A1').value = `${businessName} — Reporte de Rentabilidad por Marca`;
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: argbBrand } };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:G2');
    ws.getCell('A2').value = `Periodo: ${filters.startDate ?? '—'} al ${filters.endDate ?? '—'}`;
    ws.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF71717A' } };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    const headers = ['Marca', 'Unidades Vendidas', 'Ingresos', 'Costo', 'Utilidad', 'Margen %', 'Clasificación'];
    const headerRow = ws.getRow(3);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbBrand } };
      cell.alignment = { horizontal: 'center' };
    });

    ws.columns = [
      { width: 24 }, { width: 18 }, { width: 16 }, { width: 16 },
      { width: 16 }, { width: 12 }, { width: 18 },
    ];

    // Raw query for profitability by brand
    const rows = await connection.query(`
      SELECT
        COALESCE(b.name, 'Sin marca') AS brand,
        SUM(si.quantity)::int         AS units,
        SUM(si.quantity * si.unit_price)           AS revenue,
        SUM(si.quantity * COALESCE(pv.cost_price, 0)) AS cost
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id AND s.status = 'completed'
        ${filters.startDate ? `AND s.created_at >= '${filters.startDate}'` : ''}
        ${filters.endDate   ? `AND s.created_at <= '${filters.endDate}'`   : ''}
        ${filters.branchId  ? `AND s.branch_id = '${filters.branchId}'`    : ''}
      LEFT JOIN product_variants pv ON pv.id = si.variant_id
      LEFT JOIN products p ON p.id = pv.product_id
      LEFT JOIN brands b ON b.id = p.brand_id
      GROUP BY b.name
      ORDER BY revenue DESC
    `);

    rows.forEach((r: any, idx: number) => {
      const row = ws.getRow(idx + 4);
      const revenue = Number(r.revenue || 0);
      const cost    = Number(r.cost || 0);
      const profit  = revenue - cost;
      const margin  = revenue > 0 ? (profit / revenue) * 100 : 0;
      const tag = margin >= 40 ? '⭐ Estrella' : margin >= 20 ? '✅ Rentable' : '⚠️ Bajo margen';

      const bg = idx % 2 === 0 ? argbLight : 'FFFAFAFA';
      const vals = [r.brand, Number(r.units), revenue, cost, profit, margin / 100, tag];
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        if (ci >= 2 && ci <= 4) cell.numFmt = '"$"#,##0.00';
        if (ci === 5) { cell.numFmt = '0.00%'; cell.font = { bold: true }; }
      });
    });
  }

  // ─── Audits (Cash Differences) Sheet ────────────────────────────────────────

  private async buildAuditsSheet(
    wb: any, connection: DataSource, filters: ExcelFilters,
    argbBrand: string, argbLight: string, businessName: string,
  ) {
    const ws = wb.addWorksheet('Arqueos', { views: [{ state: 'frozen', ySplit: 3 }] });

    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = `${businessName} — Arqueos y Cortes de Caja`;
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: argbBrand } };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:E2');
    ws.getCell('A2').value = `Periodo: ${filters.startDate ?? '—'} al ${filters.endDate ?? '—'}`;
    ws.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF71717A' } };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    const headers = ['Fecha', 'Cortes', 'Diferencia', 'Estado', 'Acumulado'];
    const headerRow = ws.getRow(3);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbBrand } };
      cell.alignment = { horizontal: 'center' };
    });

    ws.columns = [{ width: 16 }, { width: 12 }, { width: 16 }, { width: 14 }, { width: 16 }];

    const rows = await connection.query(`
      SELECT
        DATE(ps.closed_at)      AS day,
        COUNT(*)::int           AS session_count,
        SUM(ps.difference)      AS difference
      FROM pos_sessions ps
      WHERE ps.status = 'closed'
        ${filters.startDate ? `AND ps.closed_at >= '${filters.startDate}'` : ''}
        ${filters.endDate   ? `AND ps.closed_at <= '${filters.endDate}'`   : ''}
        ${filters.branchId  ? `AND ps.branch_id = '${filters.branchId}'`   : ''}
      GROUP BY DATE(ps.closed_at)
      ORDER BY day DESC
    `);

    let cumulative = 0;
    rows.forEach((r: any, idx: number) => {
      const row = ws.getRow(idx + 4);
      const diff = Number(r.difference || 0);
      cumulative += diff;
      const status = diff > 0 ? 'Sobrante' : diff < 0 ? 'Faltante' : 'Exacto';
      const bg = idx % 2 === 0 ? argbLight : 'FFFAFAFA';

      const vals = [
        new Date(r.day).toLocaleDateString('es-MX'),
        Number(r.session_count),
        diff,
        status,
        cumulative,
      ];
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        if (ci === 2 || ci === 4) {
          cell.numFmt = '"$"#,##0.00';
          cell.font = {
            bold: ci === 2,
            color: { argb: diff > 0 ? 'FF10B981' : diff < 0 ? 'FFEF4444' : 'FF71717A' },
          };
        }
      });
    });
  }

  // ─── Performance Sheet ───────────────────────────────────────────────────────

  private async buildPerformanceSheet(
    wb: any, connection: DataSource, filters: ExcelFilters,
    argbBrand: string, argbLight: string, businessName: string,
  ) {
    const ws = wb.addWorksheet('Rendimiento', { views: [{ state: 'frozen', ySplit: 3 }] });

    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = `${businessName} — Rendimiento por Vendedor`;
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: argbBrand } };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    const headers = ['Vendedor', 'Ventas', 'Total Ingresos', 'Ticket Promedio', 'UPT', 'Clasificación'];
    const headerRow = ws.getRow(3);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbBrand } };
      cell.alignment = { horizontal: 'center' };
    });

    ws.columns = [{ width: 24 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 10 }, { width: 18 }];

    const rows = await connection.query(`
      SELECT
        COALESCE(e.name, 'Sin asignar') AS seller,
        COUNT(DISTINCT s.id)::int        AS sale_count,
        SUM(s.total_amount)              AS total_revenue,
        AVG(s.total_amount)              AS avg_ticket,
        COALESCE(SUM(si.quantity)::numeric / NULLIF(COUNT(DISTINCT s.id), 0), 0) AS upt
      FROM sales s
      LEFT JOIN employees e ON e.id = s.employee_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed'
        ${filters.startDate ? `AND s.created_at >= '${filters.startDate}'` : ''}
        ${filters.endDate   ? `AND s.created_at <= '${filters.endDate}'`   : ''}
        ${filters.branchId  ? `AND s.branch_id = '${filters.branchId}'`    : ''}
      GROUP BY e.name
      ORDER BY total_revenue DESC
    `);

    rows.forEach((r: any, idx: number) => {
      const row = ws.getRow(idx + 4);
      const upt = Number(r.upt || 0);
      const tag = upt >= 2 ? '🏆 Excelente' : upt >= 1.2 ? '✅ Bueno' : '⚠️ Mejorar';
      const bg = idx % 2 === 0 ? argbLight : 'FFFAFAFA';

      [r.seller, Number(r.sale_count), Number(r.total_revenue), Number(r.avg_ticket), upt, tag].forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        if (ci === 2 || ci === 3) cell.numFmt = '"$"#,##0.00';
        if (ci === 4) { cell.numFmt = '0.00'; cell.font = { bold: true }; }
      });
    });
  }
}
