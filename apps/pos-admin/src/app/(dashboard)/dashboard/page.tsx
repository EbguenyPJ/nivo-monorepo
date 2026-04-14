'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '@nivo/ui';
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingCart, AlertTriangle,
  Package, BarChart3, ArrowUpRight, ArrowDownRight, Flame, ShieldAlert,
  Truck, ClipboardList, PackageX, Crown, MapPin, Users,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getTodayRange, getThisMonthRange, formatCurrency, formatDate } from '@/lib/date-utils';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, LineChart, Line,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────

interface KpiData {
  net_revenue: number;
  net_revenue_change: number;
  gross_profit: number;
  gross_margin: number;
  gross_profit_change: number;
  shrinkage_units: number;
  avg_ticket: number;
  avg_ticket_change: number;
  sale_count: number;
}

interface TrendPoint {
  date: string;
  revenue: number;
  gross_profit: number;
  sales: number;
}

interface Alert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count?: number;
}

interface TopProduct {
  product_id: string;
  product_name: string;
  brand_name: string | null;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  units_sold: number;
}

interface BranchComparisonRow {
  branch_id: string;
  branch_name: string;
  total_revenue: number;
  total_sales: number;
  avg_ticket: number;
  employee_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return formatCurrency(n);
}

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">sin cambio</span>;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? '+' : ''}{value}%
    </span>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────

function ProfitTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/90 backdrop-blur-sm p-3 shadow-lg text-sm">
      <p className="font-medium mb-1.5 text-zinc-300">{formatShortDate(label)}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-zinc-400">
            {entry.dataKey === 'revenue' ? 'Ingreso' : 'Utilidad'}:
          </span>
          <span className="font-medium text-zinc-100">{formatCurrency(entry.value)}</span>
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
  return isGeneralSelected
    ? <GeneralDashboard />
    : <BranchDashboard branchId={selectedBranchId || ''} branchName={selectedBranchName} />;
}

// ═══════════════════════════════════════════════════════════════════
// General Dashboard — Cross-branch overview
// ═══════════════════════════════════════════════════════════════════

function GeneralDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [branchData, setBranchData] = useState<BranchComparisonRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const monthRange = getThisMonthRange();
        const mp = `start_date=${monthRange.start_date}&end_date=${monthRange.end_date}`;

        const [kpiRes, trendRes, alertsRes, topRes, branchRes] = await Promise.all([
          apiClient.get(`/dashboard/kpis?${mp}`),
          apiClient.get(`/dashboard/profitability-trend?${mp}`),
          apiClient.get('/dashboard/alerts'),
          apiClient.get(`/dashboard/top-profitable?${mp}&limit=5`),
          apiClient.get(`/reports/branch-comparison?${mp}`),
        ]);

        setKpis(kpiRes.data);
        setTrend(trendRes.data);
        setAlerts(alertsRes.data);
        setTopProducts(topRes.data);
        setBranchData(branchRes.data.branches || []);
      } catch (error) {
        console.error('Dashboard load failed:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard General</h2>
        <p className="text-muted-foreground">Panorama consolidado del mes en curso</p>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassKpiCard
          loading={loading}
          title="Ingreso Neto"
          value={kpis ? formatCurrency(kpis.net_revenue) : '$0'}
          subtitle={`${kpis?.sale_count || 0} transacciones`}
          change={kpis?.net_revenue_change || 0}
          icon={<DollarSign className="h-5 w-5" />}
          accentClass="from-emerald-500/20 to-emerald-500/5"
          iconClass="text-emerald-400"
        />
        <GlassKpiCard
          loading={loading}
          title="Utilidad Bruta"
          value={kpis ? formatCurrency(kpis.gross_profit) : '$0'}
          subtitle={`Margen ${kpis?.gross_margin || 0}%`}
          change={kpis?.gross_profit_change || 0}
          icon={<TrendingUp className="h-5 w-5" />}
          accentClass="from-blue-500/20 to-blue-500/5"
          iconClass="text-blue-400"
        />
        <GlassKpiCard
          loading={loading}
          title="Merma / Perdidas"
          value={`${kpis?.shrinkage_units || 0} pzas`}
          subtitle="Ajustes negativos"
          icon={<PackageX className="h-5 w-5" />}
          accentClass="from-amber-500/20 to-amber-500/5"
          iconClass="text-amber-400"
        />
        <GlassKpiCard
          loading={loading}
          title="Ticket Promedio"
          value={kpis ? formatCurrency(kpis.avg_ticket) : '$0'}
          subtitle="Por transaccion"
          change={kpis?.avg_ticket_change || 0}
          icon={<ShoppingCart className="h-5 w-5" />}
          accentClass="from-violet-500/20 to-violet-500/5"
          iconClass="text-violet-400"
        />
      </div>

      {/* Chart + Alerts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profitability Trend Chart — 2 cols */}
        <Card className="lg:col-span-2 border-white/5 bg-zinc-950/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Tendencia de Rentabilidad</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : trend.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                Sin datos en el periodo
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={290}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#71717a', fontSize: 11 }} />
                  <Tooltip content={<ProfitTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#gradRevenue)" name="Ingreso" />
                  <Area type="monotone" dataKey="gross_profit" stroke="#3b82f6" strokeWidth={2} fill="url(#gradProfit)" name="Utilidad" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {/* Legend */}
            {!loading && trend.length > 0 && (
              <div className="flex gap-6 mt-2 justify-center text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Ingreso Neto</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Utilidad Bruta</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts column — 1 col */}
        <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-base">Alertas Operativas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : alerts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">&#10003;</div>
                <p className="text-sm text-muted-foreground">Todo en orden</p>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <AlertCard key={i} alert={alert} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products + Branch ranking row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Profitable */}
        <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" />
              <CardTitle className="text-base">Top 5 Mas Rentables</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin datos de ventas</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, idx) => (
                  <div key={p.product_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                      idx === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                      idx === 2 ? 'bg-orange-600/20 text-orange-400' :
                      'bg-zinc-700/30 text-zinc-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.product_name}</p>
                      <p className="text-xs text-muted-foreground">{p.brand_name || 'Sin marca'} &middot; {p.units_sold} pzas</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-emerald-400">{formatCurrency(p.profit)}</p>
                      <p className="text-xs text-muted-foreground">{p.margin}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Branch Ranking */}
        <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-base">Ranking de Sucursales</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : branchData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin sucursales</p>
            ) : (
              <div className="space-y-3">
                {[...branchData].sort((a, b) => b.total_revenue - a.total_revenue).map((b, idx) => {
                  const maxRevenue = branchData[0] ? Math.max(...branchData.map(x => x.total_revenue)) : 1;
                  const pct = maxRevenue > 0 ? (b.total_revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={b.branch_id} className="p-2.5 rounded-lg bg-white/[0.03]">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-medium">{b.branch_name}</span>
                        </div>
                        <span className="text-sm font-semibold">{formatCurrency(b.total_revenue)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                        <span>{b.total_sales} ventas</span>
                        <span>Ticket prom. {formatCurrency(b.avg_ticket)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Branch Dashboard — Single branch BI
// ═══════════════════════════════════════════════════════════════════

function BranchDashboard({ branchId, branchName }: { branchId: string; branchName: string }) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const monthRange = getThisMonthRange();
        const mp = `start_date=${monthRange.start_date}&end_date=${monthRange.end_date}&branch_id=${branchId}`;

        const [kpiRes, trendRes, alertsRes, topRes] = await Promise.all([
          apiClient.get(`/dashboard/kpis?${mp}`),
          apiClient.get(`/dashboard/profitability-trend?${mp}`),
          apiClient.get(`/dashboard/alerts?branch_id=${branchId}`),
          apiClient.get(`/dashboard/top-profitable?${mp}&limit=5`),
        ]);

        setKpis(kpiRes.data);
        setTrend(trendRes.data);
        setAlerts(alertsRes.data);
        setTopProducts(topRes.data);
      } catch (error) {
        console.error('Branch dashboard failed:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [branchId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Metricas de {branchName} &mdash; mes en curso</p>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassKpiCard
          loading={loading}
          title="Ingreso Neto"
          value={kpis ? formatCurrency(kpis.net_revenue) : '$0'}
          subtitle={`${kpis?.sale_count || 0} transacciones`}
          change={kpis?.net_revenue_change || 0}
          icon={<DollarSign className="h-5 w-5" />}
          accentClass="from-emerald-500/20 to-emerald-500/5"
          iconClass="text-emerald-400"
        />
        <GlassKpiCard
          loading={loading}
          title="Utilidad Bruta"
          value={kpis ? formatCurrency(kpis.gross_profit) : '$0'}
          subtitle={`Margen ${kpis?.gross_margin || 0}%`}
          change={kpis?.gross_profit_change || 0}
          icon={<TrendingUp className="h-5 w-5" />}
          accentClass="from-blue-500/20 to-blue-500/5"
          iconClass="text-blue-400"
        />
        <GlassKpiCard
          loading={loading}
          title="Merma / Perdidas"
          value={`${kpis?.shrinkage_units || 0} pzas`}
          subtitle="Ajustes negativos del periodo"
          icon={<PackageX className="h-5 w-5" />}
          accentClass="from-amber-500/20 to-amber-500/5"
          iconClass="text-amber-400"
        />
        <GlassKpiCard
          loading={loading}
          title="Ticket Promedio"
          value={kpis ? formatCurrency(kpis.avg_ticket) : '$0'}
          subtitle="Por transaccion"
          change={kpis?.avg_ticket_change || 0}
          icon={<ShoppingCart className="h-5 w-5" />}
          accentClass="from-violet-500/20 to-violet-500/5"
          iconClass="text-violet-400"
        />
      </div>

      {/* Chart + Alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-white/5 bg-zinc-950/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Tendencia de Rentabilidad</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : trend.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={290}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="gradRevBranch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradProfBranch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#71717a', fontSize: 11 }} />
                  <Tooltip content={<ProfitTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#gradRevBranch)" />
                  <Area type="monotone" dataKey="gross_profit" stroke="#3b82f6" strokeWidth={2} fill="url(#gradProfBranch)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {!loading && trend.length > 0 && (
              <div className="flex gap-6 mt-2 justify-center text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Ingreso</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Utilidad</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-base">Alertas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : alerts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">&#10003;</div>
                <p className="text-sm text-muted-foreground">Sin alertas</p>
              </div>
            ) : (
              alerts.map((alert, i) => <AlertCard key={i} alert={alert} />)
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <CardTitle className="text-base">Top 5 Mas Rentables</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {topProducts.map((p, idx) => (
                <div key={p.product_id} className="relative p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                  <span className={`absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded-md ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700/50 text-zinc-400'
                  }`}>#{idx + 1}</span>
                  <p className="text-sm font-medium truncate pr-8">{p.product_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.brand_name || 'Sin marca'}</p>
                  <div className="mt-3 flex justify-between items-end">
                    <div>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(p.profit)}</p>
                      <p className="text-xs text-muted-foreground">{p.units_sold} pzas</p>
                    </div>
                    <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                      {p.margin}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════════════════════════

function GlassKpiCard({
  loading, title, value, subtitle, change, icon, accentClass, iconClass,
}: {
  loading: boolean;
  title: string;
  value: string;
  subtitle: string;
  change?: number;
  icon: React.ReactNode;
  accentClass: string;
  iconClass: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/5 bg-zinc-950/60 backdrop-blur-md p-5`}>
      {/* Gradient accent */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accentClass} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
          <span className={iconClass}>{icon}</span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-zinc-500">{subtitle}</span>
              {change !== undefined && <ChangeIndicator value={change} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const severityConfig = {
    critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <AlertTriangle className="h-4 w-4 text-red-400" /> },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: <AlertTriangle className="h-4 w-4 text-amber-400" /> },
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Package className="h-4 w-4 text-blue-400" /> },
  };
  const cfg = severityConfig[alert.severity];

  const typeIcons: Record<string, React.ReactNode> = {
    pending_audits: <ClipboardList className="h-4 w-4 text-amber-400" />,
    stale_transfers: <Truck className="h-4 w-4 text-red-400" />,
    low_stock: <PackageX className="h-4 w-4 text-amber-400" />,
    transfer_discrepancy: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
      <div className="flex-shrink-0 mt-0.5">{typeIcons[alert.type] || cfg.icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{alert.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
      </div>
      {alert.count && (
        <Badge variant="outline" className="flex-shrink-0 ml-auto text-xs">{alert.count}</Badge>
      )}
    </div>
  );
}
