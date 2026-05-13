'use client';

import { useEffect, useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Input,
} from '@nivo/ui';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, ClipboardList } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getThisMonthRange, formatCurrency } from '@/lib/date-utils';
import { ExportButton } from '@/components/reports/ExportButton';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Cell,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────

interface DifferencePoint {
  date: string;
  difference: number;
  session_count: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function DiffTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DifferencePoint;
  const isPos = d.difference >= 0;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/90 p-3 shadow-lg text-sm">
      <p className="font-medium text-zinc-300 mb-1">{formatShortDate(label)}</p>
      <p className={`font-semibold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPos ? '+' : ''}{formatCurrency(d.difference)}
      </p>
      <p className="text-xs text-zinc-500">{d.session_count} corte{d.session_count !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════

export default function AuditsReportPage() {
  const { isGeneralSelected, selectedBranchId } = useBranchStore();
  const branchId = isGeneralSelected ? undefined : selectedBranchId ?? undefined;

  const defaultRange = getThisMonthRange();
  const [startDate, setStartDate] = useState(defaultRange.start_date);
  const [endDate, setEndDate] = useState(defaultRange.end_date);

  const [loading, setLoading] = useState(true);
  const [diffData, setDiffData] = useState<DifferencePoint[]>([]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        if (branchId) params.set('branch_id', branchId);
        const res = await apiClient.get(`/reports/cash-difference-trend?${params}`);
        setDiffData(res.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [startDate, endDate, branchId]);

  // Summary stats
  const totalSurplus  = diffData.filter((d) => d.difference > 0).reduce((s, d) => s + d.difference, 0);
  const totalDeficit  = diffData.filter((d) => d.difference < 0).reduce((s, d) => s + d.difference, 0);
  const netDifference = diffData.reduce((s, d) => s + d.difference, 0);
  const sessionCount  = diffData.reduce((s, d) => s + d.session_count, 0);
  const daysWithDeficit = diffData.filter((d) => d.difference < 0).length;

  const maxAbs = Math.max(...diffData.map((d) => Math.abs(d.difference)), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Arqueos y Cortes de Caja</h2>
          <p className="text-muted-foreground">Tendencia de diferencias en cierres de caja del periodo</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 text-sm" />
          <span className="text-muted-foreground text-sm">—</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 text-sm" />
          <ExportButton
            reportType="audits"
            filters={{ start_date: startDate, end_date: endDate, branch_id: branchId }}
          />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Diferencia Neta', value: loading ? '—' : formatCurrency(netDifference), icon: <DollarSign className="h-5 w-5" />, accent: netDifference >= 0 ? 'from-emerald-500/20 to-emerald-500/5' : 'from-red-500/20 to-red-500/5', ic: netDifference >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Total Sobrantes', value: loading ? '—' : formatCurrency(totalSurplus), icon: <TrendingUp className="h-5 w-5" />, accent: 'from-emerald-500/20 to-emerald-500/5', ic: 'text-emerald-400' },
          { label: 'Total Faltantes', value: loading ? '—' : formatCurrency(Math.abs(totalDeficit)), icon: <TrendingDown className="h-5 w-5" />, accent: 'from-red-500/20 to-red-500/5', ic: 'text-red-400' },
          { label: 'Cortes Analizados', value: loading ? '—' : String(sessionCount), icon: <ClipboardList className="h-5 w-5" />, accent: 'from-blue-500/20 to-blue-500/5', ic: 'text-blue-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-950/60 p-5">
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.accent} pointer-events-none`} />
            <div className="relative flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{kpi.label}</span>
              <span className={kpi.ic}>{kpi.icon}</span>
            </div>
            {loading ? <Skeleton className="h-8 w-28" /> : <p className="relative text-2xl font-bold">{kpi.value}</p>}
          </div>
        ))}
      </div>

      {/* Alert if systemic deficits */}
      {!loading && daysWithDeficit >= 3 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-red-400">Alerta: {daysWithDeficit} días con faltante de caja detectados</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Un patrón sistemático de faltantes puede indicar un problema operativo o de control interno. Revisa los cortes individuales para identificar al cajero o turno involucrado.
            </p>
          </div>
        </div>
      )}

      {/* Difference trend chart */}
      <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Tendencia de Diferencias de Caja</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Barras verdes = dinero sobrante en el corte. Barras rojas = faltante. La línea en $0 es el punto de equilibrio perfecto.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-72 w-full" /> : diffData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
              Sin cortes de caja registrados en el periodo
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={diffData} barSize={diffData.length > 20 ? 8 : 18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v) => `$${Math.abs(v / 1000).toFixed(0)}k`}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  domain={[-maxAbs * 1.2, maxAbs * 1.2]}
                />
                <Tooltip content={<DiffTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
                <Bar dataKey="difference" name="Diferencia" radius={[3, 3, 0, 0]}>
                  {diffData.map((d, i) => (
                    <Cell key={i} fill={d.difference >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Day-level breakdown table */}
      {!loading && diffData.length > 0 && (
        <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base">Detalle por Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">Fecha</th>
                    <th className="text-right py-2 pr-4">Cortes</th>
                    <th className="text-right py-2 pr-4">Diferencia</th>
                    <th className="text-right py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {[...diffData].reverse().map((d) => {
                    const isPos = d.difference >= 0;
                    const isZero = d.difference === 0;
                    return (
                      <tr key={d.date} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 pr-4 text-zinc-300">{formatShortDate(d.date)}</td>
                        <td className="py-2.5 pr-4 text-right text-zinc-400">{d.session_count}</td>
                        <td className={`py-2.5 pr-4 text-right font-semibold ${isZero ? 'text-zinc-400' : isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPos && !isZero ? '+' : ''}{formatCurrency(d.difference)}
                        </td>
                        <td className="py-2.5 text-right">
                          <Badge variant="outline" className={`text-[10px] ${
                            isZero ? 'border-zinc-500/30 text-zinc-400' :
                            isPos ? 'border-emerald-500/30 text-emerald-400' :
                            'border-red-500/30 text-red-400'
                          }`}>
                            {isZero ? 'Exacto' : isPos ? 'Sobrante' : 'Faltante'}
                          </Badge>
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
