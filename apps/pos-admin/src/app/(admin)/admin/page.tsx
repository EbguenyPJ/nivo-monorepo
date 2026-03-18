'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, Skeleton } from '@nivo/ui';
import { Store, CheckCircle, XCircle, CalendarPlus, TrendingUp, ArrowUpRight } from 'lucide-react';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

interface TenantStats {
  total: number;
  active: number;
  inactive: number;
  thisMonth: number;
}

const statCards = [
  {
    key: 'total',
    label: 'Total Zapaterías',
    subtitle: 'Registradas en la plataforma',
    icon: Store,
    iconBg: 'bg-blue-50 text-blue-600',
    valueColor: '',
  },
  {
    key: 'active',
    label: 'Activas',
    subtitle: 'Con suscripción activa',
    icon: CheckCircle,
    iconBg: 'bg-emerald-50 text-emerald-600',
    valueColor: 'text-emerald-600',
  },
  {
    key: 'inactive',
    label: 'Inactivas',
    subtitle: 'Deshabilitadas o suspendidas',
    icon: XCircle,
    iconBg: 'bg-red-50 text-red-500',
    valueColor: 'text-red-500',
  },
  {
    key: 'thisMonth',
    label: 'Nuevas este mes',
    subtitle: 'Registros recientes',
    icon: CalendarPlus,
    iconBg: 'bg-purple-50 text-purple-600',
    valueColor: 'text-purple-600',
  },
];

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
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Resumen general de la plataforma Nivo</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key} className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow duration-300">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  {loading ? (
                    <Skeleton className="h-9 w-16" />
                  ) : (
                    <p className={`text-3xl font-bold tracking-tight ${card.valueColor}`}>
                      {stats[card.key as keyof TenantStats]}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/70">{card.subtitle}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow duration-300">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Vista Rápida</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {loading ? '...' : `${stats.active} de ${stats.total} zapaterías están activas`}
                </p>
                {!loading && stats.total > 0 && (
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-700"
                      style={{ width: `${(stats.active / stats.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Link href="/admin/tenants">
          <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-300 group cursor-pointer h-full">
            <CardContent className="p-6 flex items-center gap-4 h-full">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Store className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Gestionar Zapaterías</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Crear, editar y administrar todos los tenants
                </p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
