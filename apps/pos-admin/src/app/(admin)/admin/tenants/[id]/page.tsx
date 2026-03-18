'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Badge, Card, CardContent, Skeleton, toast } from '@nivo/ui';
import { ArrowLeft, Store, Globe, Database, Calendar, UserCheck, Shield, CreditCard } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface TenantDetail {
  id: string;
  name: string;
  subdomain: string;
  database_name: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  subscriptions: Array<{
    id: string;
    plan_name: string;
    status: string;
    current_period_end: string | null;
  }>;
}

const PLAN_COLORS: Record<string, string> = {
  basic: 'bg-slate-50 text-slate-700 border-slate-200',
  professional: 'bg-blue-50 text-blue-700 border-blue-200',
  enterprise: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);
  const loginAsEmployee = useAuthStore((state) => state.loginAsEmployee);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const response = await apiClient.get(`/tenants/${params.id}`);
        setTenant(response.data);
      } catch (error) {
        console.error('Failed to fetch tenant:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [params.id]);

  const handleImpersonate = async () => {
    if (!tenant) return;
    setImpersonating(true);
    try {
      const response = await apiClient.post(`/auth/impersonate/${tenant.id}`);
      const { access_token } = response.data;
      loginAsEmployee(
        access_token,
        { id: tenant.id, email: 'super-admin@nivo.com', role: 'admin', name: 'Super Admin' },
        { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
      );
      window.location.href = '/dashboard';
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo acceder como administrador.',
        variant: 'destructive',
      });
    } finally {
      setImpersonating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-20">
        <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Store className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Zapatería no encontrada</h3>
        <p className="text-sm text-muted-foreground mb-4">El tenant solicitado no existe o fue eliminado.</p>
        <Button variant="outline" onClick={() => router.push('/admin/tenants')}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const infoItems = [
    { icon: Store, label: 'Nombre', value: tenant.name },
    { icon: Globe, label: 'Subdominio', value: `${tenant.subdomain}.nivo.com` },
    { icon: Database, label: 'Base de Datos', value: tenant.database_name, mono: true },
    {
      icon: Calendar,
      label: 'Fecha de Registro',
      value: new Date(tenant.created_at).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric',
      }),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/tenants')}
          className="h-9 w-9 rounded-lg border border-border/60 bg-card flex items-center justify-center hover:bg-accent transition-colors shadow-sm"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{tenant.name}</h2>
            <Badge
              variant="outline"
              className={
                tenant.is_active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                  : 'bg-red-50 text-red-600 border-red-200/50'
              }
            >
              {tenant.is_active ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{tenant.subdomain}.nivo.com</p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* General Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Shield className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-foreground">Información General</h3>
            </div>
            <div className="space-y-4">
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">{item.label}</p>
                    <p className={`text-sm text-foreground mt-0.5 ${item.mono ? 'font-mono text-xs' : ''}`}>
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-purple-600" />
              </div>
              <h3 className="font-semibold text-foreground">Suscripción</h3>
            </div>
            {tenant.subscriptions && tenant.subscriptions.length > 0 ? (
              <div className="space-y-3">
                {tenant.subscriptions.map((sub) => (
                  <div key={sub.id} className="rounded-xl bg-muted/40 border border-border/30 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="outline" className={PLAN_COLORS[sub.plan_name] || 'bg-muted'}>
                          {sub.plan_name.charAt(0).toUpperCase() + sub.plan_name.slice(1)}
                        </Badge>
                        {sub.current_period_end && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Vence: {new Date(sub.current_period_end).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          sub.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                            : 'bg-amber-50 text-amber-700 border-amber-200/50'
                        }
                      >
                        {sub.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-muted/30 border border-dashed border-border/50 p-8 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin suscripción activa</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-amber-600" />
            </div>
            <h3 className="font-semibold text-foreground">Acciones</h3>
          </div>
          <div className="flex gap-3">
            <Button
              className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 shadow-lg shadow-blue-500/20"
              onClick={handleImpersonate}
              disabled={impersonating}
            >
              <UserCheck className="h-4 w-4" />
              {impersonating ? 'Accediendo...' : 'Entrar como Admin'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
