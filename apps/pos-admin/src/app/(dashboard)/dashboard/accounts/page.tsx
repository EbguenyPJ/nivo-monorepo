'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Label, Skeleton, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@nivo/ui';
import {
  Receipt, Search, DollarSign, AlertTriangle, Plus,
  CreditCard, Banknote, ChevronRight, User, TrendingDown,
  ArrowUpRight, ArrowDownRight, Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface CreditAccount {
  id: string;
  customer_id: string;
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  credit_limit: number;
  current_balance: number;
  payment_terms: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface CreditTx {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  sale_id: string | null;
  payment_method: string | null;
  reference: string | null;
  due_date: string | null;
  employee: { name: string } | null;
  created_at: string;
}

interface KPIs {
  total_accounts: number;
  total_debt: number;
  total_credit_limit: number;
  overdue_amount: number;
  overdue_accounts: number;
  payments_this_month: number;
}

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

const TX_LABELS: Record<string, { label: string; color: string }> = {
  charge: { label: 'Cargo', color: 'text-red-400' },
  payment: { label: 'Pago', color: 'text-green-400' },
  adjustment_credit: { label: 'Ajuste -', color: 'text-green-400' },
  adjustment_debit: { label: 'Ajuste +', color: 'text-red-400' },
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  // Detail
  const [selected, setSelected] = useState<CreditAccount | null>(null);
  const [transactions, setTransactions] = useState<CreditTx[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ customer_id: '', credit_limit: '', payment_terms: '30', notes: '' });
  const [createSaving, setCreateSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Payment dialog
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', reference: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [accRes, kpiRes] = await Promise.all([
        apiClient.get(`/credit-accounts?status=${filterStatus}&limit=100`),
        apiClient.get('/credit-accounts/kpis'),
      ]);
      setAccounts(accRes.data.items || []);
      setKpis(kpiRes.data);
    } catch (error) {
      console.error('Failed to fetch credit accounts:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (account: CreditAccount) => {
    setSelected(account);
    setLoadingTx(true);
    try {
      const res = await apiClient.get(`/credit-accounts/${account.id}/transactions?limit=50`);
      setTransactions(res.data.items || []);
    } catch {
      setTransactions([]);
    } finally {
      setLoadingTx(false);
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

  const handleCreate = async () => {
    if (!selectedCustomer || !createForm.credit_limit) return;
    setCreateSaving(true);
    try {
      await apiClient.post('/credit-accounts', {
        customer_id: selectedCustomer.id,
        credit_limit: Number(createForm.credit_limit),
        payment_terms: parseInt(createForm.payment_terms) || 30,
        notes: createForm.notes || undefined,
      });
      toast({ title: 'Cuenta creada', description: `Linea de credito para ${selectedCustomer.name}` });
      setCreateOpen(false);
      setSelectedCustomer(null);
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    } finally {
      setCreateSaving(false);
    }
  };

  const handlePayment = async () => {
    if (!selected || !paymentForm.amount) return;
    setPaymentSaving(true);
    try {
      await apiClient.post(`/credit-accounts/${selected.id}/payment`, {
        amount: Number(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        reference: paymentForm.reference || undefined,
      });
      toast({ title: 'Pago registrado', description: `${fmt(Number(paymentForm.amount))} aplicado a la cuenta.` });
      setPaymentOpen(false);
      setPaymentForm({ amount: '', payment_method: 'cash', reference: '' });
      await fetchData();
      // Refresh detail
      const accRes = await apiClient.get(`/credit-accounts/${selected.id}`);
      setSelected(accRes.data);
      const txRes = await apiClient.get(`/credit-accounts/${selected.id}/transactions?limit=50`);
      setTransactions(txRes.data.items || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    } finally {
      setPaymentSaving(false);
    }
  };

  const usagePct = (a: CreditAccount) => (Number(a.current_balance) / Number(a.credit_limit)) * 100;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      </div>
    );
  }

  // ─── Detail View ──────────────────────────────────────────────
  if (selected) {
    const available = Number(selected.credit_limit) - Number(selected.current_balance);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Volver</Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{selected.customer?.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{selected.customer?.name}</h2>
            <p className="text-muted-foreground">
              {selected.customer?.phone || ''} {selected.customer?.email ? `— ${selected.customer.email}` : ''}
              {' '}— Plazo: {selected.payment_terms} dias
            </p>
          </div>
          <Button className="gap-2" onClick={() => { setPaymentForm({ amount: '', payment_method: 'cash', reference: '' }); setPaymentOpen(true); }}>
            <Banknote className="h-4 w-4" /> Registrar Pago
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Limite de Credito</p><p className="text-xl font-bold">{fmt(Number(selected.credit_limit))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Deuda Actual</p><p className="text-xl font-bold text-red-400">{fmt(Number(selected.current_balance))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Credito Disponible</p><p className="text-xl font-bold text-green-400">{fmt(available)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Uso</p><p className="text-xl font-bold">{usagePct(selected).toFixed(0)}%</p>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
              <div className={`h-full rounded-full transition-all ${usagePct(selected) > 80 ? 'bg-red-400' : usagePct(selected) > 50 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${Math.min(usagePct(selected), 100)}%` }} />
            </div>
          </CardContent></Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Estado de Cuenta</h3>
            {loadingTx ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin movimientos</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left font-medium px-3 py-2">Fecha</th>
                      <th className="text-left font-medium px-3 py-2">Tipo</th>
                      <th className="text-right font-medium px-3 py-2">Monto</th>
                      <th className="text-right font-medium px-3 py-2">Saldo</th>
                      <th className="text-left font-medium px-3 py-2">Referencia</th>
                      <th className="text-left font-medium px-3 py-2">Vence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const tl = TX_LABELS[tx.type] || { label: tx.type, color: '' };
                      const isDebit = tx.type === 'charge' || tx.type === 'adjustment_debit';
                      return (
                        <tr key={tx.id} className="border-b">
                          <td className="px-3 py-2 text-muted-foreground">{fmtDate(tx.created_at)}</td>
                          <td className="px-3 py-2"><span className={tl.color}>{tl.label}</span></td>
                          <td className={`px-3 py-2 text-right font-medium ${isDebit ? 'text-red-400' : 'text-green-400'}`}>
                            {isDebit ? '+' : '-'}{fmt(Number(tx.amount))}
                          </td>
                          <td className="px-3 py-2 text-right">{fmt(Number(tx.balance_after))}</td>
                          <td className="px-3 py-2 text-muted-foreground">{tx.reference || tx.payment_method || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{tx.due_date ? fmtDate(tx.due_date) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Pago</DialogTitle>
              <DialogDescription>Deuda actual: {fmt(Number(selected.current_balance))}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input type="number" min={0.01} max={Number(selected.current_balance)} step={0.01} value={paymentForm.amount} onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" autoFocus />
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setPaymentForm((p) => ({ ...p, amount: String(selected.current_balance) }))}>Liquidar total</Button>
              </div>
              <div className="space-y-2">
                <Label>Metodo</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={paymentForm.payment_method} onChange={(e) => setPaymentForm((p) => ({ ...p, payment_method: e.target.value }))}>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                  <option value="deposit">Deposito</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Referencia</Label>
                <Input value={paymentForm.reference} onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))} placeholder="No. de operacion, folio, etc." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancelar</Button>
              <Button onClick={handlePayment} disabled={paymentSaving || !paymentForm.amount}>{paymentSaving ? 'Procesando...' : 'Registrar Pago'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cuentas por Cobrar</h2>
          <p className="text-muted-foreground">Gestiona las lineas de credito y cobros a clientes mayoristas.</p>
        </div>
        <Button className="gap-2" onClick={() => { setCreateOpen(true); setSelectedCustomer(null); setCustomerSearch(''); setCustomerResults([]); setCreateForm({ customer_id: '', credit_limit: '', payment_terms: '30', notes: '' }); }}>
          <Plus className="h-4 w-4" />
          Nueva Cuenta
        </Button>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><User className="h-4 w-4 text-blue-400" /><p className="text-xs text-muted-foreground">Cuentas Activas</p></div><p className="text-2xl font-bold">{kpis.total_accounts}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-red-400" /><p className="text-xs text-muted-foreground">Deuda Total</p></div><p className="text-2xl font-bold text-red-400">{fmt(kpis.total_debt)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-amber-400" /><p className="text-xs text-muted-foreground">Monto Vencido</p></div><p className="text-2xl font-bold text-amber-400">{fmt(kpis.overdue_amount)}</p><p className="text-[10px] text-muted-foreground">{kpis.overdue_accounts} cuenta{kpis.overdue_accounts !== 1 ? 's' : ''}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Banknote className="h-4 w-4 text-green-400" /><p className="text-xs text-muted-foreground">Pagos del Mes</p></div><p className="text-2xl font-bold text-green-400">{fmt(kpis.payments_this_month)}</p></CardContent></Card>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Con saldo</SelectItem>
            <SelectItem value="overdue">Vencidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Receipt className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Sin cuentas de credito</h3>
            <p className="text-sm text-muted-foreground mb-6">Crea lineas de credito para tus clientes de confianza.</p>
            <Button className="gap-2" onClick={() => { setCreateOpen(true); setSelectedCustomer(null); }}><Plus className="h-4 w-4" />Nueva Cuenta</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acc) => {
            const usage = usagePct(acc);
            const available = Number(acc.credit_limit) - Number(acc.current_balance);
            return (
              <Card key={acc.id} className="hover:shadow-md transition-all cursor-pointer" onClick={() => openDetail(acc)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-base">{acc.customer?.name}</h3>
                      <p className="text-xs text-muted-foreground">{acc.customer?.phone || acc.customer?.email || ''}</p>
                    </div>
                    <Badge className={usage > 80 ? 'bg-red-500/10 text-red-400' : usage > 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'}>
                      {usage.toFixed(0)}% usado
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div><p className="text-[10px] text-muted-foreground">Limite</p><p className="text-sm font-medium">{fmt(Number(acc.credit_limit))}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Deuda</p><p className="text-sm font-medium text-red-400">{fmt(Number(acc.current_balance))}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Disponible</p><p className="text-sm font-medium text-green-400">{fmt(available)}</p></div>
                  </div>

                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${usage > 80 ? 'bg-red-400' : usage > 50 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${Math.min(usage, 100)}%` }} />
                  </div>

                  <p className="text-[10px] text-muted-foreground mt-2">Plazo: {acc.payment_terms} dias</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Account Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Cuenta de Credito</DialogTitle>
            <DialogDescription>Asigna una linea de credito a un cliente mayorista.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <p className="text-sm font-medium">{selectedCustomer.name}</p>
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
                        <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors" onClick={() => { setSelectedCustomer(c); setCustomerResults([]); }}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Limite de credito</Label>
              <Input type="number" min={1} value={createForm.credit_limit} onChange={(e) => setCreateForm((p) => ({ ...p, credit_limit: e.target.value }))} placeholder="10000" />
            </div>
            <div className="space-y-2">
              <Label>Plazo (dias)</Label>
              <Input type="number" min={1} value={createForm.payment_terms} onChange={(e) => setCreateForm((p) => ({ ...p, payment_terms: e.target.value }))} placeholder="30" />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input value={createForm.notes} onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notas internas..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createSaving || !selectedCustomer || !createForm.credit_limit}>{createSaving ? 'Creando...' : 'Crear Cuenta'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
