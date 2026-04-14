'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@nivo/ui';
import {
  DollarSign, TrendingUp, ArrowUpDown, Package, BarChart3, ChevronLeft, ChevronRight,
  Filter, Download,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getThisMonthRange, formatCurrency } from '@/lib/date-utils';

// ─── Types ────────────────────────────────────────────────────────

interface ProfitRow {
  group_id: string;
  group_name: string;
  sale_count: number;
  units_sold: number;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
}

interface PaginatedResult {
  items: ProfitRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

type GroupBy = 'brand' | 'collection' | 'seller';

const GROUP_LABELS: Record<GroupBy, string> = {
  brand: 'Marca',
  collection: 'Coleccion',
  seller: 'Vendedor',
};

// ─── Date presets ─────────────────────────────────────────────────

function getPresetRange(preset: string): { start_date: string; end_date: string } {
  const now = new Date();
  switch (preset) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start_date: start.toISOString(), end_date: end.toISOString() };
    }
    case 'week': {
      const d = new Date(now);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      return { start_date: start.toISOString(), end_date: end.toISOString() };
    }
    case 'month':
      return getThisMonthRange();
    case 'quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      return { start_date: start.toISOString(), end_date: end.toISOString() };
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      return { start_date: start.toISOString(), end_date: end.toISOString() };
    }
    default:
      return getThisMonthRange();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════

export default function ProfitabilityPage() {
  const { isGeneralSelected, selectedBranchId } = useBranchStore();
  const branchId = isGeneralSelected ? undefined : selectedBranchId;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaginatedResult | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('brand');
  const [period, setPeriod] = useState('month');
  const [page, setPage] = useState(1);

  // Aggregated totals
  const [totals, setTotals] = useState({ revenue: 0, cogs: 0, profit: 0, margin: 0, units: 0, sales: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const range = getPresetRange(period);
      const params = new URLSearchParams({
        group_by: groupBy,
        start_date: range.start_date,
        end_date: range.end_date,
        page: String(page),
        limit: '20',
      });
      if (branchId) params.set('branch_id', branchId);

      const res = await apiClient.get(`/dashboard/profitability-report?${params}`);
      const result: PaginatedResult = res.data;
      setData(result);

      // Calculate page totals
      const rev = result.items.reduce((s, r) => s + r.revenue, 0);
      const cogs = result.items.reduce((s, r) => s + r.cogs, 0);
      const profit = rev - cogs;
      setTotals({
        revenue: rev,
        cogs,
        profit,
        margin: rev > 0 ? Math.round((profit / rev) * 1000) / 10 : 0,
        units: result.items.reduce((s, r) => s + r.units_sold, 0),
        sales: result.items.reduce((s, r) => s + r.sale_count, 0),
      });
    } catch (error) {
      console.error('Profitability report failed:', error);
    } finally {
      setLoading(false);
    }
  }, [groupBy, period, page, branchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [groupBy, period, branchId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Rentabilidad</h2>
        <p className="text-muted-foreground">Analisis de utilidad agrupado por {GROUP_LABELS[groupBy].toLowerCase()}</p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Agrupar por:</span>
        </div>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="brand">Marca</SelectItem>
            <SelectItem value="collection">Coleccion</SelectItem>
            <SelectItem value="seller">Vendedor</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm text-muted-foreground">Periodo:</span>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="year">Este ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          loading={loading}
          label="Ingreso Total"
          value={formatCurrency(totals.revenue)}
          icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
        />
        <SummaryCard
          loading={loading}
          label="Utilidad Bruta"
          value={formatCurrency(totals.profit)}
          icon={<TrendingUp className="h-4 w-4 text-blue-400" />}
        />
        <SummaryCard
          loading={loading}
          label="Margen Promedio"
          value={`${totals.margin}%`}
          icon={<BarChart3 className="h-4 w-4 text-violet-400" />}
        />
        <SummaryCard
          loading={loading}
          label="Unidades Vendidas"
          value={totals.units.toLocaleString('es-MX')}
          icon={<Package className="h-4 w-4 text-amber-400" />}
        />
      </div>

      {/* Data table */}
      <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sin datos de rentabilidad para este periodo</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left">
                      <th className="px-6 py-4 font-medium text-muted-foreground">{GROUP_LABELS[groupBy]}</th>
                      <th className="px-4 py-4 font-medium text-muted-foreground text-right">Ventas</th>
                      <th className="px-4 py-4 font-medium text-muted-foreground text-right">Unidades</th>
                      <th className="px-4 py-4 font-medium text-muted-foreground text-right">Ingreso</th>
                      <th className="px-4 py-4 font-medium text-muted-foreground text-right">Costo</th>
                      <th className="px-4 py-4 font-medium text-muted-foreground text-right">Utilidad</th>
                      <th className="px-4 py-4 font-medium text-muted-foreground text-right">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => {
                      const marginColor = row.margin >= 40 ? 'text-emerald-400'
                        : row.margin >= 20 ? 'text-blue-400'
                        : row.margin >= 0 ? 'text-amber-400'
                        : 'text-red-400';

                      return (
                        <tr key={row.group_id || row.group_name} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-3.5 font-medium">{row.group_name}</td>
                          <td className="px-4 py-3.5 text-right text-muted-foreground">{row.sale_count}</td>
                          <td className="px-4 py-3.5 text-right text-muted-foreground">{row.units_sold}</td>
                          <td className="px-4 py-3.5 text-right">{formatCurrency(row.revenue)}</td>
                          <td className="px-4 py-3.5 text-right text-muted-foreground">{formatCurrency(row.cogs)}</td>
                          <td className="px-4 py-3.5 text-right font-semibold text-emerald-400">{formatCurrency(row.profit)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <Badge variant="outline" className={`text-xs ${marginColor} border-current/30`}>
                              {row.margin}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Footer totals */}
                  <tfoot>
                    <tr className="border-t border-white/10 bg-white/[0.02]">
                      <td className="px-6 py-3.5 font-bold">Total</td>
                      <td className="px-4 py-3.5 text-right font-medium">{totals.sales}</td>
                      <td className="px-4 py-3.5 text-right font-medium">{totals.units}</td>
                      <td className="px-4 py-3.5 text-right font-bold">{formatCurrency(totals.revenue)}</td>
                      <td className="px-4 py-3.5 text-right font-medium">{formatCurrency(totals.cogs)}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-400">{formatCurrency(totals.profit)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">
                          {totals.margin}%
                        </Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination */}
              {data.pages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
                  <span className="text-sm text-muted-foreground">
                    Pagina {data.page} de {data.pages} ({data.total} resultados)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                      disabled={page >= data.pages}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────

function SummaryCard({ loading, label, value, icon }: {
  loading: boolean;
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950/60 backdrop-blur-md p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      {loading ? <Skeleton className="h-7 w-24" /> : (
        <p className="text-xl font-bold">{value}</p>
      )}
    </div>
  );
}
