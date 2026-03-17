'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Button, Badge, Card, CardContent, CardHeader, CardTitle, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@nivo/ui';
import { Plus, Store, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  database_name: string;
  is_active: boolean;
  created_at: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    subdomain: '',
    owner_email: '',
    owner_password: '',
    plan_name: 'basic',
  });

  const fetchTenants = async () => {
    try {
      const response = await apiClient.get('/tenants?page=1&limit=100');
      setTenants(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiClient.post('/tenants', form);
      setDialogOpen(false);
      setForm({ name: '', subdomain: '', owner_email: '', owner_password: '', plan_name: 'basic' });
      await fetchTenants();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al crear la zapatería');
    } finally {
      setCreating(false);
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Auto-generate subdomain from name
    if (field === 'name') {
      const subdomain = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setForm((prev) => ({ ...prev, name: value, subdomain }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Zapaterías</h2>
          <p className="text-muted-foreground">Gestiona los negocios registrados en la plataforma</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Zapatería
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Registrar Nueva Zapatería</DialogTitle>
                <DialogDescription>
                  Se creará un nuevo tenant con su base de datos independiente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Negocio</Label>
                  <Input
                    id="name"
                    placeholder="Zapatería El Paso"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subdomain">Subdominio</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="subdomain"
                      placeholder="zapateria-el-paso"
                      value={form.subdomain}
                      onChange={(e) => setForm((prev) => ({ ...prev, subdomain: e.target.value }))}
                      required
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">.nivo.com</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner_email">Correo del Administrador</Label>
                  <Input
                    id="owner_email"
                    type="email"
                    placeholder="admin@zapateria.com"
                    value={form.owner_email}
                    onChange={(e) => setForm((prev) => ({ ...prev, owner_email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner_password">Contraseña del Administrador</Label>
                  <Input
                    id="owner_password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={form.owner_password}
                    onChange={(e) => setForm((prev) => ({ ...prev, owner_password: e.target.value }))}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan">Plan</Label>
                  <select
                    id="plan"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={form.plan_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, plan_name: e.target.value }))}
                  >
                    <option value="basic">Básico</option>
                    <option value="professional">Profesional</option>
                    <option value="enterprise">Empresarial</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creando...' : 'Crear Zapatería'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando zapaterías...</p>
      ) : tenants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay zapaterías registradas aún.</p>
            <p className="text-sm text-muted-foreground">Haz clic en &quot;Nueva Zapatería&quot; para crear la primera.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tenants.map((tenant) => (
            <Link key={tenant.id} href={`/admin/tenants/${tenant.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-sm text-muted-foreground">{tenant.subdomain}.nivo.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={tenant.is_active ? 'default' : 'destructive'}>
                      {tenant.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(tenant.created_at).toLocaleDateString('es-MX')}
                    </span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
