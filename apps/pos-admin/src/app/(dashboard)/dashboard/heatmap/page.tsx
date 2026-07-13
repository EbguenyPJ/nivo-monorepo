'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Skeleton,
} from '@nivo/ui';
import {
  Flame, Package, DollarSign, Clock, AlertTriangle, Boxes, Eye, EyeOff, Timer,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import dynamic from 'next/dynamic';
import type { Zone, Branch, ZoneMetric } from './MapView';

const DynamicMapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

// ─── Types ──────────────────────────────────────────────────────

interface ZoneHeatmapData {
  zones: Zone[];
  branches: Branch[];
  blind_zones: Zone[];
  totals: {
    orders: number;
    revenue: number;
    zones: number;
    blind_zones: number;
    avg_delivery_hours: number | null;
    blind_zone_km: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function getDateRange(range: string): { start_date?: string; end_date?: string } {
  const now = new Date();
  const end_date = now.toISOString().split('T')[0];
  let start: Date;

  switch (range) {
    case '1m':
      start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3m':
      start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case 'all':
    default:
      return {};
  }

  return { start_date: start.toISOString().split('T')[0], end_date };
}

const fmtMoney = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const fmtMoneyCompact = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 10_000 ? `$${Math.round(n / 1_000)}k`
  : fmtMoney(n);
const fmtCoord = (z: Zone) => `${z.lat.toFixed(2)}, ${z.lng.toFixed(2)}`;

function metricValue(z: Zone, metric: ZoneMetric): number {
  if (metric === 'revenue') return z.revenue;
  if (metric === 'delivery') return z.avg_delivery_hours ?? 0;
  return z.orders;
}

// ─── KPI Card ───────────────────────────────────────────────────

function KpiCard({
  icon, iconClass, label, value, sub, loading,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  sub?: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <>
          <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
          {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

const METRIC_TABS: { key: ZoneMetric; label: string; icon: React.ReactNode }[] = [
  { key: 'density', label: 'Densidad', icon: <Boxes className="h-3.5 w-3.5" /> },
  { key: 'revenue', label: 'Ingresos', icon: <DollarSign className="h-3.5 w-3.5" /> },
  { key: 'delivery', label: 'Entregas', icon: <Timer className="h-3.5 w-3.5" /> },
];

export default function HeatMapPage() {
  const [data, setData] = useState<ZoneHeatmapData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [dateRange, setDateRange] = useState('1m');
  const [metric, setMetric] = useState<ZoneMetric>('density');
  const [showBranches, setShowBranches] = useState(true);

  // Fetch branch list for filter
  useEffect(() => {
    apiClient.get('/branches').then((res) => {
      const list = (res.data?.data ?? res.data ?? []).map((b: any) => ({
        id: b.id,
        name: b.name,
        address: b.address ?? '',
      }));
      setBranches(list);
    }).catch(() => {});
  }, []);

  // Fetch zone heatmap data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { ...getDateRange(dateRange) };
      if (selectedBranch !== 'all') params.branch_id = selectedBranch;

      const res = await apiClient.get('/dashboard/zone-heatmap', { params });
      const payload: ZoneHeatmapData = res.data?.data ?? res.data;
      setData(payload ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totals = data?.totals;
  const blindZones = data?.blind_zones ?? [];

  const ranking = useMemo(() => {
    const zones = [...(data?.zones ?? [])];
    zones.sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
    return zones;
  }, [data?.zones, metric]);

  const maxRankValue = ranking.length ? metricValue(ranking[0], metric) : 1;

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15">
            <Flame className="h-5 w-5 text-emerald-400" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">Mapa de Calor</h1>
            <p className="text-sm text-zinc-400">Análisis geográfico de demanda y cobertura</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Metric segmented control */}
          <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1">
            {METRIC_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMetric(tab.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                  metric === tab.key
                    ? 'bg-zinc-700/80 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-900/80 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[9999] border-zinc-700 bg-zinc-800 text-white">
              <SelectItem value="1m">Último mes</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="all">Todo el tiempo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[200px] border-zinc-800 bg-zinc-900/80 text-white">
              <SelectValue placeholder="Todas las sucursales" />
            </SelectTrigger>
            <SelectContent className="z-[9999] border-zinc-700 bg-zinc-800 text-white">
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-10">
        {/* Left column: KPIs + blind zones + ranking */}
        <div className="flex flex-col gap-4 xl:col-span-3">
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              icon={<Package className="h-4 w-4 text-emerald-400" />}
              iconClass="bg-emerald-500/15"
              label="Pedidos"
              value={(totals?.orders ?? 0).toLocaleString('es-MX')}
              sub={`${totals?.zones ?? 0} zonas`}
              loading={loading}
            />
            <KpiCard
              icon={<DollarSign className="h-4 w-4 text-indigo-400" />}
              iconClass="bg-indigo-500/15"
              label="Ingresos"
              value={fmtMoneyCompact(totals?.revenue ?? 0)}
              loading={loading}
            />
            <KpiCard
              icon={<Clock className="h-4 w-4 text-amber-400" />}
              iconClass="bg-amber-500/15"
              label="Entrega Prom."
              value={totals?.avg_delivery_hours != null ? `${totals.avg_delivery_hours.toFixed(1)} h` : '—'}
              loading={loading}
            />
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4 text-orange-400" />}
              iconClass="bg-orange-500/15"
              label="Zonas Ciegas"
              value={String(totals?.blind_zones ?? 0)}
              sub={`> ${totals?.blind_zone_km ?? 5} km sin sucursal`}
              loading={loading}
            />
          </div>

          {/* Blind zones panel */}
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </span>
              <h2 className="text-base font-bold text-amber-300">Zonas Ciegas Detectadas</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              Alta demanda sin sucursal cercana (&gt; {totals?.blind_zone_km ?? 5} km)
            </p>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : blindZones.length === 0 ? (
              <p className="text-sm text-zinc-500 py-2 text-center">Sin zonas ciegas en el periodo</p>
            ) : (
              <div className="space-y-2">
                {blindZones.slice(0, 4).map((z, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-zinc-900/70 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-white font-mono">{fmtCoord(z)}</p>
                      <p className="text-xs text-zinc-500">
                        {Number(z.distance_to_branch_km).toFixed(1)} km de sucursal
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-300">{z.orders} pedidos</p>
                      <p className="text-xs text-zinc-500 tabular-nums">{fmtMoney(z.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ranking */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Ranking por Zona</h2>
              <span className="text-xs text-zinc-500">{totals?.zones ?? 0} zonas</span>
            </div>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : ranking.length === 0 ? (
              <p className="text-sm text-zinc-500 py-2 text-center">Sin datos en el periodo</p>
            ) : (
              <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
                {ranking.slice(0, 20).map((z, i) => {
                  const value = metricValue(z, metric);
                  const ratio = maxRankValue > 0 ? value / maxRankValue : 0;
                  return (
                    <div key={i} className="relative overflow-hidden rounded-lg px-3 py-2">
                      <div
                        className="absolute inset-y-0 left-0 bg-emerald-500/10"
                        style={{ width: `${Math.max(4, ratio * 100)}%` }}
                      />
                      <div className="relative flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs text-zinc-600 w-4 text-right shrink-0">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white font-mono truncate">{fmtCoord(z)}</p>
                            <p className="text-xs text-zinc-500 truncate">
                              {z.orders} pedidos · {fmtMoney(z.revenue)}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-emerald-400 tabular-nums shrink-0">
                          {metric === 'revenue'
                            ? fmtMoney(value)
                            : metric === 'delivery'
                              ? (z.avg_delivery_hours != null ? `${Number(z.avg_delivery_hours).toFixed(1)} h` : '—')
                              : value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="xl:col-span-7">
          <div className="relative h-[560px] xl:h-full min-h-[560px] overflow-hidden rounded-2xl border border-zinc-800">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <DynamicMapView
                zones={data?.zones ?? []}
                branches={data?.branches ?? []}
                metric={metric}
                showBranches={showBranches}
                blindZoneKm={totals?.blind_zone_km ?? 5}
              />
            )}

            {/* Branches toggle */}
            <button
              type="button"
              onClick={() => setShowBranches((v) => !v)}
              className={`absolute bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-md transition-all ${
                showBranches
                  ? 'border-zinc-700 bg-zinc-900/90 text-white'
                  : 'border-zinc-800 bg-zinc-900/70 text-zinc-500 hover:text-white'
              }`}
            >
              {showBranches ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Sucursales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
