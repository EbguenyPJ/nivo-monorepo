'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Card, CardContent, Input, Label, Skeleton, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@nivo/ui';
import {
  Star, ToggleLeft, ToggleRight, Save, Gift, TrendingUp,
  Search, Minus, Plus,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface LoyaltyConfig {
  id: string;
  is_active: boolean;
  spend_per_point: number;
  point_value: number;
  min_redemption_points: number;
  expiration_days: number;
  earn_on_layaway: boolean;
  earn_on_credit: boolean;
}

export default function LoyaltyPage() {
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<LoyaltyConfig>>({});

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ customer_id: '', points: '', type: 'manual_credit' as string, description: '' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiClient.get('/loyalty/config');
      setConfig(res.data);
      setForm(res.data);
    } catch (error) {
      console.error('Failed to fetch loyalty config:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiClient.put('/loyalty/config', form);
      setConfig(res.data);
      toast({ title: 'Configuracion guardada', description: 'Los cambios al programa de lealtad se aplicaron.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    const newState = !form.is_active;
    setForm((prev) => ({ ...prev, is_active: newState }));
    setSaving(true);
    try {
      const res = await apiClient.put('/loyalty/config', { ...form, is_active: newState });
      setConfig(res.data);
      setForm(res.data);
      toast({ title: newState ? 'Programa activado' : 'Programa desactivado' });
    } catch (error: any) {
      setForm((prev) => ({ ...prev, is_active: !newState }));
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const searchCustomers = async (query: string) => {
    setCustomerSearch(query);
    if (query.length < 2) { setCustomerResults([]); return; }
    try {
      const res = await apiClient.get(`/customers?search=${encodeURIComponent(query)}&limit=5`);
      setCustomerResults(res.data.data || []);
    } catch { setCustomerResults([]); }
  };

  const handleAdjust = async () => {
    if (!selectedCustomer || !adjustForm.points) return;
    setAdjustSaving(true);
    try {
      await apiClient.post('/loyalty/adjust', {
        customer_id: selectedCustomer.id,
        points: parseInt(adjustForm.points),
        type: adjustForm.type,
        description: adjustForm.description || undefined,
      });
      toast({ title: 'Ajuste aplicado', description: `${adjustForm.points} puntos ${adjustForm.type === 'manual_credit' ? 'otorgados a' : 'deducidos de'} ${selectedCustomer.name}` });
      setAdjustOpen(false);
      setSelectedCustomer(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    } finally {
      setAdjustSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Programa de Lealtad</h2>
          <p className="text-muted-foreground">Configura las reglas de acumulacion y canje de puntos.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => {
            setAdjustOpen(true);
            setSelectedCustomer(null);
            setCustomerSearch('');
            setCustomerResults([]);
            setAdjustForm({ customer_id: '', points: '', type: 'manual_credit', description: '' });
          }}>
            <Gift className="h-4 w-4" />
            Ajuste Manual
          </Button>
          <Button variant={form.is_active ? 'default' : 'outline'} className="gap-2" onClick={toggleActive} disabled={saving}>
            {form.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {form.is_active ? 'Activo' : 'Desactivado'}
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {!form.is_active && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Star className="h-5 w-5 text-amber-400" />
            <p className="text-sm text-amber-200">El programa esta desactivado. Los clientes no acumulan puntos.</p>
          </CardContent>
        </Card>
      )}

      {form.is_active && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Star className="h-5 w-5 text-primary" />
            <p className="text-sm">
              Regla: por cada <strong>${Number(form.spend_per_point || 0).toFixed(0)}</strong> de compra = <strong>1 punto</strong>.
              {' '}1 punto = <strong>${Number(form.point_value || 0).toFixed(2)}</strong> de descuento.
              {form.expiration_days && form.expiration_days > 0 ? ` Expiran a los ${form.expiration_days} dias.` : ' No expiran.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Config Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-6 space-y-5">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Reglas de Acumulacion
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Monto por punto (pesos)</Label>
                <Input type="number" min={1} value={form.spend_per_point || ''} onChange={(e) => setForm((p) => ({ ...p, spend_per_point: Number(e.target.value) }))} placeholder="100" />
                <p className="text-[11px] text-muted-foreground">Por cada $X de compra se otorga 1 punto.</p>
              </div>
              <div className="space-y-2">
                <Label>Valor del punto (pesos)</Label>
                <Input type="number" min={0.01} step={0.01} value={form.point_value || ''} onChange={(e) => setForm((p) => ({ ...p, point_value: Number(e.target.value) }))} placeholder="1.00" />
                <p className="text-[11px] text-muted-foreground">Cuanto vale 1 punto al canjear.</p>
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Acumular en apartados</p><p className="text-[11px] text-muted-foreground">Puntos al liquidar apartado</p></div>
                <Button type="button" variant={form.earn_on_layaway ? 'default' : 'outline'} size="sm" onClick={() => setForm((p) => ({ ...p, earn_on_layaway: !p.earn_on_layaway }))}>{form.earn_on_layaway ? 'Si' : 'No'}</Button>
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Acumular en credito</p><p className="text-[11px] text-muted-foreground">Puntos en compras a credito</p></div>
                <Button type="button" variant={form.earn_on_credit ? 'default' : 'outline'} size="sm" onClick={() => setForm((p) => ({ ...p, earn_on_credit: !p.earn_on_credit }))}>{form.earn_on_credit ? 'Si' : 'No'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-5">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" />
              Reglas de Canje
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Minimo de puntos para canjear</Label>
                <Input type="number" min={1} value={form.min_redemption_points || ''} onChange={(e) => setForm((p) => ({ ...p, min_redemption_points: Number(e.target.value) }))} placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label>Dias para expirar (0 = nunca)</Label>
                <Input type="number" min={0} value={form.expiration_days ?? ''} onChange={(e) => setForm((p) => ({ ...p, expiration_days: Number(e.target.value) }))} placeholder="0" />
                <p className="text-[11px] text-muted-foreground">
                  {form.expiration_days && form.expiration_days > 0 ? `Puntos expiran ${form.expiration_days} dias despues de ganarse.` : 'Los puntos no tienen fecha de expiracion.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Guardando...' : 'Guardar Configuracion'}
        </Button>
      </div>

      {/* Manual Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste Manual de Puntos</DialogTitle>
            <DialogDescription>Otorga o deduce puntos manualmente a un cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.loyalty_points} puntos actuales</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>Cambiar</Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar cliente..." className="pl-9" value={customerSearch} onChange={(e) => searchCustomers(e.target.value)} />
                  </div>
                  {customerResults.length > 0 && (
                    <div className="border rounded-md max-h-32 overflow-y-auto">
                      {customerResults.map((c) => (
                        <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between" onClick={() => { setSelectedCustomer(c); setCustomerResults([]); }}>
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.loyalty_points} pts</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="flex gap-2">
                <Button type="button" variant={adjustForm.type === 'manual_credit' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1" onClick={() => setAdjustForm((p) => ({ ...p, type: 'manual_credit' }))}><Plus className="h-3 w-3" /> Otorgar</Button>
                <Button type="button" variant={adjustForm.type === 'manual_debit' ? 'destructive' : 'outline'} size="sm" className="flex-1 gap-1" onClick={() => setAdjustForm((p) => ({ ...p, type: 'manual_debit' }))}><Minus className="h-3 w-3" /> Deducir</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cantidad de puntos</Label>
              <Input type="number" min={1} value={adjustForm.points} onChange={(e) => setAdjustForm((p) => ({ ...p, points: e.target.value }))} placeholder="50" />
            </div>
            <div className="space-y-2">
              <Label>Razon (opcional)</Label>
              <Input value={adjustForm.description} onChange={(e) => setAdjustForm((p) => ({ ...p, description: e.target.value }))} placeholder="Ej: Compensacion por error" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdjust} disabled={adjustSaving || !selectedCustomer || !adjustForm.points}>
              {adjustSaving ? 'Aplicando...' : 'Aplicar Ajuste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
