'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@nivo/ui';
import {
  Store,
  CheckCircle,
  XCircle,
  CalendarPlus,
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

const PLAN_COLORS: Record<string, string> = {
  basic: '#3b82f6',
  professional: '#8b5cf6',
  enterprise: '#f59e0b',
  unknown: '#94a3b8',
};

const PLAN_LABELS: Record<string, string> = {
  basic: 'Básico',
  professional: 'Profesional',
  enterprise: 'Empresarial',
  unknown: 'Sin plan',
};

const ACTIVITY_ICONS: Record<string, { icon: typeof Store; color: string }> = {
  registration: { icon: UserPlus, color: 'text-blue-500 bg-blue-50' },
  cancellation: { icon: UserMinus, color: 'text-red-500 bg-red-50' },
  payment_issue: { icon: AlertCircle, color: 'text-amber-500 bg-amber-50' },
  upgrade: { icon: TrendingUp, color: 'text-purple-500 bg-purple-50' },
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

// Custom tooltip for the line chart
function GrowthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
          {entry.name === 'tenants' ? 'Registros' : 'Ingresos'}:{' '}
          <span className="font-medium text-foreground">
            {entry.name === 'revenue' ? formatCurrency(entry.value) : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// Custom label for pie chart
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

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

    fetchMetrics();
  }, []);

  const kpis = metrics?.kpis;
  const growthDelta = kpis ? kpis.thisMonth - kpis.lastMonth : 0;
  const growthPercent = kpis && kpis.lastMonth > 0 ? Math.round((growthDelta / kpis.lastMonth) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Resumen general de la plataforma Nivo</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {/* MRR */}
        <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">MRR</p>
                {loading ? (
                  <Skeleton className="h-9 w-28" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight">{formatCurrency(kpis?.mrr || 0)}</p>
                )}
                <p className="text-xs text-muted-foreground/70">Ingreso Mensual Recurrente</p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nuevos este mes */}
        <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Nuevos este mes</p>
                {loading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold tracking-tight text-blue-600">{kpis?.thisMonth || 0}</p>
                    {kpis && kpis.lastMonth > 0 && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-medium ${growthDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                      >
                        {growthDelta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(growthPercent)}%
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/70">
                  vs {kpis?.lastMonth || 0} el mes pasado
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
                <CalendarPlus className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suscripciones activas */}
        <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Suscripciones Activas</p>
                {loading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight text-emerald-600">{kpis?.activeSubs || 0}</p>
                )}
                <p className="text-xs text-muted-foreground/70">
                  de {kpis?.total || 0} zapaterías registradas
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Churn Rate */}
        <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Tasa de Cancelación</p>
                {loading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <p className={`text-3xl font-bold tracking-tight ${(kpis?.churnRate || 0) > 5 ? 'text-red-500' : 'text-foreground'}`}>
                    {kpis?.churnRate || 0}%
                  </p>
                )}
                <p className="text-xs text-muted-foreground/70">Churn este mes</p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${(kpis?.churnRate || 0) > 5 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-500'}`}>
                <Activity className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Line Chart — Growth (2/3 width) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Crecimiento (últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics?.monthlyGrowth || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<GrowthTooltip />} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="tenants"
                    name="tenants"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    name="revenue"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    strokeDasharray="6 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-500 rounded-full inline-block" /> Registros
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-purple-500 rounded-full inline-block" style={{ borderBottom: '1px dashed' }} /> Ingresos (MXN)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart — Plan Distribution (1/3 width) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Store className="h-4 w-4 text-purple-500" />
              Distribución de Planes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : metrics?.planDistribution && metrics.planDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metrics.planDistribution}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                    labelLine={false}
                    label={PieLabel}
                  >
                    {metrics.planDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PLAN_COLORS[entry.name] || PLAN_COLORS.unknown} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => (
                      <span className="text-xs text-muted-foreground">{PLAN_LABELS[value] || value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos de suscripciones
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Activity Feed + Quick Action */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Activity Feed (2/3) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : metrics?.activityFeed && metrics.activityFeed.length > 0 ? (
              <div className="space-y-1">
                {metrics.activityFeed.map((event, i) => {
                  const config = ACTIVITY_ICONS[event.type] || ACTIVITY_ICONS.registration;
                  const Icon = config.icon;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{event.message}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(event.time)}</p>
                      </div>
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

        {/* Quick Actions (1/3) */}
        <div className="space-y-5">
          <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow duration-300">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Vista Rápida</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {loading ? '...' : `${kpis?.active || 0} de ${kpis?.total || 0} zapaterías activas`}
                  </p>
                  {!loading && kpis && kpis.total > 0 && (
                    <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-700"
                        style={{ width: `${(kpis.active / kpis.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Link href="/admin/tenants">
            <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-300 group cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Store className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Gestionar Zapaterías</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Crear, editar y administrar tenants</p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
              </CardContent>
            </Card>
          </Link>

          {/* Stats Summary Mini Card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Resumen
              </h3>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Activas</span>
                    <span className="font-semibold text-emerald-600">{kpis?.active || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Inactivas</span>
                    <span className="font-semibold text-red-500">{kpis?.inactive || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Churn</span>
                    <span className={`font-semibold ${(kpis?.churnRate || 0) > 5 ? 'text-red-500' : 'text-foreground'}`}>
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
