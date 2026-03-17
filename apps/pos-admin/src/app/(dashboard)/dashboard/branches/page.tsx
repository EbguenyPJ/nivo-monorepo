'use client';

import { useEffect, useState } from 'react';
import {
  Button, Badge, Card, CardContent, CardHeader, CardTitle, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
  Skeleton, toast,
} from '@nivo/ui';
import { Plus, MapPin, Pencil, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  created_at: string;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });

  const fetchBranches = async () => {
    try {
      const response = await apiClient.get('/branches');
      setBranches(response.data);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const openCreate = () => {
    setEditingBranch(null);
    setForm({ name: '', address: '', phone: '' });
    setDialogOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingBranch) {
        await apiClient.put(`/branches/${editingBranch.id}`, form);
      } else {
        await apiClient.post('/branches', form);
      }
      setDialogOpen(false);
      setForm({ name: '', address: '', phone: '' });
      setEditingBranch(null);
      await fetchBranches();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al guardar la sucursal', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (branch: Branch) => {
    if (!confirm(`¿Estás seguro de eliminar la sucursal "${branch.name}"?`)) return;
    try {
      await apiClient.delete(`/branches/${branch.id}`);
      await fetchBranches();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al eliminar la sucursal', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sucursales</h2>
          <p className="text-muted-foreground">Administra las sucursales de tu negocio</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva Sucursal
          </Button>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
                </DialogTitle>
                <DialogDescription>
                  {editingBranch
                    ? 'Modifica los datos de la sucursal.'
                    : 'Agrega una nueva sucursal para tu negocio.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Sucursal</Label>
                  <Input
                    id="name"
                    placeholder="Sucursal Centro"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    placeholder="Av. Reforma #123, Col. Centro"
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    placeholder="55 1234 5678"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
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
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay sucursales registradas aún.</p>
            <p className="text-sm text-muted-foreground">
              Crea tu primera sucursal para empezar a operar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <Card key={branch.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{branch.name}</CardTitle>
                    {branch.address && (
                      <p className="text-sm text-muted-foreground">{branch.address}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {branch.phone && <p>{branch.phone}</p>}
                    <p>Creada: {new Date(branch.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(branch)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(branch)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
