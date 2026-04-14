'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Label, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  Skeleton, toast,
} from '@nivo/ui';
import {
  Plus, UserCircle, Star, Phone, Mail, MoreVertical, Pencil,
  Trash2, Eye, Power, Search, ChevronLeft, ChevronRight,
  MapPin, CreditCard, ShoppingBag, Calendar, Receipt, Tag, Home,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────

interface Customer {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  date_of_birth: string | null;
  notes: string | null;
  loyalty_points: number;
  membership_tier: string | null;
  credit_balance: number;
  is_active: boolean;
  tags: string[];
  addresses?: CustomerAddress[];
  stats?: CustomerStats;
  created_at: string;
  updated_at: string;
}

interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string | null;
  street: string;
  neighborhood: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  reference: string | null;
  is_default: boolean;
}

interface CustomerStats {
  total_purchases: number;
  total_spent: number;
  lifetime_value: number;
  last_purchase_date: string | null;
  average_ticket: number;
  favorite_size: string | null;
}

interface PaginatedResponse {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Helpers ────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function formatCurrency(val: number | string): string {
  return `$${Number(val || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Main Page ──────────────────────────────────────────────────

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('true'); // 'true' | 'false' | '__all__'
  const limit = 20;

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  // Address dialog
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: '', street: '', neighborhood: '', city: '', state: '', zip_code: '', country: 'Mexico', reference: '', is_default: false,
  });

  // Form state
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    rfc: '', date_of_birth: '', notes: '', internal_notes: '',
  });

  // Debounced search
  const searchTimer = useRef<NodeJS.Timeout>();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // ─── Fetch ──────────────────────────────────────────────────

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (debouncedSearch) params.search = debouncedSearch;
      if (activeFilter !== '__all__') params.is_active = activeFilter;
      const res = await apiClient.get<PaginatedResponse>('/customers', { params });
      setCustomers(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los clientes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, activeFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // ─── CRUD handlers ──────────────────────────────────────────

  const openCreate = () => {
    setEditingCustomer(null);
    setForm({ first_name: '', last_name: '', email: '', phone: '', rfc: '', date_of_birth: '', notes: '', internal_notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    // If structured names exist use them; otherwise split display name as best guess
    let fn = c.first_name || '';
    let ln = c.last_name || '';
    if (!fn && !ln && c.name) {
      const parts = c.name.trim().split(' ');
      fn = parts[0] || '';
      ln = parts.slice(1).join(' ');
    }
    setForm({
      first_name: fn,
      last_name: ln,
      email: c.email || '',
      phone: c.phone || '',
      rfc: c.rfc || '',
      date_of_birth: c.date_of_birth ? c.date_of_birth.split('T')[0] : '',
      notes: c.notes || '',
      internal_notes: (c as any).internal_notes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
    try {
      const payload = {
        name: fullName,
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        rfc: form.rfc || undefined,
        date_of_birth: form.date_of_birth || undefined,
        notes: form.notes || undefined,
        internal_notes: form.internal_notes || undefined,
      };
      if (editingCustomer) {
        await apiClient.put(`/customers/${editingCustomer.id}`, payload);
        toast({ title: 'Actualizado', description: `Cliente "${fullName}" actualizado` });
      } else {
        await apiClient.post('/customers', payload);
        toast({ title: 'Creado', description: `Cliente "${fullName}" registrado` });
      }
      setDialogOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (c: Customer) => {
    try {
      await apiClient.patch(`/customers/${c.id}/toggle-status`);
      toast({ title: c.is_active ? 'Desactivado' : 'Activado', description: `Cliente "${c.name}"` });
      fetchCustomers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteCustomer) return;
    setSaving(true);
    try {
      await apiClient.delete(`/customers/${deleteCustomer.id}`);
      toast({ title: 'Eliminado', description: `Cliente "${deleteCustomer.name}" eliminado` });
      setDeleteCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al eliminar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Detail view ────────────────────────────────────────────

  const openDetail = async (c: Customer) => {
    try {
      const res = await apiClient.get<Customer>(`/customers/${c.id}`);
      setDetailCustomer(res.data);
      setDetailOpen(true);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el detalle', variant: 'destructive' });
    }
  };

  // ─── Address handlers ──────────────────────────────────────

  const openAddAddress = () => {
    setEditingAddress(null);
    setAddressForm({ label: '', street: '', neighborhood: '', city: '', state: '', zip_code: '', country: 'Mexico', reference: '', is_default: false });
    setAddressDialogOpen(true);
  };

  const openEditAddress = (addr: CustomerAddress) => {
    setEditingAddress(addr);
    setAddressForm({
      label: addr.label || '',
      street: addr.street,
      neighborhood: addr.neighborhood || '',
      city: addr.city,
      state: addr.state,
      zip_code: addr.zip_code,
      country: addr.country,
      reference: addr.reference || '',
      is_default: addr.is_default,
    });
    setAddressDialogOpen(true);
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailCustomer) return;
    setSaving(true);
    try {
      if (editingAddress) {
        await apiClient.put(`/customers/addresses/${editingAddress.id}`, addressForm);
        toast({ title: 'Actualizado', description: 'Direccion actualizada' });
      } else {
        await apiClient.post(`/customers/${detailCustomer.id}/addresses`, addressForm);
        toast({ title: 'Agregada', description: 'Direccion agregada' });
      }
      setAddressDialogOpen(false);
      // Refresh detail
      const res = await apiClient.get<Customer>(`/customers/${detailCustomer.id}`);
      setDetailCustomer(res.data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (!detailCustomer) return;
    try {
      await apiClient.delete(`/customers/addresses/${addrId}`);
      toast({ title: 'Eliminada', description: 'Direccion eliminada' });
      const res = await apiClient.get<Customer>(`/customers/${detailCustomer.id}`);
      setDetailCustomer(res.data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    }
  };

  // ─── Pagination info ───────────────────────────────────────

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Directorio de Clientes</h2>
          <p className="text-muted-foreground">{total} cliente{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, correo, telefono, RFC..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {debouncedSearch || activeFilter !== 'true'
                ? 'No se encontraron clientes con ese criterio.'
                : 'No hay clientes registrados aun.'}
            </p>
            {!debouncedSearch && activeFilter === 'true' && (
              <p className="text-sm text-muted-foreground mt-1">
                Los clientes se agregan desde el POS o manualmente.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Puntos</TableHead>
                <TableHead>Credito</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => openDetail(c)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {getInitials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{c.name}</p>
                        {c.email && (
                          <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.phone || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      <span className="text-sm font-medium">{c.loyalty_points}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-foreground">
                    {formatCurrency(c.credit_balance)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-xs">
                      {c.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openDetail(c)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(c)}>
                          <Power className="h-4 w-4 mr-2" />
                          {c.is_active ? 'Desactivar' : 'Activar'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteCustomer(c)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {from}–{to} de {total}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ─── Create / Edit Dialog ─────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
              <DialogDescription>
                {editingCustomer ? 'Modifica los datos del cliente.' : 'Registra un nuevo cliente en tu directorio.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Name fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Nombre(s) *</Label>
                  <Input
                    id="first_name"
                    placeholder="Maria"
                    value={form.first_name}
                    onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Apellido(s) *</Label>
                  <Input
                    id="last_name"
                    placeholder="Garcia Lopez"
                    value={form.last_name}
                    onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Contact + RFC */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electronico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="maria@ejemplo.com"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    placeholder="55 1234 5678"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfc">RFC</Label>
                <Input
                  id="rfc"
                  placeholder="XAXX010101000"
                  maxLength={13}
                  className="font-mono uppercase"
                  value={form.rfc}
                  onChange={(e) => setForm((p) => ({ ...p, rfc: e.target.value.toUpperCase() }))}
                />
              </div>

              {/* Additional section */}
              <div className="border-t pt-4 mt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Adicional</p>
                <div className="space-y-2">
                  <Label htmlFor="dob">Fecha de Nacimiento</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 mt-3">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    rows={2}
                    placeholder="Observaciones del cliente..."
                    className="resize-none"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 mt-3">
                  <Label htmlFor="internal-notes">Notas Internas (solo staff)</Label>
                  <Textarea
                    id="internal-notes"
                    rows={2}
                    placeholder="Notas visibles solo para el equipo..."
                    className="resize-none"
                    value={form.internal_notes}
                    onChange={(e) => setForm((p) => ({ ...p, internal_notes: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editingCustomer ? 'Guardar Cambios' : 'Crear Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ──────────────────────── */}
      <Dialog open={!!deleteCustomer} onOpenChange={(v) => !v && setDeleteCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Cliente</DialogTitle>
            <DialogDescription>
              Esta accion eliminara al cliente <strong>&quot;{deleteCustomer?.name}&quot;</strong> del directorio.
              Los datos se conservan internamente pero el cliente dejara de aparecer en el sistema.
            </DialogDescription>
          </DialogHeader>
          {deleteCustomer && Number(deleteCustomer.credit_balance) > 0 && (
            <div className="flex items-center gap-2 text-sm bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 text-destructive">
              <CreditCard className="h-4 w-4 shrink-0" />
              Este cliente tiene saldo de credito pendiente ({formatCurrency(deleteCustomer.credit_balance)}).
              No se podra eliminar hasta saldar la cuenta.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCustomer(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detail Dialog ───────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailCustomer && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                    {getInitials(detailCustomer.name)}
                  </div>
                  <div>
                    <DialogTitle className="text-xl">{detailCustomer.name}</DialogTitle>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant={detailCustomer.is_active ? 'default' : 'secondary'} className="text-xs">
                        {detailCustomer.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      {detailCustomer.membership_tier && (
                        <Badge variant="outline" className="text-xs capitalize">{detailCustomer.membership_tier}</Badge>
                      )}
                      {detailCustomer.tags?.length > 0 && detailCustomer.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Contact info */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                {detailCustomer.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{detailCustomer.email}</span>
                  </div>
                )}
                {detailCustomer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{detailCustomer.phone}</span>
                  </div>
                )}
                {detailCustomer.rfc && (
                  <div className="flex items-center gap-2 text-sm">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{detailCustomer.rfc}</span>
                  </div>
                )}
                {detailCustomer.date_of_birth && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(detailCustomer.date_of_birth).toLocaleDateString('es-MX')}</span>
                  </div>
                )}
              </div>

              {/* Stats — 360° Profile */}
              {detailCustomer.stats && (
                <div className="grid grid-cols-5 gap-3 mt-4">
                  <div className="rounded-lg border p-3 text-center">
                    <ShoppingBag className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{detailCustomer.stats.total_purchases}</p>
                    <p className="text-xs text-muted-foreground">Compras</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <CreditCard className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{formatCurrency(detailCustomer.stats.lifetime_value || detailCustomer.stats.total_spent)}</p>
                    <p className="text-xs text-muted-foreground">Lifetime Value</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <Receipt className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{formatCurrency(detailCustomer.stats.average_ticket)}</p>
                    <p className="text-xs text-muted-foreground">Ticket Prom.</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <Star className="h-4 w-4 mx-auto text-amber-500 fill-amber-500 mb-1" />
                    <p className="text-lg font-bold">{detailCustomer.loyalty_points}</p>
                    <p className="text-xs text-muted-foreground">Puntos</p>
                  </div>
                  {detailCustomer.stats.favorite_size && (
                    <div className="rounded-lg border p-3 text-center">
                      <MapPin className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-lg font-bold">{detailCustomer.stats.favorite_size}</p>
                      <p className="text-xs text-muted-foreground">Talla Favorita</p>
                    </div>
                  )}
                </div>
              )}

              {detailCustomer.stats?.last_purchase_date && (
                <p className="text-xs text-muted-foreground mt-2">
                  Ultima visita: {new Date(detailCustomer.stats.last_purchase_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}

              {/* Layaway + Credit summary row */}
              {((detailCustomer as any).layaway_summary || (detailCustomer as any).credit_account) && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {(detailCustomer as any).layaway_summary && (detailCustomer as any).layaway_summary.total > 0 && (
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="text-sm">
                        <p className="font-medium">Apartados</p>
                        <p className="text-xs text-muted-foreground">
                          {(detailCustomer as any).layaway_summary.active} activo{(detailCustomer as any).layaway_summary.active !== 1 ? 's' : ''} de {(detailCustomer as any).layaway_summary.total} total
                        </p>
                      </div>
                    </div>
                  )}
                  {(detailCustomer as any).credit_account && (
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="text-sm">
                        <p className="font-medium">Cuenta de Credito</p>
                        <p className="text-xs text-muted-foreground">
                          Deuda: {formatCurrency((detailCustomer as any).credit_account.current_balance)} / {formatCurrency((detailCustomer as any).credit_account.credit_limit)}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{(detailCustomer as any).credit_account.payment_terms}d</span>
                    </div>
                  )}
                </div>
              )}

              {/* Loyalty recent */}
              {(detailCustomer as any).loyalty_recent && (detailCustomer as any).loyalty_recent.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Puntos Recientes</p>
                  <div className="space-y-1">
                    {(detailCustomer as any).loyalty_recent.slice(0, 3).map((entry: any) => (
                      <div key={entry.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                        <span className="text-muted-foreground">{entry.description || entry.type}</span>
                        <span className={entry.points_earned > 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                          {entry.points_earned > 0 ? `+${entry.points_earned}` : `-${entry.points_spent}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Credit balance (legacy field) */}
              {Number(detailCustomer.credit_balance) > 0 && !(detailCustomer as any).credit_account && (
                <div className="flex items-center justify-between rounded-lg border p-3 mt-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Saldo de Credito
                  </div>
                  <span className="font-bold text-lg">{formatCurrency(detailCustomer.credit_balance)}</span>
                </div>
              )}

              {/* Notes */}
              {(detailCustomer.notes || (detailCustomer as any).internal_notes) && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Notas</p>
                  {detailCustomer.notes && (
                    <p className="text-sm bg-muted/50 rounded-md p-3 mb-2">{detailCustomer.notes}</p>
                  )}
                  {(detailCustomer as any).internal_notes && (
                    <p className="text-sm bg-amber-500/5 border border-amber-500/20 rounded-md p-3 text-amber-200">
                      <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold block mb-1">Nota Interna</span>
                      {(detailCustomer as any).internal_notes}
                    </p>
                  )}
                </div>
              )}

              {/* Addresses */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Direcciones</p>
                  <Button variant="outline" size="sm" onClick={openAddAddress}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Agregar
                  </Button>
                </div>
                {(!detailCustomer.addresses || detailCustomer.addresses.length === 0) ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sin direcciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {detailCustomer.addresses.map((addr) => (
                      <div key={addr.id} className="flex items-start justify-between rounded-lg border p-3">
                        <div className="flex items-start gap-2">
                          <Home className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="text-sm">
                            <div className="flex items-center gap-2">
                              {addr.label && <span className="font-medium">{addr.label}</span>}
                              {addr.is_default && <Badge variant="outline" className="text-xs">Predeterminada</Badge>}
                            </div>
                            <p className="text-muted-foreground">
                              {addr.street}
                              {addr.neighborhood && `, ${addr.neighborhood}`}
                            </p>
                            <p className="text-muted-foreground">
                              {addr.city}, {addr.state} {addr.zip_code}
                            </p>
                            {addr.reference && (
                              <p className="text-xs text-muted-foreground mt-1 italic">{addr.reference}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAddress(addr)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteAddress(addr.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer with actions */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Registrado el {new Date(detailCustomer.created_at).toLocaleDateString('es-MX')}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openEdit(detailCustomer); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Address Dialog ──────────────────────────────────── */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleAddressSubmit}>
            <DialogHeader>
              <DialogTitle>{editingAddress ? 'Editar Direccion' : 'Nueva Direccion'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="addr_label">Etiqueta</Label>
                <Input
                  id="addr_label"
                  placeholder="Casa, Oficina, Bodega..."
                  value={addressForm.label}
                  onChange={(e) => setAddressForm((p) => ({ ...p, label: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr_street">Calle y Numero *</Label>
                <Input
                  id="addr_street"
                  placeholder="Av. Reforma 123"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm((p) => ({ ...p, street: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr_neighborhood">Colonia</Label>
                <Input
                  id="addr_neighborhood"
                  placeholder="Juarez"
                  value={addressForm.neighborhood}
                  onChange={(e) => setAddressForm((p) => ({ ...p, neighborhood: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="addr_city">Ciudad *</Label>
                  <Input
                    id="addr_city"
                    placeholder="Ciudad de Mexico"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addr_state">Estado *</Label>
                  <Input
                    id="addr_state"
                    placeholder="CDMX"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm((p) => ({ ...p, state: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="addr_zip">Codigo Postal *</Label>
                  <Input
                    id="addr_zip"
                    placeholder="06600"
                    maxLength={10}
                    value={addressForm.zip_code}
                    onChange={(e) => setAddressForm((p) => ({ ...p, zip_code: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addr_country">Pais</Label>
                  <Input
                    id="addr_country"
                    value={addressForm.country}
                    onChange={(e) => setAddressForm((p) => ({ ...p, country: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr_ref">Referencia de entrega</Label>
                <Textarea
                  id="addr_ref"
                  rows={2}
                  className="resize-none"
                  placeholder="Entre calle X y calle Y, edificio azul..."
                  value={addressForm.reference}
                  onChange={(e) => setAddressForm((p) => ({ ...p, reference: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addressForm.is_default}
                  onChange={(e) => setAddressForm((p) => ({ ...p, is_default: e.target.checked }))}
                  className="rounded border-input"
                />
                <span className="text-sm">Direccion predeterminada</span>
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddressDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editingAddress ? 'Guardar' : 'Agregar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
