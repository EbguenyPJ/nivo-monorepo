'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Badge, Card, CardContent, CardHeader, CardTitle, Skeleton,
  Input, Label,
} from '@nivo/ui';
import {
  CreditCard, Check, X, Package, Users, HardDrive, ArrowRightLeft,
  FileText, Heart, TrendingUp, ShoppingCart, Headphones, Mail, MessageCircle,
  Phone, ExternalLink, AlertCircle, CheckCircle2, Clock, Loader2,
  Download, RefreshCw, Save, RotateCcw,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubscriptionData {
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    is_active: boolean;
  };
  subscription: {
    id: string;
    plan_name: string;
    status: string;
    current_period_end: string | null;
    created_at: string;
  } | null;
  plan: {
    id: string;
    plan_name: string;
    display_name: string;
    description: string;
    monthly_price: number;
    annual_price: number;
    support_level: string;
    support_type: string;
    support_hours: string | null;
    support_description: string;
  } | null;
  effective: {
    max_branches: number;
    max_users: number;
    storage_limit_gb: number;
    mod_transfers: boolean;
    mod_invoicing: boolean;
    mod_loyalty: boolean;
    mod_advanced_reports: boolean;
    mod_ecommerce: boolean;
    support_type: string;
    support_hours: string | null;
  };
  usage: {
    branches: number;
    employees: number;
  };
}

interface AvailablePlan {
  id: string;
  plan_name: string;
  display_name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  max_branches: number;
  max_users: number;
  storage_limit_gb: number;
  mod_transfers: boolean;
  mod_invoicing: boolean;
  mod_loyalty: boolean;
  mod_advanced_reports: boolean;
  mod_ecommerce: boolean;
  support_level: string;
  support_type: string;
  support_hours: string | null;
  support_description: string;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
}

interface BillingProfile {
  id: string;
  rfc: string;
  legal_name: string;
  zip_code: string;
  tax_regime: string;
  cfdi_use: string;
  requires_invoice: boolean;
}

interface BillingInvoice {
  id: string;
  stripe_invoice_id: string | null;
  amount_total: number;
  amount_subtotal: number;
  amount_tax: number;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  cfdi_status: 'pending' | 'stamped' | 'failed' | 'canceled';
  sat_uuid: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  pac_error: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;

const TAX_REGIMES = [
  { value: '601', label: '601 – General de Ley Personas Morales' },
  { value: '603', label: '603 – Personas Morales con Fines no Lucrativos' },
  { value: '606', label: '606 – Arrendamiento' },
  { value: '612', label: '612 – Personas Físicas con Actividades Empresariales' },
  { value: '616', label: '616 – Sin obligaciones fiscales' },
  { value: '621', label: '621 – Incorporación Fiscal' },
  { value: '626', label: '626 – Régimen Simplificado de Confianza' },
];

const CFDI_USES = [
  { value: 'G01', label: 'G01 – Adquisición de merci' },
  { value: 'G03', label: 'G03 – Gastos en general' },
  { value: 'I04', label: 'I04 – Equipo de cómputo y accesorios' },
  { value: 'S01', label: 'S01 – Sin efectos fiscales' },
  { value: 'CP01', label: 'CP01 – Pagos' },
];

const CFDI_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:  { label: 'Pendiente',  className: 'bg-muted text-muted-foreground border-border' },
  stamped:  { label: 'Timbrado',   className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  failed:   { label: 'Error',      className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  canceled: { label: 'Cancelado',  className: 'bg-muted text-muted-foreground border-border' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  active: { label: 'Activa', icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  past_due: { label: 'Pago Pendiente', icon: AlertCircle, className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  canceled: { label: 'Cancelada', icon: X, className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  paused: { label: 'Pausada', icon: Clock, className: 'bg-muted text-muted-foreground border-border' },
};

const PLAN_COLORS: Record<string, { badge: string; ring: string; bg: string }> = {
  prueba:       { badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',   ring: 'ring-slate-500/30',   bg: 'bg-slate-500' },
  basico:       { badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', ring: 'ring-purple-500/40', bg: 'bg-purple-500' },
  profesional:  { badge: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20', ring: 'ring-fuchsia-500/40', bg: 'bg-fuchsia-500' },
  corporativo:  { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   ring: 'ring-amber-500/40',   bg: 'bg-amber-500' },
};
const DEFAULT_COLORS = PLAN_COLORS.basico;

const SUPPORT_TYPE_CONFIG: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: 'Correo electrónico', icon: Mail },
  chat:  { label: 'Chat en vivo', icon: MessageCircle },
  phone: { label: 'Llamada telefónica', icon: Phone },
};

const MODULE_CONFIG = [
  { key: 'mod_transfers'      as const, label: 'Traspasos entre sucursales', icon: ArrowRightLeft },
  { key: 'mod_invoicing'      as const, label: 'Facturación Electrónica',    icon: FileText },
  { key: 'mod_loyalty'        as const, label: 'Programa de Lealtad',        icon: Heart },
  { key: 'mod_advanced_reports' as const, label: 'Reportes Avanzados',       icon: TrendingUp },
  { key: 'mod_ecommerce'      as const, label: 'E-commerce',                 icon: ShoppingCart },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value);
}

function formatLimit(value: number): string {
  return value === 0 ? '∞' : String(value);
}

function UsageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-purple-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={pct >= 90 ? 'text-red-400 font-medium' : ''}>
          {used} / {max === 0 ? '∞' : max}
        </span>
      </div>
      {max > 0 && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [plans, setPlans] = useState<AvailablePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Billing state
  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null);
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({
    rfc: '', legal_name: '', zip_code: '', tax_regime: '601', cfdi_use: 'G03', requires_invoice: false,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [rfcError, setRfcError] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, plansRes] = await Promise.all([
        apiClient.get('/tenant-subscription/me'),
        apiClient.get('/tenant-subscription/plans'),
      ]);
      setData(subRes.data);
      setPlans(plansRes.data || []);
    } catch (err) {
      console.error('Error loading subscription data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBillingData = useCallback(async () => {
    setBillingLoading(true);
    try {
      const [profileRes, invoicesRes] = await Promise.all([
        apiClient.get('/billing/profile').catch(() => ({ data: null })),
        apiClient.get('/billing/invoices?limit=20').catch(() => ({ data: { data: [] } })),
      ]);
      if (profileRes.data) {
        setBillingProfile(profileRes.data);
        setProfileForm({
          rfc: profileRes.data.rfc,
          legal_name: profileRes.data.legal_name,
          zip_code: profileRes.data.zip_code,
          tax_regime: profileRes.data.tax_regime,
          cfdi_use: profileRes.data.cfdi_use,
          requires_invoice: profileRes.data.requires_invoice,
        });
      }
      setBillingInvoices(invoicesRes.data?.data || []);
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchBillingData(); }, [fetchBillingData]);

  const handleSaveProfile = async () => {
    const rfcUpper = profileForm.rfc.toUpperCase().trim();
    if (!RFC_REGEX.test(rfcUpper)) {
      setRfcError('RFC inválido. Verifica el formato (ej. XAXX010101000).');
      return;
    }
    setRfcError('');
    setProfileSaving(true);
    try {
      const res = await apiClient.put('/billing/profile', { ...profileForm, rfc: rfcUpper });
      setBillingProfile(res.data);
    } catch (err: any) {
      setRfcError(err.response?.data?.message || 'Error al guardar perfil fiscal.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRetry = async (invoiceId: string) => {
    setRetryingId(invoiceId);
    try {
      await apiClient.post(`/billing/invoices/${invoiceId}/retry`);
      await fetchBillingData();
    } catch (err: any) {
      console.error('Retry failed:', err);
    } finally {
      setRetryingId(null);
    }
  };

  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await apiClient.post('/tenant-subscription/portal');
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      }
    } catch {
      // Portal not configured — just show a placeholder
    } finally {
      setOpeningPortal(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-52 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Mi Suscripción</h2>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No se pudo cargar la información de suscripción.</p>
            <Button variant="outline" className="mt-4" onClick={fetchData}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { subscription, plan, effective, usage } = data;
  const statusCfg = subscription ? (STATUS_CONFIG[subscription.status] || STATUS_CONFIG.active) : null;
  const planColors = plan ? (PLAN_COLORS[plan.plan_name] || DEFAULT_COLORS) : DEFAULT_COLORS;
  const supportTypeCfg = SUPPORT_TYPE_CONFIG[effective.support_type] || SUPPORT_TYPE_CONFIG.email;
  const SupportIcon = supportTypeCfg.icon;

  const currentPlanName = subscription?.plan_name;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Mi Suscripción Nivo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona tu plan, revisa tu uso y compara opciones disponibles.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION A — Current plan + usage
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Plan card */}
        <div className="lg:col-span-2 space-y-4">
          <Card className={`ring-2 ${planColors.ring}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-2xl font-bold text-foreground">
                      {plan?.display_name ?? 'Sin plan'}
                    </h3>
                    <Badge variant="outline" className={planColors.badge}>
                      {plan?.plan_name ?? '—'}
                    </Badge>
                  </div>
                  {plan?.description && (
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  )}
                </div>

                {statusCfg && subscription && (
                  <Badge variant="outline" className={`${statusCfg.className} shrink-0 flex items-center gap-1.5 px-3 py-1.5`}>
                    <statusCfg.icon className="h-3.5 w-3.5" />
                    {statusCfg.label}
                  </Badge>
                )}
              </div>

              {/* Price row */}
              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-4xl font-bold text-foreground">
                  {plan ? formatPrice(plan.monthly_price) : '—'}
                </span>
                <span className="text-muted-foreground text-sm">/mes</span>
                {plan && plan.annual_price > 0 && (
                  <span className="text-sm text-muted-foreground ml-2">
                    o {formatPrice(plan.annual_price)}/año
                  </span>
                )}
              </div>

              {/* Billing date */}
              {subscription?.current_period_end && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    Próximo corte:{' '}
                    <span className="text-foreground font-medium">
                      {new Date(subscription.current_period_end).toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'long', year: 'numeric',
                      })}
                    </span>
                  </span>
                </div>
              )}

              {/* Modules included */}
              <div className="mt-6 pt-5 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-medium">
                  Módulos incluidos
                </p>
                <div className="flex flex-wrap gap-2">
                  {MODULE_CONFIG.map((mod) => {
                    const enabled = effective[mod.key];
                    const ModIcon = mod.icon;
                    return (
                      <div
                        key={mod.key}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                          enabled
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-muted text-muted-foreground border-border opacity-50'
                        }`}
                      >
                        <ModIcon className="h-3 w-3" />
                        {mod.label}
                        {enabled ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage meters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Uso Actual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <UsageBar
                used={usage.branches}
                max={effective.max_branches}
                label="Sucursales"
              />
              <UsageBar
                used={usage.employees}
                max={effective.max_users}
                label="Usuarios / Cajas"
              />
              {effective.storage_limit_gb > 0 && (
                <UsageBar
                  used={0}
                  max={effective.storage_limit_gb}
                  label="Almacenamiento (GB)"
                />
              )}
              {effective.max_branches === 0 && effective.max_users === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Tu plan tiene límites ilimitados en sucursales y usuarios.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Support + quick actions */}
        <div className="space-y-4">
          {/* Support card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Headphones className="h-4 w-4 text-muted-foreground" />
                Tu Soporte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <SupportIcon className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{supportTypeCfg.label}</p>
                  {effective.support_hours && (
                    <p className="text-xs text-muted-foreground mt-0.5">{effective.support_hours}</p>
                  )}
                </div>
              </div>
              {plan?.support_description && (
                <p className="text-xs text-muted-foreground">{plan.support_description}</p>
              )}
              <Button
                variant="outline"
                className="w-full gap-2 mt-1"
                onClick={() => {
                  window.location.href = '/dashboard/support';
                }}
              >
                <MessageCircle className="h-4 w-4" />
                Abrir un Ticket
              </Button>
            </CardContent>
          </Card>

          {/* Billing / Portal card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Facturación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Administra tu método de pago, descarga facturas y revisa tu historial de cobros desde el portal de Stripe.
              </p>
              <Button
                className="w-full gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white border-0"
                onClick={handleOpenPortal}
                disabled={openingPortal}
              >
                {openingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {openingPortal ? 'Abriendo...' : 'Portal de Pagos'}
              </Button>
              <p className="text-[11px] text-muted-foreground/60 text-center">
                Serás redirigido de forma segura a Stripe.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION B — Plan comparison table
      ════════════════════════════════════════════════════════════════════ */}
      {plans.length > 0 && (
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground">Planes disponibles</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Compara las opciones y elige el plan que mejor se adapte a tu negocio.
            </p>
          </div>

          {/* Plan cards on mobile / tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4 mb-6">
            {plans.map((p) => {
              const colors = PLAN_COLORS[p.plan_name] || DEFAULT_COLORS;
              const isCurrent = p.plan_name === currentPlanName;
              const STypeIcon = (SUPPORT_TYPE_CONFIG[p.support_type] || SUPPORT_TYPE_CONFIG.email).icon;
              return (
                <Card key={p.id} className={`relative ${isCurrent ? `ring-2 ${colors.ring}` : ''}`}>
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className={`${colors.badge} text-[10px] px-2 py-0.5 border`}>
                        Tu plan actual
                      </Badge>
                    </div>
                  )}
                  <CardContent className="pt-6 pb-5 px-5 space-y-4">
                    <div>
                      <h4 className="font-semibold text-foreground">{p.display_name}</h4>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-foreground">{formatPrice(p.monthly_price)}</span>
                      <span className="text-xs text-muted-foreground">/mes</span>
                      {p.annual_price > 0 && (
                        <p className="text-xs text-muted-foreground">{formatPrice(p.annual_price)}/año</p>
                      )}
                    </div>
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <p className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />{formatLimit(p.max_branches)} sucursales</p>
                      <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{formatLimit(p.max_users)} usuarios</p>
                      {p.storage_limit_gb > 0 && <p className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" />{p.storage_limit_gb} GB</p>}
                      <p className="flex items-center gap-1.5"><STypeIcon className="h-3.5 w-3.5" />{(SUPPORT_TYPE_CONFIG[p.support_type] || SUPPORT_TYPE_CONFIG.email).label}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {MODULE_CONFIG.filter(m => p[m.key]).map(m => (
                        <Badge key={m.key} variant="outline" className="text-[10px] gap-1 bg-emerald-500/5 text-emerald-400 border-emerald-500/20">
                          <m.icon className="h-2.5 w-2.5" />
                          {m.label}
                        </Badge>
                      ))}
                    </div>
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-1.5 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                        onClick={() => {
                          window.location.href = '/dashboard/support';
                        }}
                      >
                        Solicitar cambio
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Comparison table on desktop */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium text-muted-foreground p-4 w-56">
                        Característica
                      </th>
                      {plans.map((p) => {
                        const colors = PLAN_COLORS[p.plan_name] || DEFAULT_COLORS;
                        const isCurrent = p.plan_name === currentPlanName;
                        return (
                          <th key={p.id} className={`text-center font-medium p-4 min-w-[160px] ${isCurrent ? 'bg-purple-500/5' : ''}`}>
                            <div className="flex flex-col items-center gap-1.5">
                              <Badge variant="outline" className={colors.badge}>
                                {p.display_name}
                              </Badge>
                              {isCurrent && (
                                <span className="text-[10px] text-purple-400 font-normal">Plan actual</span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Prices */}
                    <tr className="bg-muted/30">
                      <td colSpan={plans.length + 1} className="p-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                        Precios
                      </td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="p-4 font-medium text-foreground">Mensual</td>
                      {plans.map((p) => (
                        <td key={p.id} className={`p-4 text-center font-semibold text-foreground ${p.plan_name === currentPlanName ? 'bg-purple-500/5' : ''}`}>
                          {formatPrice(p.monthly_price)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="p-4 font-medium text-foreground">Anual</td>
                      {plans.map((p) => (
                        <td key={p.id} className={`p-4 text-center font-semibold text-foreground ${p.plan_name === currentPlanName ? 'bg-purple-500/5' : ''}`}>
                          {p.annual_price > 0 ? formatPrice(p.annual_price) : '—'}
                        </td>
                      ))}
                    </tr>

                    {/* Limits */}
                    <tr className="bg-muted/30">
                      <td colSpan={plans.length + 1} className="p-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                        Límites
                      </td>
                    </tr>
                    {[
                      { key: 'max_branches' as const, label: 'Sucursales', icon: Package },
                      { key: 'max_users'    as const, label: 'Usuarios / Cajas', icon: Users },
                      { key: 'storage_limit_gb' as const, label: 'Almacenamiento (GB)', icon: HardDrive },
                    ].map((row) => {
                      const RowIcon = row.icon;
                      return (
                        <tr key={row.key} className="border-b border-border/50">
                          <td className="p-4 font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <RowIcon className="h-4 w-4 text-muted-foreground" />
                              {row.label}
                            </div>
                          </td>
                          {plans.map((p) => (
                            <td key={p.id} className={`p-4 text-center text-foreground ${p.plan_name === currentPlanName ? 'bg-purple-500/5' : ''}`}>
                              {formatLimit(p[row.key])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}

                    {/* Modules */}
                    <tr className="bg-muted/30">
                      <td colSpan={plans.length + 1} className="p-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                        Módulos
                      </td>
                    </tr>
                    {MODULE_CONFIG.map((mod) => {
                      const ModIcon = mod.icon;
                      return (
                        <tr key={mod.key} className="border-b border-border/50">
                          <td className="p-4 font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <ModIcon className="h-4 w-4 text-muted-foreground" />
                              {mod.label}
                            </div>
                          </td>
                          {plans.map((p) => {
                            const enabled = p[mod.key];
                            return (
                              <td key={p.id} className={`p-4 text-center ${p.plan_name === currentPlanName ? 'bg-purple-500/5' : ''}`}>
                                {enabled ? (
                                  <div className="mx-auto h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  </div>
                                ) : (
                                  <div className="mx-auto h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                                    <X className="h-3 w-3 text-muted-foreground/40" />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Support */}
                    <tr className="bg-muted/30">
                      <td colSpan={plans.length + 1} className="p-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                        Soporte
                      </td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="p-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Headphones className="h-4 w-4 text-muted-foreground" />
                          Canal
                        </div>
                      </td>
                      {plans.map((p) => {
                        const cfg = SUPPORT_TYPE_CONFIG[p.support_type] || SUPPORT_TYPE_CONFIG.email;
                        const CfgIcon = cfg.icon;
                        return (
                          <td key={p.id} className={`p-4 text-center ${p.plan_name === currentPlanName ? 'bg-purple-500/5' : ''}`}>
                            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                              <CfgIcon className="h-3.5 w-3.5" />
                              <span className="text-xs">{cfg.label}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="p-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Horario
                        </div>
                      </td>
                      {plans.map((p) => (
                        <td key={p.id} className={`p-4 text-center text-xs text-muted-foreground ${p.plan_name === currentPlanName ? 'bg-purple-500/5' : ''}`}>
                          {p.support_hours ?? '—'}
                        </td>
                      ))}
                    </tr>

                    {/* CTA row */}
                    <tr>
                      <td className="p-4" />
                      {plans.map((p) => {
                        const isCurrent = p.plan_name === currentPlanName;
                        return (
                          <td key={p.id} className={`p-4 text-center ${isCurrent ? 'bg-purple-500/5' : ''}`}>
                            {isCurrent ? (
                              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                                Plan actual
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                                onClick={() => { window.location.href = '/dashboard/support'; }}
                              >
                                Solicitar cambio
                              </Button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground mt-3">
            Para cambiar de plan, contacta a nuestro equipo de soporte o usa el botón &quot;Solicitar cambio&quot;.
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION C — Datos de Facturación
      ════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">Datos de Facturación (CFDI 4.0)</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configura tus datos fiscales para recibir facturas electrónicas automáticas con cada pago.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Fiscal data form ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Perfil Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {billingLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  {/* RFC */}
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-rfc">RFC</Label>
                    <Input
                      id="billing-rfc"
                      placeholder="XAXX010101000"
                      maxLength={13}
                      value={profileForm.rfc}
                      onChange={(e) => {
                        setProfileForm((p) => ({ ...p, rfc: e.target.value.toUpperCase() }));
                        setRfcError('');
                      }}
                      className={rfcError ? 'border-red-500' : ''}
                    />
                    {rfcError ? (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {rfcError}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        12 caracteres (moral) o 13 (física). Debe coincidir exactamente con el SAT.
                      </p>
                    )}
                  </div>

                  {/* Razón Social */}
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-legal">Razón Social</Label>
                    <Input
                      id="billing-legal"
                      placeholder="EMPRESA EJEMPLO SA DE CV"
                      value={profileForm.legal_name}
                      onChange={(e) => setProfileForm((p) => ({ ...p, legal_name: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tal como aparece en tu Constancia de Situación Fiscal (sin abreviaturas personalizadas).
                    </p>
                  </div>

                  {/* CP + Régimen */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-cp">Código Postal Fiscal</Label>
                      <Input
                        id="billing-cp"
                        placeholder="06600"
                        maxLength={5}
                        value={profileForm.zip_code}
                        onChange={(e) => setProfileForm((p) => ({ ...p, zip_code: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-regime">Régimen Fiscal</Label>
                      <select
                        id="billing-regime"
                        value={profileForm.tax_regime}
                        onChange={(e) => setProfileForm((p) => ({ ...p, tax_regime: e.target.value }))}
                        className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {TAX_REGIMES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Uso CFDI */}
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-cfdi-use">Uso de CFDI</Label>
                    <select
                      id="billing-cfdi-use"
                      value={profileForm.cfdi_use}
                      onChange={(e) => setProfileForm((p) => ({ ...p, cfdi_use: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {CFDI_USES.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Auto-invoice toggle */}
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Facturación automática</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Generar CFDI automáticamente en cada renovación de plan
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={profileForm.requires_invoice}
                      onClick={() => setProfileForm((p) => ({ ...p, requires_invoice: !p.requires_invoice }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                        profileForm.requires_invoice ? 'bg-purple-500' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
                          profileForm.requires_invoice ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <Button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="w-full gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white border-0"
                  >
                    {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {profileSaving ? 'Guardando...' : 'Guardar Datos Fiscales'}
                  </Button>

                  {billingProfile && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <p className="text-xs text-emerald-400">
                        Perfil fiscal guardado · RFC: <span className="font-mono font-semibold">{billingProfile.rfc}</span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Invoice history ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Historial de Facturas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {billingLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : billingInvoices.length === 0 ? (
                <div className="text-center py-10">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No hay facturas aún.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Las facturas aparecerán aquí después de cada pago exitoso.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {billingInvoices.map((inv) => {
                    const statusCfg = CFDI_STATUS_CONFIG[inv.cfdi_status] || CFDI_STATUS_CONFIG.pending;
                    const isFailed = inv.cfdi_status === 'failed';
                    const isRetrying = retryingId === inv.id;
                    return (
                      <div
                        key={inv.id}
                        className={`rounded-lg border p-3 space-y-2 ${
                          isFailed ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-muted/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {inv.description || 'Suscripción Nivo'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(inv.created_at).toLocaleDateString('es-MX', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                              {' · '}
                              <span className="font-medium">
                                {formatPrice(Number(inv.amount_total))}
                              </span>
                            </p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${statusCfg.className}`}>
                            {statusCfg.label}
                          </Badge>
                        </div>

                        {/* SAT UUID */}
                        {inv.sat_uuid && (
                          <p className="text-[10px] font-mono text-muted-foreground truncate">
                            UUID: {inv.sat_uuid}
                          </p>
                        )}

                        {/* Error message */}
                        {isFailed && inv.pac_error && (
                          <p className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1 break-words">
                            {inv.pac_error}
                          </p>
                        )}

                        {/* Actions row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {inv.pdf_url && (
                            <a
                              href={inv.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              PDF
                            </a>
                          )}
                          {inv.xml_url && (
                            <a
                              href={inv.xml_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              XML
                            </a>
                          )}
                          {isFailed && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] px-2 gap-1 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 ml-auto"
                              onClick={() => handleRetry(inv.id)}
                              disabled={isRetrying}
                            >
                              {isRetrying ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              {isRetrying ? 'Reintentando...' : 'Reintentar Factura'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs text-amber-400 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              El CFDI 4.0 requiere que el RFC y la Razón Social coincidan exactamente con tu{' '}
              <strong>Constancia de Situación Fiscal</strong> del SAT. Cualquier diferencia (incluso mayúsculas o
              acentos) causará error en el timbrado.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
