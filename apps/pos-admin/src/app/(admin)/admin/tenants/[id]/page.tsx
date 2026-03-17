'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@nivo/ui';
import { ArrowLeft, Store, Globe, Database, Calendar, UserCheck } from 'lucide-react';
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
      const { access_token, tenant: tenantData } = response.data;
      loginAsEmployee(
        access_token,
        { id: tenant.id, email: 'super-admin@nivo.com', role: 'admin', name: 'Super Admin' },
        { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
      );
      window.location.href = '/dashboard';
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al impersonar');
    } finally {
      setImpersonating(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Cargando...</p>;
  }

  if (!tenant) {
    return <p className="text-destructive">Zapatería no encontrada</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/tenants')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">{tenant.name}</h2>
          <p className="text-muted-foreground">{tenant.subdomain}.nivo.com</p>
        </div>
        <Badge variant={tenant.is_active ? 'default' : 'destructive'} className="text-sm">
          {tenant.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Store className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Nombre</p>
                <p className="text-sm text-muted-foreground">{tenant.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Subdominio</p>
                <p className="text-sm text-muted-foreground">{tenant.subdomain}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Base de Datos</p>
                <p className="text-sm text-muted-foreground font-mono text-xs">{tenant.database_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Fecha de Registro</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(tenant.created_at).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Suscripción</CardTitle>
          </CardHeader>
          <CardContent>
            {tenant.subscriptions && tenant.subscriptions.length > 0 ? (
              <div className="space-y-3">
                {tenant.subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium capitalize">{sub.plan_name}</p>
                      {sub.current_period_end && (
                        <p className="text-xs text-muted-foreground">
                          Vence: {new Date(sub.current_period_end).toLocaleDateString('es-MX')}
                        </p>
                      )}
                    </div>
                    <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                      {sub.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin suscripción activa</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acciones</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={handleImpersonate} disabled={impersonating}>
            <UserCheck className="h-4 w-4" />
            {impersonating ? 'Entrando...' : 'Entrar como Admin'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
