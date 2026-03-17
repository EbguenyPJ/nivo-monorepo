'use client';

import { useEffect, useState } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@nivo/ui';
import { Download, DollarSign, Receipt, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { getTodayRange, getThisWeekRange, getThisMonthRange, formatCurrency, formatDate } from '@/lib/date-utils';

interface Summary {
  total_sales: number;
  total_revenue: number;
  avg_ticket: number;
}

interface Sale {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  employee?: { name: string } | null;
  branch?: { name: string } | null;
  customer?: { name: string } | null;
  items?: any[];
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  mixed: 'Mixto',
  online: 'Online',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completada',
  pending: 'Pendiente',
  refunded: 'Reembolsada',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  pending: 'outline',
  refunded: 'destructive',
};

function getDateRange(period: string) {
  switch (period) {
    case 'today': return getTodayRange();
    case 'week': return getThisWeekRange();
    case 'month': return getThisMonthRange();
    default: return {};
  }
}

export default function ReportsPage() {
  const [period, setPeriod] = useState('month');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const range = getDateRange(period);
      const params = new URLSearchParams();
      if (range.start_date) params.set('start_date', range.start_date);
      if (range.end_date) params.set('end_date', range.end_date);

      const [summaryRes, salesRes] = await Promise.all([
        apiClient.get(`/reports/summary?${params.toString()}`),
        apiClient.get(`/reports/sales?${params.toString()}&limit=20`),
      ]);

      setSummary(summaryRes.data);
      setSales(salesRes.data.data || []);
      setTotalSalesCount(salesRes.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await apiClient.post('/reports/export-csv');
      toast({
        title: 'Reporte en cola',
        description: 'Te notificaremos cuando el archivo CSV esté listo.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo generar el reporte.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reportes</h2>
          <p className="text-muted-foreground">Analiza el rendimiento de tu negocio</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="all">Todo el tiempo</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(summary?.total_revenue || 0)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(summary?.avg_ticket || 0)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ventas</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary?.total_sales || 0}</div>
                <p className="text-xs text-muted-foreground">{totalSalesCount} en total</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No hay ventas en el periodo seleccionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Fecha</th>
                    <th className="pb-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="pb-3 font-medium text-muted-foreground">Empleado</th>
                    <th className="pb-3 font-medium text-muted-foreground">Sucursal</th>
                    <th className="pb-3 font-medium text-muted-foreground">Pago</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Total</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b last:border-0">
                      <td className="py-3 text-muted-foreground">{formatDate(sale.created_at)}</td>
                      <td className="py-3">{sale.customer?.name || '—'}</td>
                      <td className="py-3">{sale.employee?.name || '—'}</td>
                      <td className="py-3">{sale.branch?.name || '—'}</td>
                      <td className="py-3">
                        <Badge variant="outline">{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</Badge>
                      </td>
                      <td className="py-3 text-right font-medium">{formatCurrency(sale.total_amount)}</td>
                      <td className="py-3 text-right">
                        <Badge variant={STATUS_VARIANTS[sale.status] || 'outline'}>
                          {STATUS_LABELS[sale.status] || sale.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
