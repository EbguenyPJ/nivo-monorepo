'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Button, Input, Label, Badge, Switch, Skeleton, toast, cn,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@nivo/ui';
import { Plus, Pencil, Search } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';

interface ColorData {
  id: string;
  name: string;
  hex_code: string;
  branch_id: string | null;
  branch: { id: string; name: string } | null;
  is_active: boolean;
}

export function ColorsGrid() {
  const [colors, setColors] = useState<ColorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ColorData | null>(null);
  const [saving, setSaving] = useState(false);
  const { branches } = useBranchStore();

  // Form state
  const [formName, setFormName] = useState('');
  const [formHex, setFormHex] = useState('#000000');
  const [formBranchId, setFormBranchId] = useState<string>('__global__');

  const fetchColors = useCallback(async () => {
    try {
      const res = await apiClient.get('/catalogs/colors');
      setColors(res.data);
    } catch {
      toast({ title: 'Error al cargar colores', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormHex('#000000');
    setFormBranchId('__global__');
    setDialogOpen(true);
  };

  const openEdit = (color: ColorData) => {
    setEditing(color);
    setFormName(color.name);
    setFormHex(color.hex_code);
    setFormBranchId(color.branch_id || '__global__');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);

    const payload = {
      name: formName.trim(),
      hex_code: formHex,
      branch_id: formBranchId === '__global__' ? null : formBranchId,
    };

    try {
      if (editing) {
        await apiClient.patch(`/catalogs/colors/${editing.id}`, payload);
        toast({ title: 'Color actualizado' });
      } else {
        await apiClient.post('/catalogs/colors', payload);
        toast({ title: 'Color creado' });
      }
      setDialogOpen(false);
      await fetchColors();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (color: ColorData) => {
    try {
      await apiClient.patch(`/catalogs/colors/${color.id}`, { is_active: !color.is_active });
      setColors((prev) => prev.map((c) => (c.id === color.id ? { ...c, is_active: !c.is_active } : c)));
    } catch {
      toast({ title: 'Error al cambiar estado', variant: 'destructive' });
    }
  };

  const filtered = colors.filter((c) => {
    if (!search) return true;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });

  const activeColors = filtered.filter((c) => c.is_active);
  const inactiveColors = filtered.filter((c) => !c.is_active);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar color..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Nuevo Color
        </Button>
      </div>

      {/* Color List */}
      <div className="border rounded-lg divide-y">
        {activeColors.map((color) => (
          <div
            key={color.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
          >
            {/* Color sphere */}
            <div
              className="h-8 w-8 rounded-full border-2 border-border shadow-sm shrink-0"
              style={{ backgroundColor: color.hex_code }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{color.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{color.hex_code}</span>
              </div>
              <div className="mt-0.5">
                {color.branch_id === null ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Global</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {color.branch?.name || 'Sucursal'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => openEdit(color)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <Switch
                checked={color.is_active}
                onCheckedChange={() => handleToggle(color)}
              />
            </div>
          </div>
        ))}

        {/* Add row shortcut */}
        <div className="px-4 py-2">
          <button
            onClick={openCreate}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1"
          >
            <span className="text-lg leading-none">+</span> Añadir color
          </button>
        </div>

        {/* Inactive section */}
        {inactiveColors.length > 0 && (
          <>
            <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground font-medium">
              Inactivos ({inactiveColors.length})
            </div>
            {inactiveColors.map((color) => (
              <div
                key={color.id}
                className="flex items-center gap-3 px-4 py-3 opacity-50"
              >
                <div
                  className="h-8 w-8 rounded-full border-2 border-border shadow-sm shrink-0"
                  style={{ backgroundColor: color.hex_code }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-muted-foreground">{color.name}</span>
                  <span className="text-xs text-muted-foreground font-mono ml-2">{color.hex_code}</span>
                </div>
                <Switch
                  checked={color.is_active}
                  onCheckedChange={() => handleToggle(color)}
                />
              </div>
            ))}
          </>
        )}

        {activeColors.length === 0 && inactiveColors.length === 0 && (
          <div className="text-center text-muted-foreground py-8 text-sm">
            No hay colores registrados. Haz clic en &quot;+ Nuevo Color&quot; para comenzar.
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Color' : 'Nuevo Color'}</DialogTitle>
              <DialogDescription>
                {editing ? 'Modifica el nombre, tono o alcance de este color.' : 'Agrega un color al catálogo de tu zapatería.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Color preview + picker */}
              <div className="flex items-center gap-4">
                <div
                  className="h-16 w-16 rounded-xl border-2 border-border shadow-sm shrink-0"
                  style={{ backgroundColor: formHex }}
                />
                <div className="flex-1 space-y-2">
                  <Label>Nombre del Color</Label>
                  <Input
                    placeholder="Ej. Azul Marino"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Hex picker */}
              <div className="space-y-2">
                <Label>Código de Color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={formHex}
                    onChange={(e) => setFormHex(e.target.value)}
                    className="h-10 w-14 rounded-lg border border-border cursor-pointer bg-transparent"
                  />
                  <Input
                    value={formHex}
                    onChange={(e) => setFormHex(e.target.value)}
                    placeholder="#000000"
                    className="font-mono uppercase flex-1"
                    maxLength={9}
                  />
                </div>
              </div>

              {/* Branch scope */}
              <div className="space-y-2">
                <Label>Alcance</Label>
                <Select value={formBranchId} onValueChange={setFormBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar alcance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">🌐 Global (todas las sucursales)</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>🏪 {b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Los colores globales están disponibles para todas las sucursales.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Color'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
