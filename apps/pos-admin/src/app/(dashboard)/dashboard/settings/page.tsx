'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  Input, Label, Badge, Switch,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Separator, Button, toast, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  cn,
} from '@nivo/ui';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore, GENERAL_BRANCH_ID } from '@/store/branchStore';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  Save, Loader2, Info, Plus, Pencil, Trash2, DollarSign, RotateCcw, Globe, MapPin,
  Upload, Lock, Palette, Sparkles, ImageIcon, X,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
interface TenantSettingData {
  id: string;
  key: string;
  value: string;
  globalValue: string;
  isOverridden: boolean;
  label: string | null;
  group: string | null;
}

interface PriceListData {
  id: string;
  name: string;
  default_margin_percentage: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

// ─── Hex → HSL helper (also in layout.tsx for injection) ─────
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return { h: 217, s: 91, l: 60 };
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// ═══════════════════════════════════════════════════════════════
// Settings Page
// ═══════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const tenant = useAuthStore((s) => s.tenant);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-muted-foreground">Personaliza tu zapatería y preferencias operativas</p>
      </div>

      <Tabs defaultValue="operacion" className="space-y-4">
        <TabsList>
          <TabsTrigger value="operacion">Operación</TabsTrigger>
          <TabsTrigger value="finanzas">Finanzas y Precios</TabsTrigger>
          <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="account">Cuenta</TabsTrigger>
        </TabsList>

        {/* ─── Tab: Operación ─────────────────────────────────── */}
        <TabsContent value="operacion">
          <OperationSettingsTab />
        </TabsContent>

        {/* ─── Tab: Finanzas y Precios ────────────────────────── */}
        <TabsContent value="finanzas">
          <FinanzasTab />
        </TabsContent>

        {/* ─── Tab: Apariencia ────────────────────────────────── */}
        <TabsContent value="apariencia">
          <AppearanceTab />
        </TabsContent>

        {/* ─── Tab: General ───────────────────────────────────── */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Información de la Tienda</CardTitle>
              <CardDescription>
                Datos generales de tu zapatería.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre de la tienda</Label>
                <Input value={tenant?.name || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Subdominio</Label>
                <div className="flex items-center gap-2">
                  <Input value={tenant?.subdomain || ''} disabled className="bg-muted" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.nivo.app</span>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Estado</h4>
                <Badge variant="default">Activa</Badge>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ─── Tab: Cuenta ────────────────────────────────────── */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Mi Cuenta</CardTitle>
              <CardDescription>Información de tu cuenta de usuario.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={user?.name || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input value={user?.email || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <div>
                  <Badge variant="secondary">{user?.role || 'employee'}</Badge>
                </div>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Para cambiar tu contraseña o datos de cuenta, contacta al administrador.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Operation Settings Tab (separate component for state isolation)
// ═══════════════════════════════════════════════════════════════
function OperationSettingsTab() {
  const { isGeneralSelected, selectedBranchId, selectedBranchName } = useBranchStore();
  const isBranchMode = !isGeneralSelected && selectedBranchId && selectedBranchId !== GENERAL_BRANCH_ID;

  const [settings, setSettings] = useState<TenantSettingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Propagation dialog (General mode only)
  const [propagationOpen, setPropagationOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{ key: string; value: string }[]>([]);

  // Local editable state
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (isBranchMode) params.set('branch_id', selectedBranchId!);
      const res = await apiClient.get(`/tenant-settings?${params.toString()}`);
      setSettings(res.data);
      const vals: Record<string, string> = {};
      for (const s of res.data) vals[s.key] = s.value;
      setLocalValues(vals);
      setDirty(false);
    } catch {
      toast({ title: 'Error al cargar configuración', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [isBranchMode, selectedBranchId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateLocal = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const getChangedSettings = () => {
    return Object.entries(localValues)
      .filter(([key, value]) => {
        const original = settings.find((s) => s.key === key);
        return original?.value !== value;
      })
      .map(([key, value]) => ({ key, value }));
  };

  const handleSave = async () => {
    const changedSettings = getChangedSettings();
    if (changedSettings.length === 0) {
      toast({ title: 'Sin cambios' });
      return;
    }

    if (isBranchMode) {
      // Branch mode: save directly as overrides
      setSaving(true);
      try {
        await apiClient.patch('/tenant-settings', {
          settings: changedSettings,
          branch_id: selectedBranchId,
        });
        toast({ title: 'Configuración guardada', description: `Cambios aplicados a ${selectedBranchName}.` });
        setDirty(false);
        await fetchSettings();
      } catch (error: any) {
        toast({ title: 'Error al guardar', description: error.response?.data?.message || 'Intenta de nuevo', variant: 'destructive' });
      } finally { setSaving(false); }
    } else {
      // General mode: show propagation dialog
      setPendingChanges(changedSettings);
      setPropagationOpen(true);
    }
  };

  const handlePropagationSave = async (mode: 'default_only' | 'force_all') => {
    setPropagationOpen(false);
    setSaving(true);
    try {
      await apiClient.patch('/tenant-settings', {
        settings: pendingChanges,
        propagation: mode,
      });
      const desc = mode === 'force_all'
        ? 'Valor aplicado a todas las sucursales (overrides eliminados).'
        : 'Valor predeterminado actualizado. Sucursales con valores personalizados no cambiaron.';
      toast({ title: 'Configuración guardada', description: desc });
      setDirty(false);
      await fetchSettings();
    } catch (error: any) {
      toast({ title: 'Error al guardar', description: error.response?.data?.message || 'Intenta de nuevo', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleResetOverride = async (key: string) => {
    try {
      await apiClient.delete(`/tenant-settings/branch-override?branch_id=${selectedBranchId}&key=${encodeURIComponent(key)}`);
      toast({ title: 'Restaurado', description: 'Se restauró al valor predeterminado.' });
      await fetchSettings();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  // Helpers
  const val = (key: string, fallback = '') => localValues[key] ?? fallback;
  const boolVal = (key: string) => val(key) === 'true';
  const isOverridden = (key: string) => settings.find((s) => s.key === key)?.isOverridden ?? false;

  /** Badge showing inherited vs customized (branch mode only) */
  const OverrideBadge = ({ settingKey }: { settingKey: string }) => {
    if (!isBranchMode) return null;
    const overridden = isOverridden(settingKey);
    return (
      <div className="flex items-center gap-1.5">
        {overridden ? (
          <>
            <Badge variant="default" className="text-[10px] px-1.5 py-0 gap-1">
              <MapPin className="h-2.5 w-2.5" />Personalizado
            </Badge>
            <button
              onClick={() => handleResetOverride(settingKey)}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Restaurar al valor predeterminado"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
            <Globe className="h-2.5 w-2.5" />Heredado
          </Badge>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Context Banner */}
      <div className={cn(
        'flex items-center gap-2 rounded-lg border p-3 text-sm',
        isBranchMode ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-border',
      )}>
        {isBranchMode ? (
          <>
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <p className="text-muted-foreground">
              Estás editando los valores de <span className="font-medium text-foreground">{selectedBranchName}</span>. Los cambios solo aplican a esta sucursal.
            </p>
          </>
        ) : (
          <>
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground">
              Estás editando los <span className="font-medium text-foreground">valores predeterminados</span> para todas las sucursales.
            </p>
          </>
        )}
      </div>

      {/* ─── Costos y Precios ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Costos y Precios</CardTitle>
          <CardDescription>
            Configura las reglas automáticas de cálculo de precios al registrar nuevos productos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <Label htmlFor="landed-cost" className="text-sm font-medium">
                  Margen de Costo Operativo (Costo de Aterrizaje)
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Este porcentaje se sumará automáticamente a tu Precio de Compra al registrar nuevos
                  productos para cubrir gastos de fletes, seguros o empaquetado, dándote tu Precio Base real.
                </p>
              </div>
              <OverrideBadge settingKey="operacion.default_landed_cost_percentage" />
            </div>
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                id="landed-cost"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0.00"
                value={val('operacion.default_landed_cost_percentage', '0')}
                onChange={(e) => updateLocal('operacion.default_landed_cost_percentage', e.target.value)}
                className="text-right font-mono"
              />
              <span className="text-sm font-medium text-muted-foreground">%</span>
            </div>
            {Number(val('operacion.default_landed_cost_percentage', '0')) > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Ejemplo:</span> Si el Precio de Compra es{' '}
                  <span className="font-mono font-medium">$1,000.00</span>, el Precio Base será{' '}
                  <span className="font-mono font-medium text-primary">
                    ${(1000 * (1 + Number(val('operacion.default_landed_cost_percentage', '0')) / 100)).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Artículos y Variantes ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Artículos y Variantes</CardTitle>
          <CardDescription>
            Preferencias al crear nuevos productos y variantes en el wizard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Generar SKU automáticamente</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Al crear variantes, el sistema generará un SKU basado en el nombre del modelo y sus atributos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <OverrideBadge settingKey="operacion.auto_generate_sku" />
              <Switch
                checked={boolVal('operacion.auto_generate_sku')}
                onCheckedChange={(checked) => updateLocal('operacion.auto_generate_sku', checked ? 'true' : 'false')}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Requerir código de barras</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Si se activa, cada variante deberá tener un código de barras asignado antes de guardarse.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <OverrideBadge settingKey="operacion.require_barcode" />
              <Switch
                checked={boolVal('operacion.require_barcode')}
                onCheckedChange={(checked) => updateLocal('operacion.require_barcode', checked ? 'true' : 'false')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Inventario ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Inventario</CardTitle>
          <CardDescription>Reglas de monitoreo de stock.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Label htmlFor="low-stock" className="text-sm font-medium">Umbral de stock bajo</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cantidad mínima antes de que el sistema marque una variante como &quot;stock bajo&quot; y envíe alertas.
              </p>
            </div>
            <OverrideBadge settingKey="inventario.low_stock_threshold" />
          </div>
          <div className="flex items-center gap-2 max-w-xs">
            <Input
              id="low-stock"
              type="number"
              min="0"
              step="1"
              placeholder="5"
              value={val('inventario.low_stock_threshold', '5')}
              onChange={(e) => updateLocal('inventario.low_stock_threshold', e.target.value)}
              className="text-right font-mono"
            />
            <span className="text-sm text-muted-foreground">unidades</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Tickets ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets de Venta</CardTitle>
          <CardDescription>Personaliza la información que aparece en tus tickets impresos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Mostrar logo en tickets</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Imprime el logo de tu zapatería en la cabecera de cada ticket.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <OverrideBadge settingKey="ticket.show_logo" />
              <Switch
                checked={boolVal('ticket.show_logo')}
                onCheckedChange={(checked) => updateLocal('ticket.show_logo', checked ? 'true' : 'false')}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Mostrar dirección de sucursal</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Incluye la dirección de la sucursal activa en el ticket.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <OverrideBadge settingKey="ticket.show_branch_address" />
              <Switch
                checked={boolVal('ticket.show_branch_address')}
                onCheckedChange={(checked) => updateLocal('ticket.show_branch_address', checked ? 'true' : 'false')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Save Button ─────────────────────────────────────── */}
      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 shadow-lg"
            size="lg"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</>
            ) : (
              <><Save className="h-4 w-4" />Guardar Configuración</>
            )}
          </Button>
        </div>
      )}

      {/* ─── Propagation Dialog (General mode only) ──────────── */}
      <Dialog open={propagationOpen} onOpenChange={setPropagationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cómo deseas aplicar estos cambios?</DialogTitle>
            <DialogDescription>
              Estás modificando los valores predeterminados. Elige cómo aplicar los cambios a las sucursales.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <button
              onClick={() => handlePropagationSave('default_only')}
              className="w-full text-left rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <p className="text-sm font-medium">Solo como valor predeterminado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Las sucursales con valores personalizados mantienen su configuración. Solo se actualiza el valor base.
              </p>
            </button>
            <button
              onClick={() => handlePropagationSave('force_all')}
              className="w-full text-left rounded-lg border border-destructive/30 p-4 hover:bg-destructive/5 transition-colors"
            >
              <p className="text-sm font-medium">Aplicar a todas las sucursales</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sobrescribe los valores personalizados de todas las sucursales. Todas heredarán este nuevo valor.
              </p>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPropagationOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Appearance Tab — Branding & Custom Colors
// ═══════════════════════════════════════════════════════════════
function AppearanceTab() {
  const router = useRouter();

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Editable state
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [logoUrl, setLogoUrl]           = useState('');
  const [faviconUrl, setFaviconUrl]     = useState('');

  // Originals (dirty check)
  const [origColor, setOrigColor]     = useState('#3B82F6');
  const [origLogo, setOrigLogo]       = useState('');
  const [origFavicon, setOrigFavicon] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [settingsRes, subRes] = await Promise.all([
          apiClient.get('/tenant-settings'),
          apiClient.get('/tenant-subscription/me'),
        ]);
        const settings: TenantSettingData[] = settingsRes.data;
        const getVal = (key: string, def = '') => settings.find((s) => s.key === key)?.value ?? def;

        const color   = getVal('branding.primary_color', '#3B82F6');
        const logo    = getVal('branding.logo_url', '');
        const favicon = getVal('branding.favicon_url', '');

        setPrimaryColor(color);  setOrigColor(color);
        setLogoUrl(logo);        setOrigLogo(logo);
        setFaviconUrl(favicon);  setOrigFavicon(favicon);

        setHasAccess(subRes.data?.effective?.mod_custom_branding ?? false);
      } catch {
        toast({ title: 'Error al cargar apariencia', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const dirty = primaryColor !== origColor || logoUrl !== origLogo || faviconUrl !== origFavicon;

  // ── Logo upload ─────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    if (!file.type.match(/^image\/(png|jpeg|svg\+xml|webp)$/)) {
      toast({ title: 'Formato no permitido', description: 'Usa PNG, JPG, SVG o WebP (máx 2MB)', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'El logo no puede superar 2MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post('/uploads/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setLogoUrl(res.data.url);
    } catch (err: any) {
      toast({ title: 'Error al subir logo', description: err.response?.data?.message || 'Intenta de nuevo', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // ── Save ────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch('/tenant-settings', {
        settings: [
          { key: 'branding.primary_color', value: primaryColor },
          { key: 'branding.logo_url',      value: logoUrl },
          { key: 'branding.favicon_url',   value: faviconUrl },
        ],
        propagation: 'default_only',
      });

      // Apply color live
      const { h, s, l } = hexToHSL(primaryColor);
      document.documentElement.style.setProperty('--color-primary-h', String(h));
      document.documentElement.style.setProperty('--color-primary-s', `${s}%`);
      document.documentElement.style.setProperty('--color-primary-l', `${l}%`);

      setOrigColor(primaryColor);
      setOrigLogo(logoUrl);
      setOrigFavicon(faviconUrl);
      toast({ title: 'Apariencia guardada', description: 'Los cambios se aplican de inmediato.' });
    } catch (err: any) {
      toast({ title: 'Error al guardar', description: err.response?.data?.message || 'Intenta de nuevo', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Derived preview hsl ──────────────────────────────────────
  const previewHsl = `hsl(${hexToHSL(primaryColor).h},${hexToHSL(primaryColor).s}%,${hexToHSL(primaryColor).l}%)`;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Locked overlay when plan doesn't include branding ── */}
      {!hasAccess && (
        <div className="relative rounded-xl border border-amber-500/20 bg-amber-500/5 px-6 py-8 flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 rounded-full bg-amber-500/15 flex items-center justify-center">
            <Lock className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Personaliza Nivo con los colores de tu marca</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Sube tu logo, define tu color principal y haz que el sistema refleje tu identidad visual. Disponible en Plan Pro o superior.
            </p>
          </div>
          <Button
            className="gap-2"
            onClick={() => router.push('/dashboard/subscription')}
          >
            <Sparkles className="h-4 w-4" />
            Ver planes y mejorar
          </Button>
        </div>
      )}

      {/* ── Logo ─────────────────────────────────────────────── */}
      <Card className={!hasAccess ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo de la Marca
          </CardTitle>
          <CardDescription>
            Aparece en la barra lateral, tickets de venta y correos. PNG, JPG, SVG o WebP — máx 2MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Drop zone */}
            <div
              className={cn(
                'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed w-full sm:w-56 h-40 cursor-pointer transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/25 bg-white/[0.02]',
                uploading && 'pointer-events-none opacity-70',
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
              />
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : logoUrl ? (
                <img
                  src={logoUrl.startsWith('/') ? `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '')}${logoUrl}` : logoUrl}
                  alt="Logo"
                  className="h-24 w-full object-contain px-4"
                />
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground text-center px-4">
                    Arrastra o haz clic para subir
                  </p>
                </>
              )}
            </div>

            {/* Instructions + clear */}
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Recomendaciones</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Fondo transparente (PNG o SVG)</li>
                  <li>Proporción cuadrada o logo horizontal</li>
                  <li>Resolución mínima 200×200 px</li>
                </ul>
              </div>
              {logoUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setLogoUrl('')}
                >
                  <X className="h-3.5 w-3.5" />
                  Eliminar logo
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Color primario ───────────────────────────────────── */}
      <Card className={!hasAccess ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Principal
          </CardTitle>
          <CardDescription>
            Se aplica a botones, badges, acentos y el fondo del ícono del sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-8">
            {/* Picker */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPrimaryColor(v);
                  }}
                  className="w-32 font-mono text-sm"
                  maxLength={7}
                />
              </div>
              {/* Quick swatches */}
              <div className="flex flex-wrap gap-2">
                {[
                  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
                  '#F59E0B', '#10B981', '#06B6D4', '#6366F1',
                ].map((c) => (
                  <button
                    key={c}
                    onClick={() => setPrimaryColor(c)}
                    className={cn(
                      'h-7 w-7 rounded-md border-2 transition-transform hover:scale-110',
                      primaryColor.toLowerCase() === c.toLowerCase() ? 'border-white scale-110' : 'border-transparent',
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Live preview — "Mini Nivo" */}
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Vista previa en vivo</p>
              <div className="rounded-xl border border-white/10 bg-zinc-900 p-4 space-y-3 max-w-xs">
                {/* Fake sidebar accent */}
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: previewHsl }}>
                    <span className="text-white text-xs font-bold">N</span>
                  </div>
                  <span className="text-sm font-semibold text-white">Nivo POS</span>
                </div>
                <Separator className="bg-white/10" />
                {/* Fake KPI card */}
                <div className="rounded-lg p-3" style={{ background: `${previewHsl}22` }}>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Ventas hoy</p>
                  <p className="text-lg font-bold text-white">$12,450</p>
                  <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${previewHsl}33`, color: previewHsl }}>
                    +8% vs ayer
                  </div>
                </div>
                {/* Fake button */}
                <button
                  className="w-full rounded-lg py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: previewHsl }}
                >
                  Nueva Venta
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Favicon URL (optional) ───────────────────────────── */}
      <Card className={!hasAccess ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Favicon (opcional)</CardTitle>
          <CardDescription className="text-xs">
            URL de un ícono 32×32 o 64×64 px para la pestaña del navegador. Déjalo vacío para usar el favicon de Nivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 max-w-md">
            {faviconUrl && (
              <img
                src={faviconUrl.startsWith('/') ? `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '')}${faviconUrl}` : faviconUrl}
                alt="Favicon preview"
                className="h-8 w-8 rounded object-contain border border-white/10 bg-white/5"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <Input
              placeholder="https://tu-dominio.com/favicon.ico"
              value={faviconUrl}
              onChange={(e) => setFaviconUrl(e.target.value)}
              className="flex-1"
            />
            {faviconUrl && (
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setFaviconUrl('')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Save button ──────────────────────────────────────── */}
      {hasAccess && dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-lg" size="lg">
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</>
            ) : (
              <><Save className="h-4 w-4" />Guardar Apariencia</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Finanzas Tab — Price Lists Management
// ═══════════════════════════════════════════════════════════════
function FinanzasTab() {
  const [priceLists, setPriceLists] = useState<PriceListData[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formMargin, setFormMargin] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPriceLists = useCallback(async () => {
    try {
      const res = await apiClient.get('/pricing/price-lists');
      setPriceLists(res.data);
    } catch {
      toast({ title: 'Error al cargar listas de precios', variant: 'destructive' });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPriceLists(); }, [fetchPriceLists]);

  const openCreate = () => {
    setEditingId(null); setFormName(''); setFormMargin('30');
    setDialogOpen(true);
  };

  const openEdit = (pl: PriceListData) => {
    setEditingId(pl.id); setFormName(pl.name); setFormMargin(String(pl.default_margin_percentage));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.patch(`/pricing/price-lists/${editingId}`, {
          name: formName.trim(),
          default_margin_percentage: parseFloat(formMargin) || 0,
        });
        toast({ title: 'Lista actualizada' });
      } else {
        await apiClient.post('/pricing/price-lists', {
          name: formName.trim(),
          default_margin_percentage: parseFloat(formMargin) || 0,
        });
        toast({ title: 'Lista creada' });
      }
      setDialogOpen(false);
      await fetchPriceLists();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Intenta de nuevo', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleToggle = async (pl: PriceListData) => {
    try {
      await apiClient.patch(`/pricing/price-lists/${pl.id}`, { is_active: !pl.is_active });
      await fetchPriceLists();
      toast({ title: pl.is_active ? 'Desactivada' : 'Activada' });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const handleDelete = async (pl: PriceListData) => {
    try {
      await apiClient.delete(`/pricing/price-lists/${pl.id}`);
      await fetchPriceLists();
      toast({ title: 'Lista eliminada' });
    } catch (error: any) { toast({ title: 'Error', description: error.response?.data?.message || '', variant: 'destructive' }); }
  };

  const handleSetDefault = async (pl: PriceListData) => {
    try {
      await apiClient.patch(`/pricing/price-lists/${pl.id}/set-default`);
      await fetchPriceLists();
      toast({ title: `"${pl.name}" es ahora la lista por defecto` });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-48 w-full rounded-xl" /><Skeleton className="h-32 w-full rounded-xl" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Price Lists */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Listas de Precios</CardTitle>
              <CardDescription>
                Define las listas de precios con su margen de utilidad global. Cada producto hereda estos márgenes, a menos que se configure una excepción.
              </CardDescription>
            </div>
            <Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" />Nueva Lista</Button>
          </div>
        </CardHeader>
        <CardContent>
          {priceLists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay listas de precios.</p>
              <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={openCreate}><Plus className="h-3.5 w-3.5" />Crear primera lista</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {priceLists.map((pl) => (
                <div key={pl.id} className={cn(
                  'flex items-center justify-between gap-4 rounded-lg border p-3 transition-all',
                  !pl.is_active && 'opacity-50 border-dashed',
                  pl.is_default && 'border-primary/40 bg-primary/5',
                )}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', pl.is_default ? 'bg-primary/20' : 'bg-primary/10')}>
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{pl.name}</p>
                        {pl.is_default && <Badge variant="default" className="text-[9px] px-1.5 py-0">Por defecto</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">Margen: <span className="font-mono font-medium">{pl.default_margin_percentage}%</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Example price */}
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-muted-foreground">Ej. con costo $1,000</p>
                      <p className="text-xs font-mono font-medium text-primary">${(1000 * (1 + Number(pl.default_margin_percentage) / 100)).toFixed(2)}</p>
                    </div>
                    {!pl.is_default && (
                      <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => handleSetDefault(pl)}>Marcar defecto</Button>
                    )}
                    <Switch checked={pl.is_active} onCheckedChange={() => handleToggle(pl)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(pl)}><Pencil className="h-3.5 w-3.5" /></Button>
                    {!pl.is_default && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(pl)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5" />Motor de Precios en Cascada</CardTitle>
          <CardDescription>
            El precio de venta de cada variante se calcula automáticamente usando la siguiente fórmula:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
              <div>
                <p className="text-sm font-medium">Costo de Compra</p>
                <p className="text-xs text-muted-foreground">Se usa el costo global de la variante, a menos que la sucursal tenga un costo excepcional.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
              <div>
                <p className="text-sm font-medium">Precio Base</p>
                <p className="text-xs text-muted-foreground">Costo + Costo Operativo (%). La sucursal puede tener su propio % o heredar del global en Operación.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
              <div>
                <p className="text-sm font-medium">Precio Final de Venta</p>
                <p className="text-xs text-muted-foreground">Precio Base + Margen de Utilidad (%) de la Lista de Precios. Se puede personalizar por variante.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}</DialogTitle>
            <DialogDescription>Define el nombre y el margen de utilidad global de esta lista.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input placeholder='Ej. "Público General", "Mayoreo"' value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Margen de Utilidad (%)</Label>
              <div className="flex items-center gap-2 max-w-xs">
                <Input type="number" step="0.01" min="0" placeholder="30" value={formMargin} onChange={(e) => setFormMargin(e.target.value)} className="text-right font-mono" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {Number(formMargin) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Con Precio Base de <span className="font-mono">$1,000</span>, el precio de venta sería{' '}
                  <span className="font-mono font-medium text-primary">${(1000 * (1 + Number(formMargin) / 100)).toFixed(2)}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!formName.trim() || saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
