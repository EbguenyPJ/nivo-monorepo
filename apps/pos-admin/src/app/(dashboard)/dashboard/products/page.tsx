'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Label, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Skeleton, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Popover, PopoverTrigger, PopoverContent,
  Checkbox, ScrollArea,
  Separator, cn,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@nivo/ui';
import {
  Plus, Package, Search, MoreVertical, Pencil, Power, Trash2,
  ChevronRight, ChevronLeft, Check, X, Upload, Link2, Loader2,
  ChevronsUpDown, Layers, Tag as TagIcon, Sparkles,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';

// ─── Types ──────────────────────────────────────────────────────
interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
}

interface CollectionNode {
  id: string;
  name: string;
  color: string | null;
  children?: CollectionNode[];
}

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
  brand: Brand | null;
  category: { id: string; name: string } | null;
  variants: ProductVariant[];
  collectionProducts?: { collection: CollectionNode }[];
  is_active: boolean;
  created_at: string;
}

// ─── Wizard Types ───────────────────────────────────────────────
interface AttributeAxis {
  name: string;       // e.g. "Color", "Talla MX"
  values: string[];   // e.g. ["Negro", "Blanco", "Rojo"]
}

interface WizardVariant {
  key: string;        // combo key for dedup
  sku: string;
  attributes: Record<string, string>;
  price_override: string;
  cost: string;
  stock: string;
  barcode: string;
  enabled: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────
/** Generate cartesian product of attribute values */
function cartesian(axes: AttributeAxis[]): Record<string, string>[] {
  if (!axes.length) return [{}];
  const [first, ...rest] = axes;
  const restCombos = cartesian(rest);
  const result: Record<string, string>[] = [];
  for (const val of first.values) {
    for (const combo of restCombos) {
      result.push({ [first.name]: val, ...combo });
    }
  }
  return result;
}

/** Build a human-readable key from attributes */
function comboKey(attrs: Record<string, string>): string {
  return Object.values(attrs).join(' / ');
}

/** Auto-generate SKU from product name + attributes */
function autoSku(productName: string, attrs: Record<string, string>): string {
  const base = productName
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 6)
    .toUpperCase();
  const suffix = Object.values(attrs)
    .map((v) => v.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase())
    .join('-');
  return `${base}-${suffix}`;
}

// ─── Steps ──────────────────────────────────────────────────────
const STEPS = [
  { label: 'Información Base', icon: Package },
  { label: 'Atributos', icon: Layers },
  { label: 'Variantes y Stock', icon: Sparkles },
];

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [collections, setCollections] = useState<CollectionNode[]>([]);
  const { selectedBranchId } = useBranchStore();

  // ─── Wizard State ───────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Base Info
  const [form, setForm] = useState({
    name: '',
    description: '',
    brand_id: '',
    base_price: '',
    images: [] as string[],
  });
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Step 2: Attribute Builder
  const [axes, setAxes] = useState<AttributeAxis[]>([
    { name: 'Color', values: [] },
    { name: 'Talla MX', values: [] },
  ]);
  const [tagInputs, setTagInputs] = useState<Record<number, string>>({});

  // Step 3: Variant Matrix
  const [variants, setVariants] = useState<WizardVariant[]>([]);

  // ─── Fetch Data ─────────────────────────────────────────────
  const fetchProducts = async () => {
    try {
      const res = await apiClient.get('/products');
      setProducts(res.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogData = async () => {
    try {
      const [brandsRes, collectionsRes] = await Promise.all([
        apiClient.get('/brands?includeInactive=false'),
        apiClient.get('/collections/tree'),
      ]);
      setBrands(brandsRes.data.filter((b: Brand) => b.is_active));
      setCollections(collectionsRes.data);
    } catch (error) {
      console.error('Failed to fetch catalog data:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCatalogData();
  }, []);

  // ─── Filtered Products ─────────────────────────────────────
  const filtered = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand?.name.toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q)),
    );
  }, [products, searchQuery]);

  // ─── Wizard Lifecycle ───────────────────────────────────────
  const openWizard = () => {
    setStep(0);
    setForm({ name: '', description: '', brand_id: '', base_price: '', images: [] });
    setSelectedCollections([]);
    setImageMode('upload');
    setImageUrl('');
    setAxes([
      { name: 'Color', values: [] },
      { name: 'Talla MX', values: [] },
    ]);
    setTagInputs({});
    setVariants([]);
    setWizardOpen(true);
  };

  // ─── Step 2 → Step 3: Generate matrix ──────────────────────
  const generateMatrix = useCallback(() => {
    const validAxes = axes.filter((a) => a.name.trim() && a.values.length > 0);
    const combos = cartesian(validAxes);

    // Preserve existing variant data if user goes back and forth
    const existingMap = new Map(variants.map((v) => [v.key, v]));

    const newVariants: WizardVariant[] = combos.map((attrs) => {
      const key = comboKey(attrs);
      const existing = existingMap.get(key);
      if (existing) return existing;
      return {
        key,
        sku: autoSku(form.name, attrs),
        attributes: attrs,
        price_override: '',
        cost: '',
        stock: '',
        barcode: '',
        enabled: true,
      };
    });

    setVariants(newVariants);
  }, [axes, form.name, variants]);

  // ─── Navigation ─────────────────────────────────────────────
  const canGoNext = () => {
    if (step === 0) return form.name.trim().length > 0 && form.base_price.trim().length > 0;
    if (step === 1) return axes.some((a) => a.name.trim() && a.values.length > 0);
    return true;
  };

  const goNext = () => {
    if (step === 1) generateMatrix();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // ─── Image Upload ──────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setForm((prev) => ({ ...prev, images: [...prev.images, fullUrl] }));
      toast({ title: 'Imagen subida correctamente' });
    } catch (error: any) {
      toast({ title: 'Error al subir imagen', description: error.response?.data?.message || 'Intenta con otro archivo', variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const addImageUrl = () => {
    if (!imageUrl.trim()) return;
    setForm((prev) => ({ ...prev, images: [...prev.images, imageUrl.trim()] }));
    setImageUrl('');
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  // ─── Axis Management ───────────────────────────────────────
  const addAxis = () => setAxes((prev) => [...prev, { name: '', values: [] }]);

  const removeAxis = (index: number) => {
    setAxes((prev) => prev.filter((_, i) => i !== index));
    setTagInputs((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const updateAxisName = (index: number, name: string) => {
    setAxes((prev) => prev.map((a, i) => (i === index ? { ...a, name } : a)));
  };

  const addTagValue = (axisIndex: number, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setAxes((prev) =>
      prev.map((a, i) =>
        i === axisIndex && !a.values.includes(trimmed)
          ? { ...a, values: [...a.values, trimmed] }
          : a,
      ),
    );
    setTagInputs((prev) => ({ ...prev, [axisIndex]: '' }));
  };

  const removeTagValue = (axisIndex: number, valIndex: number) => {
    setAxes((prev) =>
      prev.map((a, i) =>
        i === axisIndex ? { ...a, values: a.values.filter((_, vi) => vi !== valIndex) } : a,
      ),
    );
  };

  // ─── Variant Matrix Editing ────────────────────────────────
  const updateVariant = (index: number, field: keyof WizardVariant, value: string | boolean) => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const applyToAll = (field: 'cost' | 'stock' | 'price_override', value: string) => {
    setVariants((prev) => prev.map((v) => (v.enabled ? { ...v, [field]: value } : v)));
  };

  // ─── Submit Wizard ──────────────────────────────────────────
  const handleSubmit = async () => {
    const enabledVariants = variants.filter((v) => v.enabled);
    if (!enabledVariants.length) {
      toast({ title: 'Sin variantes', description: 'Activa al menos una variante para crear el producto.', variant: 'destructive' });
      return;
    }

    // Validate SKUs
    const skus = enabledVariants.map((v) => v.sku);
    const uniqueSkus = new Set(skus);
    if (uniqueSkus.size !== skus.length) {
      toast({ title: 'SKUs duplicados', description: 'Cada variante debe tener un SKU único.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        brand_id: form.brand_id || undefined,
        base_price: parseFloat(form.base_price) || 0,
        images: form.images,
        collection_ids: selectedCollections,
        branch_id: selectedBranchId,
        variants: enabledVariants.map((v) => ({
          sku: v.sku,
          attributes: v.attributes,
          price_override: v.price_override ? parseFloat(v.price_override) : null,
          cost: parseFloat(v.cost) || 0,
          stock: parseInt(v.stock, 10) || 0,
          barcode: v.barcode || undefined,
        })),
      };

      await apiClient.post('/products/wizard', payload);
      toast({
        title: 'Producto creado',
        description: `"${form.name}" con ${enabledVariants.length} variante${enabledVariants.length > 1 ? 's' : ''} se agregó al catálogo.`,
      });
      setWizardOpen(false);
      await fetchProducts();
    } catch (error: any) {
      toast({
        title: 'Error al crear producto',
        description: error.response?.data?.message || 'Revisa los datos e intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle / Delete ───────────────────────────────────────
  const handleToggle = async (product: Product) => {
    try {
      await apiClient.patch(`/products/${product.id}/toggle-status`);
      toast({
        title: product.is_active ? 'Producto desactivado' : 'Producto reactivado',
        description: `"${product.name}" ${product.is_active ? 'ya no aparecerá en el catálogo.' : 'está disponible nuevamente.'}`,
      });
      await fetchProducts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    }
  };

  const handleDelete = async (product: Product) => {
    try {
      await apiClient.delete(`/products/${product.id}`);
      toast({ title: 'Producto eliminado', description: `"${product.name}" fue eliminado del catálogo.` });
      await fetchProducts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    }
  };

  // ─── Price helpers ─────────────────────────────────────────
  const getVariantPrice = (product: Product, variant: ProductVariant) => {
    return variant.price_override ?? product.base_price ?? 0;
  };

  const getPriceRange = (product: Product) => {
    if (!product.variants.length) return `$${Number(product.base_price || 0).toFixed(2)}`;
    const prices = product.variants.map((v) => getVariantPrice(product, v));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return `$${min.toFixed(2)}`;
    return `$${min.toFixed(2)} – $${max.toFixed(2)}`;
  };

  // ─── Collection flattener for checkboxes ───────────────────
  const flatCollections = useMemo(() => {
    const result: { id: string; name: string; depth: number; parent_id: string | null }[] = [];
    const walk = (nodes: CollectionNode[], depth: number, parentId: string | null) => {
      for (const node of nodes) {
        result.push({ id: node.id, name: node.name, depth, parent_id: parentId });
        if (node.children?.length) walk(node.children, depth + 1, node.id);
      }
    };
    walk(collections, 0, null);
    return result;
  }, [collections]);

  /** Given a collection id, return all ancestor ids (walking up the tree) */
  const getAncestorIds = useCallback(
    (id: string): string[] => {
      const ancestors: string[] = [];
      let current = flatCollections.find((c) => c.id === id);
      while (current?.parent_id) {
        ancestors.push(current.parent_id);
        current = flatCollections.find((c) => c.id === current!.parent_id);
      }
      return ancestors;
    },
    [flatCollections],
  );

  /** Given a collection id, return all descendant ids */
  const getDescendantIds = useCallback(
    (id: string): string[] => {
      const descendants: string[] = [];
      const walk = (parentId: string) => {
        for (const c of flatCollections) {
          if (c.parent_id === parentId) {
            descendants.push(c.id);
            walk(c.id);
          }
        }
      };
      walk(id);
      return descendants;
    },
    [flatCollections],
  );

  /** Toggle collection: selecting a child auto-selects parents, deselecting a parent deselects children */
  const toggleCollection = useCallback(
    (id: string) => {
      setSelectedCollections((prev) => {
        const isSelected = prev.includes(id);
        if (isSelected) {
          // Deselecting: also deselect all descendants
          const descendantIds = getDescendantIds(id);
          const toRemove = new Set([id, ...descendantIds]);
          return prev.filter((cid) => !toRemove.has(cid));
        } else {
          // Selecting: also select all ancestors
          const ancestorIds = getAncestorIds(id);
          const newSet = new Set([...prev, id, ...ancestorIds]);
          return Array.from(newSet);
        }
      });
    },
    [getAncestorIds, getDescendantIds],
  );

  const enabledVariantCount = variants.filter((v) => v.enabled).length;
  const totalVariantCombos = axes
    .filter((a) => a.name.trim() && a.values.length > 0)
    .reduce((acc, a) => acc * a.values.length, 1) || 0;

  // ═════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════
  const activeProducts = filtered.filter((p) => p.is_active);
  const inactiveProducts = filtered.filter((p) => !p.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Modelos de Zapatos</h2>
          <p className="text-muted-foreground">
            {products.length} modelo{products.length !== 1 ? 's' : ''} en tu catálogo
          </p>
        </div>
        <Button className="gap-2" onClick={openWizard}>
          <Plus className="h-4 w-4" />
          Nuevo Modelo
        </Button>
      </div>

      {/* Search */}
      {products.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, SKU o marca..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No hay modelos registrados</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Usa el asistente para crear tu primer modelo de zapato con variantes de talla, color y más.
            </p>
            <Button onClick={openWizard} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Crear Primer Modelo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...activeProducts, ...inactiveProducts].map((product) => (
            <Card
              key={product.id}
              className={cn(
                'transition-all',
                !product.is_active && 'opacity-50 border-dashed',
              )}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  {/* Image */}
                  <div className="h-14 w-14 rounded-lg bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                    {product.images?.[0] || product.image_url ? (
                      <img
                        src={product.images?.[0] || product.image_url || ''}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{product.name}</h3>
                      {!product.is_active && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactivo</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {product.brand && <Badge variant="outline" className="text-xs">{product.brand.name}</Badge>}
                      {product.collectionProducts?.map((cp) => (
                        <Badge key={cp.collection.id} variant="secondary" className="text-xs">
                          {cp.collection.name}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        {product.variants.length} variante{product.variants.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold">{getPriceRange(product)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(product.created_at).toLocaleDateString('es-MX')}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={() => handleToggle(product)}
                        className={product.is_active ? 'text-destructive focus:text-destructive' : 'text-green-600 focus:text-green-600'}
                      >
                        <Power className="h-4 w-4 mr-2" />
                        {product.is_active ? 'Desactivar' : 'Reactivar'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* WIZARD DIALOG                                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {/* Stepper */}
          <div className="flex items-center justify-center gap-1 pt-2 pb-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={i} className="flex items-center">
                  {i > 0 && <div className={cn('w-8 h-px mx-1', isDone ? 'bg-primary' : 'bg-border')} />}
                  <button
                    type="button"
                    onClick={() => { if (isDone) setStep(i); }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                      isActive && 'bg-primary text-primary-foreground',
                      isDone && 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20',
                      !isActive && !isDone && 'bg-muted/40 text-muted-foreground',
                    )}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* ─── STEP 0: Base Info ────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-5 py-4">
              <div>
                <DialogHeader className="pb-2">
                  <DialogTitle>Información del Modelo</DialogTitle>
                  <DialogDescription>Datos generales del zapato. Las variantes se configuran después.</DialogDescription>
                </DialogHeader>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Nombre del Modelo <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Nike Air Max 90"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Select value={form.brand_id} onValueChange={(v) => setForm((p) => ({ ...p, brand_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar marca" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Precio Base <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="1,299.00"
                    value={form.base_price}
                    onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))}
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    placeholder="Tenis deportivo con cámara de aire visible..."
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                {/* Collections Multi-Select */}
                <div className="col-span-2 space-y-2">
                  <Label>Colecciones</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {selectedCollections.length > 0
                          ? `${selectedCollections.length} colección${selectedCollections.length > 1 ? 'es' : ''} seleccionada${selectedCollections.length > 1 ? 's' : ''}`
                          : 'Seleccionar colecciones...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <div className="max-h-60 overflow-y-auto p-2 space-y-0.5">
                        {flatCollections.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No hay colecciones</p>
                        ) : (
                          flatCollections.map((c) => {
                            const checked = selectedCollections.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleCollection(c.id)}
                                className={cn(
                                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors',
                                  checked && 'bg-accent',
                                )}
                                style={{ paddingLeft: `${8 + c.depth * 16}px` }}
                              >
                                <Checkbox checked={checked} className="pointer-events-none" />
                                <span>{c.name}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {selectedCollections.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCollections.map((id) => {
                        const col = flatCollections.find((c) => c.id === id);
                        return (
                          <Badge key={id} variant="secondary" className="gap-1 pr-1">
                            {col?.name}
                            <button
                              type="button"
                              onClick={() => toggleCollection(id)}
                              className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Images */}
                <div className="col-span-2 space-y-3">
                  <Label>Imágenes <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setImageMode('upload')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                        imageMode === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Subir archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode('url')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                        imageMode === 'url' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Pegar URL
                    </button>
                  </div>

                  {imageMode === 'upload' ? (
                    <label
                      htmlFor="product-file"
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 cursor-pointer transition-colors',
                        uploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/40 hover:bg-primary/5',
                      )}
                    >
                      {uploading ? <Loader2 className="h-6 w-6 text-primary animate-spin" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground">{uploading ? 'Subiendo...' : 'Haz clic o arrastra una imagen'}</span>
                      <input id="product-file" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    </label>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://ejemplo.com/zapato.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImageUrl(); } }}
                      />
                      <Button type="button" variant="outline" onClick={addImageUrl}>Agregar</Button>
                    </div>
                  )}

                  {/* Preview thumbnails */}
                  {form.images.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {form.images.map((url, i) => (
                        <div key={i} className="relative h-16 w-16 rounded-lg border bg-muted/30 overflow-hidden group">
                          <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4 text-white" />
                          </button>
                          {i === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-[8px] text-center py-0.5">Principal</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 1: Attribute Builder ────────────────────── */}
          {step === 1 && (
            <div className="space-y-5 py-4">
              <div>
                <DialogHeader className="pb-2">
                  <DialogTitle>Constructor de Atributos</DialogTitle>
                  <DialogDescription>
                    Define los ejes de variación (ej. Color, Talla). Cada combinación generará una variante automáticamente.
                    {totalVariantCombos > 0 && (
                      <span className="ml-1 font-medium text-primary">
                        → {totalVariantCombos} variante{totalVariantCombos > 1 ? 's' : ''}
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="space-y-4">
                {axes.map((axis, axisIdx) => (
                  <div key={axisIdx} className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Nombre del atributo (ej. Color, Talla, Material)"
                        value={axis.name}
                        onChange={(e) => updateAxisName(axisIdx, e.target.value)}
                        className="font-medium"
                      />
                      {axes.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeAxis(axisIdx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Tag Input */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder={axis.name ? `Agregar valor de ${axis.name}...` : 'Agregar valor...'}
                          value={tagInputs[axisIdx] || ''}
                          onChange={(e) => setTagInputs((p) => ({ ...p, [axisIdx]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              addTagValue(axisIdx, tagInputs[axisIdx] || '');
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addTagValue(axisIdx, tagInputs[axisIdx] || '')}
                          className="shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Tags */}
                      {axis.values.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {axis.values.map((val, valIdx) => (
                            <Badge key={valIdx} variant="secondary" className="gap-1 pr-1 text-xs">
                              {val}
                              <button
                                type="button"
                                onClick={() => removeTagValue(axisIdx, valIdx)}
                                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick fill helpers for Talla MX */}
                    {axis.name.toLowerCase().includes('talla') && axis.values.length === 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-muted-foreground">Relleno rápido:</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => {
                            const tallasHombre = ['25', '25.5', '26', '26.5', '27', '27.5', '28', '28.5', '29', '29.5', '30'];
                            setAxes((prev) => prev.map((a, i) => i === axisIdx ? { ...a, values: tallasHombre } : a));
                          }}
                        >
                          Hombre (25-30)
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => {
                            const tallasMujer = ['22', '22.5', '23', '23.5', '24', '24.5', '25', '25.5', '26'];
                            setAxes((prev) => prev.map((a, i) => i === axisIdx ? { ...a, values: tallasMujer } : a));
                          }}
                        >
                          Mujer (22-26)
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => {
                            const tallasNino = ['15', '16', '17', '18', '19', '20', '21', '22'];
                            setAxes((prev) => prev.map((a, i) => i === axisIdx ? { ...a, values: tallasNino } : a));
                          }}
                        >
                          Niño (15-22)
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={addAxis} className="gap-2 w-full">
                  <Plus className="h-4 w-4" />
                  Agregar Atributo
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Variant Matrix ───────────────────────── */}
          {step === 2 && (
            <div className="space-y-4 py-4">
              <div>
                <DialogHeader className="pb-2">
                  <DialogTitle>Matriz de Variantes</DialogTitle>
                  <DialogDescription>
                    {enabledVariantCount} de {variants.length} variantes activas. Ajusta SKU, precio, costo y stock inicial.
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Bulk Actions */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                <span className="text-xs font-medium text-muted-foreground shrink-0">Aplicar a todas:</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="Costo"
                    className="h-7 w-24 text-xs"
                    type="number"
                    step="0.01"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyToAll('cost', (e.target as HTMLInputElement).value);
                    }}
                    onBlur={(e) => { if (e.target.value) applyToAll('cost', e.target.value); }}
                  />
                  <Input
                    placeholder="Stock"
                    className="h-7 w-20 text-xs"
                    type="number"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyToAll('stock', (e.target as HTMLInputElement).value);
                    }}
                    onBlur={(e) => { if (e.target.value) applyToAll('stock', e.target.value); }}
                  />
                </div>
              </div>

              {/* Matrix Table */}
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="text-left px-3 py-2 font-medium w-8"></th>
                        <th className="text-left px-3 py-2 font-medium">Variante</th>
                        <th className="text-left px-3 py-2 font-medium">SKU</th>
                        <th className="text-left px-3 py-2 font-medium w-28">Precio</th>
                        <th className="text-left px-3 py-2 font-medium w-28">Costo</th>
                        <th className="text-left px-3 py-2 font-medium w-20">Stock</th>
                        <th className="text-left px-3 py-2 font-medium">Barcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v, idx) => (
                        <tr
                          key={v.key}
                          className={cn(
                            'border-b last:border-b-0 transition-colors',
                            !v.enabled && 'opacity-40 bg-muted/20',
                            v.enabled && 'hover:bg-accent/30',
                          )}
                        >
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={v.enabled}
                              onCheckedChange={(checked) => updateVariant(idx, 'enabled', !!checked)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {Object.entries(v.attributes).map(([key, val]) => (
                                <Badge key={key} variant="outline" className="text-[10px] px-1.5 py-0">
                                  {val}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={v.sku}
                              onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                              className="h-7 text-xs font-mono"
                              disabled={!v.enabled}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={form.base_price || '—'}
                              value={v.price_override}
                              onChange={(e) => updateVariant(idx, 'price_override', e.target.value)}
                              className="h-7 text-xs"
                              disabled={!v.enabled}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={v.cost}
                              onChange={(e) => updateVariant(idx, 'cost', e.target.value)}
                              className="h-7 text-xs"
                              disabled={!v.enabled}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              placeholder="0"
                              value={v.stock}
                              onChange={(e) => updateVariant(idx, 'stock', e.target.value)}
                              className="h-7 text-xs"
                              disabled={!v.enabled}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              placeholder="Opcional"
                              value={v.barcode}
                              onChange={(e) => updateVariant(idx, 'barcode', e.target.value)}
                              className="h-7 text-xs"
                              disabled={!v.enabled}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {variants.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No hay variantes. Vuelve al paso anterior y agrega valores a los atributos.
                  </div>
                )}
              </div>

              {/* Summary */}
              {enabledVariantCount > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{enabledVariantCount}</p>
                      <p className="text-xs text-muted-foreground">Variantes</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        ${Number(form.base_price || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Precio Base</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {variants.filter((v) => v.enabled).reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Stock Total</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={step === 0 ? () => setWizardOpen(false) : goBack}
              className="gap-2"
            >
              {step === 0 ? (
                'Cancelar'
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </>
              )}
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={!canGoNext()}
                className="gap-2"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving || enabledVariantCount === 0}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Crear Producto ({enabledVariantCount} variantes)
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
