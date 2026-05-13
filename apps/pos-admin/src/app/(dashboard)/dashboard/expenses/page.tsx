'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@nivo/ui';
import {
  Wallet, Plus, Search, DollarSign, TrendingUp, Tag, ChevronLeft, ChevronRight,
  Paperclip, Building2, CreditCard, Banknote, PieChart, X, AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getThisMonthRange, formatCurrency, formatDate } from '@/lib/date-utils';

// ─── Types ────────────────────────────────────────────────────────

interface ExpenseRow {
  id: string;
  branch_id: string;
  branch_name: string;
  category_id: string;
  category_name: string;
  employee_id: string;
  employee_name: string;
  amount: number;
  description: string;
  payment_source: string;
  receipt_url: string | null;
  date: string;
  pos_session_id: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

interface KpiData {
  total_amount: number;
  expense_count: number;
  top_category: string | null;
  top_category_pct: number;
  breakdown: { category_id: string; category_name: string; total: number; count: number; pct: number }[];
}

const PAGE_SIZE = 20;

const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  cash: { label: 'Caja POS', icon: <Banknote className="h-3.5 w-3.5" /> },
  bank: { label: 'Banco', icon: <Building2 className="h-3.5 w-3.5" /> },
};

// ═══════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════

export default function ExpensesPage() {
  const { isGeneralSelected, selectedBranchId, branches } = useBranchStore();
  const branchId = isGeneralSelected ? undefined : (selectedBranchId || undefined);

  // ─── State ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  // ─── Fetch ───────────────────────────────────────────────────

  const fetchExpenses = useCallback(async (pg = 0) => {
    setLoading(true);
    try {
      const monthRange = getThisMonthRange();
      const params: Record<string, string> = {
        start_date: monthRange.start_date,
        end_date: monthRange.end_date,
        limit: String(PAGE_SIZE),
        offset: String(pg * PAGE_SIZE),
      };
      if (branchId) params.branch_id = branchId;
      if (categoryFilter !== 'all') params.category_id = categoryFilter;
      if (search.trim()) params.search = search.trim();

      const res = await apiClient.get('/expenses', { params });
      setExpenses(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, categoryFilter, search]);

  const fetchKpis = useCallback(async () => {
    try {
      const monthRange = getThisMonthRange();
      const params: Record<string, string> = {
        start_date: monthRange.start_date,
        end_date: monthRange.end_date,
      };
      if (branchId) params.branch_id = branchId;
      const res = await apiClient.get('/expenses/kpis', { params });
      setKpis(res.data);
    } catch {
      setKpis(null);
    }
  }, [branchId]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.get('/expenses/categories');
      setCategories(res.data || []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchKpis();
    fetchExpenses(0);
    setPage(0);
  }, [fetchKpis, fetchExpenses]);

  useEffect(() => {
    if (page > 0) fetchExpenses(page);
  }, [page]);

  const onCreated = () => {
    setCreateOpen(false);
    fetchExpenses(0);
    setPage(0);
    fetchKpis();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Control de Gastos</h2>
          <p className="text-sm text-muted-foreground">Registro y analisis de gastos operativos del mes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCategoryDialogOpen(true)}>
            <Tag className="h-4 w-4 mr-1.5" />
            Categorias
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo Gasto
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          loading={!kpis}
          title="Gasto Total del Mes"
          value={kpis ? formatCurrency(kpis.total_amount) : '$0'}
          subtitle={`${kpis?.expense_count || 0} registros`}
          icon={<DollarSign className="h-5 w-5 text-red-400" />}
        />
        <KpiCard
          loading={!kpis}
          title="Top Categoria"
          value={kpis?.top_category || 'Sin datos'}
          subtitle={kpis?.top_category ? `${kpis.top_category_pct}% del gasto total` : ''}
          icon={<PieChart className="h-5 w-5 text-violet-400" />}
        />
        {/* Breakdown bars */}
        <Card className="md:col-span-2 border-white/5 bg-zinc-950/60 backdrop-blur-md">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Distribucion por Categoria</p>
            {!kpis ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
            ) : kpis.breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin gastos en el periodo</p>
            ) : (
              <div className="space-y-2.5">
                {kpis.breakdown.slice(0, 5).map((cat) => (
                  <div key={cat.category_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{cat.category_name}</span>
                      <span className="text-muted-foreground">{formatCurrency(cat.total)} ({cat.pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-all"
                        style={{ width: `${cat.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en descripcion..."
            className="pl-9"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorias</SelectItem>
            {categories.filter((c) => c.is_active).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  {isGeneralSelected && <th className="px-4 py-3 text-left font-medium">Sucursal</th>}
                  <th className="px-4 py-3 text-left font-medium">Categoria</th>
                  <th className="px-4 py-3 text-left font-medium">Descripcion</th>
                  <th className="px-4 py-3 text-left font-medium">Empleado</th>
                  <th className="px-4 py-3 text-center font-medium">Origen</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 text-center font-medium">Ticket</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: isGeneralSelected ? 8 : 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={isGeneralSelected ? 8 : 7} className="px-4 py-12 text-center text-muted-foreground">
                      <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No hay gastos registrados en este periodo
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => {
                    const src = SOURCE_LABELS[e.payment_source] || SOURCE_LABELS.bank;
                    return (
                      <tr key={e.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                        {isGeneralSelected && (
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">{e.branch_name}</Badge>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">{e.category_name}</Badge>
                        </td>
                        <td className="px-4 py-3 max-w-[250px] truncate">{e.description}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.employee_name}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="text-xs gap-1">
                            {src.icon}
                            {src.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-red-400">
                          -{formatCurrency(e.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {e.receipt_url ? (
                            <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                              <Paperclip className="h-4 w-4 inline" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">{total} gastos</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Create Expense Dialog ═══════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Gasto</DialogTitle>
            <DialogDescription>Registra un gasto operativo. Si se pago desde caja, se reflejara en el arqueo.</DialogDescription>
          </DialogHeader>
          {createOpen && (
            <CreateExpenseForm
              categories={categories.filter((c) => c.is_active)}
              branches={branches}
              currentBranchId={branchId}
              onCreated={onCreated}
              onClose={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Category Manager Dialog ═════════════════════════════════ */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Categorias de Gasto</DialogTitle>
          </DialogHeader>
          {categoryDialogOpen && (
            <CategoryManager
              categories={categories}
              onUpdate={() => { fetchCategories(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────

function KpiCard({ loading, title, value, subtitle, icon }: {
  loading: boolean;
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950/60 backdrop-blur-md p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
        {icon}
      </div>
      {loading ? <Skeleton className="h-8 w-28" /> : (
        <>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Create Expense Form
// ═══════════════════════════════════════════════════════════════════

function CreateExpenseForm({
  categories, branches, currentBranchId, onCreated, onClose,
}: {
  categories: Category[];
  branches: any[];
  currentBranchId?: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [branchId, setBranchId] = useState(currentBranchId || '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentSource, setPaymentSource] = useState<'bank' | 'cash'>('bank');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const activeBranches = branches.filter((b: any) => b.is_active);

  const submit = async () => {
    if (!categoryId || !branchId || !amount || !description.trim()) return;
    setSaving(true);
    try {
      await apiClient.post('/expenses', {
        branch_id: branchId,
        category_id: categoryId,
        amount: parseFloat(amount),
        description: description.trim(),
        payment_source: paymentSource,
        date,
      });
      onCreated();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al registrar gasto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria *</label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal *</label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {activeBranches.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripcion *</label>
        <Input
          placeholder="Ej: Pago de luz, Garrafones de agua..."
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Monto *</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha</label>
          <Input
            type="date"
            value={date}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Origen del pago</label>
        <Select value={paymentSource} onValueChange={(v) => setPaymentSource(v as 'bank' | 'cash')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bank">Banco / Transferencia</SelectItem>
            <SelectItem value="cash">Caja POS (afecta arqueo)</SelectItem>
          </SelectContent>
        </Select>
        {paymentSource === 'cash' && (
          <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Este gasto se descontara del efectivo esperado en caja
          </p>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={submit}
          disabled={!categoryId || !branchId || !amount || !description.trim() || saving}
        >
          {saving ? 'Guardando...' : 'Registrar Gasto'}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Category Manager
// ═══════════════════════════════════════════════════════════════════

function CategoryManager({ categories, onUpdate }: { categories: Category[]; onUpdate: () => void }) {
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const addCategory = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await apiClient.post('/expenses/categories', { name: newName.trim() });
      setNewName('');
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = async (id: string, isActive: boolean) => {
    try {
      await apiClient.put(`/expenses/categories/${id}`, { is_active: !isActive });
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Nueva categoria..."
          value={newName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && addCategory()}
        />
        <Button size="sm" onClick={addCategory} disabled={!newName.trim() || saving}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin categorias. Agrega la primera.</p>
        ) : (
          categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/30">
              <span className={`text-sm ${c.is_active ? '' : 'text-muted-foreground line-through'}`}>{c.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleCategory(c.id, c.is_active)}
                className="text-xs"
              >
                {c.is_active ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
