'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@nivo/ui';
import {
  Store,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  DollarSign,
  UserPlus,
  UserMinus,
  CreditCard,
  Activity,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  CalendarPlus,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardMetrics {
  kpis: {
    total: number;
    active: number;
    inactive: number;
    thisMonth: number;
    lastMonth: number;
    mrr: number;
    churnRate: number;
    activeSubs: number;
  };
  planDistribution: { name: string; count: number }[];
  monthlyGrowth: { month: string; tenants: number; revenue: number }[];
  activityFeed: { type: string; message: string; time: string; tenantName?: string }[];
}

interface PlanOption {
  id: string;
  plan_name: string;
  display_name: string;
  monthly_price: number;
}

const PALETTE = ['#a78bfa', '#f59e0b', '#f472b6', '#34d399', '#60a5fa', '#fb923c'];
const FALLBACK_PLAN_LABELS: Record<string, string> = { unknown: 'Sin plan' };

const ACTIVITY_ICONS: Record<string, { icon: typeof Store; color: string; dot: string }> = {
  registration: { icon: UserPlus, color: 'text-purple-400', dot: 'bg-purple-400' },
  cancellation: { icon: UserMinus, color: 'text-red-400', dot: 'bg-red-400' },
  payment_issue: { icon: AlertCircle, color: 'text-orange-400', dot: 'bg-orange-400' },
  upgrade: { icon: TrendingUp, color: 'text-fuchsia-400', dot: 'bg-fuchsia-400' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(value);
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Justo ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 30) return `hace ${days}d`;
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// Custom tooltip
function GrowthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 text-sm">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-muted-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          {entry.name === 'tenants' ? 'Registros' : 'Ingresos'}:{' '}
          <span className="font-medium text-foreground">
            {entry.name === 'revenue' ? formatCurrency(entry.value) : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// Custom label for donut
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLabels, setPlanLabels] = useState<Record<string, string>>(FALLBACK_PLAN_LABELS);
  const [planColors, setPlanColors] = useState<Record<string, string>>({ unknown: '#64748b' });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await apiClient.get('/tenants/dashboard/metrics');
        setMetrics(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchPlans = async () => {
      try {
        const res = await apiClient.get('/settings/plans');
        const plans: PlanOption[] = res.data.data || [];
        const labels: Record<string, string> = { unknown: 'Sin plan' };
        const colors: Record<string, string> = { unknown: '#64748b' };
        plans.forEach((p, i) => {
          labels[p.plan_name] = p.display_name;
          colors[p.plan_name] = PALETTE[i % PALETTE.length];
        });
        setPlanLabels(labels);
        setPlanColors(colors);
      } catch (error) {
        console.error('Failed to fetch plans:', error);
      }
    };

    fetchMetrics();
    fetchPlans();
  }, []);

  const kpis = metrics?.kpis;
  const growthDelta = kpis ? kpis.thisMonth - kpis.lastMonth : 0;
  const growthPercent = kpis && kpis.lastMonth > 0 ? Math.round((growthDelta / kpis.lastMonth) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Resumen general de la plataforma Nivo</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* MRR */}
        <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">MRR</p>
                {loading ? (
                  <Skeleton className="h-8 w-28 bg-muted" />
                ) : (
                  <p className="text-2xl font-bold tracking-tight text-foreground">{formatCurrency(kpis?.mrr || 0)}</p>
                )}
                <p className="text-[11px] text-muted-foreground/60">Ingreso Mensual Recurrente</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nuevos este mes */}
        <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nuevos</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 bg-muted" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold tracking-tight text-foreground">{kpis?.thisMonth || 0}</p>
                    {kpis && kpis.lastMonth > 0 && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${growthDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {growthDelta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(growthPercent)}%
                      </span>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground/60">vs {kpis?.lastMonth || 0} mes pasado</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <CalendarPlus className="h-5 w-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suscripciones activas */}
        <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activas</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 bg-muted" />
                ) : (
                  <p className="text-2xl font-bold tracking-tight text-foreground">{kpis?.activeSubs || 0}</p>
                )}
                <p className="text-[11px] text-muted-foreground/60">de {kpis?.total || 0} registradas</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-fuchsia-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Churn Rate */}
        <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Churn</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 bg-muted" />
                ) : (
                  <p className={`text-2xl font-bold tracking-tight ${(kpis?.churnRate || 0) > 5 ? 'text-red-400' : 'text-foreground'}`}>
                    {kpis?.churnRate || 0}%
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/60">Tasa de cancelación</p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${(kpis?.churnRate || 0) > 5 ? 'bg-red-500/10' : 'bg-orange-500/10'}`}>
                <Activity className={`h-5 w-5 ${(kpis?.churnRate || 0) > 5 ? 'text-red-400' : 'text-orange-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Line Chart — Growth */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/70">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              Crecimiento (últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[280px] w-full rounded-lg bg-muted" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={metrics?.monthlyGrowth || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground [&_.recharts-text]:fill-muted-foreground" axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} className="[&_.recharts-text]:fill-muted-foreground" axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} className="[&_.recharts-text]:fill-muted-foreground" axisLine={false} tickLine={false} />
                  <Tooltip content={<GrowthTooltip />} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="tenants"
                    name="tenants"
                    stroke="#a78bfa"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#a78bfa', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    activeDot={{ r: 7, strokeWidth: 2, stroke: '#a78bfa', fill: 'hsl(var(--card))' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    name="revenue"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#f59e0b', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    activeDot={{ r: 7, strokeWidth: 2, stroke: '#f59e0b', fill: 'hsl(var(--card))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center justify-center gap-6 mt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Registros
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Ingresos (MXN)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Donut — Plan Distribution */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/70">
              <Store className="h-4 w-4 text-fuchsia-400" />
              Distribución de Planes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[280px] w-full rounded-lg bg-muted" />
            ) : metrics?.planDistribution && metrics.planDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={metrics.planDistribution}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="name"
                    labelLine={false}
                    label={PieLabel}
                    stroke="none"
                  >
                    {metrics.planDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={planColors[entry.name] || planColors.unknown || '#64748b'} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => (
                      <span className="text-[11px] text-muted-foreground">{planLabels[value] || value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos de suscripciones
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Activity + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Activity Feed */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/70">
              <Activity className="h-4 w-4 text-orange-400" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-2 w-2 rounded-full bg-muted shrink-0" />
                    <Skeleton className="h-4 w-full bg-muted" />
                  </div>
                ))}
              </div>
            ) : metrics?.activityFeed && metrics.activityFeed.length > 0 ? (
              <div className="space-y-0.5">
                {metrics.activityFeed.map((event, i) => {
                  const config = ACTIVITY_ICONS[event.type] || ACTIVITY_ICONS.registration;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${config.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-muted-foreground group-hover:text-foreground truncate transition-colors">
                          {event.message}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground/50 shrink-0">{timeAgo(event.time)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No hay actividad reciente
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-orange-400 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm">Vista Rápida</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {loading ? '...' : `${kpis?.active || 0} de ${kpis?.total || 0} zapaterías activas`}
                  </p>
                  {!loading && kpis && kpis.total > 0 && (
                    <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-700"
                        style={{ width: `${(kpis.active / kpis.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Link href="/admin/tenants">
            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300 group cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Store className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm">Gestionar Zapaterías</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Crear, editar y administrar</p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-purple-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
              </CardContent>
            </Card>
          </Link>

          {/* Stats Summary */}
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                Resumen
              </h3>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4 w-full bg-muted" />)}
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Activas</span>
                    <span className="font-semibold text-emerald-400">{kpis?.active || 0}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Inactivas</span>
                    <span className="font-semibold text-red-400">{kpis?.inactive || 0}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Churn</span>
                    <span className={`font-semibold ${(kpis?.churnRate || 0) > 5 ? 'text-red-400' : 'text-foreground/70'}`}>
                      {kpis?.churnRate || 0}%
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
