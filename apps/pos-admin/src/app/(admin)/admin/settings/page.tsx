'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  toast,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@nivo/ui';
import {
  Settings,
  DollarSign,
  BarChart3,
  Save,
  Check,
  Loader2,
  Layers,
  Plus,
  ArrowLeft,
  Pencil,
  Package,
  Users,
  HardDrive,
  ArrowRightLeft,
  FileText,
  Heart,
  TrendingUp,
  ShoppingCart,
  Headphones,
  MessageCircle,
  Crown,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Plan {
  id: string;
  plan_name: string;
  display_name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
  is_active: boolean;
  sort_order: number;
  max_branches: number;
  max_users: number;
  storage_limit_gb: number;
  mod_transfers: boolean;
  mod_invoicing: boolean;
  mod_loyalty: boolean;
  mod_advanced_reports: boolean;
  mod_ecommerce: boolean;
  support_level: string;
  support_description: string;
}

interface PlanFormData {
  plan_name: string;
  display_name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  stripe_price_id_monthly: string;
  stripe_price_id_annual: string;
  sort_order: number;
  is_active: boolean;
  max_branches: number;
  max_users: number;
  storage_limit_gb: number;
  mod_transfers: boolean;
  mod_invoicing: boolean;
  mod_loyalty: boolean;
  mod_advanced_reports: boolean;
  mod_ecommerce: boolean;
  support_level: string;
  support_description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAN_COLORS: Record<string, { badge: string; border: string; bg: string }> = {
  prueba: {
    badge: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    border: 'border-slate-500/40',
    bg: 'bg-slate-500',
  },
  basico: {
    badge: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    border: 'border-purple-500/40',
    bg: 'bg-purple-500',
  },
  profesional: {
    badge: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20',
    border: 'border-fuchsia-500/40',
    bg: 'bg-fuchsia-500',
  },
  corporativo: {
    badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500',
  },
};

const DEFAULT_PLAN_COLOR = PLAN_COLORS.basico;

const MODULE_CONFIG = [
  { key: 'mod_transfers' as const, label: 'Traspasos', icon: ArrowRightLeft },
  { key: 'mod_invoicing' as const, label: 'Facturación', icon: FileText },
  { key: 'mod_loyalty' as const, label: 'Lealtad', icon: Heart },
  { key: 'mod_advanced_reports' as const, label: 'Reportes', icon: TrendingUp },
  { key: 'mod_ecommerce' as const, label: 'E-commerce', icon: ShoppingCart },
];

const SUPPORT_LABELS: Record<string, { label: string; color: string }> = {
  email: { label: 'Email', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  chat: { label: 'Chat', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  dedicated: { label: 'Dedicado', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
};

const COMPARISON_LIMIT_ROWS = [
  { key: 'max_branches', label: 'Sucursales', icon: Package },
  { key: 'max_users', label: 'Usuarios / Cajas', icon: Users },
  { key: 'storage_limit_gb', label: 'Almacenamiento (GB)', icon: HardDrive },
];

const COMPARISON_MODULE_ROWS = [
  { key: 'mod_transfers', label: 'Traspasos entre sucursales' },
  { key: 'mod_invoicing', label: 'Facturación Electrónica' },
  { key: 'mod_loyalty', label: 'Programa de Lealtad' },
  { key: 'mod_advanced_reports', label: 'Reportes Avanzados' },
  { key: 'mod_ecommerce', label: 'Integración E-commerce' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLimit(value: number): string {
  return value === 0 ? 'Ilimitado' : String(value);
}

function emptyFormData(): PlanFormData {
  return {
    plan_name: '',
    display_name: '',
    description: '',
    monthly_price: 0,
    annual_price: 0,
    stripe_price_id_monthly: '',
    stripe_price_id_annual: '',
    sort_order: 0,
    is_active: true,
    max_branches: 1,
    max_users: 1,
    storage_limit_gb: 1,
    mod_transfers: false,
    mod_invoicing: false,
    mod_loyalty: false,
    mod_advanced_reports: false,
    mod_ecommerce: false,
    support_level: 'email',
    support_description: '',
  };
}

function planToFormData(plan: Plan): PlanFormData {
  return {
    plan_name: plan.plan_name,
    display_name: plan.display_name,
    description: plan.description,
    monthly_price: plan.monthly_price,
    annual_price: plan.annual_price,
    stripe_price_id_monthly: plan.stripe_price_id_monthly ?? '',
    stripe_price_id_annual: plan.stripe_price_id_annual ?? '',
    sort_order: plan.sort_order,
    is_active: plan.is_active,
    max_branches: plan.max_branches,
    max_users: plan.max_users,
    storage_limit_gb: plan.storage_limit_gb,
    mod_transfers: plan.mod_transfers,
    mod_invoicing: plan.mod_invoicing,
    mod_loyalty: plan.mod_loyalty,
    mod_advanced_reports: plan.mod_advanced_reports,
    mod_ecommerce: plan.mod_ecommerce,
    support_level: plan.support_level,
    support_description: plan.support_description,
  };
}

// ---------------------------------------------------------------------------
// Toggle Switch Component
// ---------------------------------------------------------------------------

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-purple-500' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('plans');

  // Plans state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);

  // Plan form state
  const [formMode, setFormMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlanFormData>(emptyFormData());
  const [formSaving, setFormSaving] = useState(false);

  // Deactivate confirmation dialog
  const [deactivateDialog, setDeactivateDialog] = useState<Plan | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const response = await apiClient.get('/settings/plans');
      const data: Plan[] = response.data.data || [];
      setPlans(data);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los planes.',
        variant: 'destructive',
      });
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // -----------------------------------------------------------------------
  // Plans tab handlers
  // -----------------------------------------------------------------------

  const handleTogglePlanStatus = async (plan: Plan) => {
    setSavingPlan(plan.id);
    try {
      await apiClient.patch(`/settings/plans/${plan.id}`, {
        is_active: !plan.is_active,
      });
      toast({
        title: plan.is_active ? 'Plan desactivado' : 'Plan activado',
        description: `${plan.display_name} fue ${plan.is_active ? 'desactivado' : 'activado'}.`,
      });
      await fetchPlans();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo cambiar el estado del plan.',
        variant: 'destructive',
      });
    } finally {
      setSavingPlan(null);
      setDeactivateDialog(null);
    }
  };

  const openCreateForm = () => {
    setFormData(emptyFormData());
    setEditingPlanId(null);
    setFormMode('create');
  };

  const openEditForm = (plan: Plan) => {
    setFormData(planToFormData(plan));
    setEditingPlanId(plan.id);
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode('list');
    setEditingPlanId(null);
    setFormData(emptyFormData());
  };

  const updateFormField = <K extends keyof PlanFormData>(field: K, value: PlanFormData[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-generate slug from display_name
      if (field === 'display_name') {
        next.plan_name = slugify(value as string);
      }
      return next;
    });
  };

  const handleSaveForm = async () => {
    if (!formData.display_name.trim()) {
      toast({ title: 'Error', description: 'El nombre del plan es requerido.', variant: 'destructive' });
      return;
    }
    if (formData.monthly_price < 0 || formData.annual_price < 0) {
      toast({ title: 'Error', description: 'Los precios no pueden ser negativos.', variant: 'destructive' });
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        ...formData,
        stripe_price_id_monthly: formData.stripe_price_id_monthly || null,
        stripe_price_id_annual: formData.stripe_price_id_annual || null,
      };

      if (formMode === 'create') {
        await apiClient.post('/settings/plans', payload);
        toast({ title: 'Plan creado', description: `${formData.display_name} fue creado exitosamente.` });
      } else {
        await apiClient.patch(`/settings/plans/${editingPlanId}`, payload);
        toast({ title: 'Plan actualizado', description: `${formData.display_name} fue actualizado.` });
      }
      await fetchPlans();
      closeForm();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo guardar el plan.',
        variant: 'destructive',
      });
    } finally {
      setFormSaving(false);
    }
  };

  // Annual discount calculation
  const annualDiscount = useMemo(() => {
    if (formData.monthly_price <= 0 || formData.annual_price <= 0) return null;
    const fullAnnual = formData.monthly_price * 12;
    if (formData.annual_price >= fullAnnual) return null;
    const discount = ((fullAnnual - formData.annual_price) / fullAnnual) * 100;
    return Math.round(discount);
  }, [formData.monthly_price, formData.annual_price]);

  // -----------------------------------------------------------------------
  // Sort plans for display
  // -----------------------------------------------------------------------

  const sortedPlans = [...plans].sort((a, b) => a.sort_order - b.sort_order);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          Configuración
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Administra los planes y comparación del sistema.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="plans" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Planes
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Comparación
          </TabsTrigger>
        </TabsList>

        {/* =============================================================== */}
        {/* TAB 1: Plans                                                    */}
        {/* =============================================================== */}
        <TabsContent value="plans" className="mt-6">
          {formMode === 'list' ? (
            <>
              {/* Header row */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">Planes</h3>
                <Button
                  onClick={openCreateForm}
                  className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white border-0"
                >
                  <Plus className="h-4 w-4" />
                  Crear Nuevo Plan
                </Button>
              </div>

              {plansLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-5 w-20 mt-2" />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : sortedPlans.length === 0 ? (
                /* Empty state */
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="rounded-full bg-muted p-4 mb-4">
                      <Layers className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">No hay planes configurados</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Crea tu primer plan para comenzar a ofrecer suscripciones.
                    </p>
                    <Button
                      onClick={openCreateForm}
                      className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white border-0"
                    >
                      <Plus className="h-4 w-4" />
                      Crear Nuevo Plan
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedPlans.map((plan) => {
                    const colors = PLAN_COLORS[plan.plan_name] || DEFAULT_PLAN_COLOR;
                    const isSaving = savingPlan === plan.id;
                    const enabledModules = MODULE_CONFIG.filter((m) => plan[m.key]);
                    const supportInfo = SUPPORT_LABELS[plan.support_level] || SUPPORT_LABELS.email;

                    return (
                      <Card key={plan.id} className="flex flex-col">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                              <Badge variant="outline" className={colors.badge}>
                                {plan.plan_name}
                              </Badge>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                plan.is_active
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : 'bg-muted text-muted-foreground border-border'
                              }
                            >
                              {plan.is_active ? 'Activo' : 'Oculto'}
                            </Badge>
                          </div>
                          {plan.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {plan.description}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col gap-4">
                          {/* Prices */}
                          <div className="flex items-baseline gap-3">
                            <div>
                              <span className="text-2xl font-bold text-foreground">
                                {formatPrice(plan.monthly_price)}
                              </span>
                              <span className="text-sm text-muted-foreground">/mes</span>
                            </div>
                            {plan.annual_price > 0 && (
                              <div className="text-sm text-muted-foreground">
                                {formatPrice(plan.annual_price)}
                                <span>/año</span>
                              </div>
                            )}
                          </div>

                          {/* Key limits */}
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Package className="h-3.5 w-3.5" />
                              <span>{plan.max_branches === 0 ? '∞' : plan.max_branches} sucursales</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              <span>{plan.max_users === 0 ? '∞' : plan.max_users} usuarios</span>
                            </div>
                          </div>

                          {/* Module badges */}
                          <div className="flex flex-wrap gap-1.5">
                            {enabledModules.map((mod) => {
                              const ModIcon = mod.icon;
                              return (
                                <Badge
                                  key={mod.key}
                                  variant="outline"
                                  className="text-xs gap-1 bg-muted/50 text-muted-foreground border-border"
                                >
                                  <ModIcon className="h-3 w-3" />
                                  {mod.label}
                                </Badge>
                              );
                            })}
                            {enabledModules.length === 0 && (
                              <span className="text-xs text-muted-foreground italic">Sin módulos</span>
                            )}
                          </div>

                          {/* Support level */}
                          <div className="flex items-center gap-1.5">
                            <Headphones className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant="outline" className={`text-xs ${supportInfo.color}`}>
                              Soporte {supportInfo.label}
                            </Badge>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 mt-auto pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={() => openEditForm(plan)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              disabled={isSaving}
                              onClick={() => {
                                if (plan.is_active) {
                                  setDeactivateDialog(plan);
                                } else {
                                  handleTogglePlanStatus(plan);
                                }
                              }}
                            >
                              {isSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              ) : null}
                              {plan.is_active ? 'Desactivar' : 'Activar'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* ============================================================= */
            /* CREATE / EDIT FORM                                             */
            /* ============================================================= */
            <div className="space-y-6">
              {/* Back button */}
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={closeForm} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Button>
                <h3 className="text-lg font-semibold text-foreground">
                  {formMode === 'create' ? 'Crear Nuevo Plan' : `Editar: ${formData.display_name}`}
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column: text inputs */}
                <div className="space-y-5">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Información General</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Display name */}
                      <div className="space-y-1.5">
                        <Label htmlFor="display_name">Nombre del plan</Label>
                        <Input
                          id="display_name"
                          placeholder="Plan Básico"
                          value={formData.display_name}
                          onChange={(e) => updateFormField('display_name', e.target.value)}
                        />
                      </div>

                      {/* Slug */}
                      <div className="space-y-1.5">
                        <Label htmlFor="plan_name" className="text-sm text-muted-foreground">
                          Slug (auto-generado)
                        </Label>
                        <Input
                          id="plan_name"
                          value={formData.plan_name}
                          onChange={(e) => updateFormField('plan_name', e.target.value)}
                          className="font-mono text-sm bg-muted/50"
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-1.5">
                        <Label htmlFor="description">Descripción</Label>
                        <textarea
                          id="description"
                          rows={3}
                          placeholder="Ideal para una sola sucursal..."
                          value={formData.description}
                          onChange={(e) => updateFormField('description', e.target.value)}
                          className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                        />
                      </div>

                      {/* Prices */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="monthly_price">Precio mensual (MXN)</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="monthly_price"
                              type="number"
                              min="0"
                              step="0.01"
                              className="pl-10"
                              value={formData.monthly_price}
                              onChange={(e) => updateFormField('monthly_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="annual_price">Precio anual (MXN)</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="annual_price"
                              type="number"
                              min="0"
                              step="0.01"
                              className="pl-10"
                              value={formData.annual_price}
                              onChange={(e) => updateFormField('annual_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          {annualDiscount !== null && (
                            <p className="text-xs text-emerald-500 font-medium">
                              {annualDiscount}% de descuento vs. mensual
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Stripe IDs */}
                      <div className="space-y-1.5">
                        <Label htmlFor="stripe_monthly">Stripe Price ID (mensual)</Label>
                        <Input
                          id="stripe_monthly"
                          placeholder="price_..."
                          value={formData.stripe_price_id_monthly}
                          onChange={(e) => updateFormField('stripe_price_id_monthly', e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="stripe_annual">Stripe Price ID (anual)</Label>
                        <Input
                          id="stripe_annual"
                          placeholder="price_..."
                          value={formData.stripe_price_id_annual}
                          onChange={(e) => updateFormField('stripe_price_id_annual', e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>

                      {/* Sort order */}
                      <div className="space-y-1.5">
                        <Label htmlFor="sort_order">Orden de aparición</Label>
                        <Input
                          id="sort_order"
                          type="number"
                          min="0"
                          className="w-24"
                          value={formData.sort_order}
                          onChange={(e) => updateFormField('sort_order', parseInt(e.target.value) || 0)}
                        />
                      </div>

                      {/* Support level */}
                      <div className="space-y-1.5">
                        <Label htmlFor="support_level">Nivel de soporte</Label>
                        <select
                          id="support_level"
                          value={formData.support_level}
                          onChange={(e) => updateFormField('support_level', e.target.value)}
                          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="email">Email</option>
                          <option value="chat">Chat</option>
                          <option value="dedicated">Dedicado</option>
                        </select>
                      </div>

                      {/* Support description */}
                      <div className="space-y-1.5">
                        <Label htmlFor="support_description">Descripción del soporte</Label>
                        <Input
                          id="support_description"
                          placeholder="Soporte por correo en horario laboral..."
                          value={formData.support_description}
                          onChange={(e) => updateFormField('support_description', e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right column: toggles and numeric limits */}
                <div className="space-y-5">
                  {/* Limits section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Límites</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Max branches */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="max_branches" className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            Sucursales
                          </Label>
                          {formData.max_branches === 0 && (
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              Ilimitado
                            </Badge>
                          )}
                        </div>
                        <Input
                          id="max_branches"
                          type="number"
                          min="0"
                          value={formData.max_branches}
                          onChange={(e) => updateFormField('max_branches', parseInt(e.target.value) || 0)}
                        />
                        <p className="text-xs text-muted-foreground">0 = ilimitadas</p>
                      </div>

                      {/* Max users */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="max_users" className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            Usuarios / Cajas
                          </Label>
                          {formData.max_users === 0 && (
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              Ilimitado
                            </Badge>
                          )}
                        </div>
                        <Input
                          id="max_users"
                          type="number"
                          min="0"
                          value={formData.max_users}
                          onChange={(e) => updateFormField('max_users', parseInt(e.target.value) || 0)}
                        />
                        <p className="text-xs text-muted-foreground">0 = ilimitados</p>
                      </div>

                      {/* Storage */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="storage_limit_gb" className="flex items-center gap-2">
                            <HardDrive className="h-4 w-4 text-muted-foreground" />
                            Almacenamiento (GB)
                          </Label>
                          {formData.storage_limit_gb === 0 && (
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              Ilimitado
                            </Badge>
                          )}
                        </div>
                        <Input
                          id="storage_limit_gb"
                          type="number"
                          min="0"
                          value={formData.storage_limit_gb}
                          onChange={(e) => updateFormField('storage_limit_gb', parseInt(e.target.value) || 0)}
                        />
                        <p className="text-xs text-muted-foreground">0 = ilimitado</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Modules section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Módulos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* mod_transfers */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                          <Label>Traspasos entre sucursales</Label>
                        </div>
                        <ToggleSwitch
                          checked={formData.mod_transfers}
                          onChange={(val) => updateFormField('mod_transfers', val)}
                          label="Traspasos entre sucursales"
                        />
                      </div>

                      {/* mod_invoicing */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <Label>Facturación Electrónica</Label>
                        </div>
                        <ToggleSwitch
                          checked={formData.mod_invoicing}
                          onChange={(val) => updateFormField('mod_invoicing', val)}
                          label="Facturación Electrónica"
                        />
                      </div>

                      {/* mod_loyalty */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-muted-foreground" />
                          <Label>Programa de Lealtad</Label>
                        </div>
                        <ToggleSwitch
                          checked={formData.mod_loyalty}
                          onChange={(val) => updateFormField('mod_loyalty', val)}
                          label="Programa de Lealtad"
                        />
                      </div>

                      {/* mod_advanced_reports */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <Label>Reportes Avanzados</Label>
                        </div>
                        <ToggleSwitch
                          checked={formData.mod_advanced_reports}
                          onChange={(val) => updateFormField('mod_advanced_reports', val)}
                          label="Reportes Avanzados"
                        />
                      </div>

                      {/* mod_ecommerce */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                          <Label>Integración E-commerce</Label>
                        </div>
                        <ToggleSwitch
                          checked={formData.mod_ecommerce}
                          onChange={(val) => updateFormField('mod_ecommerce', val)}
                          label="Integración E-commerce"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Active toggle */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Estado del plan</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Los planes ocultos no se muestran a nuevos clientes
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={formData.is_active}
                          onChange={(val) => updateFormField('is_active', val)}
                          label="Plan activo"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <Button variant="outline" onClick={closeForm} disabled={formSaving}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveForm}
                  disabled={formSaving}
                  className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white border-0"
                >
                  {formSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {formSaving ? 'Guardando...' : 'Guardar Plan'}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* =============================================================== */}
        {/* TAB 2: Comparación                                              */}
        {/* =============================================================== */}
        <TabsContent value="comparison" className="mt-6">
          {plansLoading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 flex-1" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : sortedPlans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Layers className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Sin planes para comparar</h3>
                <p className="text-sm text-muted-foreground">
                  Crea planes en la pestaña &quot;Planes&quot; para ver la comparación.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  Comparación de Planes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left font-medium text-muted-foreground p-4 w-56">
                          Característica
                        </th>
                        {sortedPlans.map((plan) => {
                          const colors = PLAN_COLORS[plan.plan_name] || DEFAULT_PLAN_COLOR;
                          return (
                            <th key={plan.id} className="text-center font-medium p-4 min-w-[140px]">
                              <Badge variant="outline" className={colors.badge}>
                                {plan.display_name}
                              </Badge>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Prices section header */}
                      <tr className="bg-muted/30">
                        <td colSpan={sortedPlans.length + 1} className="p-3 font-semibold text-foreground text-xs uppercase tracking-wider">
                          Precios
                        </td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="p-4 font-medium text-foreground">Mensual</td>
                        {sortedPlans.map((plan) => (
                          <td key={plan.id} className="p-4 text-center font-semibold text-foreground">
                            {formatPrice(plan.monthly_price)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="p-4 font-medium text-foreground">Anual</td>
                        {sortedPlans.map((plan) => (
                          <td key={plan.id} className="p-4 text-center font-semibold text-foreground">
                            {plan.annual_price > 0 ? formatPrice(plan.annual_price) : '—'}
                          </td>
                        ))}
                      </tr>

                      {/* Limits section header */}
                      <tr className="bg-muted/30">
                        <td colSpan={sortedPlans.length + 1} className="p-3 font-semibold text-foreground text-xs uppercase tracking-wider">
                          Límites
                        </td>
                      </tr>
                      {COMPARISON_LIMIT_ROWS.map((row) => {
                        const RowIcon = row.icon;
                        return (
                          <tr key={row.key} className="border-b border-border/50">
                            <td className="p-4 font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                <RowIcon className="h-4 w-4 text-muted-foreground" />
                                {row.label}
                              </div>
                            </td>
                            {sortedPlans.map((plan) => (
                              <td key={plan.id} className="p-4 text-center text-foreground">
                                {formatLimit((plan as any)[row.key])}
                              </td>
                            ))}
                          </tr>
                        );
                      })}

                      {/* Modules section header */}
                      <tr className="bg-muted/30">
                        <td colSpan={sortedPlans.length + 1} className="p-3 font-semibold text-foreground text-xs uppercase tracking-wider">
                          Módulos
                        </td>
                      </tr>
                      {COMPARISON_MODULE_ROWS.map((row) => (
                        <tr key={row.key} className="border-b border-border/50">
                          <td className="p-4 font-medium text-foreground">{row.label}</td>
                          {sortedPlans.map((plan) => {
                            const enabled = (plan as any)[row.key] as boolean;
                            return (
                              <td key={plan.id} className="p-4 text-center">
                                {enabled ? (
                                  <div className="mx-auto h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  </div>
                                ) : (
                                  <div className="mx-auto h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                                    <X className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Support section header */}
                      <tr className="bg-muted/30">
                        <td colSpan={sortedPlans.length + 1} className="p-3 font-semibold text-foreground text-xs uppercase tracking-wider">
                          Soporte
                        </td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="p-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <Headphones className="h-4 w-4 text-muted-foreground" />
                            Nivel de soporte
                          </div>
                        </td>
                        {sortedPlans.map((plan) => {
                          const info = SUPPORT_LABELS[plan.support_level] || SUPPORT_LABELS.email;
                          return (
                            <td key={plan.id} className="p-4 text-center">
                              <Badge variant="outline" className={`text-xs ${info.color}`}>
                                {info.label}
                              </Badge>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Deactivate confirmation dialog */}
      <Dialog open={deactivateDialog !== null} onOpenChange={(open) => !open && setDeactivateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar plan</DialogTitle>
            <DialogDescription>
              {deactivateDialog
                ? `¿Estás seguro de que deseas desactivar "${deactivateDialog.display_name}"? Los clientes actuales no se verán afectados, pero el plan dejará de estar visible para nuevos clientes.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deactivateDialog && handleTogglePlanStatus(deactivateDialog)}
              disabled={savingPlan !== null}
              className="gap-2"
            >
              {savingPlan !== null && <Loader2 className="h-4 w-4 animate-spin" />}
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
