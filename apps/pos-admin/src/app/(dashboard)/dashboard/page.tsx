'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '@nivo/ui';
import {
  DollarSign, TrendingUp, ShoppingCart, AlertTriangle,
  Package, BarChart3, ArrowUpRight, ArrowDownRight, Flame, ShieldAlert,
  Truck, ClipboardList, PackageX, Crown, MapPin, PieChart as PieIcon,
  Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getThisMonthRange, formatCurrency } from '@/lib/date-utils';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
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

interface TrendPoint { date: string; revenue: number; gross_profit: number; sales: number; }
interface CategoryPoint { name: string; revenue: number; units: number; }
interface HeatCell { day: number; hour: number; count: number; }
interface Alert { type: string; severity: 'critical' | 'warning' | 'info'; title: string; description: string; count?: number; }
interface TopProduct { product_id: string; product_name: string; brand_name: string | null; revenue: number; profit: number; margin: number; units_sold: number; }
interface BranchRow { branch_id: string; branch_name: string; total_revenue: number; total_sales: number; avg_ticket: number; }

// ─── Helpers ──────────────────────────────────────────────────────

function formatShortDate(dateStr: string) {
  // dateStr may be ISO "2026-05-01T06:00:00.000Z" or plain "2026-05-01"
  const raw = typeof dateStr === 'string' ? dateStr.split('T')[0] : String(dateStr).split('T')[0];
  const d = new Date(raw + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr; // fallback
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

const DONUT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const HEATMAP_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HEATMAP_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function formatHour(h: number) { return h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`; }

// ─── Chart Tooltip ────────────────────────────────────────────────

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/90 backdrop-blur-sm p-3 shadow-lg text-sm">
      <p className="font-medium mb-1.5 text-zinc-300">{formatShortDate(label)}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-zinc-400">{entry.dataKey === 'revenue' ? 'Ingreso' : 'Utilidad'}:</span>
          <span className="font-medium text-zinc-100">{formatCurrency(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/90 p-3 shadow-lg text-sm">
      <p className="font-medium text-zinc-200">{d.name}</p>
      <p className="text-zinc-400">{formatCurrency(d.value)}</p>
    </div>
  );
}

// ─── Heatmap Component ────────────────────────────────────────────

function HeatmapChart({ data, loading }: { data: HeatCell[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-56 w-full" />;
  if (!data.length) return (
    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Sin datos de ventas</div>
  );

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const cellMap = new Map(data.map((d) => [`${d.day}-${d.hour}`, d.count]));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[540px]">
        {/* Hour headers */}
        <div className="grid mb-1" style={{ gridTemplateColumns: `44px repeat(${HEATMAP_HOURS.length}, 1fr)` }}>
          <div />
          {HEATMAP_HOURS.map((h) => (
            <div key={h} className="text-center text-[10px] text-zinc-500">{formatHour(h)}</div>
          ))}
        </div>
        {/* Day rows */}
        {HEATMAP_DAYS.map((day, di) => (
          <div key={di} className="grid mb-1" style={{ gridTemplateColumns: `44px repeat(${HEATMAP_HOURS.length}, 1fr)` }}>
            <div className="text-[11px] text-zinc-500 flex items-center">{day}</div>
            {HEATMAP_HOURS.map((h) => {
              const count = cellMap.get(`${di}-${h}`) ?? 0;
              const intensity = count / maxCount;
              return (
                <div
                  key={h}
                  title={`${day} ${formatHour(h)} — ${count} venta${count !== 1 ? 's' : ''}`}
                  className="mx-px rounded-sm h-7 cursor-default transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: intensity > 0
                      ? `rgba(16,185,129,${0.12 + intensity * 0.78})`
                      : 'rgba(255,255,255,0.03)',
                  }}
                />
              );
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[10px] text-zinc-600">Menos</span>
          {[0.12, 0.32, 0.52, 0.72, 0.90].map((op, i) => (
            <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `rgba(16,185,129,${op})` }} />
          ))}
          <span className="text-[10px] text-zinc-600">Más</span>
        </div>
      </div>
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
// General Dashboard
// ═══════════════════════════════════════════════════════════════════

function GeneralDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [category, setCategory] = useState<CategoryPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [branchData, setBranchData] = useState<BranchRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { start_date, end_date } = getThisMonthRange();
        const mp = `start_date=${start_date}&end_date=${end_date}`;

        const [kpiRes, trendRes, catRes, alertsRes, topRes, branchRes] = await Promise.all([
          apiClient.get(`/dashboard/kpis?${mp}`),
          apiClient.get(`/dashboard/profitability-trend?${mp}`),
          apiClient.get(`/dashboard/category-breakdown?${mp}`),
          apiClient.get('/dashboard/alerts'),
          apiClient.get(`/dashboard/top-profitable?${mp}&limit=5`),
          apiClient.get(`/reports/branch-comparison?${mp}`),
        ]);

        setKpis(kpiRes.data);
        setTrend(trendRes.data);
        setCategory(catRes.data);
        setAlerts(alertsRes.data);
        setTopProducts(topRes.data);
        setBranchData(branchRes.data.branches || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard General</h2>
        <p className="text-muted-foreground">Panorama consolidado del mes en curso</p>
      </div>

      {/* Fila 1: KPIs */}
      <KpiRow kpis={kpis} loading={loading} />

      {/* Fila 2: Tendencia + Donut */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendCard trend={trend} loading={loading} />
        <CategoryDonutCard category={category} loading={loading} />
      </div>

      {/* Fila 3: Ranking de Sucursales */}
      <BranchRankingCard branchData={branchData} loading={loading} />

      {/* Fila 4: Alertas + Top 5 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <AlertsCard alerts={alerts} loading={loading} />
        <TopProductsCard topProducts={topProducts} loading={loading} className="lg:col-span-2" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Branch Dashboard
// ═══════════════════════════════════════════════════════════════════

function BranchDashboard({ branchId, branchName }: { branchId: string; branchName: string }) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [category, setCategory] = useState<CategoryPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatCell[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start_date, end_date } = getThisMonthRange();
      const mp = `start_date=${start_date}&end_date=${end_date}&branch_id=${branchId}`;

      const [kpiRes, trendRes, catRes, heatRes, alertsRes, topRes] = await Promise.all([
        apiClient.get(`/dashboard/kpis?${mp}`),
        apiClient.get(`/dashboard/profitability-trend?${mp}`),
        apiClient.get(`/dashboard/category-breakdown?${mp}`),
        apiClient.get(`/dashboard/hourly-heatmap?${mp}`),
        apiClient.get(`/dashboard/alerts?branch_id=${branchId}`),
        apiClient.get(`/dashboard/top-profitable?${mp}&limit=5`),
      ]);

      setKpis(kpiRes.data);
      setTrend(trendRes.data);
      setCategory(catRes.data);
      setHeatmap(heatRes.data);
      setAlerts(alertsRes.data);
      setTopProducts(topRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">{branchName} &mdash; mes en curso</p>
      </div>

      {/* Fila 1: KPIs */}
      <KpiRow kpis={kpis} loading={loading} />

      {/* Fila 2: Tendencia + Donut */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendCard trend={trend} loading={loading} />
        <CategoryDonutCard category={category} loading={loading} />
      </div>

      {/* Fila 3: Heatmap horario */}
      <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Mapa de Calor — Tráfico por Horario</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">Ventas por día y hora del mes en curso. Las celdas más oscuras indican mayor actividad.</p>
        </CardHeader>
        <CardContent>
          <HeatmapChart data={heatmap} loading={loading} />
        </CardContent>
      </Card>

      {/* Fila 4: Alertas + Top 5 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <AlertsCard alerts={alerts} loading={loading} />
        <TopProductsCard topProducts={topProducts} loading={loading} className="lg:col-span-2" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Shared Section Components
// ═══════════════════════════════════════════════════════════════════

function KpiRow({ kpis, loading }: { kpis: KpiData | null; loading: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <GlassKpiCard loading={loading} title="Ingreso Neto"
        value={kpis ? formatCurrency(kpis.net_revenue) : '$0'}
        subtitle={`${kpis?.sale_count ?? 0} transacciones`}
        change={kpis?.net_revenue_change}
        icon={<DollarSign className="h-5 w-5" />}
        accentClass="from-emerald-500/20 to-emerald-500/5" iconClass="text-emerald-400" />
      <GlassKpiCard loading={loading} title="Utilidad Bruta"
        value={kpis ? formatCurrency(kpis.gross_profit) : '$0'}
        subtitle={`Margen ${kpis?.gross_margin ?? 0}%`}
        change={kpis?.gross_profit_change}
        icon={<TrendingUp className="h-5 w-5" />}
        accentClass="from-blue-500/20 to-blue-500/5" iconClass="text-blue-400" />
      <GlassKpiCard loading={loading} title="Merma / Pérdidas"
        value={`${kpis?.shrinkage_units ?? 0} pzas`}
        subtitle="Ajustes negativos del periodo"
        icon={<PackageX className="h-5 w-5" />}
        accentClass="from-amber-500/20 to-amber-500/5" iconClass="text-amber-400" />
      <GlassKpiCard loading={loading} title="Ticket Promedio"
        value={kpis ? formatCurrency(kpis.avg_ticket) : '$0'}
        subtitle="Por transacción"
        change={kpis?.avg_ticket_change}
        icon={<ShoppingCart className="h-5 w-5" />}
        accentClass="from-violet-500/20 to-violet-500/5" iconClass="text-violet-400" />
    </div>
  );
}

function TrendCard({ trend, loading }: { trend: TrendPoint[]; loading: boolean }) {
  return (
    <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Tendencia de Ventas</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-64 w-full" /> : trend.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Sin datos en el periodo</div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tickFormatter={formatCompact} tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip content={<TrendTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#gRevenue)" />
              <Area type="monotone" dataKey="gross_profit" stroke="#3b82f6" strokeWidth={2} fill="url(#gProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {!loading && trend.length > 0 && (
          <div className="flex gap-6 mt-2 justify-center text-xs text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Ingreso Neto</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />Utilidad Bruta</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryDonutCard({ category, loading }: { category: CategoryPoint[]; loading: boolean }) {
  return (
    <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Ventas por Marca</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-64 w-full" /> : category.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Sin datos de ventas</div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <PieChart>
              <Pie
                data={category}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={90}
                dataKey="revenue"
                nameKey="name"
                paddingAngle={2}
              >
                {category.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(v) => <span className="text-xs text-zinc-400">{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function BranchRankingCard({ branchData, loading }: { branchData: BranchRow[]; loading: boolean }) {
  const sorted = [...branchData].sort((a, b) => b.total_revenue - a.total_revenue);
  const maxRev = sorted[0]?.total_revenue || 1;

  return (
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
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin sucursales con ventas</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((b, idx) => {
              const pct = maxRev > 0 ? (b.total_revenue / maxRev) * 100 : 0;
              return (
                <div key={b.branch_id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                        idx === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                        'bg-zinc-700/30 text-zinc-500'
                      }`}>#{idx + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm font-medium truncate">{b.branch_name}</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(b.total_revenue)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
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
  );
}

function AlertsCard({ alerts, loading }: { alerts: Alert[]; loading: boolean }) {
  return (
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
            <div className="text-3xl mb-2">✓</div>
            <p className="text-sm text-muted-foreground">Todo en orden</p>
          </div>
        ) : (
          alerts.map((alert, i) => <AlertCard key={i} alert={alert} />)
        )}
      </CardContent>
    </Card>
  );
}

function TopProductsCard({ topProducts, loading, className }: { topProducts: TopProduct[]; loading: boolean; className?: string }) {
  return (
    <Card className={`border-white/5 bg-zinc-950/60 backdrop-blur-md ${className ?? ''}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <CardTitle className="text-base">Top 5 Más Rentables</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : topProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin datos de ventas</p>
        ) : (
          <div className="space-y-2">
            {topProducts.map((p, idx) => (
              <div key={p.product_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                  idx === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                  idx === 2 ? 'bg-orange-600/20 text-orange-400' :
                  'bg-zinc-700/30 text-zinc-500'
                }`}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.product_name}</p>
                  <p className="text-xs text-muted-foreground">{p.brand_name ?? 'Sin marca'} · {p.units_sold} pzas</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-emerald-400">{formatCurrency(p.profit)}</p>
                  <p className="text-xs text-muted-foreground">{p.margin}% margen</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Shared atom components
// ═══════════════════════════════════════════════════════════════════

function GlassKpiCard({ loading, title, value, subtitle, change, icon, accentClass, iconClass }: {
  loading: boolean; title: string; value: string; subtitle: string;
  change?: number; icon: React.ReactNode; accentClass: string; iconClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-950/60 backdrop-blur-md p-5">
      <div className={`absolute inset-0 bg-gradient-to-br ${accentClass} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
          <span className={iconClass}>{icon}</span>
        </div>
        {loading ? <Skeleton className="h-8 w-28" /> : (
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
  const cfg = {
    critical: { bg: 'bg-red-500/10', border: 'border-red-500/20' },
    warning:  { bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    info:     { bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  }[alert.severity];

  const typeIcons: Record<string, React.ReactNode> = {
    pending_audits:       <ClipboardList className="h-4 w-4 text-amber-400" />,
    stale_transfers:      <Truck className="h-4 w-4 text-red-400" />,
    low_stock:            <PackageX className="h-4 w-4 text-amber-400" />,
    transfer_discrepancy: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
      <div className="flex-shrink-0 mt-0.5">{typeIcons[alert.type] ?? <Package className="h-4 w-4" />}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{alert.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
      </div>
      {alert.count && <Badge variant="outline" className="flex-shrink-0 ml-auto text-xs">{alert.count}</Badge>}
    </div>
  );
}
