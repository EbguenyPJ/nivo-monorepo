'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@nivo/ui';
import { Store, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface TenantStats {
  total: number;
  active: number;
  inactive: number;
  thisMonth: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<TenantStats>({ total: 0, active: 0, inactive: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiClient.get('/tenants?page=1&limit=100');
        const tenants = response.data.data || [];
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        setStats({
          total: tenants.length,
          active: tenants.filter((t: any) => t.is_active).length,
          inactive: tenants.filter((t: any) => !t.is_active).length,
          thisMonth: tenants.filter((t: any) => new Date(t.created_at) >= firstOfMonth).length,
        });
      } catch (error) {
        console.error('Failed to fetch tenant stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Resumen general de la plataforma Nivo</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Zapaterías</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.total}</div>
            <p className="text-xs text-muted-foreground">Registradas en la plataforma</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{loading ? '...' : stats.active}</div>
            <p className="text-xs text-muted-foreground">Con suscripción activa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactivas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{loading ? '...' : stats.inactive}</div>
            <p className="text-xs text-muted-foreground">Deshabilitadas o suspendidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground">Nuevas zapaterías registradas</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
