import { DataSource } from 'typeorm';
import {
  Sale, SaleItem, ProductVariant, Product, Brand, Category,
  Inventory, Expense, CashTransaction, PosSession,
} from '@nivo/database';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
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
];

export async function executeTool(
  conn: DataSource,
  toolName: string,
  input: Record<string, any>,
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
      ps.cash_expected,
      ps.cash_actual,
      (ps.cash_actual - ps.cash_expected) AS difference,
      ps.closed_at
    FROM pos_sessions ps
    INNER JOIN branches b ON b.id = ps.branch_id
    INNER JOIN employees e ON e.id = ps.employee_id
    WHERE ps.closed_at IS NOT NULL
      AND ps.closed_at >= $1 AND ps.closed_at <= $2
      AND ps.cash_actual IS NOT NULL AND ps.cash_expected IS NOT NULL
      AND ABS(ps.cash_actual - ps.cash_expected) > 1
      ${branchFilter}
    ORDER BY ABS(ps.cash_actual - ps.cash_expected) DESC
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
