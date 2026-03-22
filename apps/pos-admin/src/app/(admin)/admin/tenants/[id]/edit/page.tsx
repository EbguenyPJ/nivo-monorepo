'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Button, Badge, Card, CardContent, Input, Label, Skeleton, toast,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@nivo/ui';
import {
  ArrowLeft, Save, Loader2, Check, X, AlertTriangle, CreditCard,
  ArrowLeftRight, FileText, Heart, BarChart3, ShoppingCart, RotateCcw, Key,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

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
  override_notes: string | null;
  override_mod_transfers: boolean | null;
  override_mod_invoicing: boolean | null;
  override_mod_loyalty: boolean | null;
  override_mod_advanced_reports: boolean | null;
  override_mod_ecommerce: boolean | null;
  // Fiscal
  rfc: string | null;
  razon_social: string | null;
  regimen_fiscal: string | null;
  codigo_postal_fiscal: string | null;
  direccion_fiscal: string | null;
  subscriptions: Array<{
    id: string;
    plan_name: string;
    status: string;
    current_period_end: string | null;
    created_at: string;
  }>;
}

interface PlanOption {
  id: string;
  plan_name: string;
  display_name: string;
  monthly_price: number;
  max_branches?: number;
  max_users?: number;
  storage_limit_gb?: number;
  mod_transfers?: boolean;
  mod_invoicing?: boolean;
  mod_loyalty?: boolean;
  mod_advanced_reports?: boolean;
  mod_ecommerce?: boolean;
  is_active: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(value);
}

const FISCAL_REGIMES = [
  '601 - General de Ley',
  '603 - Personas Morales con Fines no Lucrativos',
  '605 - Sueldos y Salarios',
  '606 - Arrendamiento',
  '612 - Personas Físicas con Actividades Empresariales',
  '616 - Sin obligaciones fiscales',
  '621 - Incorporación Fiscal',
  '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  '626 - Régimen Simplificado de Confianza',
];

const SUB_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  past_due: { label: 'Pago Pendiente', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  canceled: { label: 'Cancelada', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  paused: { label: 'Pausada', className: 'bg-muted text-muted-foreground border-border' },
};

export default function TenantEditPage() {
  const params = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);

  // General tab
  const [generalForm, setGeneralForm] = useState({ name: '', subdomain: '' });
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const subdomainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalSubdomain = useRef('');

  // Fiscal tab
  const [fiscalForm, setFiscalForm] = useState({
    rfc: '',
    razon_social: '',
    regimen_fiscal: '',
    codigo_postal_fiscal: '',
    direccion_fiscal: '',
  });
  const [savingFiscal, setSavingFiscal] = useState(false);

  // Subscription tab
  const [selectedPlan, setSelectedPlan] = useState('');
  const [changingPlan, setChangingPlan] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);

  // Limits tab
  const [limitsForm, setLimitsForm] = useState({
    max_branches: '',
    max_users: '',
    storage_gb: '',
    notes: '',
  });
  const [savingLimits, setSavingLimits] = useState(false);

  // Modules override tab
  const [modulesForm, setModulesForm] = useState<Record<string, boolean | null>>({
    override_mod_transfers: null,
    override_mod_invoicing: null,
    override_mod_loyalty: null,
    override_mod_advanced_reports: null,
    override_mod_ecommerce: null,
  });
  const [savingModules, setSavingModules] = useState(false);

  // Credentials
  const [credentialsForm, setCredentialsForm] = useState({ email: '', password: '' });
  const [savingCredentials, setSavingCredentials] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tenantRes, plansRes] = await Promise.all([
        apiClient.get(`/tenants/${params.id}`),
        apiClient.get('/settings/plans'),
      ]);
      const t = tenantRes.data;
      setTenant(t);
      setGeneralForm({ name: t.name, subdomain: t.subdomain });
      originalSubdomain.current = t.subdomain;
      setSelectedPlan(t.subscriptions?.[0]?.plan_name || '');

      // Populate fiscal
      setFiscalForm({
        rfc: t.rfc || '',
        razon_social: t.razon_social || '',
        regimen_fiscal: t.regimen_fiscal || '',
        codigo_postal_fiscal: t.codigo_postal_fiscal || '',
        direccion_fiscal: t.direccion_fiscal || '',
      });

      // Populate limits
      setLimitsForm({
        max_branches: t.override_max_branches != null ? String(t.override_max_branches) : '',
        max_users: t.override_max_users != null ? String(t.override_max_users) : '',
        storage_gb: t.override_storage_limit_gb != null ? String(t.override_storage_limit_gb) : '',
        notes: t.override_notes || '',
      });

      // Populate module overrides
      setModulesForm({
        override_mod_transfers: t.override_mod_transfers,
        override_mod_invoicing: t.override_mod_invoicing,
        override_mod_loyalty: t.override_mod_loyalty,
        override_mod_advanced_reports: t.override_mod_advanced_reports,
        override_mod_ecommerce: t.override_mod_ecommerce,
      });

      const activePlans = (plansRes.data.data || []).filter((p: PlanOption) => p.is_active);
      setPlans(activePlans);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced subdomain check
  useEffect(() => {
    if (subdomainTimerRef.current) clearTimeout(subdomainTimerRef.current);
    if (!generalForm.subdomain || generalForm.subdomain.length < 3) {
      setSubdomainStatus('idle');
      return;
    }
    if (generalForm.subdomain === originalSubdomain.current) {
      setSubdomainStatus('idle');
      return;
    }
    setSubdomainStatus('checking');
    subdomainTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/tenants/check-subdomain?subdomain=${encodeURIComponent(generalForm.subdomain)}`);
        setSubdomainStatus(res.data.available ? 'available' : 'taken');
      } catch {
        setSubdomainStatus('idle');
      }
    }, 500);
    return () => {
      if (subdomainTimerRef.current) clearTimeout(subdomainTimerRef.current);
    };
  }, [generalForm.subdomain]);

  const handleSaveGeneral = async () => {
    if (!tenant) return;
    setSavingGeneral(true);
    try {
      await apiClient.patch(`/tenants/${tenant.id}`, {
        name: generalForm.name,
        subdomain: generalForm.subdomain,
      });
      originalSubdomain.current = generalForm.subdomain;
      setSubdomainStatus('idle');
      toast({ title: 'Guardado', description: 'Datos generales actualizados correctamente.' });
      const res = await apiClient.get(`/tenants/${params.id}`);
      setTenant(res.data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveFiscal = async () => {
    if (!tenant) return;
    setSavingFiscal(true);
    try {
      await apiClient.patch(`/tenants/${tenant.id}`, fiscalForm);
      toast({ title: 'Guardado', description: 'Datos fiscales actualizados correctamente.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSavingFiscal(false);
    }
  };

  const handleChangePlan = async () => {
    if (!tenant) return;
    setChangingPlan(true);
    try {
      await apiClient.patch(`/tenants/${tenant.id}/plan`, { plan_name: selectedPlan });
      const planLabel = plans.find(p => p.plan_name === selectedPlan)?.display_name || selectedPlan;
      toast({ title: 'Plan actualizado', description: `Plan cambiado a ${planLabel}.` });
      const res = await apiClient.get(`/tenants/${params.id}`);
      setTenant(res.data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al cambiar plan.', variant: 'destructive' });
    } finally {
      setChangingPlan(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!tenant) return;
    setCancellingSubscription(true);
    try {
      await apiClient.patch(`/tenants/${tenant.id}/cancel-subscription`);
      toast({ title: 'Suscripción cancelada', description: `La suscripción de ${tenant.name} fue cancelada.` });
      setCancelDialogOpen(false);
      const res = await apiClient.get(`/tenants/${params.id}`);
      setTenant(res.data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al cancelar.', variant: 'destructive' });
    } finally {
      setCancellingSubscription(false);
    }
  };

  const handleSaveLimits = async () => {
    if (!tenant) return;
    setSavingLimits(true);
    try {
      await apiClient.patch(`/tenants/${tenant.id}`, {
        override_max_branches: limitsForm.max_branches ? Number(limitsForm.max_branches) : null,
        override_max_users: limitsForm.max_users ? Number(limitsForm.max_users) : null,
        override_storage_gb: limitsForm.storage_gb ? Number(limitsForm.storage_gb) : null,
        override_notes: limitsForm.notes || null,
      });
      toast({ title: 'Guardado', description: 'Límites manuales actualizados correctamente.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSavingLimits(false);
    }
  };

  const handleSaveModules = async () => {
    if (!tenant) return;
    setSavingModules(true);
    try {
      await apiClient.patch(`/tenants/${tenant.id}`, modulesForm);
      toast({ title: 'Guardado', description: 'Módulos actualizados correctamente.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSavingModules(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!tenant) return;
    setSavingCredentials(true);
    try {
      const payload: Record<string, string> = {};
      if (credentialsForm.email) payload.admin_email = credentialsForm.email;
      if (credentialsForm.password) payload.admin_password = credentialsForm.password;
      if (Object.keys(payload).length === 0) {
        toast({ title: 'Sin cambios', description: 'No hay cambios de credenciales que guardar.' });
        setSavingCredentials(false);
        return;
      }
      await apiClient.patch(`/tenants/${tenant.id}/credentials`, payload);
      setCredentialsForm(prev => ({ ...prev, password: '' }));
      toast({ title: 'Guardado', description: 'Credenciales actualizadas correctamente.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSavingCredentials(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-20">
        <h3 className="font-semibold text-foreground mb-1">Tenant no encontrado</h3>
        <Button variant="outline" onClick={() => router.push('/admin/tenants')}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const activeSub = tenant.subscriptions?.find((s) => s.status === 'active' || s.status === 'past_due');
  const currentPlanName = activeSub?.plan_name || null;
  const currentPlanObj = plans.find(p => p.plan_name === currentPlanName);

  // Build plan label/price maps
  const PLAN_LABELS: Record<string, string> = {};
  const PLAN_PRICES: Record<string, number> = {};
  plans.forEach((p) => {
    PLAN_LABELS[p.plan_name] = p.display_name;
    PLAN_PRICES[p.plan_name] = Number(p.monthly_price) || 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
          className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Editar: {tenant.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tenant.subdomain}.nivo.com</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="fiscal">Datos Fiscales</TabsTrigger>
          <TabsTrigger value="subscription">Suscripción</TabsTrigger>
          <TabsTrigger value="limits">Límites y Módulos</TabsTrigger>
        </TabsList>

        {/* Tab 1: General */}
        <TabsContent value="general">
          <Card className="bg-card border-border">
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre del Negocio</Label>
                <Input
                  id="edit-name"
                  value={generalForm.name}
                  onChange={(e) => setGeneralForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-subdomain">Subdominio</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="edit-subdomain"
                    value={generalForm.subdomain}
                    onChange={(e) => setGeneralForm((prev) => ({ ...prev, subdomain: e.target.value }))}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.nivo.com</span>
                  {subdomainStatus === 'checking' && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  )}
                  {subdomainStatus === 'available' && (
                    <span className="flex items-center gap-1 text-emerald-400 shrink-0">
                      <Check className="h-4 w-4" />
                      <span className="text-xs font-medium">Disponible</span>
                    </span>
                  )}
                  {subdomainStatus === 'taken' && (
                    <span className="flex items-center gap-1 text-red-400 shrink-0">
                      <X className="h-4 w-4" />
                      <span className="text-xs font-medium">Ya está en uso</span>
                    </span>
                  )}
                </div>
                {generalForm.subdomain !== originalSubdomain.current && generalForm.subdomain.length >= 3 && (
                  <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    Cambiar el subdominio afectará todas las URLs del negocio.
                  </p>
                )}
              </div>

              <Button
                onClick={handleSaveGeneral}
                disabled={savingGeneral || subdomainStatus === 'taken' || subdomainStatus === 'checking'}
                className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0"
              >
                {savingGeneral ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </Button>
            </CardContent>
          </Card>

          {/* Credentials Card */}
          <Card className="bg-card border-border mt-5">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Key className="h-4 w-4 text-amber-400" />
                </div>
                <h3 className="font-semibold text-foreground">Credenciales del Administrador</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="admin_email">Correo del Admin</Label>
                  <Input
                    id="admin_email"
                    type="email"
                    placeholder="admin@zapateria.com"
                    value={credentialsForm.email}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_password">Nueva Contraseña</Label>
                  <Input
                    id="admin_password"
                    type="password"
                    placeholder="Dejar vacío para no cambiar"
                    value={credentialsForm.password}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground/60">
                Modifica el correo o contraseña con la que el administrador de esta zapatería accede al sistema.
              </p>
              <Button
                onClick={handleSaveCredentials}
                disabled={savingCredentials}
                variant="outline"
                className="gap-2"
              >
                {savingCredentials ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar Credenciales
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Datos Fiscales */}
        <TabsContent value="fiscal">
          <Card className="bg-card border-border">
            <CardContent className="p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rfc">RFC</Label>
                  <Input
                    id="rfc"
                    maxLength={13}
                    placeholder="XAXX010101000"
                    value={fiscalForm.rfc}
                    onChange={(e) => setFiscalForm((prev) => ({ ...prev, rfc: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="razon_social">Razón Social</Label>
                  <Input
                    id="razon_social"
                    placeholder="Empresa S.A. de C.V."
                    value={fiscalForm.razon_social}
                    onChange={(e) => setFiscalForm((prev) => ({ ...prev, razon_social: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="regimen_fiscal">Régimen Fiscal</Label>
                  <Select
                    value={fiscalForm.regimen_fiscal}
                    onValueChange={(v) => setFiscalForm((prev) => ({ ...prev, regimen_fiscal: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar régimen" />
                    </SelectTrigger>
                    <SelectContent>
                      {FISCAL_REGIMES.map((regime) => (
                        <SelectItem key={regime} value={regime}>{regime}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp_fiscal">Código Postal Fiscal</Label>
                  <Input
                    id="cp_fiscal"
                    maxLength={5}
                    placeholder="06600"
                    value={fiscalForm.codigo_postal_fiscal}
                    onChange={(e) => setFiscalForm((prev) => ({ ...prev, codigo_postal_fiscal: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dir_fiscal">Dirección Fiscal</Label>
                <textarea
                  id="dir_fiscal"
                  rows={3}
                  placeholder="Calle, Número, Colonia, Municipio, Estado"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={fiscalForm.direccion_fiscal}
                  onChange={(e) => setFiscalForm((prev) => ({ ...prev, direccion_fiscal: e.target.value }))}
                />
              </div>

              <Button
                onClick={handleSaveFiscal}
                disabled={savingFiscal}
                className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0"
              >
                {savingFiscal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar Datos Fiscales
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Suscripción */}
        <TabsContent value="subscription">
          <div className="space-y-5">
            {/* Current plan read-only card */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-8 w-8 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-fuchsia-400" />
                  </div>
                  <h3 className="font-semibold text-foreground">Plan Actual</h3>
                </div>

                {activeSub ? (
                  <div className="rounded-xl bg-muted/50 border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
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
                    {activeSub.current_period_end && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Próximo corte: {new Date(activeSub.current_period_end).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-muted/30 border border-dashed border-border/50 p-8 text-center">
                    <CreditCard className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Sin suscripción activa</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Plan change grid */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-4">Cambiar Plan</h3>
                <div className={`grid gap-3 ${plans.length <= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {plans.map((plan) => (
                    <button
                      key={plan.plan_name}
                      onClick={() => setSelectedPlan(plan.plan_name)}
                      className={`rounded-xl border-2 p-5 text-center transition-all ${
                        selectedPlan === plan.plan_name
                          ? 'border-purple-500 bg-purple-500/10 shadow-md shadow-purple-500/10'
                          : 'border-border hover:border-purple-500/30'
                      }`}
                    >
                      <p className="font-semibold text-sm">{plan.display_name}</p>
                      <p className="text-xl font-bold mt-1">{formatCurrency(Number(plan.monthly_price))}</p>
                      <p className="text-xs text-muted-foreground">/mes</p>
                      {currentPlanName === plan.plan_name && (
                        <Badge className="mt-2 text-[10px]" variant="secondary">Actual</Badge>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 mt-5">
                  <Button
                    onClick={handleChangePlan}
                    disabled={changingPlan || selectedPlan === currentPlanName || !selectedPlan}
                    className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0"
                  >
                    {changingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {changingPlan ? 'Cambiando...' : 'Cambiar Plan'}
                  </Button>

                  <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                    <Button
                      variant="outline"
                      className="gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/30"
                      onClick={() => setCancelDialogOpen(true)}
                      disabled={!activeSub}
                    >
                      Cancelar Suscripción
                    </Button>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cancelar Suscripción</DialogTitle>
                        <DialogDescription>
                          Esta acción cancelará la suscripción de {tenant.name}. El tenant perderá acceso a las funciones del plan actual al finalizar el período de facturación.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Volver</Button>
                        <Button
                          variant="destructive"
                          onClick={handleCancelSubscription}
                          disabled={cancellingSubscription}
                          className="gap-2"
                        >
                          {cancellingSubscription ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {cancellingSubscription ? 'Cancelando...' : 'Confirmar Cancelación'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Límites y Módulos */}
        <TabsContent value="limits">
          <div className="space-y-5">
            {/* Límites Cuantitativos */}
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground">Límites Cuantitativos</h3>
                </div>
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                  <p className="text-sm text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Sobrescribe los límites del plan para este tenant específico. Deja vacío para usar los valores por defecto del plan.
                  </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_branches">Máx. Sucursales</Label>
                    <Input
                      id="max_branches"
                      type="number"
                      min={0}
                      placeholder={currentPlanObj?.max_branches != null ? `Plan: ${currentPlanObj.max_branches}` : 'Sin límite'}
                      value={limitsForm.max_branches}
                      onChange={(e) => setLimitsForm((prev) => ({ ...prev, max_branches: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_users">Máx. Usuarios</Label>
                    <Input
                      id="max_users"
                      type="number"
                      min={0}
                      placeholder={currentPlanObj?.max_users != null ? `Plan: ${currentPlanObj.max_users}` : 'Sin límite'}
                      value={limitsForm.max_users}
                      onChange={(e) => setLimitsForm((prev) => ({ ...prev, max_users: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storage_gb">Almacenamiento (GB)</Label>
                    <Input
                      id="storage_gb"
                      type="number"
                      min={0}
                      placeholder={currentPlanObj?.storage_limit_gb != null ? `Plan: ${currentPlanObj.storage_limit_gb}` : 'Sin límite'}
                      value={limitsForm.storage_gb}
                      onChange={(e) => setLimitsForm((prev) => ({ ...prev, storage_gb: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="override_notes">Notas</Label>
                  <textarea
                    id="override_notes"
                    rows={3}
                    placeholder="Razón de la sobrescritura de límites..."
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={limitsForm.notes}
                    onChange={(e) => setLimitsForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <Button
                  onClick={handleSaveLimits}
                  disabled={savingLimits}
                  className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0"
                >
                  {savingLimits ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar Límites
                </Button>
              </CardContent>
            </Card>

            {/* Módulos / Funcionalidades */}
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground">Funcionalidades Adicionales</h3>
                </div>
                <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
                  <p className="text-sm text-purple-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Activa o desactiva módulos individuales sin cambiar de plan. El estado &quot;Por defecto&quot; hereda la configuración del plan actual.
                  </p>
                </div>

                <div className="space-y-3">
                  {([
                    { key: 'override_mod_transfers', label: 'Transferencias entre sucursales', description: 'Permite mover inventario entre sucursales', icon: ArrowLeftRight, planKey: 'mod_transfers' },
                    { key: 'override_mod_invoicing', label: 'Facturación electrónica', description: 'Generación de CFDI y complementos de pago', icon: FileText, planKey: 'mod_invoicing' },
                    { key: 'override_mod_loyalty', label: 'Programa de lealtad', description: 'Monedero electrónico y puntos para clientes', icon: Heart, planKey: 'mod_loyalty' },
                    { key: 'override_mod_advanced_reports', label: 'Reportes avanzados', description: 'Pronósticos, stock muerto, análisis de tendencias', icon: BarChart3, planKey: 'mod_advanced_reports' },
                    { key: 'override_mod_ecommerce', label: 'E-commerce', description: 'Integración con Shopify, WooCommerce, etc.', icon: ShoppingCart, planKey: 'mod_ecommerce' },
                  ] as const).map((mod) => {
                    const currentValue = modulesForm[mod.key];
                    const planDefault = currentPlanObj?.[mod.planKey as keyof PlanOption] as boolean | undefined;
                    const effectiveValue = currentValue !== null ? currentValue : (planDefault ?? false);

                    return (
                      <div
                        key={mod.key}
                        className={`rounded-xl border p-4 transition-all ${
                          effectiveValue
                            ? 'border-purple-500/30 bg-purple-500/5'
                            : 'border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                              effectiveValue ? 'bg-purple-500/15 text-purple-400' : 'bg-muted text-muted-foreground'
                            }`}>
                              <mod.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">{mod.label}</p>
                                {currentValue === null && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50 text-muted-foreground border-border">
                                    Por defecto del plan
                                  </Badge>
                                )}
                                {currentValue !== null && currentValue !== planDefault && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                                    Personalizado
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            {/* Three-state toggle: null (plan default) / true / false */}
                            <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5 gap-0.5">
                              <button
                                type="button"
                                onClick={() => setModulesForm((prev) => ({ ...prev, [mod.key]: null }))}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                  currentValue === null
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Usar configuración del plan"
                              >
                                Auto
                              </button>
                              <button
                                type="button"
                                onClick={() => setModulesForm((prev) => ({ ...prev, [mod.key]: true }))}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                  currentValue === true
                                    ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Forzar activado"
                              >
                                On
                              </button>
                              <button
                                type="button"
                                onClick={() => setModulesForm((prev) => ({ ...prev, [mod.key]: false }))}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                  currentValue === false
                                    ? 'bg-red-500/20 text-red-400 shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Forzar desactivado"
                              >
                                Off
                              </button>
                            </div>

                            {/* Reset to plan default */}
                            {currentValue !== null && (
                              <button
                                type="button"
                                onClick={() => setModulesForm((prev) => ({ ...prev, [mod.key]: null }))}
                                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Restablecer al valor del plan"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Show plan default info */}
                        <div className="mt-2 ml-12">
                          <p className="text-[11px] text-muted-foreground/60">
                            Valor del plan: <span className={planDefault ? 'text-emerald-400/70' : 'text-red-400/70'}>{planDefault ? 'Incluido' : 'No incluido'}</span>
                            {currentValue !== null && (
                              <span className="ml-2">
                                → Override: <span className={effectiveValue ? 'text-emerald-400/70' : 'text-red-400/70'}>{effectiveValue ? 'Activado' : 'Desactivado'}</span>
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={handleSaveModules}
                  disabled={savingModules}
                  className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0"
                >
                  {savingModules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar Módulos
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
