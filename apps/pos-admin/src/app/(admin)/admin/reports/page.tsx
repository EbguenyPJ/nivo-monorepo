'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  cn,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@nivo/ui';
import {
  DollarSign,
  UserPlus,
  UserMinus,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Download,
  BarChart3,
  Activity,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MrrEntry {
  month: string;
  mrr: number;
  tenants: number;
}

interface RevenueData {
  totalRevenue: number;
  newTenants: number;
  churnedTenants: number;
  avgRevenuePerTenant: number;
  retentionRate: number;
}

interface RetentionEntry {
  month: string;
  rate: number;
  survived: number;
  total: number;
}

interface TenantGrowthEntry {
  month: string;
  newTenants: number;
  churned: number;
  net: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateRange(period: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start: Date;
  switch (period) {
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case '3_months':
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case '6_months':
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    case '1_year':
      start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      break;
    default:
      start = new Date(2020, 0, 1);
  }
  return { start: start.toISOString().split('T')[0], end };
}

const PERIOD_OPTIONS = [
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Último mes' },
  { value: '3_months', label: 'Últimos 3 meses' },
  { value: '6_months', label: 'Últimos 6 meses' },
  { value: '1_year', label: 'Último año' },
  { value: 'all', label: 'Todo' },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyCompact(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

// ---------------------------------------------------------------------------
// Chart tooltips
// ---------------------------------------------------------------------------

function MrrTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 text-sm">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-muted-foreground flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          {entry.dataKey === 'mrr' ? 'MRR' : 'Tenants'}:{' '}
          <span className="font-medium text-foreground">
            {entry.dataKey === 'mrr' ? formatCurrency(entry.value) : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

function RetentionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 text-sm">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      <p className="text-muted-foreground flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: entry.color }}
        />
        Retención:{' '}
        <span className="font-medium text-foreground">{entry.value}%</span>
      </p>
      {entry.payload && (
        <p className="text-muted-foreground text-xs mt-1">
          {entry.payload.survived} de {entry.payload.total} tenants
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('6_months');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [mrrHistory, setMrrHistory] = useState<MrrEntry[]>([]);
  const [retention, setRetention] = useState<RetentionEntry[]>([]);
  const [tenantGrowth, setTenantGrowth] = useState<TenantGrowthEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(period);

      const [revenueRes, mrrRes, retentionRes, growthRes] = await Promise.all([
        apiClient.get(`/reports/revenue?start_date=${start}&end_date=${end}`),
        apiClient.get('/reports/mrr-history?months=12'),
        apiClient.get('/reports/retention'),
        apiClient.get(`/reports/tenant-growth?start_date=${start}&end_date=${end}`),
      ]);

      setRevenue(revenueRes.data);
      setMrrHistory(mrrRes.data.data || []);
      setRetention(retentionRes.data.data || []);
      setTenantGrowth(growthRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const { start, end } = getDateRange(period);
      const res = await apiClient.get(
        `/reports/export-csv?start_date=${start}&end_date=${end}`,
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `nivo-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    } finally {
      setExporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // KPI cards config
  // ---------------------------------------------------------------------------

  const kpiCards = [
    {
      label: 'Ingresos Totales',
      value: revenue ? formatCurrency(revenue.totalRevenue) : null,
      subtitle: revenue
        ? `${formatCurrency(revenue.avgRevenuePerTenant)} prom/tenant`
        : undefined,
      icon: DollarSign,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Nuevos Tenants',
      value: revenue ? String(revenue.newTenants) : null,
      subtitle: 'En el periodo seleccionado',
      icon: UserPlus,
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-400',
    },
    {
      label: 'Tenants Perdidos',
      value: revenue ? String(revenue.churnedTenants) : null,
      subtitle: 'Churn en el periodo',
      icon: UserMinus,
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
    },
    {
      label: 'Tasa de Retención',
      value: revenue ? `${revenue.retentionRate}%` : null,
      subtitle: 'Retención de clientes',
      icon: ShieldCheck,
      iconBg:
        revenue && revenue.retentionRate >= 80
          ? 'bg-emerald-500/10'
          : 'bg-amber-500/10',
      iconColor:
        revenue && revenue.retentionRate >= 80
          ? 'text-emerald-400'
          : 'text-amber-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Reportes
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Análisis y métricas de la plataforma
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportCsv}
            disabled={exporting}
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* KPI Cards                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.label}
              className="bg-card border-border hover:shadow-lg transition-all duration-300"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {kpi.label}
                    </p>
                    {loading ? (
                      <Skeleton className="h-8 w-28 bg-muted" />
                    ) : (
                      <p className="text-2xl font-bold tracking-tight text-foreground">
                        {kpi.value}
                      </p>
                    )}
                    {kpi.subtitle && (
                      <p className="text-[11px] text-muted-foreground/60">
                        {kpi.subtitle}
                      </p>
                    )}
                  </div>
                  <div
                    className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center',
                      kpi.iconBg,
                    )}
                  >
                    <Icon className={cn('h-5 w-5', kpi.iconColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Charts Row: MRR + Retention                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* MRR History — 2/3 width */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/70">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              Historial de MRR
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[300px] w-full rounded-lg bg-muted" />
            ) : mrrHistory.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos de MRR disponibles
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={mrrHistory}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      className="[&_.recharts-text]:fill-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatCurrencyCompact(v)}
                      className="[&_.recharts-text]:fill-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      className="[&_.recharts-text]:fill-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<MrrTooltip />} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="mrr"
                      stroke="#a78bfa"
                      strokeWidth={2.5}
                      fill="url(#mrrGradient)"
                      dot={{ r: 4, fill: '#a78bfa', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#a78bfa', fill: 'hsl(var(--card))' }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="tenants"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#f59e0b', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#f59e0b', fill: 'hsl(var(--card))' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />{' '}
                    MRR (MXN)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{' '}
                    Tenants
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Retention — 1/3 width */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/70">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              Retención Mensual
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[300px] w-full rounded-lg bg-muted" />
            ) : retention.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos de retención
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={retention}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10 }}
                    className="[&_.recharts-text]:fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    className="[&_.recharts-text]:fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<RetentionTooltip />} />
                  <Bar
                    dataKey="rate"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  >
                    {retention.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.rate >= 80 ? '#34d399' : '#fbbf24'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Tenant Growth Table                                               */}
      {/* ----------------------------------------------------------------- */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/70">
            <Activity className="h-4 w-4 text-fuchsia-400" />
            Crecimiento de Tenants
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-muted" />
              ))}
            </div>
          ) : tenantGrowth.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No hay datos de crecimiento en el periodo seleccionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Mes</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Nuevos
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Perdidos
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Neto
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Tendencia
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenantGrowth.map((row) => (
                    <tr
                      key={row.month}
                      className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 text-foreground">{row.month}</td>
                      <td className="py-3 text-right text-foreground">
                        {row.newTenants}
                      </td>
                      <td className="py-3 text-right text-foreground">
                        {row.churned}
                      </td>
                      <td className="py-3 text-right font-medium text-foreground">
                        {row.net > 0 ? `+${row.net}` : row.net}
                      </td>
                      <td className="py-3 text-right">
                        {row.net > 0 ? (
                          <Badge
                            variant="default"
                            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 gap-1"
                          >
                            <TrendingUp className="h-3 w-3" />
                            Crecimiento
                          </Badge>
                        ) : row.net < 0 ? (
                          <Badge
                            variant="destructive"
                            className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 gap-1"
                          >
                            <TrendingDown className="h-3 w-3" />
                            Declive
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground gap-1"
                          >
                            Estable
                          </Badge>
                        )}
                      </td>
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
