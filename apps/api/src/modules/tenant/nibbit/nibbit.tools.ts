import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import {
  Sale, SaleItem, ProductVariant, Product, Brand, Category,
  Inventory, Expense, CashTransaction, PosSession,
  PurchaseRequisition, PurchaseOrder, PurchaseOrderItem,
  Supplier, EmailDraft, VariantSupplier, Branch,
} from '@nivo/database';
import type { RequisitionsService } from '../requisitions/requisitions.service';
import type { PdfGeneratorService } from '../reports-export/services/pdf-generator.service';
import type { S3Service } from '../reports-export/services/s3.service';
import type { GoogleGenerativeAI } from '@google/generative-ai';

const logger = new Logger('NibbitTools');

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface ToolExecutionContext {
  requisitionsService: RequisitionsService;
  pdfGeneratorService: PdfGeneratorService;
  s3Service: S3Service;
  genAI: GoogleGenerativeAI;
  tenantId: string;
  tenantName: string;
  databaseName: string;
}

export const NIBBIT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_sales_summary',
    description: 'Obtiene un resumen de ventas para un rango de fechas. Devuelve: ingreso total, cantidad de ventas, ticket promedio, y comparación con periodo anterior.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        branch_id: { type: 'string', description: 'ID de sucursal (opcional, omitir para todas)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_top_selling_products',
    description: 'Obtiene los productos más vendidos ordenados por cantidad de unidades vendidas o por ingreso. Útil para saber qué modelos se mueven más.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        limit: { type: 'number', description: 'Cantidad de resultados (default 10)' },
        order_by: { type: 'string', enum: ['units', 'revenue'], description: 'Ordenar por unidades o ingreso' },
        branch_id: { type: 'string', description: 'ID de sucursal (opcional)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_least_selling_products',
    description: 'Obtiene los productos menos vendidos. Útil para identificar inventario estancado o de baja rotación.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        limit: { type: 'number', description: 'Cantidad de resultados (default 10)' },
        branch_id: { type: 'string', description: 'ID de sucursal (opcional)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_most_profitable_brand',
    description: 'Obtiene las marcas más rentables del negocio, calculando ingreso, costo y margen de utilidad por marca.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        limit: { type: 'number', description: 'Cantidad de marcas (default 5)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_cash_expenses_sum',
    description: 'Obtiene el total de gastos (egresos) registrados, agrupados por categoría. Útil para control de gastos operativos.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        branch_id: { type: 'string', description: 'ID de sucursal (opcional)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_low_stock_items',
    description: 'Obtiene variantes de producto con stock disponible por debajo del mínimo configurado. Útil para generar recomendaciones de re-abasto.',
    input_schema: {
      type: 'object',
      properties: {
        branch_id: { type: 'string', description: 'ID de sucursal (opcional)' },
        limit: { type: 'number', description: 'Cantidad de resultados (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_cash_discrepancies',
    description: 'Obtiene sesiones POS con diferencias de caja (arqueos donde el efectivo real difiere del esperado).',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        branch_id: { type: 'string', description: 'ID de sucursal (opcional)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'search_product_catalog',
    description: 'Busca un producto o modelo en el catálogo por nombre, SKU o marca. Devuelve nombre, SKU, precio, costo y stock actual. Usa esta herramienta cuando el usuario pregunte por un modelo específico.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de búsqueda (nombre, SKU o marca)' },
        limit: { type: 'number', description: 'Cantidad de resultados (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_sales_by_hour',
    description: 'Obtiene distribución de ventas por hora del día. Útil para identificar horarios pico.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        branch_id: { type: 'string', description: 'ID de sucursal (opcional)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_branch_comparison',
    description: 'Compara el rendimiento de todas las sucursales: ventas, ticket promedio y cantidad de transacciones.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'list_branches',
    description: 'Lista todas las sucursales del negocio con su ID, nombre, ciudad y estado activo. Usa esta herramienta SIEMPRE que necesites resolver el nombre de una sucursal a su ID antes de llamar otras herramientas que requieran branch_id.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_requisitions',
    description: 'Lista las requisiciones de compra del negocio. Usa esta herramienta cuando el usuario pregunte por requisiciones, pida redactar correos a proveedores sin especificar un ID, o quiera ver el estado de sus pedidos. Puedes filtrar por estado (draft, locked, approved) y por sucursal.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filtrar por estado: draft, locked, approved (opcional)' },
        branch_id: { type: 'string', description: 'UUID de sucursal (opcional, obtenido de list_branches)' },
        limit: { type: 'number', description: 'Máximo de resultados (default 10)' },
      },
      required: [],
    },
  },
  // ═══════════════════════════════════════════════════════════════════
  // MUTATION TOOLS (require ToolExecutionContext)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'draft_auto_requisition',
    description: 'Genera automáticamente un borrador de requisición de reabastecimiento para una sucursal. Escanea el inventario buscando productos con stock por debajo del mínimo y crea un borrador con las cantidades sugeridas. El usuario debe revisar y aprobar el borrador antes de que se generen órdenes de compra. Usa esta herramienta cuando el usuario pida generar pedidos de reabastecimiento o reabastecer inventario. IMPORTANTE: Si el usuario da el nombre de la sucursal, primero usa list_branches para obtener el branch_id correcto.',
    input_schema: {
      type: 'object',
      properties: {
        branch_id: { type: 'string', description: 'UUID de la sucursal (obtenido de list_branches)' },
      },
      required: ['branch_id'],
    },
  },
  {
    name: 'draft_supplier_emails',
    description: 'Genera borradores de correos electrónicos para los proveedores de una requisición aprobada. Para cada orden de compra generada, redacta un correo formal con los detalles del pedido y genera el PDF adjunto. Los correos NO se envían automáticamente — el usuario debe revisarlos y confirmar el envío. Usa esta herramienta cuando el usuario pida redactar o enviar correos a proveedores después de aprobar una requisición.',
    input_schema: {
      type: 'object',
      properties: {
        requisition_id: { type: 'string', description: 'ID de la requisición aprobada' },
      },
      required: ['requisition_id'],
    },
  },
];

export async function executeTool(
  conn: DataSource,
  toolName: string,
  input: Record<string, any>,
  ctx?: ToolExecutionContext,
): Promise<string> {
  switch (toolName) {
    case 'get_sales_summary':
      return JSON.stringify(await getSalesSummary(conn, input));
    case 'get_top_selling_products':
      return JSON.stringify(await getTopSellingProducts(conn, input));
    case 'get_least_selling_products':
      return JSON.stringify(await getLeastSellingProducts(conn, input));
    case 'get_most_profitable_brand':
      return JSON.stringify(await getMostProfitableBrand(conn, input));
    case 'get_cash_expenses_sum':
      return JSON.stringify(await getCashExpensesSum(conn, input));
    case 'get_low_stock_items':
      return JSON.stringify(await getLowStockItems(conn, input));
    case 'get_cash_discrepancies':
      return JSON.stringify(await getCashDiscrepancies(conn, input));
    case 'search_product_catalog':
      return JSON.stringify(await searchProductCatalog(conn, input));
    case 'get_sales_by_hour':
      return JSON.stringify(await getSalesByHour(conn, input));
    case 'get_branch_comparison':
      return JSON.stringify(await getBranchComparison(conn, input));
    case 'list_branches':
      return JSON.stringify(await listBranches(conn));
    case 'list_requisitions':
      return JSON.stringify(await listRequisitions(conn, input));
    case 'draft_auto_requisition':
      if (!ctx) return JSON.stringify({ error: 'Contexto de ejecución no disponible para herramientas de mutación' });
      return JSON.stringify(await draftAutoRequisition(conn, input, ctx));
    case 'draft_supplier_emails':
      if (!ctx) return JSON.stringify({ error: 'Contexto de ejecución no disponible para herramientas de mutación' });
      return JSON.stringify(await draftSupplierEmails(conn, input, ctx));
    default:
      return JSON.stringify({ error: `Tool "${toolName}" not found` });
  }
}

async function getSalesSummary(conn: DataSource, input: Record<string, any>) {
  const params: any[] = [input.start_date, input.end_date];
  let branchFilter = '';
  if (input.branch_id) {
    branchFilter = ' AND s.branch_id = $3';
    params.push(input.branch_id);
  }

  const rows = await conn.query(`
    SELECT
      COALESCE(SUM(s.total_amount), 0) AS total_revenue,
      COUNT(DISTINCT s.id) AS sale_count,
      COALESCE(AVG(s.total_amount), 0) AS avg_ticket
    FROM sales s
    WHERE s.status = 'completed'
      AND s.created_at >= $1 AND s.created_at <= $2
      ${branchFilter}
  `, params);

  const prevStart = new Date(input.start_date);
  const prevEnd = new Date(input.end_date);
  const duration = prevEnd.getTime() - prevStart.getTime();
  const prevStartDate = new Date(prevStart.getTime() - duration).toISOString().split('T')[0];
  const prevEndDate = input.start_date;

  const prevParams: any[] = [prevStartDate, prevEndDate];
  if (input.branch_id) prevParams.push(input.branch_id);

  const prev = await conn.query(`
    SELECT COALESCE(SUM(s.total_amount), 0) AS total_revenue, COUNT(DISTINCT s.id) AS sale_count
    FROM sales s
    WHERE s.status = 'completed'
      AND s.created_at >= $1 AND s.created_at <= $2
      ${branchFilter}
  `, prevParams);

  const curr = parseFloat(rows[0].total_revenue) || 0;
  const prevRev = parseFloat(prev[0].total_revenue) || 0;
  const change = prevRev > 0 ? ((curr - prevRev) / prevRev * 100) : 0;

  return {
    total_revenue: curr,
    sale_count: parseInt(rows[0].sale_count) || 0,
    avg_ticket: Math.round((parseFloat(rows[0].avg_ticket) || 0) * 100) / 100,
    previous_period_revenue: prevRev,
    change_percent: Math.round(change * 10) / 10,
  };
}

async function getTopSellingProducts(conn: DataSource, input: Record<string, any>) {
  const limit = input.limit || 10;
  const orderCol = input.order_by === 'revenue' ? 'revenue' : 'units_sold';
  const params: any[] = [input.start_date, input.end_date, limit];
  let branchFilter = '';
  if (input.branch_id) {
    branchFilter = ' AND s.branch_id = $4';
    params.push(input.branch_id);
  }

  return conn.query(`
    SELECT
      p.name AS product_name,
      b.name AS brand_name,
      SUM(si.quantity) AS units_sold,
      SUM(si.subtotal) AS revenue
    FROM sale_items si
    INNER JOIN sales s ON s.id = si.sale_id
    INNER JOIN product_variants pv ON pv.id = si.variant_id
    INNER JOIN products p ON p.id = pv.product_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE s.status = 'completed'
      AND s.created_at >= $1 AND s.created_at <= $2
      ${branchFilter}
    GROUP BY p.id, p.name, b.name
    ORDER BY ${orderCol} DESC
    LIMIT $3
  `, params);
}

async function getLeastSellingProducts(conn: DataSource, input: Record<string, any>) {
  const limit = input.limit || 10;
  const params: any[] = [input.start_date, input.end_date, limit];
  let branchFilter = '';
  if (input.branch_id) {
    branchFilter = ' AND s.branch_id = $4';
    params.push(input.branch_id);
  }

  return conn.query(`
    SELECT
      p.name AS product_name,
      b.name AS brand_name,
      COALESCE(sold.units_sold, 0) AS units_sold,
      COALESCE(sold.revenue, 0) AS revenue
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN (
      SELECT pv.product_id,
             SUM(si.quantity) AS units_sold,
             SUM(si.subtotal) AS revenue
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      INNER JOIN product_variants pv ON pv.id = si.variant_id
      WHERE s.status = 'completed'
        AND s.created_at >= $1 AND s.created_at <= $2
        ${branchFilter}
      GROUP BY pv.product_id
    ) sold ON sold.product_id = p.id
    WHERE p.deleted_at IS NULL
    ORDER BY COALESCE(sold.units_sold, 0) ASC
    LIMIT $3
  `, params);
}

async function getMostProfitableBrand(conn: DataSource, input: Record<string, any>) {
  const limit = input.limit || 5;
  return conn.query(`
    SELECT
      COALESCE(b.name, 'Sin marca') AS brand_name,
      SUM(si.subtotal) AS revenue,
      SUM(
        CASE WHEN si.unit_cost_at_sale IS NOT NULL
          THEN si.unit_cost_at_sale * si.quantity
          ELSE COALESCE(pv.cost, 0) * si.quantity
        END
      ) AS cogs,
      SUM(si.subtotal) - SUM(
        CASE WHEN si.unit_cost_at_sale IS NOT NULL
          THEN si.unit_cost_at_sale * si.quantity
          ELSE COALESCE(pv.cost, 0) * si.quantity
        END
      ) AS profit,
      SUM(si.quantity) AS units_sold
    FROM sale_items si
    INNER JOIN sales s ON s.id = si.sale_id
    INNER JOIN product_variants pv ON pv.id = si.variant_id
    INNER JOIN products p ON p.id = pv.product_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE s.status = 'completed'
      AND s.created_at >= $1 AND s.created_at <= $2
    GROUP BY b.id, b.name
    ORDER BY profit DESC
    LIMIT $3
  `, [input.start_date, input.end_date, limit]);
}

async function getCashExpensesSum(conn: DataSource, input: Record<string, any>) {
  const params: any[] = [input.start_date, input.end_date];
  let branchFilter = '';
  if (input.branch_id) {
    branchFilter = ' AND e.branch_id = $3';
    params.push(input.branch_id);
  }

  const rows = await conn.query(`
    SELECT
      ec.name AS category_name,
      COUNT(*) AS expense_count,
      SUM(e.amount) AS total_amount
    FROM expenses e
    INNER JOIN expense_categories ec ON ec.id = e.category_id
    WHERE e.is_cancelled = false
      AND e.date >= $1 AND e.date <= $2
      ${branchFilter}
    GROUP BY ec.id, ec.name
    ORDER BY total_amount DESC
  `, params);

  const total = rows.reduce((sum: number, r: any) => sum + (parseFloat(r.total_amount) || 0), 0);
  return { categories: rows, grand_total: total };
}

async function getLowStockItems(conn: DataSource, input: Record<string, any>) {
  const limit = input.limit || 20;
  const params: any[] = [limit];
  let branchFilter = '';
  if (input.branch_id) {
    branchFilter = ' AND i.branch_id = $2';
    params.push(input.branch_id);
  }

  return conn.query(`
    SELECT
      p.name AS product_name,
      pv.sku,
      b.name AS branch_name,
      i.stock_available,
      i.stock_minimum,
      (i.stock_minimum - i.stock_available) AS deficit
    FROM inventory i
    INNER JOIN product_variants pv ON pv.id = i.variant_id
    INNER JOIN products p ON p.id = pv.product_id
    INNER JOIN branches b ON b.id = i.branch_id
    WHERE i.stock_available <= i.stock_minimum
      AND i.stock_minimum > 0
      ${branchFilter}
    ORDER BY deficit DESC
    LIMIT $1
  `, params);
}

async function getCashDiscrepancies(conn: DataSource, input: Record<string, any>) {
  const params: any[] = [input.start_date, input.end_date];
  let branchFilter = '';
  if (input.branch_id) {
    branchFilter = ' AND ps.branch_id = $3';
    params.push(input.branch_id);
  }

  return conn.query(`
    SELECT
      b.name AS branch_name,
      e.name AS employee_name,
      ps.expected_amount AS cash_expected,
      ps.closing_amount AS cash_actual,
      (ps.closing_amount - ps.expected_amount) AS difference,
      ps.closed_at
    FROM pos_sessions ps
    INNER JOIN branches b ON b.id = ps.branch_id
    INNER JOIN employees e ON e.id = ps.employee_id
    WHERE ps.closed_at IS NOT NULL
      AND ps.closed_at >= $1 AND ps.closed_at <= $2
      AND ps.closing_amount IS NOT NULL AND ps.expected_amount IS NOT NULL
      AND ABS(ps.closing_amount - ps.expected_amount) > 1
      ${branchFilter}
    ORDER BY ABS(ps.closing_amount - ps.expected_amount) DESC
  `, params);
}

async function searchProductCatalog(conn: DataSource, input: Record<string, any>) {
  const limit = input.limit || 10;
  const searchTerm = `%${input.query}%`;

  return conn.query(`
    SELECT
      p.name AS product_name,
      pv.sku,
      b.name AS brand_name,
      c.name AS category_name,
      pv.price,
      pv.cost,
      COALESCE(inv.total_stock, 0) AS total_stock
    FROM products p
    INNER JOIN product_variants pv ON pv.product_id = p.id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN (
      SELECT variant_id, SUM(stock_available) AS total_stock
      FROM inventory
      GROUP BY variant_id
    ) inv ON inv.variant_id = pv.id
    WHERE p.deleted_at IS NULL
      AND (
        p.name ILIKE $1
        OR pv.sku ILIKE $1
        OR b.name ILIKE $1
      )
    ORDER BY p.name
    LIMIT $2
  `, [searchTerm, limit]);
}

async function getSalesByHour(conn: DataSource, input: Record<string, any>) {
  const params: any[] = [input.start_date, input.end_date];
  let branchFilter = '';
  if (input.branch_id) {
    branchFilter = ' AND s.branch_id = $3';
    params.push(input.branch_id);
  }

  return conn.query(`
    SELECT
      EXTRACT(HOUR FROM s.created_at)::int AS hour,
      COUNT(*) AS sale_count,
      SUM(s.total_amount) AS total_revenue
    FROM sales s
    WHERE s.status = 'completed'
      AND s.created_at >= $1 AND s.created_at <= $2
      ${branchFilter}
    GROUP BY hour
    ORDER BY hour
  `, params);
}

async function getBranchComparison(conn: DataSource, input: Record<string, any>) {
  return conn.query(`
    SELECT
      b.name AS branch_name,
      COUNT(DISTINCT s.id) AS sale_count,
      COALESCE(SUM(s.total_amount), 0) AS total_revenue,
      COALESCE(AVG(s.total_amount), 0) AS avg_ticket
    FROM branches b
    LEFT JOIN sales s ON s.branch_id = b.id
      AND s.status = 'completed'
      AND s.created_at >= $1 AND s.created_at <= $2
    WHERE b.is_active = true
    GROUP BY b.id, b.name
    ORDER BY total_revenue DESC
  `, [input.start_date, input.end_date]);
}

async function listBranches(conn: DataSource) {
  const branches = await conn.getRepository(Branch).find({
    select: ['id', 'name', 'code', 'city', 'is_active'],
    order: { name: 'ASC' },
  });
  return branches.map(b => ({
    id: b.id,
    name: b.name,
    code: b.code,
    city: b.city,
    is_active: b.is_active,
  }));
}

async function listRequisitions(conn: DataSource, input: Record<string, any>) {
  const limit = input.limit || 10;
  const params: any[] = [];
  const conditions: string[] = [];

  if (input.status) {
    params.push(input.status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (input.branch_id) {
    params.push(input.branch_id);
    conditions.push(`r.branch_id = $${params.length}`);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(limit);

  const rows = await conn.query(`
    SELECT
      r.id,
      r.folio_number,
      r.status,
      r.total_estimated_cost,
      r.total_items,
      r.notes,
      r.created_at,
      r.approved_at,
      r.emails_drafted,
      r.emails_sent,
      b.name AS branch_name
    FROM purchase_requisitions r
    LEFT JOIN branches b ON b.id = r.branch_id
    ${where}
    ORDER BY r.folio_number DESC
    LIMIT $${params.length}
  `, params);

  return rows.map((r: any) => ({
    id: r.id,
    folio: `REQ-${String(r.folio_number).padStart(4, '0')}`,
    status: r.status,
    branch: r.branch_name,
    total_items: r.total_items,
    total_estimated_cost: Number(r.total_estimated_cost),
    created_at: r.created_at,
    approved_at: r.approved_at,
    emails_drafted: r.emails_drafted,
    emails_sent: r.emails_sent,
  }));
}

// ═══════════════════════════════════════════════════════════════════
// MUTATION TOOLS
// ═══════════════════════════════════════════════════════════════════

async function draftAutoRequisition(
  conn: DataSource,
  input: Record<string, any>,
  ctx: ToolExecutionContext,
) {
  const result = await ctx.requisitionsService.generateDraftFromStock(conn, input.branch_id, true);

  if (!result.draft_id) {
    return { message: result.message, item_count: 0 };
  }

  const reqRepo = conn.getRepository(PurchaseRequisition);
  await reqRepo.update(result.draft_id, { created_by_ai: true });

  const draft = await ctx.requisitionsService.getRequisitionDetail(conn, result.draft_id);

  const brandCounts: Record<string, number> = {};
  for (const item of draft.items || []) {
    const brand = (item as any).variant?.product?.brand?.name || 'Sin marca';
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  }

  return {
    requisition_id: result.draft_id,
    folio: draft.folio,
    item_count: draft.total_items,
    total_estimated_cost: draft.total_estimated_cost,
    brand_summary: brandCounts,
    __nibbit_action: {
      type: 'requisition_draft',
      label: 'Abrir Borrador de Requisición',
      payload: { requisition_id: result.draft_id, folio: draft.folio },
    },
  };
}

async function draftSupplierEmails(
  conn: DataSource,
  input: Record<string, any>,
  ctx: ToolExecutionContext,
) {
  const reqRepo = conn.getRepository(PurchaseRequisition);
  const requisition = await reqRepo.findOne({
    where: { id: input.requisition_id },
    relations: ['branch'],
  });

  if (!requisition) {
    return { error: 'Requisición no encontrada' };
  }
  if (requisition.status !== 'approved') {
    return { error: `La requisición ${requisition.folio} no está aprobada. Estado actual: ${requisition.status}. Solo se pueden redactar correos de requisiciones aprobadas.` };
  }
  if (requisition.emails_sent) {
    return { error: `Los correos de la requisición ${requisition.folio} (sucursal: ${requisition.branch?.name || 'desconocida'}) ya fueron enviados previamente. No es necesario redactarlos de nuevo.` };
  }
  if (requisition.emails_drafted) {
    return { error: `Los correos de la requisición ${requisition.folio} (sucursal: ${requisition.branch?.name || 'desconocida'}) ya fueron redactados previamente pero aún no se han enviado. El usuario puede revisarlos y enviarlos desde la página de requisiciones.` };
  }

  const poRepo = conn.getRepository(PurchaseOrder);
  const purchaseOrders = await poRepo.find({
    where: { requisition_id: requisition.id },
    relations: ['supplier', 'items', 'items.variant', 'items.variant.product'],
  });

  if (purchaseOrders.length === 0) {
    return { error: 'No se encontraron órdenes de compra para esta requisición' };
  }

  const draftRepo = conn.getRepository(EmailDraft);
  const createdDrafts: { id: string; supplier_name: string; to_email: string }[] = [];

  for (const po of purchaseOrders) {
    if (!po.supplier?.email) {
      logger.warn(`PO ${po.folio}: proveedor sin correo, omitido`);
      continue;
    }

    let pdfUrl: string | null = null;
    try {
      const pdfBuffer = await ctx.pdfGeneratorService.generate(
        ctx.tenantId,
        ctx.databaseName,
        'purchase-order' as any,
        { po_id: po.id },
      );
      const key = `temp-reports/${ctx.tenantId}/po-${po.folio}-${Date.now()}.pdf`;
      const uploaded = await ctx.s3Service.upload(key, pdfBuffer, 'application/pdf');
      pdfUrl = uploaded.url;
    } catch (err: any) {
      logger.error(`Error generando PDF para PO ${po.folio}: ${err.message}`);
    }

    const itemsList = (po.items || []).map((item) => {
      const name = item.variant?.product?.name || 'Producto';
      const sku = item.variant?.sku || '';
      const attrs = item.variant?.attributes ? JSON.stringify(item.variant.attributes) : '';
      return `- ${name} ${attrs} (SKU: ${sku}) × ${item.ordered_quantity} unidades a $${Number(item.unit_cost).toFixed(2)} c/u`;
    }).join('\n');

    const emailPrompt = `Redacta un correo electrónico formal y profesional en español para solicitar mercancía a un proveedor de calzado. El correo debe ser conciso y directo.

Datos del pedido:
- Proveedor: ${po.supplier.name}
- Folio de Orden de Compra: ${po.folio}
- Requisición origen: ${requisition.folio}
- Sucursal destino: ${requisition.branch?.name || 'Principal'}
- Negocio: ${ctx.tenantName}

Artículos solicitados:
${itemsList}

Total estimado: $${Number(po.total_cost).toFixed(2)}

Instrucciones:
- Saludo cordial al contacto del proveedor
- Referencia al folio de la orden de compra
- Lista clara de artículos con cantidades
- Solicitar confirmación de disponibilidad y tiempos de entrega
- Cierre profesional

Devuelve SOLO el body del correo en HTML simple (usa <p>, <ul>, <li>, <strong>). NO incluyas subject ni metadatos.`;

    let bodyHtml = '';
    try {
      const model = ctx.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(emailPrompt);
      bodyHtml = result.response.text();
    } catch (err: any) {
      logger.error(`Error generando email draft para PO ${po.folio}: ${err.message}`);
      bodyHtml = `<p>Estimado equipo de ${po.supplier.name},</p>
<p>Por medio del presente, le enviamos la Orden de Compra <strong>${po.folio}</strong> correspondiente a la requisición ${requisition.folio}.</p>
<p>Agradecemos confirmar disponibilidad y tiempos de entrega.</p>
<p>Saludos cordiales,<br>${ctx.tenantName}</p>`;
    }

    const subject = `Orden de Compra ${po.folio} — ${ctx.tenantName}`;

    const draft = draftRepo.create({
      purchase_order_id: po.id,
      supplier_id: po.supplier_id,
      requisition_id: requisition.id,
      to_email: po.supplier.email,
      subject,
      body_html: bodyHtml,
      pdf_url: pdfUrl,
      status: 'pending',
    });
    const saved = await draftRepo.save(draft);

    createdDrafts.push({
      id: saved.id,
      supplier_name: po.supplier.name,
      to_email: po.supplier.email,
    });
  }

  await reqRepo.update(requisition.id, { emails_drafted: true });

  return {
    draft_count: createdDrafts.length,
    drafts: createdDrafts,
    requisition_folio: requisition.folio,
    branch_name: requisition.branch?.name,
    __nibbit_action: {
      type: 'email_drafts',
      label: 'Revisar Correos a Proveedores',
      payload: { draft_ids: createdDrafts.map((d) => d.id) },
    },
  };
}
