'use client';

import { useEffect, useState } from 'react';
import {
  Button, Badge, Card, CardContent, Input,
  Skeleton, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@nivo/ui';
import { Search, Package, Warehouse, MoreVertical, Trash2, Power } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ProductVariant {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price_override: number | null;
  cost: number;
  barcode: string | null;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  images: string[];
  image_url: string | null;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  variants: ProductVariant[];
  is_active: boolean;
  created_at: string;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const handleDelete = async (product: Product) => {
    try {
      await apiClient.delete(`/products/${product.id}`);
      toast({ title: 'Producto eliminado', description: `"${product.name}" fue eliminado.` });
      await fetchProducts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al eliminar', variant: 'destructive' });
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand?.name.toLowerCase().includes(q) ||
      p.variants.some(
        (v) =>
          v.sku.toLowerCase().includes(q) ||
          v.barcode?.toLowerCase().includes(q) ||
          Object.values(v.attributes).some((a) => a.toLowerCase().includes(q)),
      )
    );
  });

  const getVariantPrice = (product: Product, variant: ProductVariant) =>
    variant.price_override ?? product.base_price ?? 0;

  const getPriceRange = (product: Product) => {
    if (!product.variants.length) return `$${Number(product.base_price || 0).toFixed(2)}`;
    const prices = product.variants.map((v) => getVariantPrice(product, v));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return `$${min.toFixed(2)}`;
    return `$${min.toFixed(2)} – $${max.toFixed(2)}`;
  };

  const formatAttributes = (attrs: Record<string, string>) =>
    Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(' · ');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventario</h2>
          <p className="text-muted-foreground">Stock por sucursal y variantes</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, SKU, marca o atributo..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <Warehouse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {search ? 'No se encontraron productos con ese criterio.' : 'No hay productos en el catálogo aún.'}
            </p>
            {!search && <p className="text-sm text-muted-foreground mt-1">Crea modelos desde la sección "Modelos de Zapatos".</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {product.images?.[0] || product.image_url ? (
                        <img src={product.images?.[0] || product.image_url || ''} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {product.brand && <Badge variant="outline" className="text-xs">{product.brand.name}</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {product.variants.length} variante{product.variants.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">{getPriceRange(product)}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => handleDelete(product)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Variants detail */}
                {product.variants.length > 0 && (
                  <div className="ml-13 pl-3 border-l-2 border-border space-y-1">
                    {product.variants.slice(0, 6).map((v) => (
                      <div key={v.id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-foreground">{v.sku}</span>
                          <span>{formatAttributes(v.attributes)}</span>
                        </div>
                        <span className="font-medium text-foreground">
                          ${Number(getVariantPrice(product, v)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {product.variants.length > 6 && (
                      <p className="text-xs text-muted-foreground">+{product.variants.length - 6} más...</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
