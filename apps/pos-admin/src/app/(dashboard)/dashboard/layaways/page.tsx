'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Label, Skeleton, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@nivo/ui';
import {
  ClipboardList, Search, Calendar, DollarSign, AlertTriangle,
  CheckCircle2, XCircle, Clock, CreditCard, Receipt, User,
  MapPin, ChevronRight, Banknote,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Layaway {
  id: string;
  folio_number: number;
  customer: { id: string; name: string; phone: string | null } | null;
  branch: { id: string; name: string } | null;
  employee: { id: string; name: string } | null;
  total_amount: number;
  down_payment: number;
  balance_due: number;
  status: string;
  due_date: string;
  items: any[];
  payments: any[];
  notes: string | null;
  created_at: string;
}

interface KPIs {
  active_count: number;
  total_pending: number;
  total_collected: number;
  overdue_count: number;
  completed_this_month: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Activo', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Clock },
  paid_delivered: { label: 'Liquidado', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle2 },
  cancelled_refunded: { label: 'Cancelado (Reembolso)', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
  cancelled_forfeited: { label: 'Cancelado (Sin reembolso)', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: XCircle },
};

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

export default function LayawaysPage() {
  const [layaways, setLayaways] = useState<Layaway[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail view
  const [selected, setSelected] = useState<Layaway | null>(null);

  // Payment dialog
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', reference: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);

  // Cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelForfeit, setCancelForfeit] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [layRes, kpiRes] = await Promise.all([
        apiClient.get('/layaways?limit=100'),
        apiClient.get('/layaways/kpis'),
      ]);
      setLayaways(layRes.data.items || []);
      setKpis(kpiRes.data);
    } catch (error) {
      console.error('Failed to fetch layaways:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredLayaways = layaways.filter((l) => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const folio = `APT-${String(l.folio_number).padStart(4, '0')}`.toLowerCase();
      if (!folio.includes(q) && !l.customer?.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openDetail = async (layaway: Layaway) => {
    try {
      const res = await apiClient.get(`/layaways/${layaway.id}`);
      setSelected(res.data);
    } catch {
      setSelected(layaway);
    }
  };

  const handlePayment = async () => {
    if (!selected || !paymentForm.amount) return;
    setPaymentSaving(true);
    try {
      await apiClient.post(`/layaways/${selected.id}/payment`, {
        amount: Number(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        reference: paymentForm.reference || undefined,
      });
      toast({ title: 'Abono registrado', description: `${fmt(Number(paymentForm.amount))} abonado al apartado.` });
      setPaymentOpen(false);
      setPaymentForm({ amount: '', payment_method: 'cash', reference: '' });
      // Refresh
      const res = await apiClient.get(`/layaways/${selected.id}`);
      setSelected(res.data);
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!selected) return;
    try {
      await apiClient.post(`/layaways/${selected.id}/cancel`, { forfeit: cancelForfeit });
      toast({ title: 'Apartado cancelado' });
      setCancelOpen(false);
      setSelected(null);
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    }
  };

  const isOverdue = (l: Layaway) => l.status === 'active' && new Date(l.due_date) < new Date();
  const progressPct = (l: Layaway) => ((Number(l.total_amount) - Number(l.balance_due)) / Number(l.total_amount)) * 100;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // ─── Detail View ──────────────────────────────────────────────
  if (selected) {
    const sc = STATUS_CONFIG[selected.status] || STATUS_CONFIG.active;
    const StatusIcon = sc.icon;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Volver</Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">APT-{String(selected.folio_number).padStart(4, '0')}</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              APT-{String(selected.folio_number).padStart(4, '0')}
              <Badge className={sc.color}><StatusIcon className="h-3 w-3 mr-1" />{sc.label}</Badge>
              {isOverdue(selected) && <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Vencido</Badge>}
            </h2>
            <p className="text-muted-foreground">{selected.customer?.name} — {fmtDate(selected.created_at)}</p>
          </div>
          {selected.status === 'active' && (
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-4 w-4" /> Cancelar
              </Button>
              <Button className="gap-2" onClick={() => { setPaymentForm({ amount: '', payment_method: 'cash', reference: '' }); setPaymentOpen(true); }}>
                <Banknote className="h-4 w-4" /> Registrar Abono
              </Button>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total</p><p className="text-xl font-bold">{fmt(Number(selected.total_amount))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Pagado</p><p className="text-xl font-bold text-green-400">{fmt(Number(selected.total_amount) - Number(selected.balance_due))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Saldo Pendiente</p><p className="text-xl font-bold text-amber-400">{fmt(Number(selected.balance_due))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Vencimiento</p><p className="text-xl font-bold">{fmtDate(selected.due_date)}</p></CardContent></Card>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Progreso de pago</p>
              <p className="text-sm text-muted-foreground">{progressPct(selected).toFixed(0)}%</p>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct(selected)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Articulos apartados</h3>
            <div className="space-y-2">
              {(selected.items || []).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.variant?.product?.name || 'Producto'}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variant?.sku || ''} — Cant: {item.quantity} x {fmt(Number(item.unit_price))}
                    </p>
                  </div>
                  <p className="text-sm font-medium">{fmt(Number(item.subtotal))}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payments History */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Historial de pagos</h3>
            <div className="space-y-2">
              {(selected.payments || []).map((p: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{fmt(Number(p.amount))}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(p.created_at)} — {p.payment_method} {p.reference ? `(${p.reference})` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.employee?.name || ''}</p>
                </div>
              ))}
              {(!selected.payments || selected.payments.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">Sin pagos registrados</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Abono</DialogTitle>
              <DialogDescription>Saldo pendiente: {fmt(Number(selected.balance_due))}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Monto del abono</Label>
                <Input type="number" min={0.01} max={Number(selected.balance_due)} step={0.01} value={paymentForm.amount} onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" autoFocus />
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setPaymentForm((p) => ({ ...p, amount: String(selected.balance_due) }))}>Liquidar total</Button>
              </div>
              <div className="space-y-2">
                <Label>Metodo de pago</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={paymentForm.payment_method} onChange={(e) => setPaymentForm((p) => ({ ...p, payment_method: e.target.value }))}>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Referencia (opcional)</Label>
                <Input value={paymentForm.reference} onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))} placeholder="No. de operacion" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancelar</Button>
              <Button onClick={handlePayment} disabled={paymentSaving || !paymentForm.amount}>{paymentSaving ? 'Procesando...' : 'Registrar Abono'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancelar Apartado</DialogTitle>
              <DialogDescription>El inventario reservado sera devuelto al piso de ventas.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-3">
                <Button type="button" variant={!cancelForfeit ? 'default' : 'outline'} className="flex-1" onClick={() => setCancelForfeit(false)}>
                  Reembolsar pagos
                </Button>
                <Button type="button" variant={cancelForfeit ? 'destructive' : 'outline'} className="flex-1" onClick={() => setCancelForfeit(true)}>
                  Sin reembolso
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {cancelForfeit
                  ? 'El cliente perdera los pagos realizados. Total pagado: ' + fmt(Number(selected.total_amount) - Number(selected.balance_due))
                  : 'Se debera reembolsar al cliente: ' + fmt(Number(selected.total_amount) - Number(selected.balance_due))}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelOpen(false)}>Volver</Button>
              <Button variant="destructive" onClick={handleCancel}>Confirmar Cancelacion</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Apartados</h2>
        <p className="text-muted-foreground">Gestiona los apartados de clientes y sus abonos.</p>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-blue-400" /><p className="text-xs text-muted-foreground">Activos</p></div><p className="text-2xl font-bold">{kpis.active_count}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-amber-400" /><p className="text-xs text-muted-foreground">Por Cobrar</p></div><p className="text-2xl font-bold">{fmt(kpis.total_pending)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Banknote className="h-4 w-4 text-green-400" /><p className="text-xs text-muted-foreground">Cobrado</p></div><p className="text-2xl font-bold">{fmt(kpis.total_collected)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-red-400" /><p className="text-xs text-muted-foreground">Vencidos</p></div><p className="text-2xl font-bold text-red-400">{kpis.overdue_count}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-green-400" /><p className="text-xs text-muted-foreground">Liquidados (Mes)</p></div><p className="text-2xl font-bold">{kpis.completed_this_month}</p></CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por folio o cliente..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="paid_delivered">Liquidados</SelectItem>
            <SelectItem value="cancelled_refunded">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredLayaways.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Sin apartados</h3>
            <p className="text-sm text-muted-foreground">Los apartados se crean desde el Punto de Venta.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left font-medium px-4 py-3">Folio</th>
                    <th className="text-left font-medium px-4 py-3">Cliente</th>
                    <th className="text-left font-medium px-4 py-3">Total</th>
                    <th className="text-left font-medium px-4 py-3">Saldo</th>
                    <th className="text-left font-medium px-4 py-3">Progreso</th>
                    <th className="text-left font-medium px-4 py-3">Vencimiento</th>
                    <th className="text-left font-medium px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLayaways.map((l) => {
                    const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG.active;
                    const overdue = isOverdue(l);
                    return (
                      <tr key={l.id} className="border-b hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => openDetail(l)}>
                        <td className="px-4 py-3 font-mono font-medium">APT-{String(l.folio_number).padStart(4, '0')}</td>
                        <td className="px-4 py-3">{l.customer?.name || '—'}</td>
                        <td className="px-4 py-3">{fmt(Number(l.total_amount))}</td>
                        <td className="px-4 py-3 font-medium">{fmt(Number(l.balance_due))}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct(l)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{progressPct(l).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 ${overdue ? 'text-red-400 font-medium' : ''}`}>{fmtDate(l.due_date)}</td>
                        <td className="px-4 py-3">
                          <Badge className={`${sc.color} text-[10px]`}>{sc.label}</Badge>
                          {overdue && <Badge className="ml-1 bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Vencido</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
