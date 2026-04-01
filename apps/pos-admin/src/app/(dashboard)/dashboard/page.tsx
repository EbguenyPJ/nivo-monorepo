'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '@nivo/ui';
import { DollarSign, ShoppingCart, Package, Users, TrendingUp, MapPin, Crown, BarChart3 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getTodayRange, getThisMonthRange, formatCurrency, formatDate } from '@/lib/date-utils';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from 'recharts';

// ─── Shared types & helpers ────────────────────────────────────────

interface DailyData {
  date: string;
  count: number;
  revenue: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  mixed: 'Mixto',
  online: 'Online',
};

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium mb-1">{formatShortDate(label)}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.dataKey === 'revenue' ? formatCurrency(entry.value) : `${entry.value} ventas`}
        </p>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page — Switcher
// ═══════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { isGeneralSelected, selectedBranchId, selectedBranchName } = useBranchStore();
  return isGeneralSelected ? <GeneralDashboard /> : <BranchDashboard branchName={selectedBranchName} />;
}

// ═══════════════════════════════════════════════════════════════════
// General Dashboard — Cross-branch KPIs
// ═══════════════════════════════════════════════════════════════════

interface BranchComparisonRow {
  branch_id: string;
  branch_name: string;
  total_revenue: number;
  total_sales: number;
  avg_ticket: number;
  employee_count: number;
}

function GeneralDashboard() {
  const [loading, setLoading] = useState(true);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [branchData, setBranchData] = useState<BranchComparisonRow[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [activeBranches, setActiveBranches] = useState(0);
  const [totalEmployees, setTotalEmployees] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      try {
        const todayRange = getTodayRange();
        const monthRange = getThisMonthRange();
        const tp = `start_date=${todayRange.start_date}&end_date=${todayRange.end_date}`;
        const mp = `start_date=${monthRange.start_date}&end_date=${monthRange.end_date}`;

        const [todaySummary, monthSummary, comparison, recent] = await Promise.all([
          apiClient.get(`/reports/summary?${tp}`),
          apiClient.get(`/reports/summary?${mp}`),
          apiClient.get(`/reports/branch-comparison?${mp}`),
          apiClient.get('/reports/sales?limit=5'),
        ]);

        setTodayRevenue(todaySummary.data.total_revenue);
        setTodaySales(todaySummary.data.total_sales);
        setMonthRevenue(monthSummary.data.total_revenue);

        const branches: BranchComparisonRow[] = comparison.data.branches || [];
        setBranchData(branches);
        setActiveBranches(branches.length);
        setTotalEmployees(branches.reduce((s: number, b: BranchComparisonRow) => s + b.employee_count, 0));
        setRecentSales(recent.data.data || []);
      } catch (error) {
        console.error('Failed to load general dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const topBranch = [...branchData].sort((a, b) => b.total_revenue - a.total_revenue)[0];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard General</h2>
        <p className="text-muted-foreground">Vista consolidada de todas las sucursales</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del día</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(todayRevenue)}</div>
                <p className="text-xs text-muted-foreground">{todaySales} transacciones hoy</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(monthRevenue)}</div>
                <p className="text-xs text-muted-foreground">Todas las sucursales</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sucursales activas</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{activeBranches}</div>
                <p className="text-xs text-muted-foreground">{totalEmployees} empleados en total</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sucursal líder</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : topBranch ? (
              <>
                <div className="text-2xl font-bold truncate">{topBranch.branch_name}</div>
                <p className="text-xs text-muted-foreground">{formatCurrency(topBranch.total_revenue)} este mes</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Branch Comparison Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Ingresos por Sucursal (mes)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : branchData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              No hay datos para mostrar
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={branchData.sort((a, b) => b.total_revenue - a.total_revenue)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="branch_name"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Ingresos']}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="total_revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Branch Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Sucursales</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : branchData.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Sin sucursales registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">#</th>
                    <th className="pb-3 font-medium text-muted-foreground">Sucursal</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Ventas</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Ingresos</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Ticket Prom.</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Empleados</th>
                  </tr>
                </thead>
                <tbody>
                  {[...branchData].sort((a, b) => b.total_revenue - a.total_revenue).map((b, idx) => (
                    <tr key={b.branch_id} className="border-b last:border-0">
                      <td className="py-3 font-medium text-muted-foreground">{idx + 1}</td>
                      <td className="py-3 font-medium flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {b.branch_name}
                      </td>
                      <td className="py-3 text-right">{b.total_sales}</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(b.total_revenue)}</td>
                      <td className="py-3 text-right">{formatCurrency(b.avg_ticket)}</td>
                      <td className="py-3 text-right">{b.employee_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sales (all branches) */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas Recientes (todas las sucursales)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recentSales.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No hay ventas registradas aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Fecha</th>
                    <th className="pb-3 font-medium text-muted-foreground">Sucursal</th>
                    <th className="pb-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="pb-3 font-medium text-muted-foreground">Pago</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale: any) => (
                    <tr key={sale.id} className="border-b last:border-0">
                      <td className="py-3 text-muted-foreground">{formatDate(sale.created_at)}</td>
                      <td className="py-3">
                        <Badge variant="outline" className="text-xs">{sale.branch?.name || '—'}</Badge>
                      </td>
                      <td className="py-3">{sale.customer?.name || 'Sin cliente'}</td>
                      <td className="py-3">
                        <Badge variant="outline">{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</Badge>
                      </td>
                      <td className="py-3 text-right font-medium">{formatCurrency(sale.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Branch Dashboard — Single branch KPIs (existing, now filtered by interceptor)
// ═══════════════════════════════════════════════════════════════════

interface BranchDashboardData {
  todayRevenue: number;
  todaySales: number;
  monthSales: number;
  productCount: number;
  customerCount: number;
  recentSales: any[];
}

function BranchDashboard({ branchName }: { branchName: string }) {
  const [data, setData] = useState<BranchDashboardData | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedBranchId } = useBranchStore();

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const todayRange = getTodayRange();
        const monthRange = getThisMonthRange();
        const todayParams = `start_date=${todayRange.start_date}&end_date=${todayRange.end_date}`;
        const monthParams = `start_date=${monthRange.start_date}&end_date=${monthRange.end_date}`;

        // Note: branch_id is auto-injected by the Axios interceptor
        const [todaySummary, monthSummary, products, customers, recentSales, daily] = await Promise.all([
          apiClient.get(`/reports/summary?${todayParams}`),
          apiClient.get(`/reports/summary?${monthParams}`),
          apiClient.get('/products'),
          apiClient.get('/customers'),
          apiClient.get('/reports/sales?limit=5'),
          apiClient.get(`/reports/daily-sales?${monthParams}`),
        ]);

        setData({
          todayRevenue: todaySummary.data.total_revenue,
          todaySales: todaySummary.data.total_sales,
          monthSales: monthSummary.data.total_sales,
          productCount: products.data.length,
          customerCount: customers.data.length,
          recentSales: recentSales.data.data || [],
        });
        setDailyData(daily.data || []);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [selectedBranchId]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Resumen de {branchName}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del día</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(data?.todayRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground">{data?.todaySales || 0} transacciones hoy</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets del mes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{data?.monthSales || 0}</div>
                <p className="text-xs text-muted-foreground">Ventas este mes</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{data?.productCount || 0}</div>
                <p className="text-xs text-muted-foreground">Modelos en catálogo</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{data?.customerCount || 0}</div>
                <p className="text-xs text-muted-foreground">Clientes registrados</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Ingresos del Mes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : dailyData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No hay datos para mostrar
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Ventas por Día</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : dailyData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No hay datos para mostrar
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !data?.recentSales || data.recentSales.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No hay ventas registradas aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Fecha</th>
                    <th className="pb-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="pb-3 font-medium text-muted-foreground">Pago</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((sale: any) => (
                    <tr key={sale.id} className="border-b last:border-0">
                      <td className="py-3 text-muted-foreground">{formatDate(sale.created_at)}</td>
                      <td className="py-3">{sale.customer?.name || 'Sin cliente'}</td>
                      <td className="py-3">
                        <Badge variant="outline">{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</Badge>
                      </td>
                      <td className="py-3 text-right font-medium">{formatCurrency(sale.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
