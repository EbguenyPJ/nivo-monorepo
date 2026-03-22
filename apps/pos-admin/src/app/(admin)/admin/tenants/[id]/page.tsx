'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Button, Badge, Card, CardContent, Skeleton, toast,
} from '@nivo/ui';
import {
  ArrowLeft, Store, Globe, Database, Calendar, Shield, CreditCard,
  ShoppingBag, Users, UserCog, MapPin, TrendingUp, TrendingDown,
  Package, DollarSign, Activity, Clock, Eye, ArrowUp, ArrowDown,
  Ban, CheckCircle2, Pencil, Mail, AlertTriangle,
} from 'lucide-react';
import { ResponsiveContainer, Area, AreaChart } from 'recharts';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface TenantDetail {
  id: string;
  name: string;
  subdomain: string;
  database_name: string;
  logo_url: string | null;
  stripe_customer_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Overrides
  override_max_branches: number | null;
  override_max_users: number | null;
  override_storage_limit_gb: number | null;
  override_mod_transfers: boolean | null;
  override_mod_invoicing: boolean | null;
  override_mod_loyalty: boolean | null;
  override_mod_advanced_reports: boolean | null;
  override_mod_ecommerce: boolean | null;
  subscriptions: Array<{
    id: string;
    plan_name: string;
    status: string;
    current_period_end: string | null;
    created_at: string;
  }>;
}

interface UsageMetrics {
  totalProducts: number;
  totalBranches: number;
  totalCustomers: number;
  totalEmployees: number;
  salesThisMonth: number;
  salesLastMonth: number;
  revenueThisMonth: number;
  totalSalesAllTime: number;
  lastActivity: string | null;
  error?: string;
}

interface PlanOption {
  id: string;
  plan_name: string;
  display_name: string;
  monthly_price: number;
  is_active: boolean;
}

interface ActivityDay {
  day: string;
  sales: number;
}

const DEFAULT_BADGE_COLORS = [
  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'bg-blue-500/10 text-blue-400 border-blue-500/20',
];

const SUB_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  past_due: { label: 'Pago Pendiente', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  canceled: { label: 'Cancelada', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  paused: { label: 'Pausada', className: 'bg-muted text-muted-foreground border-border' },
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
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7) return `hace ${days}d`;
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [activityData, setActivityData] = useState<ActivityDay[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const loginAsEmployee = useAuthStore((state) => state.loginAsEmployee);

  // Helper maps derived from loaded plans
  const PLAN_PRICES: Record<string, number> = {};
  const PLAN_LABELS: Record<string, string> = {};
  const PLAN_BADGE_COLORS: Record<string, string> = {};
  plans.forEach((p, i) => {
    PLAN_PRICES[p.plan_name] = Number(p.monthly_price) || 0;
    PLAN_LABELS[p.plan_name] = p.display_name;
    PLAN_BADGE_COLORS[p.plan_name] = DEFAULT_BADGE_COLORS[i % DEFAULT_BADGE_COLORS.length];
  });

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const response = await apiClient.get(`/tenants/${params.id}`);
        setTenant(response.data);
      } catch (error) {
        console.error('Failed to fetch tenant:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchUsage = async () => {
      try {
        const response = await apiClient.get(`/tenants/${params.id}/usage`);
        setUsage(response.data);
      } catch (error) {
        console.error('Failed to fetch usage metrics:', error);
      } finally {
        setUsageLoading(false);
      }
    };

    const fetchPlans = async () => {
      try {
        const res = await apiClient.get('/settings/plans');
        const activePlans = (res.data.data || []).filter((p: PlanOption) => p.is_active);
        setPlans(activePlans);
      } catch (error) {
        console.error('Failed to fetch plans:', error);
      }
    };

    const fetchActivity = async () => {
      try {
        const res = await apiClient.get(`/tenants/${params.id}/activity`);
        setActivityData(res.data || []);
      } catch (error) {
        console.error('Failed to fetch activity:', error);
      } finally {
        setActivityLoading(false);
      }
    };

    fetchTenant();
    fetchUsage();
    fetchPlans();
    fetchActivity();
  }, [params.id]);

  const handleImpersonate = async () => {
    if (!tenant) return;
    setImpersonating(true);
    try {
      const response = await apiClient.post(`/auth/impersonate/${tenant.id}`);
      const { access_token } = response.data;
      loginAsEmployee(
        access_token,
        { id: tenant.id, email: 'super-admin@nivo.com', role: 'admin', name: 'Super Admin' },
        { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
      );
      window.location.href = '/dashboard';
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo acceder como administrador.',
        variant: 'destructive',
      });
    } finally {
      setImpersonating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!tenant) return;
    try {
      await apiClient.patch(`/tenants/${tenant.id}/toggle-status`);
      toast({
        title: tenant.is_active ? 'Zapatería suspendida' : 'Zapatería activada',
        description: `${tenant.name} fue ${tenant.is_active ? 'suspendida' : 'activada'} correctamente.`,
      });
      const response = await apiClient.get(`/tenants/${params.id}`);
      setTenant(response.data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al cambiar estado.', variant: 'destructive' });
    }
  };

  const activityTotal = activityData.reduce((sum, d) => sum + d.sales, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-20">
        <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Store className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Zapatería no encontrada</h3>
        <p className="text-sm text-muted-foreground mb-4">El tenant solicitado no existe o fue eliminado.</p>
        <Button variant="outline" onClick={() => router.push('/admin/tenants')}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const activeSub = tenant.subscriptions?.find((s) => s.status === 'active' || s.status === 'past_due');
  const currentPlan = activeSub?.plan_name || null;
  const salesDelta = usage ? usage.salesThisMonth - usage.salesLastMonth : 0;
  const salesGrowth = usage && usage.salesLastMonth > 0 ? Math.round((salesDelta / usage.salesLastMonth) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            onClick={() => router.push('/admin/tenants')}
            className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-foreground truncate">{tenant.name}</h2>
              <Badge
                variant="outline"
                className={
                  tenant.is_active
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }
              >
                {tenant.is_active ? 'Activa' : 'Suspendida'}
              </Badge>
              {currentPlan && (
                <Badge variant="outline" className={PLAN_BADGE_COLORS[currentPlan] || ''}>
                  {PLAN_LABELS[currentPlan] || currentPlan}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{tenant.subdomain}.nivo.com</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/tenants/${tenant.id}/edit`)}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button
            onClick={handleImpersonate}
            disabled={impersonating}
            className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
          >
            <Eye className="h-4 w-4" />
            {impersonating ? 'Accediendo...' : 'Entrar como Admin'}
          </Button>
        </div>
      </div>

      {/* Usage Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Ventas este mes */}
        <Card className="bg-card border-border hover:bg-muted transition-all">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ventas este mes</p>
                {usageLoading ? (
                  <Skeleton className="h-8 w-16 bg-muted" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-foreground">{usage?.salesThisMonth || 0}</p>
                    {usage && usage.salesLastMonth > 0 && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${salesDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {salesDelta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(salesGrowth)}%
                      </span>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground/60">vs {usage?.salesLastMonth || 0} mes anterior</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingresos este mes */}
        <Card className="bg-card border-border hover:bg-muted transition-all">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingresos del mes</p>
                {usageLoading ? (
                  <Skeleton className="h-8 w-24 bg-muted" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(usage?.revenueThisMonth || 0)}</p>
                )}
                <p className="text-[11px] text-muted-foreground/60">{usage?.totalSalesAllTime || 0} ventas totales</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Productos */}
        <Card className="bg-card border-border hover:bg-muted transition-all">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Productos</p>
                {usageLoading ? (
                  <Skeleton className="h-8 w-12 bg-muted" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{usage?.totalProducts || 0}</p>
                )}
                <p className="text-[11px] text-muted-foreground/60">registrados en catálogo</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-fuchsia-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actividad últimos 7 días — Sparkline */}
        <Card className="bg-card border-border hover:bg-muted transition-all">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Últimos 7 días</p>
                {activityLoading ? (
                  <Skeleton className="h-8 w-16 bg-muted" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{activityTotal}</p>
                )}
                <p className="text-[11px] text-muted-foreground/60">ventas en la semana</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-purple-400" />
              </div>
            </div>
            {!activityLoading && activityData.length > 0 && (
              <div className="h-12 mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#a855f7"
                      strokeWidth={2}
                      fill="url(#sparkFill)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Usage Detail Card */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-purple-400" />
                </div>
                <h3 className="font-semibold text-foreground">Métricas de Uso</h3>
                {usage?.error && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 ml-auto text-xs">
                    DB no disponible
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: Package, label: 'Productos', value: usage?.totalProducts, color: 'text-purple-400 bg-purple-500/10' },
                  { icon: Users, label: 'Clientes', value: usage?.totalCustomers, color: 'text-blue-400 bg-blue-500/10' },
                  { icon: UserCog, label: 'Empleados', value: usage?.totalEmployees, color: 'text-emerald-400 bg-emerald-500/10' },
                  { icon: MapPin, label: 'Sucursales', value: usage?.totalBranches, color: 'text-orange-400 bg-orange-500/10' },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl bg-muted/50 border border-border p-4 text-center">
                    <div className={`h-9 w-9 rounded-lg ${metric.color} flex items-center justify-center mx-auto mb-2`}>
                      <metric.icon className="h-4 w-4" />
                    </div>
                    {usageLoading ? (
                      <Skeleton className="h-7 w-10 mx-auto mb-1 bg-muted" />
                    ) : (
                      <p className="text-xl font-bold text-foreground">{metric.value ?? 0}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                  </div>
                ))}
              </div>

              {/* Health Indicator */}
              {!usageLoading && usage && (
                <div className="mt-5 rounded-xl bg-muted/50 border border-border p-4">
                  <div className="flex items-center gap-3">
                    {usage.salesThisMonth > 0 || (usage.lastActivity && (Date.now() - new Date(usage.lastActivity).getTime()) < 86400000 * 7) ? (
                      <>
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-400">Cliente activo</p>
                          <p className="text-xs text-muted-foreground">Este negocio está usando el sistema activamente</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                          <TrendingDown className="h-5 w-5 text-orange-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-400">Riesgo de abandono</p>
                          <p className="text-xs text-muted-foreground">Sin ventas este mes ni actividad reciente. Considerar contactar al cliente.</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1.5 text-orange-400 border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-300"
                          onClick={() => {
                            toast({
                              title: 'Correo enviado',
                              description: `Correo de reactivación enviado a ${tenant.name}`,
                            });
                          }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Enviar correo de reactivación
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* General Info Card */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground">Información General</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: Store, label: 'Nombre', value: tenant.name },
                  { icon: Globe, label: 'Subdominio', value: `${tenant.subdomain}.nivo.com` },
                  { icon: Database, label: 'Base de Datos', value: tenant.database_name, mono: true },
                  {
                    icon: Calendar,
                    label: 'Fecha de Registro',
                    value: new Date(tenant.created_at).toLocaleDateString('es-MX', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    }),
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide">{item.label}</p>
                      <p className={`text-sm text-foreground mt-0.5 truncate ${item.mono ? 'font-mono text-xs' : ''}`}>
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3) — Subscription & Actions */}
        <div className="space-y-5">
          {/* Subscription Card */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-fuchsia-400" />
                </div>
                <h3 className="font-semibold text-foreground">Suscripción</h3>
              </div>

              {activeSub ? (
                <div className="space-y-4">
                  {/* Plan Badge + Status */}
                  <div className="rounded-xl bg-muted/50 border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className={PLAN_BADGE_COLORS[activeSub.plan_name] || ''}>
                        {PLAN_LABELS[activeSub.plan_name] || activeSub.plan_name}
                      </Badge>
                      <Badge variant="outline" className={SUB_STATUS_LABELS[activeSub.status]?.className || ''}>
                        {SUB_STATUS_LABELS[activeSub.status]?.label || activeSub.status}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(PLAN_PRICES[activeSub.plan_name] || 0)}
                      <span className="text-sm font-normal text-muted-foreground">/mes</span>
                    </p>
                  </div>

                  {/* Billing Info */}
                  <div className="space-y-3 text-sm">
                    {activeSub.current_period_end && (
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">Próximo corte</span>
                        <span className="font-medium">
                          {new Date(activeSub.current_period_end).toLocaleDateString('es-MX', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Inicio suscripción</span>
                      <span className="font-medium">
                        {new Date(activeSub.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Método de pago</span>
                      <span className="font-medium text-muted-foreground">
                        {tenant.stripe_customer_id ? '•••• registrado' : 'No configurado'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">Stripe ID</span>
                      <span className="font-mono text-xs text-muted-foreground/70 truncate max-w-[140px]">
                        {tenant.stripe_customer_id || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Plan Overrides */}
                  {(tenant.override_max_branches != null || tenant.override_max_users != null || tenant.override_storage_limit_gb != null ||
                    tenant.override_mod_transfers != null || tenant.override_mod_invoicing != null || tenant.override_mod_loyalty != null ||
                    tenant.override_mod_advanced_reports != null || tenant.override_mod_ecommerce != null) && (
                    <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 space-y-2">
                      <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" />
                        Modificaciones del plan
                      </p>
                      <div className="space-y-1">
                        {tenant.override_max_branches != null && (
                          <p className="text-xs text-muted-foreground">Sucursales: <span className="text-foreground font-medium">{tenant.override_max_branches}</span></p>
                        )}
                        {tenant.override_max_users != null && (
                          <p className="text-xs text-muted-foreground">Usuarios: <span className="text-foreground font-medium">{tenant.override_max_users}</span></p>
                        )}
                        {tenant.override_storage_limit_gb != null && (
                          <p className="text-xs text-muted-foreground">Almacenamiento: <span className="text-foreground font-medium">{tenant.override_storage_limit_gb} GB</span></p>
                        )}
                        {[
                          { key: 'override_mod_transfers' as const, label: 'Transferencias' },
                          { key: 'override_mod_invoicing' as const, label: 'Facturación' },
                          { key: 'override_mod_loyalty' as const, label: 'Lealtad' },
                          { key: 'override_mod_advanced_reports' as const, label: 'Reportes Avanzados' },
                          { key: 'override_mod_ecommerce' as const, label: 'E-commerce' },
                        ].filter(mod => tenant[mod.key] != null).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {[
                              { key: 'override_mod_transfers' as const, label: 'Transferencias' },
                              { key: 'override_mod_invoicing' as const, label: 'Facturación' },
                              { key: 'override_mod_loyalty' as const, label: 'Lealtad' },
                              { key: 'override_mod_advanced_reports' as const, label: 'Reportes Avanzados' },
                              { key: 'override_mod_ecommerce' as const, label: 'E-commerce' },
                            ].filter(mod => tenant[mod.key] != null).map(mod => (
                              <Badge
                                key={mod.key}
                                variant="outline"
                                className={tenant[mod.key] ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]' : 'bg-red-500/10 text-red-400 border-red-500/20 text-[10px]'}
                              >
                                {mod.label}: {tenant[mod.key] ? 'Activado' : 'Desactivado'}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Manage in Edit page */}
                  <Button
                    variant="outline"
                    className="w-full gap-2 mt-2"
                    onClick={() => router.push(`/admin/tenants/${tenant.id}/edit`)}
                  >
                    <Pencil className="h-4 w-4" />
                    Gestionar suscripción
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl bg-muted/30 border border-dashed border-border/50 p-8 text-center">
                  <CreditCard className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">Sin suscripción activa</p>
                  <p className="text-xs text-muted-foreground/70">Este tenant está en periodo de prueba</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground">Acciones</h3>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => window.open(`http://${tenant.subdomain}.localhost:3001`, '_blank')}
                >
                  <Globe className="h-4 w-4" />
                  Abrir portal del tenant
                </Button>

                <Button
                  variant="outline"
                  className={`w-full justify-start gap-2 ${
                    tenant.is_active
                      ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                      : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                  }`}
                  onClick={handleToggleStatus}
                >
                  {tenant.is_active ? (
                    <>
                      <Ban className="h-4 w-4" />
                      Suspender zapatería
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Activar zapatería
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
