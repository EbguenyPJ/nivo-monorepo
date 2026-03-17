'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '@nivo/ui';
import { DollarSign, ShoppingCart, Package, Users } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { getTodayRange, getThisMonthRange, formatCurrency, formatDate } from '@/lib/date-utils';

interface DashboardData {
  todayRevenue: number;
  todaySales: number;
  monthSales: number;
  productCount: number;
  customerCount: number;
  recentSales: any[];
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  mixed: 'Mixto',
  online: 'Online',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const todayRange = getTodayRange();
        const monthRange = getThisMonthRange();
        const todayParams = `start_date=${todayRange.start_date}&end_date=${todayRange.end_date}`;
        const monthParams = `start_date=${monthRange.start_date}&end_date=${monthRange.end_date}`;

        const [todaySummary, monthSummary, products, customers, recentSales] = await Promise.all([
          apiClient.get(`/reports/summary?${todayParams}`),
          apiClient.get(`/reports/summary?${monthParams}`),
          apiClient.get('/products'),
          apiClient.get('/customers'),
          apiClient.get('/reports/sales?limit=5'),
        ]);

        setData({
          todayRevenue: todaySummary.data.total_revenue,
          todaySales: todaySummary.data.total_sales,
          monthSales: monthSummary.data.total_sales,
          productCount: products.data.length,
          customerCount: customers.data.length,
          recentSales: recentSales.data.data || [],
        });
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Resumen de tu zapatería</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del día</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(data?.todayRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground">{data?.todaySales || 0} transacciones hoy</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{data?.monthSales || 0}</div>
                <p className="text-xs text-muted-foreground">Ventas este mes</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{data?.productCount || 0}</div>
                <p className="text-xs text-muted-foreground">Modelos en catálogo</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{data?.customerCount || 0}</div>
                <p className="text-xs text-muted-foreground">Clientes registrados</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.recentSales || data.recentSales.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No hay ventas registradas aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Fecha</th>
                    <th className="pb-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="pb-3 font-medium text-muted-foreground">Pago</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((sale: any) => (
                    <tr key={sale.id} className="border-b last:border-0">
                      <td className="py-3 text-muted-foreground">{formatDate(sale.created_at)}</td>
                      <td className="py-3">{sale.customer?.name || 'Sin cliente'}</td>
                      <td className="py-3">
                        <Badge variant="outline">
                          {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-medium">{formatCurrency(sale.total_amount)}</td>
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
