'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Switch,
  Skeleton,
  Label,
} from '@nivo/ui';
import { Truck, Plus, Edit, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────
interface ShippingMethod {
  id: string;
  name: string;
  description: string | null;
  base_cost: number;
  free_above: number | null;
  is_active: boolean;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

type ShippingFormData = Omit<ShippingMethod, 'id'>;

const EMPTY_FORM: ShippingFormData = {
  name: '',
  description: null,
  base_cost: 0,
  free_above: null,
  is_active: true,
  estimated_days_min: null,
  estimated_days_max: null,
};

// ─── Page ────────────────────────────────────────────────────
export default function ShippingSettingsPage() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ShippingFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────
  const fetchMethods = useCallback(async () => {
    try {
      const { data } = await apiClient.get<ShippingMethod[]>('/shipping-methods/admin');
      setMethods(data);
    } catch (err) {
      console.error('Error fetching shipping methods', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  // ── Toggle active ────────────────────────────────────────
  const handleToggleActive = async (method: ShippingMethod) => {
    setTogglingId(method.id);
    try {
      await apiClient.patch(`/shipping-methods/${method.id}`, {
        is_active: !method.is_active,
      });
      setMethods((prev) =>
        prev.map((m) => (m.id === method.id ? { ...m, is_active: !m.is_active } : m)),
      );
    } catch (err) {
      console.error('Error toggling shipping method', err);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Open dialog ──────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (method: ShippingMethod) => {
    setEditingId(method.id);
    setForm({
      name: method.name,
      description: method.description,
      base_cost: method.base_cost,
      free_above: method.free_above,
      is_active: method.is_active,
      estimated_days_min: method.estimated_days_min,
      estimated_days_max: method.estimated_days_max,
    });
    setDialogOpen(true);
  };

  // ── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        const { data } = await apiClient.patch<ShippingMethod>(
          `/shipping-methods/${editingId}`,
          form,
        );
        setMethods((prev) => prev.map((m) => (m.id === editingId ? data : m)));
      } else {
        const { data } = await apiClient.post<ShippingMethod>('/shipping-methods', form);
        setMethods((prev) => [...prev, data]);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error('Error saving shipping method', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);

  const formatDays = (min: number | null, max: number | null) => {
    if (min == null && max == null) return '—';
    if (min != null && max != null) return `${min}–${max} días`;
    if (min != null) return `${min}+ días`;
    return `Hasta ${max} días`;
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-8 w-8 text-zinc-400" />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Métodos de Envío</h2>
            <p className="text-muted-foreground">
              Configura las opciones de envío disponibles para tus clientes.
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Método
        </Button>
      </div>

      {/* Table Card */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle>Métodos configurados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : methods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Truck className="mb-4 h-12 w-12 text-zinc-600" />
              <p className="text-lg font-medium text-zinc-400">
                No hay métodos de envío configurados
              </p>
              <p className="mb-4 text-sm text-zinc-500">
                Agrega tu primer método de envío para empezar.
              </p>
              <Button variant="outline" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Método
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-400">
                    <th className="pb-3 pr-4 font-medium">Nombre</th>
                    <th className="pb-3 pr-4 font-medium">Descripción</th>
                    <th className="pb-3 pr-4 font-medium">Costo Base</th>
                    <th className="pb-3 pr-4 font-medium">Envío Gratis desde</th>
                    <th className="pb-3 pr-4 font-medium">Días Estimados</th>
                    <th className="pb-3 pr-4 font-medium">Activo</th>
                    <th className="pb-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map((method) => (
                    <tr
                      key={method.id}
                      className="border-b border-zinc-800/50 last:border-0"
                    >
                      <td className="py-3 pr-4 font-medium text-white">{method.name}</td>
                      <td className="py-3 pr-4 text-zinc-400">
                        {method.description || '—'}
                      </td>
                      <td className="py-3 pr-4 text-white">
                        {formatCurrency(method.base_cost)}
                      </td>
                      <td className="py-3 pr-4 text-white">
                        {method.free_above != null ? formatCurrency(method.free_above) : '—'}
                      </td>
                      <td className="py-3 pr-4 text-zinc-400">
                        {formatDays(method.estimated_days_min, method.estimated_days_max)}
                      </td>
                      <td className="py-3 pr-4">
                        <Switch
                          checked={method.is_active}
                          disabled={togglingId === method.id}
                          onCheckedChange={() => handleToggleActive(method)}
                        />
                      </td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(method)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Método de Envío' : 'Nuevo Método de Envío'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="sm-name">Nombre</Label>
              <Input
                id="sm-name"
                placeholder="Ej: Envío estándar"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="sm-desc">Descripción</Label>
              <Input
                id="sm-desc"
                placeholder="Ej: Entrega en 3-5 días hábiles"
                value={form.description ?? ''}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value || null })
                }
              />
            </div>

            {/* Costo Base */}
            <div className="space-y-2">
              <Label htmlFor="sm-cost">Costo Base</Label>
              <Input
                id="sm-cost"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={form.base_cost}
                onChange={(e) =>
                  setForm({ ...form, base_cost: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </div>

            {/* Free above */}
            <div className="space-y-2">
              <Label htmlFor="sm-free">Envío Gratis en compras mayores a</Label>
              <Input
                id="sm-free"
                type="number"
                min={0}
                step={0.01}
                placeholder="Dejar vacío si no aplica"
                value={form.free_above ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    free_above: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
              />
            </div>

            {/* Estimated days */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sm-min">Días estimados mín</Label>
                <Input
                  id="sm-min"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Ej: 3"
                  value={form.estimated_days_min ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      estimated_days_min: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sm-max">Días estimados máx</Label>
                <Input
                  id="sm-max"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Ej: 5"
                  value={form.estimated_days_max ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      estimated_days_max: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    })
                  }
                />
              </div>
            </div>

            {/* Activo */}
            <div className="flex items-center justify-between rounded-md border border-zinc-800 p-3">
              <Label htmlFor="sm-active">Activo</Label>
              <Switch
                id="sm-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
