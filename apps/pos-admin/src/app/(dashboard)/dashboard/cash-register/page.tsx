'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@nivo/ui';
import {
  DollarSign, CreditCard, AlertTriangle, TrendingDown, TrendingUp,
  ChevronLeft, ChevronRight, Calculator, Eye, Clock, ArrowDownToLine,
  ArrowUpFromLine, RefreshCw, Filter, ShieldCheck,
  Banknote, Receipt, Wallet,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getTodayRange, getThisWeekRange, getThisMonthRange, formatCurrency, formatDate } from '@/lib/date-utils';

// ─── Types ───────────────────────────────────────────────────────

interface AuditSession {
  id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  employee_name: string;
  employee_id: string;
  branch_name: string;
  branch_id: string;
  cash_register_name: string;
  cash_register_id: string | null;
  closed_by_name: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  difference: number | null;
  total_cash_sales: number;
  total_cash_in: number;
  total_cash_out: number;
  total_refunds: number;
  total_sales_count: number;
  total_sales_amount: number;
  total_card_payments: number;
}

interface AuditKpis {
  total_revenue: number;
  total_cash_expected: number;
  total_card_payments: number;
  sessions_with_difference: number;
  total_sessions: number;
  total_difference_abs: number;
}

interface SessionSummary {
  session_id: string;
  employee_name: string;
  cash_register_name: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  opening_amount: number;
  total_cash_sales: number;
  total_cash_in: number;
  total_cash_out: number;
  total_refunds: number;
  expected_cash: number;
  declared_amount: number | null;
  difference: number | null;
  payment_methods: { method: string; total: number; count: number }[];
  total_sales_count: number;
  total_sales_amount: number;
  audits: { declared: number; expected: number; difference: number; time: string }[];
  transactions: { id: string; type: string; amount: number; description: string | null; created_at: string }[];
}

interface VaultWithdrawal {
  id: string;
  session_id: string;
  employee_name: string;
  branch_name: string;
  cash_register_name: string;
  amount: number;
  description: string | null;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────

const PAGE_SIZE = 15;

const TX_TYPE_LABELS: Record<string, string> = {
  sale_cash: 'Venta (Efectivo)',
  cash_in: 'Entrada',
  cash_out: 'Retiro',
  refund: 'Reembolso',
  audit: 'Arqueo (Corte X)',
};

const TX_TYPE_COLORS: Record<string, string> = {
  sale_cash: 'text-emerald-400',
  cash_in: 'text-blue-400',
  cash_out: 'text-red-400',
  refund: 'text-orange-400',
  audit: 'text-cyan-400',
};

function getDateRange(period: string): { start_date?: string; end_date?: string } {
  switch (period) {
    case 'today': return getTodayRange();
    case 'week': return getThisWeekRange();
    case 'month': return getThisMonthRange();
    default: return {};
  }
}

// ─── Main Page ───────────────────────────────────────────────────

export default function CashRegisterAuditPage() {
  const { selectedBranchId, isGeneralSelected, branches } = useBranchStore();

  // Filters
  const [period, setPeriod] = useState('month');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [branchFilter, setBranchFilter] = useState('all');

  // Data
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [kpis, setKpis] = useState<AuditKpis | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Drill-down drawer
  const [selectedSession, setSelectedSession] = useState<AuditSession | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Vault tab
  const [activeTab, setActiveTab] = useState('sessions');
  const [vaultData, setVaultData] = useState<VaultWithdrawal[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ─── Fetch Sessions ────────────────────────────────────────────

  const fetchSessions = useCallback(async (currentPage = 0) => {
    setLoading(true);
    try {
      const range = getDateRange(period);
      const params: Record<string, string> = {};
      if (range.start_date) params.start_date = range.start_date;
      if (range.end_date) params.end_date = range.end_date;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (onlyDifferences) params.only_differences = 'true';
      if (branchFilter !== 'all') {
        params.branch_id = branchFilter;
      } else if (!isGeneralSelected && selectedBranchId) {
        params.branch_id = selectedBranchId;
      }
      params.limit = String(PAGE_SIZE);
      params.offset = String(currentPage * PAGE_SIZE);

      const res = await apiClient.get('/pos/sessions/audit', { params });
      setSessions(res.data.data || []);
      setTotalCount(res.data.total || 0);
      setKpis(res.data.kpis || null);
    } catch (error) {
      console.error('Failed to fetch audit sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [period, statusFilter, onlyDifferences, branchFilter, selectedBranchId, isGeneralSelected]);

  useEffect(() => {
    setPage(0);
    fetchSessions(0);
  }, [fetchSessions]);

  useEffect(() => {
    fetchSessions(page);
  }, [page]);

  // ─── Fetch Vault ───────────────────────────────────────────────

  const fetchVault = useCallback(async () => {
    setVaultLoading(true);
    try {
      const range = getDateRange(period);
      const params: Record<string, string> = {};
      if (range.start_date) params.start_date = range.start_date;
      if (range.end_date) params.end_date = range.end_date;
      if (branchFilter !== 'all') {
        params.branch_id = branchFilter;
      } else if (!isGeneralSelected && selectedBranchId) {
        params.branch_id = selectedBranchId;
      }

      const res = await apiClient.get('/pos/vault/withdrawals', { params });
      setVaultData(res.data || []);
    } catch (error) {
      console.error('Failed to fetch vault data:', error);
    } finally {
      setVaultLoading(false);
    }
  }, [period, branchFilter, selectedBranchId, isGeneralSelected]);

  useEffect(() => {
    if (activeTab === 'vault') {
      fetchVault();
    }
  }, [activeTab, fetchVault]);

  // ─── Drill-down ────────────────────────────────────────────────

  const openDrawer = async (session: AuditSession) => {
    setSelectedSession(session);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setSessionSummary(null);
    try {
      const res = await apiClient.get('/pos/sessions/summary', {
        params: { session_id: session.id },
      });
      setSessionSummary(res.data);
    } catch (error) {
      console.error('Failed to fetch session summary:', error);
    } finally {
      setDrawerLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Arqueos y Cortes de Caja</h2>
          <p className="text-muted-foreground">Audita sesiones, revisa diferencias y gestiona retiros</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs: Sessions / Vault */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sessions" className="gap-1.5">
            <Calculator className="h-4 w-4" />
            Sesiones
          </TabsTrigger>
          <TabsTrigger value="vault" className="gap-1.5">
            <Wallet className="h-4 w-4" />
            Bóveda
          </TabsTrigger>
        </TabsList>

        {/* ─── Sessions Tab ─────────────────────────────────────── */}
        <TabsContent value="sessions" className="space-y-6 mt-4">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard
              title="Ingresos Totales"
              icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
              value={kpis ? formatCurrency(kpis.total_revenue) : '$0.00'}
              subtitle={`${kpis?.total_sessions || 0} sesiones`}
            />
            <KpiCard
              title="Efectivo Esperado"
              icon={<Banknote className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
              value={kpis ? formatCurrency(kpis.total_cash_expected) : '$0.00'}
              subtitle="Neto en cajas cerradas"
            />
            <KpiCard
              title="Pagos con Tarjeta"
              icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
              value={kpis ? formatCurrency(kpis.total_card_payments) : '$0.00'}
              subtitle="Débito + Crédito + Transferencia"
            />
            <KpiCard
              title="Índice de Diferencias"
              icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
              value={kpis ? `${kpis.sessions_with_difference}` : '0'}
              subtitle={kpis ? `${formatCurrency(kpis.total_difference_abs)} diferencia total` : '—'}
              highlight={!!kpis && kpis.sessions_with_difference > 0}
            />
          </div>

          {/* Filters Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filtros:
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="open">Abiertas</SelectItem>
                <SelectItem value="closed">Cerradas</SelectItem>
              </SelectContent>
            </Select>
            {isGeneralSelected && branches.length > 1 && (
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="Sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {branches.filter(b => b.is_active).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant={onlyDifferences ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5 h-9"
              onClick={() => setOnlyDifferences(!onlyDifferences)}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Solo con diferencias
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 ml-auto"
              onClick={() => fetchSessions(page)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualizar
            </Button>
          </div>

          {/* Sessions Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sesiones de Caja</CardTitle>
                {!loading && totalCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  No hay sesiones en el periodo seleccionado.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 font-medium text-muted-foreground">Estado</th>
                          <th className="pb-3 font-medium text-muted-foreground">Caja</th>
                          <th className="pb-3 font-medium text-muted-foreground">Cajero</th>
                          {isGeneralSelected && (
                            <th className="pb-3 font-medium text-muted-foreground">Sucursal</th>
                          )}
                          <th className="pb-3 font-medium text-muted-foreground">Apertura</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">Ventas</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">Ingresos</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">Diferencia</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="py-3">
                              <StatusBadge status={s.status} />
                            </td>
                            <td className="py-3 font-medium">{s.cash_register_name || '—'}</td>
                            <td className="py-3">{s.employee_name}</td>
                            {isGeneralSelected && (
                              <td className="py-3 text-muted-foreground">{s.branch_name}</td>
                            )}
                            <td className="py-3 text-muted-foreground">{formatDate(s.opened_at)}</td>
                            <td className="py-3 text-right tabular-nums">{s.total_sales_count}</td>
                            <td className="py-3 text-right font-medium tabular-nums">
                              {formatCurrency(s.total_sales_amount)}
                            </td>
                            <td className="py-3 text-right">
                              <DifferenceBadge difference={s.difference} status={s.status} />
                            </td>
                            <td className="py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 h-8"
                                onClick={() => openDrawer(s)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Ver
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                          let pageNum: number;
                          if (totalPages <= 7) {
                            pageNum = i;
                          } else if (page < 3) {
                            pageNum = i;
                          } else if (page > totalPages - 4) {
                            pageNum = totalPages - 7 + i;
                          } else {
                            pageNum = page - 3 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={pageNum === page ? 'default' : 'outline'}
                              size="sm"
                              className="w-9 h-9 p-0"
                              onClick={() => setPage(pageNum)}
                            >
                              {pageNum + 1}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Vault Tab ────────────────────────────────────────── */}
        <TabsContent value="vault" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Bóveda — Retiros de Valores</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Todos los retiros de efectivo realizados durante el periodo
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchVault}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {vaultLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : vaultData.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  No hay retiros en el periodo seleccionado.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium text-muted-foreground">Fecha</th>
                        <th className="pb-3 font-medium text-muted-foreground">Caja</th>
                        <th className="pb-3 font-medium text-muted-foreground">Empleado</th>
                        {isGeneralSelected && (
                          <th className="pb-3 font-medium text-muted-foreground">Sucursal</th>
                        )}
                        <th className="pb-3 font-medium text-muted-foreground">Descripción</th>
                        <th className="pb-3 font-medium text-muted-foreground text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vaultData.map((w) => (
                        <tr key={w.id} className="border-b last:border-0">
                          <td className="py-3 text-muted-foreground">{formatDate(w.created_at)}</td>
                          <td className="py-3 font-medium">{w.cash_register_name}</td>
                          <td className="py-3">{w.employee_name}</td>
                          {isGeneralSelected && (
                            <td className="py-3 text-muted-foreground">{w.branch_name}</td>
                          )}
                          <td className="py-3 text-muted-foreground">{w.description || 'Retiro de valores'}</td>
                          <td className="py-3 text-right font-semibold text-red-500 tabular-nums">
                            {formatCurrency(w.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Vault total */}
                  <div className="flex items-center justify-end pt-4 border-t mt-4 gap-3">
                    <span className="text-sm text-muted-foreground">Total retirado:</span>
                    <span className="text-lg font-bold tabular-nums">
                      {formatCurrency(vaultData.reduce((sum, w) => sum + w.amount, 0))}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Drill-down Dialog ─────────────────────────────────── */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Detalle de Sesión
            </DialogTitle>
          </DialogHeader>

          {drawerLoading ? (
            <div className="space-y-4 mt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : sessionSummary && selectedSession ? (
            <DrawerContent session={selectedSession} summary={sessionSummary} />
          ) : (
            <p className="text-sm text-muted-foreground mt-2">No se pudo cargar el detalle.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function KpiCard({
  title, icon, loading, value, subtitle, highlight,
}: {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  value: string;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-red-500/30 bg-red-500/5' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <>
            <div className={`text-2xl font-bold ${highlight ? 'text-red-500' : ''}`}>{value}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'open') {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Abierta
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <ShieldCheck className="h-3 w-3" />
      Cerrada
    </Badge>
  );
}

function DifferenceBadge({ difference, status }: { difference: number | null; status: string }) {
  if (status === 'open') {
    return <span className="text-xs text-muted-foreground">En curso</span>;
  }
  if (difference === null || difference === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (difference === 0) {
    return (
      <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 tabular-nums">
        Cuadra
      </Badge>
    );
  }
  if (difference > 0) {
    return (
      <Badge variant="outline" className="gap-0.5 border-blue-500/30 text-blue-500 bg-blue-500/10 tabular-nums">
        <TrendingUp className="h-3 w-3" />
        +{formatCurrency(difference)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-0.5 border-red-500/30 text-red-500 bg-red-500/10 tabular-nums">
      <TrendingDown className="h-3 w-3" />
      {formatCurrency(difference)}
    </Badge>
  );
}

// ─── Drawer Content ──────────────────────────────────────────────

function DrawerContent({ session, summary }: { session: AuditSession; summary: SessionSummary }) {
  return (
    <div className="mt-6 space-y-6">
      {/* Session Info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Caja</p>
          <p className="font-medium">{session.cash_register_name || '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Cajero</p>
          <p className="font-medium">{session.employee_name}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Apertura</p>
          <p className="font-medium">{formatDate(session.opened_at)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Cierre</p>
          <p className="font-medium">{session.closed_at ? formatDate(session.closed_at) : 'En curso'}</p>
        </div>
        {session.closed_by_name && (
          <div className="col-span-2">
            <p className="text-muted-foreground text-xs">Cerrado por</p>
            <p className="font-medium">{session.closed_by_name}</p>
          </div>
        )}
      </div>

      {/* Z-Report (Cash Flow) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Receipt className="h-4 w-4" />
            Corte Z — Flujo de Efectivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <FlowRow label="Fondo de apertura" amount={summary.opening_amount} />
          <FlowRow label="+ Ventas en efectivo" amount={summary.total_cash_sales} positive />
          <FlowRow label="+ Entradas de efectivo" amount={summary.total_cash_in} positive />
          <FlowRow label="− Retiros de valores" amount={summary.total_cash_out} negative />
          <FlowRow label="− Reembolsos" amount={summary.total_refunds} negative />
          <div className="border-t pt-2 mt-2">
            <FlowRow label="= Efectivo esperado" amount={summary.expected_cash} bold />
          </div>
          {summary.declared_amount !== null && (
            <>
              <FlowRow label="Declarado por cajero" amount={summary.declared_amount} />
              <div className="border-t pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Diferencia</span>
                  <DifferenceBadge difference={summary.difference} status={session.status} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods Breakdown */}
      {summary.payment_methods.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <CreditCard className="h-4 w-4" />
              Métodos de Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {summary.payment_methods.map((pm) => (
              <div key={pm.method} className="flex items-center justify-between">
                <span className="text-muted-foreground">{pm.method} ({pm.count})</span>
                <span className="font-medium tabular-nums">{formatCurrency(pm.total)}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex items-center justify-between font-semibold">
              <span>Total ventas</span>
              <span className="tabular-nums">
                {formatCurrency(summary.total_sales_amount)} ({summary.total_sales_count})
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audits (Corte X) performed during session */}
      {summary.audits.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Arqueos Realizados (Corte X)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {summary.audits.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b last:border-0">
                <div>
                  <p className="text-muted-foreground text-xs">{formatDate(a.time)}</p>
                  <p>Declarado: {formatCurrency(a.declared)} / Esperado: {formatCurrency(a.expected)}</p>
                </div>
                <DifferenceBadge difference={a.difference} status="closed" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Timeline of Transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Línea de Tiempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.transactions.length === 0 ? (
            <p className="text-muted-foreground text-xs py-3 text-center">Sin movimientos</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {summary.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-1.5 text-xs border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <TxIcon type={tx.type} />
                    <div>
                      <span className={`font-medium ${TX_TYPE_COLORS[tx.type] || ''}`}>
                        {TX_TYPE_LABELS[tx.type] || tx.type}
                      </span>
                      {tx.description && (
                        <p className="text-muted-foreground truncate max-w-[180px]">{tx.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">{formatCurrency(tx.amount)}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {new Date(tx.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FlowRow({
  label, amount, positive, negative, bold,
}: {
  label: string;
  amount: number;
  positive?: boolean;
  negative?: boolean;
  bold?: boolean;
}) {
  const color = positive ? 'text-emerald-500' : negative ? 'text-red-500' : '';
  return (
    <div className="flex items-center justify-between">
      <span className={`${bold ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold text-base' : 'font-medium'} ${color}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function TxIcon({ type }: { type: string }) {
  const cls = 'h-3.5 w-3.5';
  switch (type) {
    case 'sale_cash': return <DollarSign className={`${cls} text-emerald-400`} />;
    case 'cash_in': return <ArrowDownToLine className={`${cls} text-blue-400`} />;
    case 'cash_out': return <ArrowUpFromLine className={`${cls} text-red-400`} />;
    case 'refund': return <RefreshCw className={`${cls} text-orange-400`} />;
    case 'audit': return <Calculator className={`${cls} text-cyan-400`} />;
    default: return <DollarSign className={`${cls} text-muted-foreground`} />;
  }
}
