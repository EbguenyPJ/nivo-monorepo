'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button, Badge, Card, CardContent, Input, Label, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Skeleton, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@nivo/ui';
import {
  Plus, MapPin, MoreVertical, Pencil, Users, Power, Store,
  Phone, DollarSign, Monitor,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';

// ─── Types ──────────────────────────────────────────────────────
interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  phone: string | null;
  ticket_footer: string | null;
  is_active: boolean;
  created_at: string;
}

interface BranchForm {
  name: string;
  code: string;
  address: string;
  city: string;
  zip_code: string;
  phone: string;
  ticket_footer: string;
}

const emptyForm: BranchForm = {
  name: '', code: '', address: '', city: '', zip_code: '', phone: '', ticket_footer: '',
};

// ─── Component ──────────────────────────────────────────────────
export default function BranchesPage() {
  const router = useRouter();
  const { fetchBranches: refreshHeaderBranches } = useBranchStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [codeManual, setCodeManual] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<Branch | null>(null);
  const [toggling, setToggling] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────
  const fetchBranches = async () => {
    try {
      const response = await apiClient.get('/branches?includeInactive=true');
      setBranches(response.data);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBranches(); }, []);

  // ─── Auto-generate code ───────────────────────────────────────
  const generateCode = (name: string): string => {
    return name
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .map(w => w.slice(0, 4))
      .join('-')
      .slice(0, 20) || '';
  };

  const updateField = (key: keyof BranchForm, value: string) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      // Auto-generate code from name if not manually edited
      if (key === 'name' && !codeManual && !editingBranch) {
        updated.code = generateCode(value);
      }
      return updated;
    });
  };

  // ─── Dialog handlers ──────────────────────────────────────────
  const openCreate = () => {
    setEditingBranch(null);
    setForm(emptyForm);
    setCodeManual(false);
    setDialogOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      city: branch.city || '',
      zip_code: branch.zip_code || '',
      phone: branch.phone || '',
      ticket_footer: branch.ticket_footer || '',
    });
    setCodeManual(true);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: 'Error', description: 'Nombre y código son obligatorios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingBranch) {
        await apiClient.put(`/branches/${editingBranch.id}`, form);
        toast({ title: 'Sucursal actualizada', description: `"${form.name}" se actualizó correctamente.` });
      } else {
        await apiClient.post('/branches', form);
        toast({ title: 'Sucursal creada', description: `"${form.name}" se creó correctamente.` });
      }
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingBranch(null);
      await fetchBranches();
      refreshHeaderBranches();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al guardar la sucursal', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle status ────────────────────────────────────────────
  const handleToggleStatus = async () => {
    if (!confirmToggle) return;
    setToggling(true);
    try {
      await apiClient.patch(`/branches/${confirmToggle.id}/toggle-status`);
      toast({
        title: confirmToggle.is_active ? 'Sucursal desactivada' : 'Sucursal reactivada',
        description: `"${confirmToggle.name}" ${confirmToggle.is_active ? 'ya no puede operar.' : 'vuelve a estar activa.'}`,
      });
      setConfirmToggle(null);
      await fetchBranches();
      refreshHeaderBranches();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al cambiar el estado', variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  // ─── Stats (placeholder – will connect to real data later) ────
  const activeBranches = branches.filter(b => b.is_active);
  const inactiveBranches = branches.filter(b => !b.is_active);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sucursales</h2>
          <p className="text-muted-foreground">
            {branches.length} sucursal{branches.length !== 1 ? 'es' : ''} registrada{branches.length !== 1 ? 's' : ''}
            {inactiveBranches.length > 0 && (
              <span className="text-muted-foreground/60"> · {inactiveBranches.length} inactiva{inactiveBranches.length !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva Sucursal
        </Button>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">¿Cómo funciona?</span>{' '}
          Tu catálogo de productos, clientes y formas de pago son <span className="font-medium">globales</span> (compartidos en todas las sucursales).
          El inventario físico, las ventas y los cortes de caja son <span className="font-medium">exclusivos</span> de cada sucursal.
          Usa el selector de sucursal en la barra superior para cambiar de contexto.
        </p>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No hay sucursales registradas</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Crea tu primera sucursal para empezar a operar. Podrás configurar su dirección, teléfono y el mensaje que aparecerá en los tickets de venta.
            </p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Crear Primera Sucursal
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Grid of Branch Cards */
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Active branches first, then inactive */}
          {[...activeBranches, ...inactiveBranches].map((branch) => (
            <Card
              key={branch.id}
              className={`relative transition-all ${!branch.is_active ? 'opacity-60 border-dashed' : 'hover:shadow-md'}`}
            >
              <CardContent className="p-5">
                {/* Top row: Name + Badge + Menu */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${branch.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                      <MapPin className={`h-5 w-5 ${branch.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base truncate">{branch.name}</h3>
                        <Badge variant={branch.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
                          {branch.is_active ? 'Activa' : 'Cerrada'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{branch.code}</p>
                    </div>
                  </div>

                  {/* 3-dot menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => openEdit(branch)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar Detalles
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/dashboard/employees?branch=${branch.id}`)}>
                        <Users className="h-4 w-4 mr-2" />
                        Ver Personal
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setConfirmToggle(branch)}
                        className={branch.is_active ? 'text-destructive focus:text-destructive' : 'text-green-600 focus:text-green-600'}
                      >
                        <Power className="h-4 w-4 mr-2" />
                        {branch.is_active ? 'Desactivar Sucursal' : 'Reactivar Sucursal'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium">Ventas hoy</span>
                    </div>
                    <p className="text-lg font-bold tracking-tight">$0.00</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                      <Monitor className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium">Cajas</span>
                    </div>
                    <p className="text-lg font-bold tracking-tight">
                      0 <span className="text-sm font-normal text-muted-foreground">abiertas</span>
                    </p>
                  </div>
                </div>

                {/* Context Row: Address & Phone */}
                <div className="space-y-1">
                  {(branch.address || branch.city) && (
                    <p className="text-xs text-muted-foreground truncate">
                      📍 {[branch.address, branch.city, branch.zip_code].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {branch.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {branch.phone}
                    </p>
                  )}
                  {!branch.address && !branch.city && !branch.phone && (
                    <p className="text-xs text-muted-foreground/50 italic">Sin dirección ni teléfono configurados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Create/Edit Dialog ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
              </DialogTitle>
              <DialogDescription>
                {editingBranch
                  ? 'Modifica los datos de la sucursal.'
                  : 'Ingresa los datos para crear una nueva sucursal.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Required fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="branch-name">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="branch-name"
                    placeholder="Plaza Las Américas"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch-code">
                    Código <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="branch-code"
                    placeholder="AMER-01"
                    value={form.code}
                    onChange={(e) => {
                      setCodeManual(true);
                      updateField('code', e.target.value.toUpperCase());
                    }}
                    maxLength={20}
                    className="font-mono uppercase"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Usado en tickets y prefijos de facturas
                  </p>
                </div>
              </div>

              {/* Optional fields */}
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Datos opcionales</p>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="branch-address">Dirección</Label>
                    <Input
                      id="branch-address"
                      placeholder="Av. Reforma #123, Col. Centro"
                      value={form.address}
                      onChange={(e) => updateField('address', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="branch-city">Ciudad</Label>
                      <Input
                        id="branch-city"
                        placeholder="Guadalajara"
                        value={form.city}
                        onChange={(e) => updateField('city', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-zip">Código Postal</Label>
                      <Input
                        id="branch-zip"
                        placeholder="44100"
                        value={form.zip_code}
                        onChange={(e) => updateField('zip_code', e.target.value)}
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branch-phone">Teléfono de la tienda</Label>
                    <Input
                      id="branch-phone"
                      placeholder="33 1234 5678"
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branch-footer">Mensaje al pie del ticket</Label>
                    <Textarea
                      id="branch-footer"
                      placeholder="¡Gracias por su compra en sucursal Centro!"
                      value={form.ticket_footer}
                      onChange={(e) => updateField('ticket_footer', e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Aparecerá impreso en los tickets de venta de esta sucursal
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editingBranch ? 'Guardar Cambios' : 'Crear Sucursal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Toggle Status Confirmation ──────────────────────────── */}
      <Dialog open={!!confirmToggle} onOpenChange={(open) => !open && setConfirmToggle(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmToggle?.is_active ? '🚫 Desactivar Sucursal' : '✅ Reactivar Sucursal'}
            </DialogTitle>
            <DialogDescription>
              {confirmToggle?.is_active
                ? `Al desactivar "${confirmToggle.name}", no se podrán registrar nuevas ventas ni asignar stock. El historial se conserva.`
                : `Al reactivar "${confirmToggle?.name}", volverá a estar disponible para operaciones.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmToggle(null)} disabled={toggling}>
              Cancelar
            </Button>
            <Button
              variant={confirmToggle?.is_active ? 'destructive' : 'default'}
              onClick={handleToggleStatus}
              disabled={toggling}
            >
              {toggling ? 'Procesando...' : confirmToggle?.is_active ? 'Desactivar' : 'Reactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
