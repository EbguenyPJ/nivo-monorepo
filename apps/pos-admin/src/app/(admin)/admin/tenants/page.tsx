'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button, Badge, Card, CardContent, Input, Label, Skeleton, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@nivo/ui';
import {
  Plus, Store, Search, Globe, MoreHorizontal, Eye, Pencil, Ban,
  CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  LogIn, X, Filter,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Subscription {
  id: string;
  plan_name: string;
  status: string;
  current_period_end: string | null;
}

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  database_name: string;
  is_active: boolean;
  created_at: string;
  subscriptions?: Subscription[];
}

const PAGE_SIZE = 15;

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Activa',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15',
  },
  inactive: {
    label: 'Suspendida',
    className: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/15',
  },
  trial: {
    label: 'Prueba Gratuita',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/15',
  },
};

const PLAN_BADGES: Record<string, { label: string; className: string }> = {
  basic: { label: 'Básico', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  professional: { label: 'Profesional', className: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' },
  enterprise: { label: 'Empresarial', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

function getTenantStatus(tenant: Tenant): string {
  if (!tenant.is_active) return 'inactive';
  const sub = tenant.subscriptions?.[0];
  if (!sub) return 'trial';
  if (sub.status === 'active') return 'active';
  if (sub.status === 'canceled' || sub.status === 'paused') return 'inactive';
  return 'active';
}

function getTenantPlan(tenant: Tenant): string | null {
  return tenant.subscriptions?.[0]?.plan_name || null;
}

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const [form, setForm] = useState({
    name: '',
    subdomain: '',
    owner_email: '',
    owner_password: '',
    plan_name: 'basic',
  });

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (planFilter !== 'all') params.set('plan', planFilter);

      const response = await apiClient.get(`/tenants?${params.toString()}`);
      setTenants(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, statusFilter, planFilter]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

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

  const handleToggleStatus = async (tenant: Tenant) => {
    try {
      await apiClient.patch(`/tenants/${tenant.id}/toggle-status`);
      toast({
        title: tenant.is_active ? 'Zapatería suspendida' : 'Zapatería activada',
        description: `${tenant.name} fue ${tenant.is_active ? 'suspendida' : 'activada'} correctamente.`,
      });
      await fetchTenants();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo cambiar el estado.',
        variant: 'destructive',
      });
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

  const hasFilters = statusFilter !== 'all' || planFilter !== 'all' || searchInput !== '';

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setStatusFilter('all');
    setPlanFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Zapaterías</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} negocios registrados en la plataforma
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 border-0">
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
                  className="bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0">
                  {creating ? 'Creando...' : 'Crear Zapatería'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o subdominio..."
                className="pl-10"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Estado" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="inactive">Suspendidas</SelectItem>
              </SelectContent>
            </Select>

            {/* Plan Filter */}
            <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Plan" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los planes</SelectItem>
                <SelectItem value="basic">Básico</SelectItem>
                <SelectItem value="professional">Profesional</SelectItem>
                <SelectItem value="enterprise">Empresarial</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        {loading ? (
          <CardContent className="p-0">
            <div className="p-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          </CardContent>
        ) : tenants.length === 0 && !hasFilters ? (
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Store className="h-8 w-8 text-purple-400" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Sin zapaterías registradas</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Haz clic en &quot;Nueva Zapatería&quot; para registrar el primer negocio en la plataforma.
            </p>
          </CardContent>
        ) : tenants.length === 0 && hasFilters ? (
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Sin resultados</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              No se encontraron zapaterías con los filtros seleccionados.
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </CardContent>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[280px]">Zapatería</TableHead>
                  <TableHead>Subdominio</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => {
                  const status = getTenantStatus(tenant);
                  const plan = getTenantPlan(tenant);
                  const statusConfig = STATUS_BADGES[status] || STATUS_BADGES.active;
                  const planConfig = plan ? PLAN_BADGES[plan] : null;

                  return (
                    <TableRow key={tenant.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/10 shrink-0">
                            <Store className="h-4 w-4 text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{tenant.name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-sm">{tenant.subdomain}.nivo.com</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {planConfig ? (
                          <Badge variant="outline" className={planConfig.className}>
                            {planConfig.label}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusConfig.className}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(tenant.created_at).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Acciones</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => router.push(`/admin/tenants/${tenant.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/admin/tenants/${tenant.id}`)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                window.open(`http://${tenant.subdomain}.localhost:3001`, '_blank');
                              }}
                            >
                              <LogIn className="h-4 w-4 mr-2" />
                              Entrar como Admin
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(tenant)}
                              className={tenant.is_active ? 'text-red-600 focus:text-red-600' : 'text-emerald-600 focus:text-emerald-600'}
                            >
                              {tenant.is_active ? (
                                <>
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspender
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Activar
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
                <p className="text-sm text-muted-foreground">
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 7) return true;
                      if (p === 1 || p === totalPages) return true;
                      if (Math.abs(p - page) <= 1) return true;
                      return false;
                    })
                    .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, i) =>
                      item === 'ellipsis' ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">
                          …
                        </span>
                      ) : (
                        <Button
                          key={item}
                          variant={page === item ? 'default' : 'ghost'}
                          size="sm"
                          className={`h-8 w-8 p-0 ${page === item ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 border-0 text-white' : ''}`}
                          onClick={() => setPage(item as number)}
                        >
                          {item}
                        </Button>
                      ),
                    )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
