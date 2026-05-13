'use client';

import { useEffect, useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Skeleton,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Input,
} from '@nivo/ui';
import { TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getThisMonthRange, formatCurrency } from '@/lib/date-utils';
import { ExportButton } from '@/components/reports/ExportButton';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────

function marginColor(margin: number) {
  if (margin >= 40) return '#10b981';
  if (margin >= 20) return '#f59e0b';
  return '#ef4444';
}

function MarginLight({ margin }: { margin: number }) {
  const color = margin >= 40 ? 'bg-emerald-500' : margin >= 20 ? 'bg-amber-500' : 'bg-red-500';
  const label = margin >= 40 ? 'Alto' : margin >= 20 ? 'Medio' : 'Bajo';
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${color}`} />
      <span className="text-xs">{margin}%</span>
      <span className="text-[10px] text-muted-foreground">({label})</span>
    </div>
  );
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ProfitRow;
  if (!d) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/90 p-3 shadow-lg text-sm min-w-[160px]">
      <p className="font-medium text-zinc-200 mb-1.5">{d.group_name}</p>
      <div className="space-y-0.5 text-xs text-zinc-400">
        <p>Unidades: <span className="text-zinc-200">{d.units_sold}</span></p>
        <p>Margen: <span style={{ color: marginColor(d.margin) }}>{d.margin}%</span></p>
        <p>Utilidad: <span className="text-zinc-200">{formatCurrency(d.profit)}</span></p>
        <p>Ingreso: <span className="text-zinc-200">{formatCurrency(d.revenue)}</span></p>
      </div>
    </div>
  );
}

// ─── Quadrant labels ─────────────────────────────────────────────

function QuadrantLabel({ x, y, text, sub }: { x: string; y: string; text: string; sub: string }) {
  return (
    <div className={`absolute ${y === 'top' ? 'top-2' : 'bottom-2'} ${x === 'right' ? 'right-3' : 'left-3'} text-right`}
      style={{ textAlign: x === 'right' ? 'right' : 'left' }}>
      <p className="text-[10px] font-semibold text-zinc-500">{text}</p>
      <p className="text-[9px] text-zinc-600">{sub}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════

export default function ProfitabilityReportPage() {
  const { isGeneralSelected, selectedBranchId } = useBranchStore();
  const branchId = isGeneralSelected ? undefined : selectedBranchId ?? undefined;

  const defaultRange = getThisMonthRange();
  const [startDate, setStartDate] = useState(defaultRange.start_date);
  const [endDate, setEndDate] = useState(defaultRange.end_date);
  const [groupBy, setGroupBy] = useState<'brand' | 'collection' | 'seller'>('brand');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfitRow[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start_date: startDate,
          end_date: endDate,
          group_by: groupBy,
          limit: '100',
        });
        if (branchId) params.set('branch_id', branchId);
        const res = await apiClient.get(`/dashboard/profitability-report?${params}`);
        setData(res.data.items ?? []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [startDate, endDate, groupBy, branchId]);

  const avgUnits = data.length > 0 ? data.reduce((s, d) => s + d.units_sold, 0) / data.length : 0;
  const avgMargin = data.length > 0 ? data.reduce((s, d) => s + d.margin, 0) / data.length : 0;

  const GROUP_LABEL: Record<string, string> = { brand: 'Marca', collection: 'Colección', seller: 'Vendedor' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Rentabilidad</h2>
          <p className="text-muted-foreground">Eficiencia de margen por {GROUP_LABEL[groupBy].toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="brand">Por Marca</SelectItem>
              <SelectItem value="collection">Por Colección</SelectItem>
              <SelectItem value="seller">Por Vendedor</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 text-sm" />
          <span className="text-muted-foreground text-sm">—</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 text-sm" />
          <ExportButton
            reportType="profitability"
            filters={{ start_date: startDate, end_date: endDate, branch_id: branchId }}
          />
        </div>
      </div>

      {/* Scatter Plot */}
      <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Dispersión: Volumen vs Margen</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Eje X = unidades vendidas · Eje Y = margen de utilidad. Las líneas punteadas muestran el promedio del periodo.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-80 w-full" /> : data.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">Sin datos en el periodo</div>
          ) : (
            <div className="relative">
              {/* Quadrant labels */}
              <QuadrantLabel x="right" y="top" text="Estrellas" sub="Alto volumen · alto margen" />
              <QuadrantLabel x="left" y="top" text="Nicho premium" sub="Poco volumen · alto margen" />
              <QuadrantLabel x="right" y="bottom" text="Volumen bajo" sub="Alto volumen · margen estrecho" />
              <QuadrantLabel x="left" y="bottom" text="Liquidar" sub="Poco volumen · poco margen" />

              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 20, right: 30, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" dataKey="units_sold" name="Unidades" tick={{ fill: '#71717a', fontSize: 11 }}
                    label={{ value: 'Unidades vendidas', position: 'insideBottomRight', offset: -10, fill: '#52525b', fontSize: 11 }} />
                  <YAxis type="number" dataKey="margin" name="Margen" unit="%" tick={{ fill: '#71717a', fontSize: 11 }}
                    label={{ value: 'Margen %', angle: -90, position: 'insideLeft', fill: '#52525b', fontSize: 11 }} />
                  <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <ReferenceLine x={avgUnits} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                  <ReferenceLine y={avgMargin} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                  <Scatter data={data} name={GROUP_LABEL[groupBy]}>
                    {data.map((d, i) => (
                      <Cell key={i} fill={marginColor(d.margin)} fillOpacity={0.8} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-2 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Margen &gt; 40%</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />20% – 40%</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Margen &lt; 20%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Tabla de Rentabilidad por {GROUP_LABEL[groupBy]}</CardTitle>
            {data.length > 0 && (
              <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Margen &gt; 40%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 20–40%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> &lt; 20%</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">{GROUP_LABEL[groupBy]}</th>
                    <th className="text-right py-2 pr-4">Ventas</th>
                    <th className="text-right py-2 pr-4">Unidades</th>
                    <th className="text-right py-2 pr-4">Ingreso</th>
                    <th className="text-right py-2 pr-4">Costo</th>
                    <th className="text-right py-2 pr-4">Utilidad</th>
                    <th className="text-right py-2">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Sin datos</td></tr>
                  ) : data.map((row) => (
                    <tr key={row.group_id ?? row.group_name} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 pr-4 font-medium">{row.group_name}</td>
                      <td className="py-2.5 pr-4 text-right text-zinc-400">{row.sale_count}</td>
                      <td className="py-2.5 pr-4 text-right text-zinc-400">{row.units_sold}</td>
                      <td className="py-2.5 pr-4 text-right">{formatCurrency(row.revenue)}</td>
                      <td className="py-2.5 pr-4 text-right text-zinc-400">{formatCurrency(row.cogs)}</td>
                      <td className="py-2.5 pr-4 text-right text-emerald-400 font-semibold">{formatCurrency(row.profit)}</td>
                      <td className="py-2.5 text-right"><MarginLight margin={row.margin} /></td>
                    </tr>
                  ))}
                </tbody>
                {data.length > 0 && (() => {
                  const totRev = data.reduce((s, d) => s + d.revenue, 0);
                  const totCogs = data.reduce((s, d) => s + d.cogs, 0);
                  const totProfit = totRev - totCogs;
                  const totMargin = totRev > 0 ? Math.round((totProfit / totRev) * 1000) / 10 : 0;
                  return (
                    <tfoot>
                      <tr className="border-t border-white/10 text-sm font-semibold">
                        <td className="pt-3 pr-4">Total</td>
                        <td className="pt-3 pr-4 text-right text-zinc-400">{data.reduce((s, d) => s + d.sale_count, 0)}</td>
                        <td className="pt-3 pr-4 text-right text-zinc-400">{data.reduce((s, d) => s + d.units_sold, 0)}</td>
                        <td className="pt-3 pr-4 text-right">{formatCurrency(totRev)}</td>
                        <td className="pt-3 pr-4 text-right text-zinc-400">{formatCurrency(totCogs)}</td>
                        <td className="pt-3 pr-4 text-right text-emerald-400">{formatCurrency(totProfit)}</td>
                        <td className="pt-3 text-right"><MarginLight margin={totMargin} /></td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insight callout */}
      {!loading && data.length > 0 && (() => {
        const lowMargin = data.filter((d) => d.margin < 20 && d.units_sold > 0);
        if (!lowMargin.length) return null;
        return (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-400">Atención: {lowMargin.length} {GROUP_LABEL[groupBy].toLowerCase()}{lowMargin.length > 1 ? 's' : ''} con margen menor al 20%</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {lowMargin.slice(0, 3).map((d) => d.group_name).join(', ')}{lowMargin.length > 3 ? ` y ${lowMargin.length - 3} más` : ''}
                . Considera revisar precios o renegociar costos con proveedor.
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
