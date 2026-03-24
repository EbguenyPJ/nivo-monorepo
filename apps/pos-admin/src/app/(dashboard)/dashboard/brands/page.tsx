'use client';

import { useEffect, useState } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Skeleton, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  cn,
} from '@nivo/ui';
import {
  Plus, Tag, MoreVertical, Pencil, Power, Search, Upload, Link2, Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────
interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

// ─── Component ──────────────────────────────────────────────────
export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [form, setForm] = useState({ name: '', logo_url: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [logoMode, setLogoMode] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────
  const fetchBrands = async () => {
    try {
      const res = await apiClient.get('/brands?includeInactive=true');
      setBrands(res.data);
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrands(); }, []);

  // ─── Filtered ───────────────────────────────────────────────
  const filtered = brands.filter((b) =>
    !searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ─── Dialog handlers ──────────────────────────────────────────
  const openCreate = () => {
    setEditingBrand(null);
    setForm({ name: '', logo_url: '' });
    setLogoMode('upload');
    setDialogOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setForm({ name: brand.name, logo_url: brand.logo_url || '' });
    setLogoMode(brand.logo_url ? 'url' : 'upload');
    setDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/uploads/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';
      const fullUrl = `${baseUrl}${res.data.url}`;
      setForm((prev) => ({ ...prev, logo_url: fullUrl }));
      toast({ title: 'Imagen subida correctamente' });
    } catch (error: any) {
      toast({ title: 'Error al subir imagen', description: error.response?.data?.message || 'Intenta con otro archivo', variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: form.name, logo_url: form.logo_url || null };
      if (editingBrand) {
        await apiClient.put(`/brands/${editingBrand.id}`, payload);
        toast({ title: 'Marca actualizada', description: `"${form.name}" se actualizó correctamente.` });
      } else {
        await apiClient.post('/brands', payload);
        toast({ title: 'Marca creada', description: `"${form.name}" se agregó al catálogo.` });
      }
      setDialogOpen(false);
      await fetchBrands();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (brand: Brand) => {
    try {
      await apiClient.patch(`/brands/${brand.id}/toggle-status`);
      toast({
        title: brand.is_active ? 'Marca desactivada' : 'Marca reactivada',
        description: `"${brand.name}" ${brand.is_active ? 'ya no aparecerá en el catálogo.' : 'está disponible nuevamente.'}`,
      });
      await fetchBrands();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    }
  };

  // ─── Render ───────────────────────────────────────────────────
  const activeBrands = filtered.filter((b) => b.is_active);
  const inactiveBrands = filtered.filter((b) => !b.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Marcas</h2>
          <p className="text-muted-foreground">
            {brands.length} marca{brands.length !== 1 ? 's' : ''} en tu catálogo
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva Marca
        </Button>
      </div>

      {/* Search */}
      {brands.length > 0 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar marca..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Tag className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No hay marcas registradas</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Agrega las marcas de calzado que manejas para organizar mejor tu catálogo y darle una imagen profesional al Punto de Venta.
            </p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Primera Marca
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {[...activeBrands, ...inactiveBrands].map((brand) => (
            <div
              key={brand.id}
              className={`group relative rounded-xl border bg-card overflow-hidden transition-all ${
                !brand.is_active ? 'opacity-50 border-dashed' : 'hover:shadow-md hover:border-primary/30'
              }`}
            >
              {/* Logo Area */}
              <div className="aspect-square bg-muted/30 flex items-center justify-center p-4">
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
                    <span className="text-2xl font-bold text-muted-foreground/40">
                      {brand.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Name + Status */}
              <div className="px-3 py-2.5 border-t border-border">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-sm font-medium truncate">{brand.name}</h3>
                  {!brand.is_active && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">Off</Badge>
                  )}
                </div>
              </div>

              {/* Hover Menu */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-7 w-7 shadow-md">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => openEdit(brand)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleToggle(brand)}
                      className={brand.is_active ? 'text-destructive focus:text-destructive' : 'text-green-600 focus:text-green-600'}
                    >
                      <Power className="h-4 w-4 mr-2" />
                      {brand.is_active ? 'Desactivar' : 'Reactivar'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          {/* Add Card */}
          <button
            onClick={openCreate}
            className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
          >
            <Plus className="h-8 w-8" />
            <span className="text-xs font-medium">Agregar</span>
          </button>
        </div>
      )}

      {/* ─── Create/Edit Dialog ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingBrand ? 'Editar Marca' : 'Nueva Marca'}
              </DialogTitle>
              <DialogDescription>
                {editingBrand ? 'Modifica los datos de la marca.' : 'Agrega una nueva marca a tu catálogo.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="brand-name">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="brand-name"
                  placeholder="Nike"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-3">
                <Label>Logo <span className="text-muted-foreground font-normal">(opcional)</span></Label>

                {/* Mode Tabs */}
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setLogoMode('upload')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                      logoMode === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Subir archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoMode('url')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                      logoMode === 'url' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Pegar URL
                  </button>
                </div>

                {logoMode === 'upload' ? (
                  <div className="space-y-2">
                    <label
                      htmlFor="brand-file"
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 cursor-pointer transition-colors',
                        uploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/40 hover:bg-primary/5',
                      )}
                    >
                      {uploading ? (
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {uploading ? 'Subiendo...' : 'Haz clic o arrastra una imagen'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">JPG, PNG, SVG, WebP · Máx 5MB</span>
                    </label>
                    <input
                      id="brand-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </div>
                ) : (
                  <Input
                    placeholder="https://ejemplo.com/logo-nike.png"
                    value={form.logo_url}
                    onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
                  />
                )}

                {/* Preview */}
                {form.logo_url && (
                  <div className="relative mt-2 h-24 w-24 rounded-lg border border-border bg-muted/30 flex items-center justify-center p-2 mx-auto">
                    <img
                      src={form.logo_url}
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, logo_url: '' }))}
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:bg-destructive/80"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editingBrand ? 'Guardar Cambios' : 'Crear Marca'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
