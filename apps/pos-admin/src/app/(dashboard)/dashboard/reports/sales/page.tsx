'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Skeleton,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Input,
} from '@nivo/ui';
import { CreditCard, BarChart3, Search, TrendingUp, ShoppingCart, Receipt } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { ExportButton } from '@/components/reports/ExportButton';
import { useBranchStore } from '@/store/branchStore';
import { getThisMonthRange, formatCurrency } from '@/lib/date-utils';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────

interface PaymentPoint { method: string; label: string; count: number; total: number; }
interface DowPoint { dow: number; day_name: string; count: number; }
interface SaleRow {
  id: string;
  created_at: string;
  total_amount: number;
  payment_method: string;
  employee?: { name: string } | null;
  customer?: { name: string } | null;
  branch?: { name: string } | null;
  items?: { id: string }[];
}
interface Summary { total_sales: number; total_revenue: number; avg_ticket: number; }

// ─── Constants ────────────────────────────────────────────────────

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#10b981', card: '#3b82f6', mixed: '#f59e0b', online: '#8b5cf6',
};
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', mixed: 'Mixto', online: 'En línea',
};
const DOW_COLORS = ['#94a3b8', '#10b981', '#3b82f6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'];

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ─── Custom Tooltips ─────────────────────────────────────────────

function PaymentTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/90 p-3 shadow-lg text-sm">
      <p className="font-medium text-zinc-200">{d.name}</p>
      <p className="text-zinc-400">{formatCurrency(d.value)}</p>
    </div>
  );
}

function DowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/90 p-3 shadow-lg text-sm">
      <p className="font-medium text-zinc-200">{label}</p>
      <p className="text-zinc-400">{payload[0].value} tickets</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════

export default function SalesReportPage() {
  const { isGeneralSelected, selectedBranchId } = useBranchStore();
  const branchId = isGeneralSelected ? undefined : selectedBranchId ?? undefined;

  // Date range
  const defaultRange = getThisMonthRange();
  const [startDate, setStartDate] = useState(defaultRange.start_date);
  const [endDate, setEndDate] = useState(defaultRange.end_date);

  // Data
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentPoint[]>([]);
  const [dowData, setDowData] = useState<DowPoint[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPayment, setFilterPayment] = useState('all');

  const fetchCharts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (branchId) params.set('branch_id', branchId);

      const [summRes, pmRes, dowRes] = await Promise.all([
        apiClient.get(`/reports/summary?${params}`),
        apiClient.get(`/reports/payment-breakdown?${params}`),
        apiClient.get(`/reports/day-of-week-volume?${params}`),
      ]);
      setSummary(summRes.data);
      setPaymentData(pmRes.data);
      setDowData(dowRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchTable = async (p = 0) => {
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate, limit: '25', offset: String(p * 25) });
      if (branchId) params.set('branch_id', branchId);
      const res = await apiClient.get(`/reports/sales?${params}`);
      setSales(res.data.data);
      setTotal(res.data.total);
      setPage(p);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchCharts(); fetchTable(0); }, [startDate, endDate, branchId]);

  const filtered = useMemo(() => sales.filter((s) => {
    if (filterPayment !== 'all' && s.payment_method !== filterPayment) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.employee?.name.toLowerCase().includes(q) ||
        s.customer?.name?.toLowerCase().includes(q) ||
        false
      );
    }
    return true;
  }), [sales, filterPayment, searchQuery]);

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reporte de Ventas</h2>
          <p className="text-muted-foreground">Volumen y métodos de pago del periodo</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 text-sm" />
          <span className="text-muted-foreground text-sm">—</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 text-sm" />
          <ExportButton
            reportType="sales"
            filters={{ start_date: startDate, end_date: endDate, branch_id: branchId }}
          />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: <Receipt className="h-5 w-5" />, label: 'Total Tickets', value: loading ? '—' : String(summary?.total_sales ?? 0), accent: 'from-blue-500/20 to-blue-500/5', ic: 'text-blue-400' },
          { icon: <TrendingUp className="h-5 w-5" />, label: 'Ingreso Total', value: loading ? '—' : formatCurrency(summary?.total_revenue ?? 0), accent: 'from-emerald-500/20 to-emerald-500/5', ic: 'text-emerald-400' },
          { icon: <ShoppingCart className="h-5 w-5" />, label: 'Ticket Promedio', value: loading ? '—' : formatCurrency(summary?.avg_ticket ?? 0), accent: 'from-violet-500/20 to-violet-500/5', ic: 'text-violet-400' },
        ].map((kpi) => (
          <div key={kpi.label} className={`relative overflow-hidden rounded-xl border border-white/5 bg-zinc-950/60 p-5`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.accent} pointer-events-none`} />
            <div className="relative flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{kpi.label}</span>
              <span className={kpi.ic}>{kpi.icon}</span>
            </div>
            {loading ? <Skeleton className="h-8 w-28" /> : <p className="relative text-2xl font-bold">{kpi.value}</p>}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Payment method donut */}
        <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Distribución por Método de Pago</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-56 w-full" /> : paymentData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={paymentData} dataKey="total" nameKey="label" cx="50%" cy="45%"
                      innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {paymentData.map((d) => (
                        <Cell key={d.method} fill={PAYMENT_COLORS[d.method] ?? '#71717a'} />
                      ))}
                    </Pie>
                    <Tooltip content={<PaymentTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-zinc-400">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Summary row */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {paymentData.map((d) => (
                    <div key={d.method} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[d.method] ?? '#71717a' }} />
                        <span className="text-xs text-zinc-400">{d.label}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold">{d.count} tickets</p>
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(d.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Day of week bar */}
        <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Volumen por Día de la Semana</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : (
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={dowData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day_name" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<DowTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="count" name="Tickets" radius={[4, 4, 0, 0]}>
                    {dowData.map((d, i) => <Cell key={i} fill={DOW_COLORS[d.dow % DOW_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Detalle de Ventas</CardTitle>
              <Badge variant="outline" className="text-xs">{total}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Vendedor o cliente…" className="pl-8 w-48 h-8 text-sm"
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Método" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="mixed">Mixto</SelectItem>
                  <SelectItem value="online">En línea</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Fecha</th>
                  <th className="text-left py-2 pr-4">Hora</th>
                  <th className="text-left py-2 pr-4">Vendedor</th>
                  <th className="text-left py-2 pr-4">Cliente</th>
                  <th className="text-left py-2 pr-4">Método</th>
                  <th className="text-left py-2 pr-4">Artículos</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="py-2"><Skeleton className="h-8 w-full" /></td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 pr-4 text-zinc-300">{formatDate(s.created_at)}</td>
                      <td className="py-2.5 pr-4 text-zinc-400">{formatTime(s.created_at)}</td>
                      <td className="py-2.5 pr-4">{s.employee?.name ?? '—'}</td>
                      <td className="py-2.5 pr-4 text-zinc-400">{s.customer?.name ?? 'Sin cliente'}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="outline" className="text-[10px]"
                          style={{ borderColor: PAYMENT_COLORS[s.payment_method] + '40', color: PAYMENT_COLORS[s.payment_method] }}>
                          {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-400">{s.items?.length ?? '—'} pzas</td>
                      <td className="py-2.5 text-right font-semibold">{formatCurrency(s.total_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
              <span>Página {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 0}
                  onClick={() => fetchTable(page - 1)}
                  className="px-3 py-1.5 rounded-md border border-white/10 disabled:opacity-40 hover:bg-white/[0.05] transition-colors">
                  Anterior
                </button>
                <button disabled={page >= totalPages - 1}
                  onClick={() => fetchTable(page + 1)}
                  className="px-3 py-1.5 rounded-md border border-white/10 disabled:opacity-40 hover:bg-white/[0.05] transition-colors">
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
