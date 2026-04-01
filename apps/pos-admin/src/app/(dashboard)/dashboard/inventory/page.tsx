'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Badge, Card, CardContent, Input,
  Skeleton, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@nivo/ui';
import {
  Search, Package, Warehouse, MoreVertical, Trash2,
  MapPin, ArrowRightLeft, LayoutGrid,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';

// ─── Types ────────────────────────────────────────────────────────

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

interface InventoryLocationEntry {
  id: string;
  variant_id: string;
  branch_id: string;
  location_id: string;
  quantity: number;
  variant: {
    id: string;
    sku: string;
    attributes: Record<string, string>;
    product?: { id: string; name: string; images: string[] };
  };
  location: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
}

interface StorageLocationFlat {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Branch {
  id: string;
  name: string;
}

// ─── Stock General Tab (original) ────────────────────────────────

function StockGeneralTab() {
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
    <div className="space-y-4">
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
              {search ? 'No se encontraron productos con ese criterio.' : 'No hay productos en el catalogo aun.'}
            </p>
            {!search && <p className="text-sm text-muted-foreground mt-1">Crea modelos desde la seccion "Modelos de Zapatos".</p>}
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
                      <p className="text-xs text-muted-foreground">+{product.variants.length - 6} mas...</p>
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

// ─── Stock by Location Tab ───────────────────────────────────────

function StockByLocationTab() {
  const { selectedBranchId, isGeneralSelected } = useBranchStore();
  const [entries, setEntries] = useState<InventoryLocationEntry[]>([]);
  const [locations, setLocations] = useState<StorageLocationFlat[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [filterLocationId, setFilterLocationId] = useState<string>('');
  const [search, setSearch] = useState('');

  // Assign dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignVariantId, setAssignVariantId] = useState('');
  const [assignLocationId, setAssignLocationId] = useState('');
  const [assignQuantity, setAssignQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  // Move dialog
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveEntry, setMoveEntry] = useState<InventoryLocationEntry | null>(null);
  const [moveToLocationId, setMoveToLocationId] = useState('');
  const [moveQuantity, setMoveQuantity] = useState(1);

  useEffect(() => {
    if (!isGeneralSelected && selectedBranchId) {
      setActiveBranchId(selectedBranchId);
    }
  }, [isGeneralSelected, selectedBranchId]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await apiClient.get('/branches');
        setBranches(res.data);
        if (isGeneralSelected && res.data.length > 0 && !activeBranchId) {
          setActiveBranchId(res.data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchBranches();
  }, []);

  // Fetch locations for filter dropdown
  useEffect(() => {
    if (!activeBranchId) return;
    const fetchLocs = async () => {
      try {
        const res = await apiClient.get('/storage-locations', { params: { branch_id: activeBranchId } });
        setLocations(res.data.flat || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchLocs();
  }, [activeBranchId]);

  const fetchEntries = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const params: any = { branch_id: activeBranchId };
      if (filterLocationId) params.location_id = filterLocationId;
      const res = await apiClient.get('/products/inventory/by-location', { params });
      setEntries(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, filterLocationId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filteredEntries = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.variant?.sku?.toLowerCase().includes(q) ||
      e.variant?.product?.name?.toLowerCase().includes(q) ||
      e.location?.code?.toLowerCase().includes(q) ||
      Object.values(e.variant?.attributes || {}).some((a) => a.toLowerCase().includes(q))
    );
  });

  const handleAssign = async () => {
    if (!assignVariantId || !assignLocationId || assignQuantity <= 0) return;
    setSaving(true);
    try {
      await apiClient.post('/products/inventory/assign-location', {
        variant_id: assignVariantId,
        branch_id: activeBranchId,
        location_id: assignLocationId,
        quantity: assignQuantity,
      });
      toast({ title: 'Stock asignado a ubicacion' });
      setShowAssignDialog(false);
      fetchEntries();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al asignar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async () => {
    if (!moveEntry || !moveToLocationId || moveQuantity <= 0) return;
    setSaving(true);
    try {
      await apiClient.post('/products/inventory/move-location', {
        variant_id: moveEntry.variant_id,
        branch_id: activeBranchId,
        from_location_id: moveEntry.location_id,
        to_location_id: moveToLocationId,
        quantity: moveQuantity,
      });
      toast({ title: 'Stock movido exitosamente' });
      setShowMoveDialog(false);
      setMoveEntry(null);
      fetchEntries();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al mover', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openMoveDialog = (entry: InventoryLocationEntry) => {
    setMoveEntry(entry);
    setMoveToLocationId('');
    setMoveQuantity(1);
    setShowMoveDialog(true);
  };

  const formatAttributes = (attrs: Record<string, string>) =>
    Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(' · ');

  return (
    <div className="space-y-4">
      {/* Branch selector for General mode */}
      {isGeneralSelected && branches.length > 0 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Sucursal:</Label>
          <Select value={activeBranchId} onValueChange={(v) => { setActiveBranchId(v); setFilterLocationId(''); }}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecciona una sucursal" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por SKU, producto o ubicacion..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {locations.length > 0 && (
          <Select value={filterLocationId} onValueChange={setFilterLocationId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas las ubicaciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!activeBranchId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Warehouse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Selecciona una sucursal para ver el stock por ubicacion.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {search || filterLocationId ? 'No se encontraron resultados.' : 'No hay stock asignado a ubicaciones aun.'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Asigna stock a ubicaciones desde los ajustes de inventario.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ubicacion</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Atributos</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{entry.location?.code}</Badge>
                      <span className="text-xs text-muted-foreground">{entry.location?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{entry.variant?.product?.name || '—'}</TableCell>
                  <TableCell className="font-mono text-sm">{entry.variant?.sku}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatAttributes(entry.variant?.attributes || {})}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{entry.quantity}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMoveDialog(entry)} title="Mover">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={(v) => !v && setShowMoveDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Stock</DialogTitle>
          </DialogHeader>
          {moveEntry && (
            <div className="space-y-4 mt-2">
              <div className="text-sm">
                <p><span className="font-medium">Variante:</span> {moveEntry.variant?.sku}</p>
                <p><span className="font-medium">Desde:</span> {moveEntry.location?.code} — {moveEntry.location?.name}</p>
                <p><span className="font-medium">Disponible:</span> {moveEntry.quantity}</p>
              </div>
              <div className="space-y-2">
                <Label>Ubicacion destino</Label>
                <Select value={moveToLocationId} onValueChange={setMoveToLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.filter((l) => l.id !== moveEntry.location_id).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min={1}
                  max={moveEntry.quantity}
                  value={moveQuantity}
                  onChange={(e) => setMoveQuantity(Math.max(1, Number(e.target.value)))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>Cancelar</Button>
            <Button onClick={handleMove} disabled={saving || !moveToLocationId}>
              {saving ? 'Moviendo...' : 'Mover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventario</h2>
          <p className="text-muted-foreground">Stock por sucursal y variantes</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Stock General
          </TabsTrigger>
          <TabsTrigger value="by-location" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Por Ubicacion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <StockGeneralTab />
        </TabsContent>

        <TabsContent value="by-location">
          <StockByLocationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
