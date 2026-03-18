'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Button, Badge, Card, CardContent, Input, Label, Skeleton, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@nivo/ui';
import { Plus, Store, ChevronRight, Search, Globe } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
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
    if (!form.name.trim() || !form.owner_email.trim() || !form.owner_password.trim()) {
      toast({ title: 'Campos requeridos', description: 'Completa todos los campos obligatorios.', variant: 'destructive' });
      return;
    }
    if (form.owner_password.length < 8) {
      toast({ title: 'Contraseña muy corta', description: 'La contraseña debe tener al menos 8 caracteres.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      await apiClient.post('/tenants', form);
      setDialogOpen(false);
      setForm({ name: '', subdomain: '', owner_email: '', owner_password: '', plan_name: 'basic' });
      toast({ title: 'Zapatería creada', description: `${form.name} se registró correctamente.` });
      await fetchTenants();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo crear la zapatería.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  const filteredTenants = tenants.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.subdomain.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Zapaterías</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {tenants.length} negocios registrados en la plataforma
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 border-0">
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
                  <Select value={form.plan_name} onValueChange={(v) => setForm((prev) => ({ ...prev, plan_name: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Básico</SelectItem>
                      <SelectItem value="professional">Profesional</SelectItem>
                      <SelectItem value="enterprise">Empresarial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0">
                  {creating ? 'Creando...' : 'Crear Zapatería'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      {tenants.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar zapatería..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Tenant List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <Store className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Sin zapaterías registradas</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Haz clic en &quot;Nueva Zapatería&quot; para registrar el primer negocio en la plataforma.
            </p>
          </CardContent>
        </Card>
      ) : filteredTenants.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">No se encontraron resultados para &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTenants.map((tenant) => (
            <Link key={tenant.id} href={`/admin/tenants/${tenant.id}`}>
              <Card className="hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 group cursor-pointer">
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center border border-blue-100/50">
                      <Store className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{tenant.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Globe className="h-3 w-3 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">{tenant.subdomain}.nivo.com</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      className={
                        tenant.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-50'
                          : 'bg-red-50 text-red-600 border-red-200/50 hover:bg-red-50'
                      }
                      variant="outline"
                    >
                      {tenant.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                    <span className="text-xs text-muted-foreground/60 min-w-[80px] text-right">
                      {new Date(tenant.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
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
