'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  MapPin, ArrowRightLeft, LayoutGrid, AlertCircle, Check, Filter,
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

interface InventoryRow {
  id: string;
  variant_id: string;
  branch_id: string;
  stock_available: number;
  variant: {
    id: string;
    sku: string;
    attributes: Record<string, string>;
    product?: { id: string; name: string };
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
  const { selectedBranchId, isGeneralSelected } = useBranchStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [calculatedPrices, setCalculatedPrices] = useState<Record<string, { min: number; max: number }>>({});
  const [variantPrices, setVariantPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const getEffectiveBranchId = useBranchStore((s) => s.getEffectiveBranchId);

  const fetchPrices = async () => {
    const effectiveBranch = getEffectiveBranchId();
    if (!effectiveBranch) return;
    try {
      const [listRes, varRes] = await Promise.all([
        apiClient.get(`/pricing/product-list-prices?branch_id=${effectiveBranch}`),
        apiClient.get(`/pricing/variant-prices?branch_id=${effectiveBranch}`),
      ]);
      setCalculatedPrices(listRes.data);
      setVariantPrices(varRes.data);
    } catch { /* prices will fall back to base_price */ }
  };

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
    fetchProducts().then(() => fetchPrices());
  }, []);

  // Refetch prices when branch changes
  useEffect(() => {
    if (products.length > 0) fetchPrices();
  }, [selectedBranchId, products]);

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

  const getVariantPrice = (variant: ProductVariant) => {
    // Use pricing engine price first, fallback to raw entity
    if (variantPrices[variant.id] != null) return variantPrices[variant.id];
    const override = variant.price_override != null ? Number(variant.price_override) : null;
    return override ?? 0;
  };

  const getPriceRange = (product: Product) => {
    const calc = calculatedPrices[product.id];
    if (calc) {
      if (calc.min === 0 && calc.max === 0) return '$0.00';
      return calc.min === calc.max
        ? `$${calc.min.toFixed(2)}`
        : `$${calc.min.toFixed(2)} – $${calc.max.toFixed(2)}`;
    }
    if (!product.variants.length) return `$${Number(product.base_price || 0).toFixed(2)}`;
    const prices = product.variants.map((v) => getVariantPrice(v));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return `$${min.toFixed(2)}`;
    return `$${min.toFixed(2)} – $${max.toFixed(2)}`;
  };

  const formatAttributes = (attrs: Record<string, string>) =>
    Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(' · ');

  const toggleExpand = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const INITIAL_VISIBLE = 6;

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
          {filteredProducts.map((product) => {
            const isExpanded = expandedProducts.has(product.id);
            const visibleVariants = isExpanded ? product.variants : product.variants.slice(0, INITIAL_VISIBLE);
            const hiddenCount = product.variants.length - INITIAL_VISIBLE;

            return (
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
                      {visibleVariants.map((v) => (
                        <div key={v.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-foreground">{v.sku}</span>
                            <span>{formatAttributes(v.attributes)}</span>
                          </div>
                          <span className="font-medium text-foreground">
                            ${getVariantPrice(v).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          onClick={() => toggleExpand(product.id)}
                          className="text-xs text-primary hover:underline font-medium pt-1"
                        >
                          {isExpanded ? 'Ver menos' : `+${hiddenCount} variante${hiddenCount !== 1 ? 's' : ''} mas...`}
                        </button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Stock by Location Tab ───────────────────────────────────────

// ─── Inline Assign Row ───────────────────────────────────────────

function InlineAssignRow({
  row,
  unlocated,
  locations,
  branchId,
  onAssigned,
}: {
  row: InventoryRow;
  unlocated: number;
  locations: StorageLocationFlat[];
  branchId: string;
  onAssigned: () => void;
}) {
  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState(unlocated);
  const [saving, setSaving] = useState(false);

  // Reset qty when unlocated changes
  useEffect(() => { setQty(unlocated); }, [unlocated]);

  const handleAssign = async () => {
    if (!locationId || qty <= 0) return;
    setSaving(true);
    try {
      await apiClient.post('/products/inventory/assign-location', {
        variant_id: row.variant_id,
        branch_id: branchId,
        location_id: locationId,
        quantity: qty,
      });
      toast({ title: 'Asignado', description: `${qty} unidad(es) de ${row.variant?.sku} ubicadas` });
      setLocationId('');
      onAssigned();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al asignar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const formatAttrs = (attrs: Record<string, string>) =>
    Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(' · ');

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <Badge variant="outline" className="text-xs font-medium border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20">
          Sin ubicar
        </Badge>
      </TableCell>
      <TableCell className="font-medium text-foreground">{row.variant?.product?.name || '—'}</TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">{row.variant?.sku}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatAttrs(row.variant?.attributes || {})}
      </TableCell>
      <TableCell>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          max={unlocated}
          value={qty}
          onChange={(e) => setQty(Math.min(unlocated, Math.max(1, Number(e.target.value))))}
          className="h-8 w-20 text-xs"
        />
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          onClick={handleAssign}
          disabled={saving || !locationId || qty <= 0}
          className="h-8 px-3 text-xs"
        >
          {saving ? '...' : <><Check className="h-3.5 w-3.5 mr-1" /> Asignar</>}
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ─── Stock by Location Tab ───────────────────────────────────────

function StockByLocationTab() {
  const { selectedBranchId, isGeneralSelected } = useBranchStore();
  const [entries, setEntries] = useState<InventoryLocationEntry[]>([]);
  const [locations, setLocations] = useState<StorageLocationFlat[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [filterLocationId, setFilterLocationId] = useState<string>('');
  const [showOnlyUnlocated, setShowOnlyUnlocated] = useState(false);
  const [search, setSearch] = useState('');
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

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const fetchInventoryRows = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const res = await apiClient.get('/products/inventory/stock', { params: { branch_id: activeBranchId } });
      setInventoryRows(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [activeBranchId]);

  useEffect(() => { fetchInventoryRows(); }, [fetchInventoryRows]);

  // Compute unlocated per variant
  const unlocatedMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of inventoryRows) {
      const allocated = entries
        .filter((e) => e.variant_id === row.variant_id)
        .reduce((sum, e) => sum + e.quantity, 0);
      const unlocated = row.stock_available - allocated;
      if (unlocated > 0) map[row.variant_id] = unlocated;
    }
    return map;
  }, [inventoryRows, entries]);

  // Variants with unlocated stock, sorted by unlocated desc
  const unlocatedRows = useMemo(() => {
    return inventoryRows
      .filter((r) => (unlocatedMap[r.variant_id] || 0) > 0)
      .sort((a, b) => (unlocatedMap[b.variant_id] || 0) - (unlocatedMap[a.variant_id] || 0));
  }, [inventoryRows, unlocatedMap]);

  // Search filter for unlocated rows
  const filteredUnlocatedRows = unlocatedRows.filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      row.variant?.sku?.toLowerCase().includes(q) ||
      row.variant?.product?.name?.toLowerCase().includes(q) ||
      Object.values(row.variant?.attributes || {}).some((a: string) => a.toLowerCase().includes(q))
    );
  });

  // Search filter for located entries
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

  const handleRefresh = () => {
    fetchEntries();
    fetchInventoryRows();
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
      handleRefresh();
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

  const totalUnlocated = Object.values(unlocatedMap).reduce<number>((a, b) => a + b, 0);

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
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por SKU, producto o ubicacion..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {!showOnlyUnlocated && locations.length > 0 && (
          <Select value={filterLocationId || '__all__'} onValueChange={(v) => setFilterLocationId(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas las ubicaciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={showOnlyUnlocated ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowOnlyUnlocated(!showOnlyUnlocated)}
          className="shrink-0"
        >
          <Filter className="h-4 w-4 mr-2" />
          Sin ubicar
          {totalUnlocated > 0 && (
            <Badge variant={showOnlyUnlocated ? 'secondary' : 'destructive'} className="ml-2 text-xs px-1.5">
              {unlocatedRows.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Summary banner */}
      {!loading && activeBranchId && totalUnlocated > 0 && !showOnlyUnlocated && (
        <div className="flex items-center gap-2 text-sm bg-muted/50 border border-border rounded-md px-4 py-2.5 text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-orange-500 dark:text-orange-400 shrink-0" />
          <span>
            <strong className="text-foreground">{unlocatedRows.length}</strong> variante{unlocatedRows.length !== 1 ? 's' : ''} con{' '}
            <strong className="text-foreground">{totalUnlocated}</strong> unidad{totalUnlocated !== 1 ? 'es' : ''} sin ubicar
          </span>
          <button onClick={() => setShowOnlyUnlocated(true)} className="text-primary hover:underline font-medium ml-1">
            Ver todas →
          </button>
        </div>
      )}

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
      ) : showOnlyUnlocated ? (
        /* ─── Unlocated-only view with inline assign ─── */
        filteredUnlocatedRows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-muted-foreground">
                {search ? 'No se encontraron variantes sin ubicar con ese criterio.' : 'Todo el stock esta ubicado.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Atributos</TableHead>
                  <TableHead>Ubicacion</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnlocatedRows.map((row) => (
                  <InlineAssignRow
                    key={row.variant_id}
                    row={row}
                    unlocated={unlocatedMap[row.variant_id] || 0}
                    locations={locations}
                    branchId={activeBranchId}
                    onAssigned={handleRefresh}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : (
        /* ─── Full view: unlocated rows at top + located entries ─── */
        filteredUnlocatedRows.length === 0 && filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {search || filterLocationId ? 'No se encontraron resultados.' : 'No hay stock en esta sucursal aun.'}
              </p>
              {locations.length === 0 && !search && (
                <p className="text-sm text-muted-foreground mt-1">
                  Primero crea ubicaciones desde la seccion "Ubicaciones".
                </p>
              )}
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
                  <TableHead>Ubicacion destino</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Unlocated rows first */}
                {filteredUnlocatedRows.map((row) => (
                  <InlineAssignRow
                    key={`unl-${row.variant_id}`}
                    row={row}
                    unlocated={unlocatedMap[row.variant_id] || 0}
                    locations={locations}
                    branchId={activeBranchId}
                    onAssigned={handleRefresh}
                  />
                ))}
                {/* Located entries */}
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs border-primary/30 text-foreground">{entry.location?.code}</Badge>
                        <span className="text-xs text-muted-foreground">{entry.location?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{entry.variant?.product?.name || '—'}</TableCell>
                    <TableCell className="font-mono text-sm text-foreground/80">{entry.variant?.sku}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatAttributes(entry.variant?.attributes || {})}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className="font-semibold text-foreground">{entry.quantity}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openMoveDialog(entry)} title="Mover">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
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
