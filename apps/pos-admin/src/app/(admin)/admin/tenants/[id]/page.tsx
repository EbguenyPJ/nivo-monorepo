'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Button, Badge, Card, CardContent, Skeleton, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@nivo/ui';
import {
  ArrowLeft, Store, Globe, Database, Calendar, Shield, CreditCard,
  ShoppingBag, Users, UserCog, MapPin, TrendingUp, TrendingDown,
  Package, DollarSign, Activity, Clock, Eye, ArrowUp, ArrowDown,
  Ban, CheckCircle2, Repeat,
} from 'lucide-react';
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

const PLAN_PRICES: Record<string, number> = {
  basic: 499,
  professional: 999,
  enterprise: 2499,
};

const PLAN_LABELS: Record<string, string> = {
  basic: 'Básico',
  professional: 'Profesional',
  enterprise: 'Empresarial',
};

const PLAN_BADGE_COLORS: Record<string, string> = {
  basic: 'bg-blue-50 text-blue-700 border-blue-200/60',
  professional: 'bg-purple-50 text-purple-700 border-purple-200/60',
  enterprise: 'bg-amber-50 text-amber-700 border-amber-200/60',
};

const SUB_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
  past_due: { label: 'Pago Pendiente', className: 'bg-amber-50 text-amber-700 border-amber-200/60' },
  canceled: { label: 'Cancelada', className: 'bg-red-50 text-red-600 border-red-200/60' },
  paused: { label: 'Pausada', className: 'bg-slate-50 text-slate-600 border-slate-200/60' },
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
  const [changingPlan, setChangingPlan] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const loginAsEmployee = useAuthStore((state) => state.loginAsEmployee);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const response = await apiClient.get(`/tenants/${params.id}`);
        setTenant(response.data);
        setSelectedPlan(response.data.subscriptions?.[0]?.plan_name || 'basic');
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

    fetchTenant();
    fetchUsage();
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

  const handleChangePlan = async () => {
    if (!tenant) return;
    setChangingPlan(true);
    try {
      await apiClient.patch(`/tenants/${tenant.id}/plan`, { plan_name: selectedPlan });
      toast({ title: 'Plan actualizado', description: `Plan cambiado a ${PLAN_LABELS[selectedPlan]}.` });
      setPlanDialogOpen(false);
      const response = await apiClient.get(`/tenants/${params.id}`);
      setTenant(response.data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al cambiar plan.', variant: 'destructive' });
    } finally {
      setChangingPlan(false);
    }
  };

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
        <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
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
            className="h-9 w-9 rounded-lg border border-border/60 bg-card flex items-center justify-center hover:bg-accent transition-colors shadow-sm shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight text-foreground truncate">{tenant.name}</h2>
              <Badge
                variant="outline"
                className={
                  tenant.is_active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                    : 'bg-red-50 text-red-600 border-red-200/50'
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

        {/* Impersonate Button — Prominent */}
        <Button
          onClick={handleImpersonate}
          disabled={impersonating}
          className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 shrink-0"
        >
          <Eye className="h-4 w-4" />
          {impersonating ? 'Accediendo...' : 'Entrar como Admin'}
        </Button>
      </div>

      {/* Usage Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Ventas este mes */}
        <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Ventas este mes</p>
                {usageLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">{usage?.salesThisMonth || 0}</p>
                    {usage && usage.salesLastMonth > 0 && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${salesDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {salesDelta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(salesGrowth)}%
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/70">vs {usage?.salesLastMonth || 0} mes anterior</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <ShoppingBag className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingresos este mes */}
        <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Ingresos del mes</p>
                {usageLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold">{formatCurrency(usage?.revenueThisMonth || 0)}</p>
                )}
                <p className="text-xs text-muted-foreground/70">{usage?.totalSalesAllTime || 0} ventas totales</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Productos */}
        <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Productos</p>
                {usageLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{usage?.totalProducts || 0}</p>
                )}
                <p className="text-xs text-muted-foreground/70">registrados en catálogo</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Package className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Última actividad */}
        <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Última actividad</p>
                {usageLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : usage?.lastActivity ? (
                  <p className="text-2xl font-bold">{timeAgo(usage.lastActivity)}</p>
                ) : (
                  <p className="text-lg font-semibold text-muted-foreground">Sin actividad</p>
                )}
                <p className="text-xs text-muted-foreground/70">último uso del sistema</p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                usage?.lastActivity && (Date.now() - new Date(usage.lastActivity).getTime()) < 86400000 * 7
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-amber-50 text-amber-600'
              }`}>
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Usage Detail Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                <h3 className="font-semibold text-foreground">Métricas de Uso</h3>
                {usage?.error && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200/60 ml-auto text-xs">
                    DB no disponible
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: Package, label: 'Productos', value: usage?.totalProducts, color: 'text-purple-600 bg-purple-50' },
                  { icon: Users, label: 'Clientes', value: usage?.totalCustomers, color: 'text-blue-600 bg-blue-50' },
                  { icon: UserCog, label: 'Empleados', value: usage?.totalEmployees, color: 'text-emerald-600 bg-emerald-50' },
                  { icon: MapPin, label: 'Sucursales', value: usage?.totalBranches, color: 'text-amber-600 bg-amber-50' },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl bg-muted/40 border border-border/30 p-4 text-center">
                    <div className={`h-9 w-9 rounded-lg ${metric.color} flex items-center justify-center mx-auto mb-2`}>
                      <metric.icon className="h-4 w-4" />
                    </div>
                    {usageLoading ? (
                      <Skeleton className="h-7 w-10 mx-auto mb-1" />
                    ) : (
                      <p className="text-xl font-bold text-foreground">{metric.value ?? 0}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                  </div>
                ))}
              </div>

              {/* Health Indicator */}
              {!usageLoading && usage && (
                <div className="mt-5 rounded-xl bg-muted/30 border border-border/30 p-4">
                  <div className="flex items-center gap-3">
                    {usage.salesThisMonth > 0 || (usage.lastActivity && (Date.now() - new Date(usage.lastActivity).getTime()) < 86400000 * 7) ? (
                      <>
                        <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-700">Cliente activo</p>
                          <p className="text-xs text-muted-foreground">Este negocio está usando el sistema activamente</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <TrendingDown className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-amber-700">Riesgo de abandono</p>
                          <p className="text-xs text-muted-foreground">Sin ventas este mes ni actividad reciente. Considerar contactar al cliente.</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* General Info Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-slate-600" />
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
                  <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="h-8 w-8 rounded-lg bg-card border border-border/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">{item.label}</p>
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
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-purple-600" />
                </div>
                <h3 className="font-semibold text-foreground">Suscripción</h3>
              </div>

              {activeSub ? (
                <div className="space-y-4">
                  {/* Plan Badge + Status */}
                  <div className="rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/30 p-4">
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
                      <div className="flex items-center justify-between py-2 border-b border-border/30">
                        <span className="text-muted-foreground">Próximo corte</span>
                        <span className="font-medium">
                          {new Date(activeSub.current_period_end).toLocaleDateString('es-MX', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Inicio suscripción</span>
                      <span className="font-medium">
                        {new Date(activeSub.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/30">
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

                  {/* Change Plan Button */}
                  <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2 mt-2">
                        <Repeat className="h-4 w-4" />
                        Cambiar Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cambiar Plan de Suscripción</DialogTitle>
                        <DialogDescription>
                          Selecciona el nuevo plan para {tenant.name}. El cambio se aplicará inmediatamente.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          {['basic', 'professional', 'enterprise'].map((plan) => (
                            <button
                              key={plan}
                              onClick={() => setSelectedPlan(plan)}
                              className={`rounded-xl border-2 p-4 text-center transition-all ${
                                selectedPlan === plan
                                  ? 'border-blue-500 bg-blue-50/50 shadow-md'
                                  : 'border-border/40 hover:border-border'
                              }`}
                            >
                              <p className="font-semibold text-sm">{PLAN_LABELS[plan]}</p>
                              <p className="text-lg font-bold mt-1">{formatCurrency(PLAN_PRICES[plan])}</p>
                              <p className="text-xs text-muted-foreground">/mes</p>
                              {activeSub.plan_name === plan && (
                                <Badge className="mt-2 text-[10px]" variant="secondary">Actual</Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancelar</Button>
                        <Button
                          onClick={handleChangePlan}
                          disabled={changingPlan || selectedPlan === activeSub.plan_name}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0"
                        >
                          {changingPlan ? 'Cambiando...' : 'Confirmar Cambio'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-slate-600" />
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
                      ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                      : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
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
