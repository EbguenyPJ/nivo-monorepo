'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Skeleton,
} from '@nivo/ui';
import { Globe, Users, MapPin } from 'lucide-react';
import { apiClient } from '@/lib/api';
import dynamic from 'next/dynamic';

const DynamicMapView = dynamic(
  () => import('./MapView'),
  { ssr: false },
);

// ─── Types ──────────────────────────────────────────────────────

interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
  customer_name: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  city?: string;
  lat?: number | null;
  lng?: number | null;
}

interface HeatMapData {
  points: HeatPoint[];
  branches: Branch[];
  total_mapped: number;
}

// ─── Date Helpers ───────────────────────────────────────────────

function getDateRange(range: string): { start_date: string; end_date: string } {
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
      start = new Date(2020, 0, 1);
      break;
  }

  return { start_date: start.toISOString().split('T')[0], end_date };
}

// ─── Page ───────────────────────────────────────────────────────

export default function HeatMapPage() {
  const [data, setData] = useState<HeatMapData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [dateRange, setDateRange] = useState('1m');

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

  // Fetch heatmap data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { start_date, end_date } = getDateRange(dateRange);
      const params: Record<string, string> = { start_date, end_date };
      if (selectedBranch !== 'all') params.branch_id = selectedBranch;

      const res = await apiClient.get('/dashboard/customer-heatmap', { params });
      const payload: HeatMapData = res.data?.data ?? res.data ?? { points: [], branches: [], total_mapped: 0 };
      setData(payload);
    } catch {
      setData({ points: [], branches: [], total_mapped: 0 });
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const highestPoint = data?.points?.length
    ? data.points.reduce((a, b) => (b.weight > a.weight ? b : a), data.points[0])
    : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe className="h-7 w-7 text-emerald-400" />
        <h1 className="text-2xl font-bold text-white">Mapa de Calor de Clientes</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-[220px] border-zinc-700 bg-zinc-800 text-white">
            <SelectValue placeholder="Todas las sucursales" />
          </SelectTrigger>
          <SelectContent className="z-[9999] border-zinc-700 bg-zinc-800 text-white">
            <SelectItem value="all">Todas las sucursales</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[200px] border-zinc-700 bg-zinc-800 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[9999] border-zinc-700 bg-zinc-800 text-white">
            <SelectItem value="1m">Último Mes</SelectItem>
            <SelectItem value="3m">Últimos 3 Meses</SelectItem>
            <SelectItem value="all">Todo el Tiempo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Stats Panel */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                <Users className="h-4 w-4" />
                Total clientes mapeados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-3xl font-bold text-white">{data?.total_mapped ?? 0}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                <MapPin className="h-4 w-4" />
                Cliente con más compras
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : highestPoint ? (
                <div>
                  <p className="text-lg font-semibold text-white">{highestPoint.customer_name}</p>
                  <p className="text-sm text-zinc-400">{highestPoint.weight} compras</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Sin datos</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        <div className="lg:col-span-3">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-0">
              <div className="h-[600px] w-full overflow-hidden rounded-lg">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <DynamicMapView
                    points={data?.points ?? []}
                    branches={data?.branches ?? []}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
