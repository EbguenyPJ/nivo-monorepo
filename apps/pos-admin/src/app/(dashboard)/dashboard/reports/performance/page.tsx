'use client';

import { useEffect, useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Input,
} from '@nivo/ui';
import { Users, TrendingUp, ShoppingBag, Package } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getThisMonthRange, formatCurrency } from '@/lib/date-utils';
import { ExportButton } from '@/components/reports/ExportButton';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────

interface SellerRow {
  employee_id: string;
  employee_name: string;
  sale_count: number;
  revenue: number;
  avg_ticket: number;
  upt: number;
  units_sold: number;
}

interface SellThroughRow {
  branch_id: string;
  branch_name: string;
  sold_units: number;
  stock_units: number;
  rate: number;
}

// ─── Gauge Component (SVG arc) ────────────────────────────────────

function GaugeChart({ rate, label }: { rate: number; label: string }) {
  const r = 52;
  const cx = 70;
  const cy = 70;
  const startAngle = Math.PI;
  const endAngle = 0;
  const pct = Math.min(rate / 100, 1);

  const polarToCartesian = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  });

  const start = polarToCartesian(startAngle);
  const trackEnd = polarToCartesian(endAngle);
  const fillEnd = polarToCartesian(startAngle + pct * Math.PI);

  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${trackEnd.x} ${trackEnd.y}`;
  const fillPath  = pct > 0
    ? `M ${start.x} ${start.y} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${fillEnd.x} ${fillEnd.y}`
    : '';

  const color = rate >= 60 ? '#10b981' : rate >= 30 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={82} viewBox="0 0 140 82">
        {/* Track */}
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} strokeLinecap="round" />
        {/* Fill */}
        {fillPath && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
        )}
        {/* Value text */}
        <text x={cx} y={cy - 2} textAnchor="middle" fill="white" fontSize={18} fontWeight="700">
          {rate}%
        </text>
        {/* Min / Max */}
        <text x={start.x} y={cy + 18} textAnchor="middle" fill="#52525b" fontSize={10}>0%</text>
        <text x={trackEnd.x} y={cy + 18} textAnchor="middle" fill="#52525b" fontSize={10}>100%</text>
      </svg>
      <p className="text-sm font-medium text-center mt-1 leading-tight">{label}</p>
      <p className="text-[11px] text-muted-foreground text-center">Sell-Through</p>
    </div>
  );
}

// ─── Custom Tooltips ─────────────────────────────────────────────

function SellerTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as SellerRow;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/90 p-3 shadow-lg text-sm min-w-[160px]">
      <p className="font-medium text-zinc-200 mb-1.5">{d.employee_name}</p>
      <div className="space-y-0.5 text-xs text-zinc-400">
        <p>Ventas: <span className="text-zinc-200">{d.sale_count}</span></p>
        <p>Ingreso: <span className="text-zinc-200">{formatCurrency(d.revenue)}</span></p>
        <p>Ticket prom.: <span className="text-zinc-200">{formatCurrency(d.avg_ticket)}</span></p>
        <p>UPT: <span className="text-zinc-200">{d.upt}</span></p>
      </div>
    </div>
  );
}

// ─── Metric pill ─────────────────────────────────────────────────

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-zinc-500">{label}:</span>
      <span style={{ color }} className="font-semibold">{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════

export default function PerformancePage() {
  const { isGeneralSelected, selectedBranchId } = useBranchStore();
  const branchId = isGeneralSelected ? undefined : selectedBranchId ?? undefined;

  const defaultRange = getThisMonthRange();
  const [startDate, setStartDate] = useState(defaultRange.start_date);
  const [endDate, setEndDate] = useState(defaultRange.end_date);

  const [loadingSellers, setLoadingSellers] = useState(true);
  const [loadingST, setLoadingST] = useState(true);
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [sellThrough, setSellThrough] = useState<SellThroughRow[]>([]);

  useEffect(() => {
    const fetchSellers = async () => {
      setLoadingSellers(true);
      try {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        if (branchId) params.set('branch_id', branchId);
        const res = await apiClient.get(`/reports/seller-performance?${params}`);
        setSellers(res.data);
      } catch (e) { console.error(e); }
      finally { setLoadingSellers(false); }
    };
    const fetchST = async () => {
      setLoadingST(true);
      try {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        const res = await apiClient.get(`/reports/sell-through?${params}`);
        setSellThrough(res.data);
      } catch (e) { console.error(e); }
      finally { setLoadingST(false); }
    };
    fetchSellers();
    fetchST();
  }, [startDate, endDate, branchId]);

  const maxRevenue = sellers[0]?.revenue || 1;
  const SELLER_COLORS = ['#10b981', '#3b82f6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Rendimiento</h2>
          <p className="text-muted-foreground">Eficiencia del equipo de ventas y rotación de inventario</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 text-sm" />
          <span className="text-muted-foreground text-sm">—</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 text-sm" />
          <ExportButton
            reportType="performance"
            filters={{ start_date: startDate, end_date: endDate, branch_id: branchId }}
          />
        </div>
      </div>

      {/* Section A: Seller Leaderboard */}
      <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Leaderboard de Vendedores</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            UPT = Unidades por Ticket (artículos promedio por venta). Un UPT alto indica mejor venta cruzada.
          </p>
        </CardHeader>
        <CardContent>
          {loadingSellers ? <Skeleton className="h-72 w-full" /> : sellers.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">Sin datos de ventas en el periodo</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Horizontal bar chart */}
              <ResponsiveContainer width="100%" height={Math.max(sellers.length * 44, 180)}>
                <BarChart data={sellers} layout="vertical" barSize={22} margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis type="category" dataKey="employee_name" width={90} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                  <Tooltip content={<SellerTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="revenue" name="Ingreso" radius={[0, 4, 4, 0]}>
                    {sellers.map((_, i) => <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Metric table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-3">Vendedor</th>
                      <th className="text-right py-2 pr-3">Ventas</th>
                      <th className="text-right py-2 pr-3">Ticket Prom.</th>
                      <th className="text-right py-2">UPT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((s, idx) => (
                      <tr key={s.employee_id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-500">#{idx + 1}</span>
                            <span>{s.employee_name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-right text-zinc-400">{s.sale_count}</td>
                        <td className="py-2.5 pr-3 text-right">{formatCurrency(s.avg_ticket)}</td>
                        <td className="py-2.5 text-right">
                          <span className={`font-semibold ${s.upt >= 2 ? 'text-emerald-400' : s.upt >= 1.2 ? 'text-amber-400' : 'text-zinc-400'}`}>
                            {s.upt}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section B: Sell-Through Rate */}
      <Card className="border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Sell-Through Rate por Sucursal</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            (Unidades vendidas ÷ Unidades vendidas + Stock disponible) × 100. Mide qué tan rápido se mueve el inventario.
          </p>
        </CardHeader>
        <CardContent>
          {loadingST ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
            </div>
          ) : sellThrough.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-sm text-muted-foreground">Sin datos de sucursales</div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sellThrough.map((b) => (
                  <div key={b.branch_id} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center gap-2">
                    <GaugeChart rate={b.rate} label={b.branch_name} />
                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap justify-center">
                      <span><span className="text-emerald-400 font-semibold">{b.sold_units}</span> vendidas</span>
                      <span><span className="text-zinc-400 font-semibold">{b.stock_units}</span> en stock</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Insight row */}
              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                {[
                  { icon: <TrendingUp className="h-4 w-4 text-emerald-400" />, label: 'Mayor rotación', val: [...sellThrough].sort((a,b) => b.rate - a.rate)[0] },
                  { icon: <ShoppingBag className="h-4 w-4 text-amber-400" />, label: 'Promedio general', val: null },
                  { icon: <Package className="h-4 w-4 text-red-400" />, label: 'Menor rotación', val: [...sellThrough].sort((a,b) => a.rate - b.rate)[0] },
                ].map((item, i) => {
                  const avg = sellThrough.length > 0 ? Math.round(sellThrough.reduce((s,b) => s+b.rate, 0) / sellThrough.length * 10) / 10 : 0;
                  const display = i === 1 ? `${avg}%` : `${item.val?.branch_name ?? '—'} (${item.val?.rate ?? 0}%)`;
                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03]">
                      {item.icon}
                      <div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="font-semibold text-sm">{display}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
