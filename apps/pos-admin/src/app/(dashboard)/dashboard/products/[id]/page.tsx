'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Input, Label, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Separator, Switch, toast, cn,
} from '@nivo/ui';
import {
  ArrowLeft, Save, Package, Upload, Loader2, Trash2, X, Plus,
  Image as ImageIcon, Link2, Truck, Star, Edit3, Check,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';

// ─── Types ───────────────────────────────────────────────────────

interface Brand { id: string; name: string; }
interface CollectionNode { id: string; name: string; color: string | null; children?: CollectionNode[]; }
interface SupplierRow { id: string; name: string; email: string | null; is_active: boolean; }
interface VariantSupplier {
  id: string;
  variant_id: string;
  supplier_id: string;
  supplier_sku: string | null;
  last_cost: number;
  is_default: boolean;
  supplier?: SupplierRow;
}

interface ProductVariant {
  id: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, string>;
  price_override: number | null;
  cost: number;
  images: string[];
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
  brand_id: string | null;
  category: { id: string; name: string } | null;
  category_id: string | null;
  variants: ProductVariant[];
  collectionProducts?: { collection: CollectionNode }[];
  is_active: boolean;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';
}

// ─── Page ───────────────────────────────────────────────────────

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { branches } = useBranchStore();

  // Product data
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [brandId, setBrandId] = useState('');
  const [productImages, setProductImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Catalogs
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);

  // Variant editing
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantForm, setVariantForm] = useState<Record<string, any>>({});
  const [variantUploading, setVariantUploading] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);

  // Supplier assignment
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierSkuPrefix, setSupplierSkuPrefix] = useState('');
  const [assigningSupplier, setAssigningSupplier] = useState(false);

  // Per-variant supplier management
  const [variantSupplierDialogOpen, setVariantSupplierDialogOpen] = useState(false);
  const [variantSupplierTarget, setVariantSupplierTarget] = useState<string | null>(null);
  const [variantSuppliers, setVariantSuppliers] = useState<VariantSupplier[]>([]);
  const [loadingVarSuppliers, setLoadingVarSuppliers] = useState(false);

  // ─── Fetch product ────────────────────────────────────────────

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/products/${id}`);
      const p = res.data as Product;
      setProduct(p);
      setName(p.name);
      setDescription(p.description || '');
      setBasePrice(String(p.base_price || 0));
      setBrandId(p.brand_id || p.brand?.id || '');
      setProductImages(p.images || []);
    } catch {
      toast({ title: 'Error', description: 'Producto no encontrado', variant: 'destructive' });
      router.push('/dashboard/products');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  // Fetch catalogs
  useEffect(() => {
    apiClient.get('/brands').then((r) => setBrands(r.data || [])).catch(() => {});
    apiClient.get('/purchasing/suppliers', { params: { active_only: 'true' } }).then((r) => setSuppliers(r.data || [])).catch(() => {});
  }, []);

  // ─── Save product info ────────────────────────────────────────

  const handleSaveProduct = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/products/${id}`, {
        name: name.trim(),
        description: description.trim() || null,
        base_price: parseFloat(basePrice) || 0,
        brand_id: brandId || null,
        images: productImages,
      });
      toast({ title: 'Guardado', description: 'Información del producto actualizada.' });
      fetchProduct();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Image upload ─────────────────────────────────────────────

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'product' | string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    target === 'product' ? setUploading(true) : setVariantUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const fullUrl = `${getBaseUrl()}${res.data.url}`;

      if (target === 'product') {
        setProductImages((prev) => [...prev, fullUrl]);
      } else {
        // target is variant_id
        setVariantForm((prev) => ({
          ...prev,
          images: [...(prev.images || []), fullUrl],
        }));
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo subir la imagen', variant: 'destructive' });
    } finally {
      target === 'product' ? setUploading(false) : setVariantUploading(false);
    }
    // Reset input
    e.target.value = '';
  };

  const removeProductImage = (index: number) => {
    setProductImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Variant editing ──────────────────────────────────────────

  const startEditVariant = (variant: ProductVariant) => {
    setEditingVariantId(variant.id);
    setVariantForm({
      sku: variant.sku,
      barcode: variant.barcode || '',
      cost: String(variant.cost || 0),
      price_override: variant.price_override !== null ? String(variant.price_override) : '',
      images: [...(variant.images || [])],
      is_active: variant.is_active,
    });
  };

  const cancelEditVariant = () => {
    setEditingVariantId(null);
    setVariantForm({});
  };

  const saveVariant = async () => {
    if (!editingVariantId || !product) return;
    setSavingVariant(true);
    try {
      await apiClient.put(`/products/${product.id}/variants/${editingVariantId}`, {
        sku: variantForm.sku,
        barcode: variantForm.barcode || null,
        cost: parseFloat(variantForm.cost) || 0,
        price_override: variantForm.price_override ? parseFloat(variantForm.price_override) : null,
        images: variantForm.images || [],
        is_active: variantForm.is_active,
      });
      toast({ title: 'Variante actualizada' });
      setEditingVariantId(null);
      fetchProduct();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSavingVariant(false);
    }
  };

  const removeVariantImage = (index: number) => {
    setVariantForm((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_: string, i: number) => i !== index),
    }));
  };

  // ─── Supplier Assignment (bulk for all variants) ──────────────

  const handleAssignSupplier = async () => {
    if (!selectedSupplierId || !product) return;
    setAssigningSupplier(true);
    try {
      const res = await apiClient.post(`/requisitions/product-default-supplier/${product.id}`, {
        supplier_id: selectedSupplierId,
        supplier_sku_prefix: supplierSkuPrefix || undefined,
      });
      toast({ title: 'Proveedor asignado', description: `Se asignó como proveedor por defecto a ${res.data.updated} variantes.` });
      setSupplierDialogOpen(false);
      setSelectedSupplierId('');
      setSupplierSkuPrefix('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al asignar', variant: 'destructive' });
    } finally {
      setAssigningSupplier(false);
    }
  };

  // ─── Per-variant supplier management ──────────────────────────

  const openVariantSuppliers = async (variantId: string) => {
    setVariantSupplierTarget(variantId);
    setVariantSupplierDialogOpen(true);
    setLoadingVarSuppliers(true);
    try {
      const res = await apiClient.get(`/requisitions/variant-suppliers/${variantId}`);
      setVariantSuppliers(res.data || []);
    } catch {
      setVariantSuppliers([]);
    } finally {
      setLoadingVarSuppliers(false);
    }
  };

  const setDefaultVariantSupplier = async (vsId: string) => {
    if (!variantSupplierTarget) return;
    try {
      const updated = variantSuppliers.map((vs) => ({
        supplier_id: vs.supplier_id,
        supplier_sku: vs.supplier_sku || undefined,
        last_cost: Number(vs.last_cost),
        is_default: vs.id === vsId,
      }));
      const res = await apiClient.post(`/requisitions/variant-suppliers/${variantSupplierTarget}`, { suppliers: updated });
      setVariantSuppliers(res.data || []);
      toast({ title: 'Proveedor por defecto actualizado' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const addVariantSupplier = async (supplierId: string) => {
    if (!variantSupplierTarget) return;
    const exists = variantSuppliers.find((vs) => vs.supplier_id === supplierId);
    if (exists) return;
    try {
      const updated = [
        ...variantSuppliers.map((vs) => ({
          supplier_id: vs.supplier_id,
          supplier_sku: vs.supplier_sku || undefined,
          last_cost: Number(vs.last_cost),
          is_default: vs.is_default,
        })),
        { supplier_id: supplierId, is_default: variantSuppliers.length === 0 },
      ];
      const res = await apiClient.post(`/requisitions/variant-suppliers/${variantSupplierTarget}`, { suppliers: updated });
      setVariantSuppliers(res.data || []);
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const removeVariantSupplier = async (supplierId: string) => {
    if (!variantSupplierTarget) return;
    try {
      const updated = variantSuppliers
        .filter((vs) => vs.supplier_id !== supplierId)
        .map((vs) => ({
          supplier_id: vs.supplier_id,
          supplier_sku: vs.supplier_sku || undefined,
          last_cost: Number(vs.last_cost),
          is_default: vs.is_default,
        }));
      const res = await apiClient.post(`/requisitions/variant-suppliers/${variantSupplierTarget}`, { suppliers: updated });
      setVariantSuppliers(res.data || []);
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/products')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Productos
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h2 className="text-xl font-bold">{product.name}</h2>
            <p className="text-xs text-muted-foreground">
              {product.brand?.name || 'Sin marca'} · {product.variants.length} variante{product.variants.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Badge variant={product.is_active ? 'default' : 'secondary'}>
            {product.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSupplierDialogOpen(true)} className="gap-1.5">
            <Truck className="h-4 w-4" />
            Asignar Proveedor
          </Button>
          <Button onClick={handleSaveProduct} disabled={saving || !name.trim()} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* ═══ LEFT: Product Info ═══ */}
        <div className="col-span-2 space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Información General</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nombre del producto</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Marca</Label>
                  <Select value={brandId} onValueChange={setBrandId}>
                    <SelectTrigger><SelectValue placeholder="Sin marca" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin marca</SelectItem>
                      {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="resize-none" />
              </div>
              <div className="space-y-1.5 max-w-xs">
                <Label>Precio base</Label>
                <Input type="number" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Product images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Imágenes del Producto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {productImages.map((url, i) => (
                  <div key={i} className="relative group h-24 w-24 rounded-lg overflow-hidden border">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeProductImage(i)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className={cn(
                  'h-24 w-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors gap-1',
                  uploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/40 hover:bg-primary/5',
                )}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-[10px] text-muted-foreground">{uploading ? 'Subiendo...' : 'Agregar'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'product')} disabled={uploading} />
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Variantes ({product.variants.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {product.variants.map((variant) => {
                const isEditing = editingVariantId === variant.id;
                const attrs = Object.entries(variant.attributes);

                return (
                  <div key={variant.id} className={cn(
                    'rounded-lg border p-4 transition-colors',
                    isEditing ? 'border-primary bg-primary/[0.02]' : 'hover:bg-muted/30',
                  )}>
                    {isEditing ? (
                      /* ─── Edit mode ─── */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {attrs.map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={cancelEditVariant} disabled={savingVariant}>
                              Cancelar
                            </Button>
                            <Button size="sm" onClick={saveVariant} disabled={savingVariant} className="gap-1.5">
                              {savingVariant ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              Guardar
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">SKU</Label>
                            <Input value={variantForm.sku || ''} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Código de barras</Label>
                            <Input value={variantForm.barcode || ''} onChange={(e) => setVariantForm({ ...variantForm, barcode: e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Costo</Label>
                            <Input type="number" step="0.01" value={variantForm.cost || ''} onChange={(e) => setVariantForm({ ...variantForm, cost: e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Precio override</Label>
                            <Input type="number" step="0.01" value={variantForm.price_override || ''} onChange={(e) => setVariantForm({ ...variantForm, price_override: e.target.value })} placeholder="(usar base)" className="h-8 text-xs" />
                          </div>
                        </div>

                        {/* Variant images */}
                        <div className="space-y-1.5">
                          <Label className="text-xs">Imágenes de la variante</Label>
                          <div className="flex flex-wrap gap-2">
                            {(variantForm.images || []).map((url: string, i: number) => (
                              <div key={i} className="relative group h-16 w-16 rounded-lg overflow-hidden border">
                                <img src={url} alt="" className="h-full w-full object-cover" />
                                <button
                                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeVariantImage(i)}
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ))}
                            <label className={cn(
                              'h-16 w-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors gap-0.5',
                              variantUploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/40',
                            )}>
                              {variantUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 text-muted-foreground" />}
                              <span className="text-[8px] text-muted-foreground">Subir</span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, variant.id)} disabled={variantUploading} />
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={variantForm.is_active !== false}
                            onCheckedChange={(v) => setVariantForm({ ...variantForm, is_active: v })}
                          />
                          <span className="text-xs text-muted-foreground">Variante activa</span>
                        </div>
                      </div>
                    ) : (
                      /* ─── View mode ─── */
                      <div className="flex items-center gap-3">
                        {variant.images?.[0] ? (
                          <img src={variant.images[0]} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                        ) : productImages[0] ? (
                          <img src={productImages[0]} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0 opacity-50" />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">
                              {attrs.map(([_, v]) => v).join(' / ')}
                            </p>
                            {!variant.is_active && <Badge variant="secondary" className="text-[10px]">Inactiva</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            SKU: {variant.sku}
                            {variant.barcode && <> · Barcode: {variant.barcode}</>}
                            {' · '}Costo: {formatCurrency(Number(variant.cost))}
                            {variant.price_override !== null && <> · Precio: {formatCurrency(Number(variant.price_override))}</>}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => openVariantSuppliers(variant.id)}>
                            <Truck className="h-3.5 w-3.5" />
                            <span className="text-xs">Proveedores</span>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => startEditVariant(variant)}>
                            <Edit3 className="h-3.5 w-3.5" />
                            <span className="text-xs">Editar</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ═══ RIGHT: Sidebar info ═══ */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio base</span>
                <span className="font-medium">{formatCurrency(Number(product.base_price))}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Variantes</span>
                <span className="font-medium">{product.variants.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Activas</span>
                <span className="font-medium">{product.variants.filter((v) => v.is_active).length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Marca</span>
                <span className="font-medium">{product.brand?.name || 'Sin marca'}</span>
              </div>
              {product.collectionProducts && product.collectionProducts.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground text-xs">Colecciones</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {product.collectionProducts.map((cp) => (
                        <Badge key={cp.collection.id} variant="outline" className="text-[10px]">
                          {cp.collection.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Imágenes</CardTitle></CardHeader>
            <CardContent>
              {productImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {productImages.slice(0, 4).map((url, i) => (
                    <img key={i} src={url} alt="" className="rounded-lg aspect-square object-cover w-full" />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Sin imágenes
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ Assign Supplier Dialog (bulk) ═══ */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Asignar Proveedor por Defecto
            </DialogTitle>
            <DialogDescription>
              Se asignará como proveedor por defecto a todas las variantes de este producto. Las requisiciones automáticas usarán este proveedor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proveedor..." /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prefijo SKU del proveedor (opcional)</Label>
              <Input
                placeholder="Ej: NIKE"
                value={supplierSkuPrefix}
                onChange={(e) => setSupplierSkuPrefix(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Se generará como PREFIJO-SKU para cada variante
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssignSupplier} disabled={!selectedSupplierId || assigningSupplier} className="gap-1.5">
              {assigningSupplier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Asignar a todas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Variant Supplier Dialog (per-variant) ═══ */}
      <Dialog open={variantSupplierDialogOpen} onOpenChange={setVariantSupplierDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Proveedores de Variante
            </DialogTitle>
            <DialogDescription>
              Gestiona los proveedores para esta variante. El proveedor por defecto se usa en requisiciones automáticas.
            </DialogDescription>
          </DialogHeader>

          {loadingVarSuppliers ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-3">
              {variantSuppliers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay proveedores asignados a esta variante.
                </p>
              ) : (
                variantSuppliers.map((vs) => (
                  <div key={vs.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{vs.supplier?.name || 'Proveedor'}</p>
                        {vs.is_default && (
                          <Badge className="gap-0.5 text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Star className="h-2.5 w-2.5" />
                            Por defecto
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {vs.supplier_sku && <>SKU: {vs.supplier_sku} · </>}
                        Costo: {formatCurrency(Number(vs.last_cost))}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!vs.is_default && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDefaultVariantSupplier(vs.id)}>
                          Hacer default
                        </Button>
                      )}
                      <button
                        className="h-7 w-7 rounded hover:bg-red-500/10 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                        onClick={() => removeVariantSupplier(vs.supplier_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Add supplier */}
              <div className="border-t pt-3">
                <Label className="text-xs mb-2 block">Agregar proveedor</Label>
                <div className="flex gap-2">
                  <Select
                    value=""
                    onValueChange={(v) => { if (v) addVariantSupplier(v); }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar proveedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers
                        .filter((s) => !variantSuppliers.find((vs) => vs.supplier_id === s.id))
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantSupplierDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
