'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
} from '@nivo/ui';
import {
  Settings,
  DollarSign,
  BarChart3,
  Key,
  Save,
  Eye,
  EyeOff,
  Check,
  Loader2,
  CreditCard,
  Mail,
  Globe,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Plan {
  id: string;
  plan_name: string;
  display_name: string;
  price: number;
  max_products: number;
  max_employees: number;
  max_branches: number;
  max_support_tickets: number;
  features: string[];
  is_active: boolean;
}

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  value_type: string;
  category: string;
  description: string;
  is_secret: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAN_COLORS: Record<string, { badge: string; border: string }> = {
  basic: {
    badge: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    border: 'border-purple-500/40',
  },
  professional: {
    badge: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20',
    border: 'border-fuchsia-500/40',
  },
  enterprise: {
    badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    border: 'border-amber-500/40',
  },
};

const LIMIT_ROWS = [
  { key: 'max_products', label: 'Productos', type: 'number' as const },
  { key: 'max_employees', label: 'Empleados', type: 'number' as const },
  { key: 'max_branches', label: 'Sucursales', type: 'number' as const },
  { key: 'max_support_tickets', label: 'Tickets de Soporte', type: 'number' as const },
];

const FEATURE_ROWS = [
  { key: 'pos', label: 'Modulo POS' },
  { key: 'reports', label: 'Modulo Reportes' },
  { key: 'ecommerce', label: 'Modulo E-commerce' },
  { key: 'chat', label: 'Modulo Chat' },
  { key: 'inventory', label: 'Modulo Inventario' },
  { key: 'customers', label: 'Modulo Clientes' },
];

const SETTING_GROUPS: { title: string; icon: React.ElementType; keys: string[] }[] = [
  {
    title: 'Pagos',
    icon: CreditCard,
    keys: ['stripe_secret_key', 'stripe_webhook_secret', 'stripe_publishable_key'],
  },
  {
    title: 'Correo',
    icon: Mail,
    keys: ['sendgrid_api_key', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password'],
  },
  {
    title: 'General',
    icon: Globe,
    keys: ['app_name', 'support_email', 'default_currency'],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKeyLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('plans');

  // Plans state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [savingPlan, setSavingPlan] = useState<string | null>(null);

  // Limits state (draft copies of plans for the limits tab)
  const [limitsDraft, setLimitsDraft] = useState<Record<string, Plan>>({});
  const [limitsDirty, setLimitsDirty] = useState(false);
  const [savingLimits, setSavingLimits] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>({});
  const [settingsDirty, setSettingsDirty] = useState<Set<string>>(new Set());
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [savingSettings, setSavingSettings] = useState(false);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const response = await apiClient.get('/settings/plans');
      const data: Plan[] = response.data.data || [];
      setPlans(data);
      // Initialize price editing values
      const prices: Record<string, string> = {};
      const drafts: Record<string, Plan> = {};
      data.forEach((p) => {
        prices[p.id] = String(p.price);
        drafts[p.id] = { ...p, features: [...p.features] };
      });
      setEditingPrices(prices);
      setLimitsDraft(drafts);
      setLimitsDirty(false);
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

  const fetchSettings = useCallback(async () => {
    if (settingsLoaded) return;
    setSettingsLoading(true);
    try {
      const response = await apiClient.get('/settings?category=payment');
      const data: SystemSetting[] = response.data.data || [];
      setSettings(data);
      const draft: Record<string, string> = {};
      data.forEach((s) => {
        draft[s.key] = s.is_secret ? '' : s.value;
      });
      setSettingsDraft(draft);
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las configuraciones.',
        variant: 'destructive',
      });
    } finally {
      setSettingsLoading(false);
    }
  }, [settingsLoaded]);

  // Load plans on mount
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Load settings when API Keys tab is selected
  useEffect(() => {
    if (activeTab === 'apikeys') {
      fetchSettings();
    }
  }, [activeTab, fetchSettings]);

  // -----------------------------------------------------------------------
  // Plans tab handlers
  // -----------------------------------------------------------------------

  const handleSavePlan = async (plan: Plan) => {
    const newPrice = parseFloat(editingPrices[plan.id]);
    if (isNaN(newPrice) || newPrice < 0) {
      toast({
        title: 'Precio invalido',
        description: 'Ingresa un precio valido.',
        variant: 'destructive',
      });
      return;
    }
    setSavingPlan(plan.id);
    try {
      await apiClient.patch(`/settings/plans/${plan.id}`, {
        price: newPrice,
      });
      toast({ title: 'Plan actualizado', description: `El precio de ${plan.display_name} fue actualizado.` });
      await fetchPlans();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo actualizar el plan.',
        variant: 'destructive',
      });
    } finally {
      setSavingPlan(null);
    }
  };

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
    }
  };

  // -----------------------------------------------------------------------
  // Limits tab handlers
  // -----------------------------------------------------------------------

  const updateLimitField = (planId: string, field: string, value: number) => {
    setLimitsDraft((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], [field]: value },
    }));
    setLimitsDirty(true);
  };

  const toggleFeature = (planId: string, feature: string) => {
    setLimitsDraft((prev) => {
      const plan = prev[planId];
      const features = plan.features.includes(feature)
        ? plan.features.filter((f) => f !== feature)
        : [...plan.features, feature];
      return { ...prev, [planId]: { ...plan, features } };
    });
    setLimitsDirty(true);
  };

  const handleSaveAllLimits = async () => {
    setSavingLimits(true);
    try {
      const promises = Object.values(limitsDraft).map((draft) =>
        apiClient.patch(`/settings/plans/${draft.id}`, {
          max_products: draft.max_products,
          max_employees: draft.max_employees,
          max_branches: draft.max_branches,
          max_support_tickets: draft.max_support_tickets,
          features: draft.features,
        }),
      );
      await Promise.all(promises);
      toast({ title: 'Limites actualizados', description: 'Todos los limites fueron guardados correctamente.' });
      await fetchPlans();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudieron guardar los limites.',
        variant: 'destructive',
      });
    } finally {
      setSavingLimits(false);
    }
  };

  // -----------------------------------------------------------------------
  // API Keys tab handlers
  // -----------------------------------------------------------------------

  const updateSettingDraft = (key: string, value: string) => {
    setSettingsDraft((prev) => ({ ...prev, [key]: value }));
    setSettingsDirty((prev) => new Set(prev).add(key));
  };

  const toggleReveal = (key: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveSettings = async () => {
    if (settingsDirty.size === 0) {
      toast({ title: 'Sin cambios', description: 'No hay configuraciones modificadas.' });
      return;
    }
    setSavingSettings(true);
    try {
      const settingsPayload = Array.from(settingsDirty).map((key) => ({
        key,
        value: settingsDraft[key],
      }));
      await apiClient.patch('/settings', { settings: settingsPayload });
      toast({ title: 'Configuraciones guardadas', description: `${settingsPayload.length} configuracion(es) actualizada(s).` });
      setSettingsDirty(new Set());
      // Reload settings to get fresh masked values
      setSettingsLoaded(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudieron guardar las configuraciones.',
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // -----------------------------------------------------------------------
  // Sort plans for display: basic, professional, enterprise
  // -----------------------------------------------------------------------

  const sortedPlans = [...plans].sort((a, b) => {
    const order: Record<string, number> = { basic: 0, professional: 1, enterprise: 2 };
    return (order[a.plan_name] ?? 99) - (order[b.plan_name] ?? 99);
  });

  const sortedDraftPlans = sortedPlans.map((p) => limitsDraft[p.id] || p);

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const getSettingByKey = (key: string): SystemSetting | undefined =>
    settings.find((s) => s.key === key);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          Configuracion
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Administra los planes, limites y configuraciones del sistema.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="plans" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Planes
          </TabsTrigger>
          <TabsTrigger value="limits" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Limites
          </TabsTrigger>
          <TabsTrigger value="apikeys" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
        </TabsList>

        {/* =============================================================== */}
        {/* TAB 1: Plans                                                    */}
        {/* =============================================================== */}
        <TabsContent value="plans" className="mt-6">
          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-5 w-20 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sortedPlans.map((plan) => {
                const colors = PLAN_COLORS[plan.plan_name] || PLAN_COLORS.basic;
                const priceChanged = editingPrices[plan.id] !== String(plan.price);
                const isSaving = savingPlan === plan.id;

                return (
                  <Card
                    key={plan.id}
                    className={`transition-all ${priceChanged ? `ring-2 ring-offset-2 ring-offset-background ${colors.border} ring-opacity-60` : ''}`}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                        <Badge
                          variant="outline"
                          className={`${plan.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'}`}
                        >
                          {plan.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <Badge variant="outline" className={colors.badge}>
                        {plan.plan_name}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Price */}
                      <div className="space-y-2">
                        <Label htmlFor={`price-${plan.id}`} className="text-sm text-muted-foreground">
                          Precio (MXN/mes)
                        </Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id={`price-${plan.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            className="pl-10"
                            value={editingPrices[plan.id] ?? ''}
                            onChange={(e) =>
                              setEditingPrices((prev) => ({
                                ...prev,
                                [plan.id]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {/* Status toggle */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={isSaving}
                        onClick={() => handleTogglePlanStatus(plan)}
                      >
                        {plan.is_active ? 'Desactivar plan' : 'Activar plan'}
                      </Button>

                      {/* Save button */}
                      <Button
                        className="w-full gap-2"
                        disabled={!priceChanged || isSaving}
                        onClick={() => handleSavePlan(plan)}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {isSaving ? 'Guardando...' : 'Guardar precio'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* =============================================================== */}
        {/* TAB 2: Limits                                                   */}
        {/* =============================================================== */}
        <TabsContent value="limits" className="mt-6">
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
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  Comparacion de Planes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left font-medium text-muted-foreground p-4 w-48">
                          Caracteristica
                        </th>
                        {sortedDraftPlans.map((plan) => {
                          const colors = PLAN_COLORS[plan.plan_name] || PLAN_COLORS.basic;
                          return (
                            <th key={plan.id} className="text-center font-medium p-4">
                              <Badge variant="outline" className={colors.badge}>
                                {plan.display_name}
                              </Badge>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Numeric limit rows */}
                      {LIMIT_ROWS.map((row) => (
                        <tr key={row.key} className="border-b border-border/50">
                          <td className="p-4 font-medium text-foreground">{row.label}</td>
                          {sortedDraftPlans.map((plan) => (
                            <td key={plan.id} className="p-4 text-center">
                              <Input
                                type="number"
                                min="0"
                                className="w-24 mx-auto text-center"
                                value={(plan as any)[row.key] ?? 0}
                                onChange={(e) =>
                                  updateLimitField(plan.id, row.key, parseInt(e.target.value) || 0)
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}

                      {/* Feature/module rows */}
                      {FEATURE_ROWS.map((row) => (
                        <tr key={row.key} className="border-b border-border/50">
                          <td className="p-4 font-medium text-foreground">{row.label}</td>
                          {sortedDraftPlans.map((plan) => {
                            const checked = plan.features.includes(row.key);
                            return (
                              <td key={plan.id} className="p-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleFeature(plan.id, row.key)}
                                  className={`mx-auto h-5 w-5 rounded border transition-colors flex items-center justify-center ${
                                    checked
                                      ? 'bg-primary border-primary text-primary-foreground'
                                      : 'border-border bg-background hover:border-muted-foreground'
                                  }`}
                                  aria-label={`${row.label} para ${plan.display_name}`}
                                >
                                  {checked && <Check className="h-3 w-3" />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Save all */}
                <div className="p-4 border-t border-border flex justify-end">
                  <Button
                    className="gap-2"
                    disabled={!limitsDirty || savingLimits}
                    onClick={handleSaveAllLimits}
                  >
                    {savingLimits ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {savingLimits ? 'Guardando...' : 'Guardar todos los limites'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* =============================================================== */}
        {/* TAB 3: API Keys / System Settings                               */}
        {/* =============================================================== */}
        <TabsContent value="apikeys" className="mt-6">
          {settingsLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {SETTING_GROUPS.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <Card key={group.title}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <GroupIcon className="h-4 w-4 text-muted-foreground" />
                        {group.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {group.keys.map((key) => {
                        const setting = getSettingByKey(key);
                        const isSecret = setting?.is_secret ?? false;
                        const isRevealed = revealedSecrets.has(key);
                        const isDirty = settingsDirty.has(key);
                        const label = setting?.description || formatKeyLabel(key);
                        const maskedValue = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

                        return (
                          <div key={key} className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`setting-${key}`} className="text-sm">
                                {label}
                              </Label>
                              {isSecret && (
                                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              {isDirty && (
                                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
                                  Modificado
                                </Badge>
                              )}
                            </div>
                            <div className="relative">
                              <Input
                                id={`setting-${key}`}
                                type={isSecret && !isRevealed ? 'password' : 'text'}
                                placeholder={isSecret ? maskedValue : `Valor de ${formatKeyLabel(key)}`}
                                value={settingsDraft[key] ?? ''}
                                onChange={(e) => updateSettingDraft(key, e.target.value)}
                                className="pr-10"
                              />
                              {isSecret && (
                                <button
                                  type="button"
                                  onClick={() => toggleReveal(key)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  aria-label={isRevealed ? 'Ocultar valor' : 'Mostrar valor'}
                                >
                                  {isRevealed ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Save all settings */}
              <div className="flex justify-end">
                <Button
                  className="gap-2"
                  disabled={settingsDirty.size === 0 || savingSettings}
                  onClick={handleSaveSettings}
                >
                  {savingSettings ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingSettings
                    ? 'Guardando...'
                    : `Guardar configuraciones${settingsDirty.size > 0 ? ` (${settingsDirty.size})` : ''}`}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
