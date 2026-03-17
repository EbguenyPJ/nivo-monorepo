'use client';

import { useEffect, useState } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Skeleton, toast,
} from '@nivo/ui';
import { Plus, Search, Package, Trash2, X } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  size_mex: number;
  price: number;
  cost: number;
  barcode: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  variants: ProductVariant[];
  created_at: string;
}

interface VariantForm {
  sku: string;
  color: string;
  size_mex: string;
  price: string;
  cost: string;
  barcode: string;
}

const emptyVariant = (): VariantForm => ({
  sku: '', color: '', size_mex: '', price: '', cost: '', barcode: '',
});

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', image_url: '' });
  const [variants, setVariants] = useState<VariantForm[]>([emptyVariant()]);

  const fetchProducts = async () => {
    try {
      const response = await apiClient.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openCreate = () => {
    setForm({ name: '', description: '', image_url: '' });
    setVariants([emptyVariant()]);
    setDialogOpen(true);
  };

  const addVariant = () => setVariants((prev) => [...prev, emptyVariant()]);

  const removeVariant = (index: number) => {
    if (variants.length <= 1) return;
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantForm, value: string) => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        image_url: form.image_url || undefined,
        variants: variants.map((v) => ({
          sku: v.sku,
          color: v.color,
          size_mex: parseFloat(v.size_mex),
          price: parseFloat(v.price),
          cost: parseFloat(v.cost),
          barcode: v.barcode || undefined,
        })),
      };
      await apiClient.post('/products', payload);
      setDialogOpen(false);
      await fetchProducts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al crear el producto', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Eliminar "${product.name}"? Esta acción se puede revertir.`)) return;
    try {
      await apiClient.delete(`/products/${product.id}`);
      await fetchProducts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al eliminar el producto', variant: 'destructive' });
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand?.name.toLowerCase().includes(q) ||
      p.variants.some((v) => v.sku.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q))
    );
  });

  const getPriceRange = (vars: ProductVariant[]) => {
    if (!vars.length) return '$0';
    const prices = vars.map((v) => v.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return `$${min.toFixed(2)}`;
    return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventario</h2>
          <p className="text-muted-foreground">Gestiona tu catálogo de zapatos</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </Button>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Nuevo Producto</DialogTitle>
                <DialogDescription>Agrega un modelo de zapato con sus variantes de talla y color.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Modelo</Label>
                    <Input
                      id="name"
                      placeholder="Nike Air Max 90"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Input
                      id="description"
                      placeholder="Tenis deportivo con cámara de aire"
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image_url">URL de Imagen</Label>
                    <Input
                      id="image_url"
                      placeholder="https://ejemplo.com/foto.jpg"
                      value={form.image_url}
                      onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">Variantes</Label>
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addVariant}>
                      <Plus className="h-3 w-3" />
                      Agregar
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {variants.map((variant, index) => (
                      <div key={index} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Variante {index + 1}</span>
                          {variants.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeVariant(index)}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">SKU</Label>
                            <Input placeholder="AM90-BLK-26" value={variant.sku} onChange={(e) => updateVariant(index, 'sku', e.target.value)} required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Color</Label>
                            <Input placeholder="Negro" value={variant.color} onChange={(e) => updateVariant(index, 'color', e.target.value)} required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Talla (MX)</Label>
                            <Input type="number" step="0.5" placeholder="26" value={variant.size_mex} onChange={(e) => updateVariant(index, 'size_mex', e.target.value)} required />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Precio</Label>
                            <Input type="number" step="0.01" placeholder="2499.00" value={variant.price} onChange={(e) => updateVariant(index, 'price', e.target.value)} required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Costo</Label>
                            <Input type="number" step="0.01" placeholder="1200.00" value={variant.cost} onChange={(e) => updateVariant(index, 'cost', e.target.value)} required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Código de Barras</Label>
                            <Input placeholder="7501234567890" value={variant.barcode} onChange={(e) => updateVariant(index, 'barcode', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Creando...' : 'Crear Producto'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, SKU o marca..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {search ? 'No se encontraron productos con ese criterio.' : 'No hay productos en el catálogo aún.'}
            </p>
            {!search && <p className="text-sm text-muted-foreground">Agrega tu primer modelo de zapato para comenzar.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {product.brand && <Badge variant="outline">{product.brand.name}</Badge>}
                      {product.category && <Badge variant="secondary">{product.category.name}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {product.variants.length} variante{product.variants.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">{getPriceRange(product.variants)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(product.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(product)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
