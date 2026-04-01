'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Label, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Skeleton, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Popover, PopoverTrigger, PopoverContent,
  Checkbox, Switch, Tabs, TabsList, TabsTrigger,
  Separator, cn,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@nivo/ui';
import {
  Plus, Package, Search, MoreVertical, Power, Trash2,
  ChevronRight, ChevronLeft, Check, X, Upload, Link2, Loader2,
  ChevronsUpDown, Layers, Sparkles, Settings2, Info, ImagePlus,
  ChevronDown, PlusCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════
interface Brand { id: string; name: string; logo_url: string | null; is_active: boolean; }
interface CollectionNode { id: string; name: string; color: string | null; children?: CollectionNode[]; }
interface CatalogColor { id: string; name: string; hex_code: string; branch_id: string | null; is_active: boolean; }
interface SizeGroup { id: string; name: string; is_active: boolean; }
interface SizeSystem { id: string; name: string; is_active: boolean; }
interface SizeEquivalency { size_system_id: string; value: string; sizeSystem: SizeSystem; }
interface SizeRow { id: string; size_group_id: string; order_index: number; equivalencies: SizeEquivalency[]; }
interface BranchData { id: string; name: string; }
interface ProductVariant { id: string; sku: string; attributes: Record<string, string>; price_override: number | null; cost: number; barcode: string | null; is_active: boolean; }
interface Product {
  id: string; name: string; description: string | null; base_price: number; images: string[];
  image_url: string | null; brand: Brand | null; category: { id: string; name: string } | null;
  variants: ProductVariant[]; collectionProducts?: { collection: CollectionNode }[];
  is_active: boolean; created_at: string;
}

// Wizard variant row
interface WizardVariant {
  key: string;
  colorName: string;
  colorHex: string;
  sizeMex: string;
  sizeRowId: string;
  equivalencies: Record<string, string>; // system_name → value
  sku: string;
  cost: string;
  price: string;
  barcode: string;
  stockByBranch: Record<string, number>;
  enabled: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
function autoSku(name: string, color: string, size: string): string {
  const b = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
  const c = color.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
  const s = size.replace(/[^a-zA-Z0-9.]/g, '');
  return `${b}-${c}-${s}`;
}

const STEPS = [
  { label: 'Información Base', icon: Package },
  { label: 'Atributos', icon: Layers },
  { label: 'Variantes y Stock', icon: Sparkles },
];

// ═══════════════════════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════════════════════
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { branches, selectedBranchId, getEffectiveBranchId } = useBranchStore();

  // Calculated prices from the engine (product_id → { min, max })
  const [calculatedPrices, setCalculatedPrices] = useState<Record<string, { min: number; max: number }>>({});

  // Catalog data
  const [brands, setBrands] = useState<Brand[]>([]);
  const [collections, setCollections] = useState<CollectionNode[]>([]);
  const [catalogColors, setCatalogColors] = useState<CatalogColor[]>([]);
  const [sizeGroups, setSizeGroups] = useState<SizeGroup[]>([]);
  const [sizeSystems, setSizeSystems] = useState<SizeSystem[]>([]);
  const [sizeRows, setSizeRows] = useState<SizeRow[]>([]);

  // ─── Wizard State ─────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [formName, setFormName] = useState('');
  const [formBrandId, setFormBrandId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formCostMargin, setFormCostMargin] = useState('');
  const [formBasePrice, setFormBasePrice] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Step 2
  const [hasOptions, setHasOptions] = useState(true);
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [selectedSizeGroupId, setSelectedSizeGroupId] = useState('');
  const [selectedSizeSystemDisplay, setSelectedSizeSystemDisplay] = useState('');
  const [selectedSizeRowIds, setSelectedSizeRowIds] = useState<string[]>([]);

  // Step 3
  const [stockMode, setStockMode] = useState<'local' | 'multi'>('local');
  const [variants, setVariants] = useState<WizardVariant[]>([]);
  const [colorImages, setColorImages] = useState<Record<string, string[]>>({});
  const [colorImageUploading, setColorImageUploading] = useState(false);
  const [activeColorForImages, setActiveColorForImages] = useState<string | null>(null);

  // Collection tree state
  const [collectionSearch, setCollectionSearch] = useState('');
  const [collapsedCollections, setCollapsedCollections] = useState<Set<string>>(new Set());

  // New color from wizard
  const [showNewColorDialog, setShowNewColorDialog] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');
  const [savingNewColor, setSavingNewColor] = useState(false);

  // Bulk action states
  const [showBulkStockDialog, setShowBulkStockDialog] = useState(false);
  const [showBulkPriceDialog, setShowBulkPriceDialog] = useState(false);
  const [bulkStockValue, setBulkStockValue] = useState('');
  const [bulkPriceValue, setBulkPriceValue] = useState('');

  // ─── Fetch Data ─────────────────────────────────────────
  const fetchProducts = async () => {
    try {
      const res = await apiClient.get('/products');
      setProducts(res.data);
      // Fetch calculated prices from the engine for the effective branch
      const effectiveBranch = getEffectiveBranchId();
      if (effectiveBranch) {
        try {
          const priceRes = await apiClient.get(`/pricing/product-list-prices?branch_id=${effectiveBranch}`);
          setCalculatedPrices(priceRes.data);
        } catch { /* prices will show as $0 if pricing engine fails */ }
      }
    }
    catch { console.error('Failed to fetch products'); }
    finally { setLoading(false); }
  };

  const fetchCatalogData = async () => {
    try {
      const [bRes, cRes, colRes, sgRes, ssRes] = await Promise.all([
        apiClient.get('/brands?includeInactive=false'),
        apiClient.get('/collections/tree'),
        apiClient.get('/catalogs/colors'),
        apiClient.get('/catalogs/size-groups'),
        apiClient.get('/catalogs/size-systems'),
      ]);
      setBrands(bRes.data.filter((b: Brand) => b.is_active));
      setCollections(cRes.data);
      setCatalogColors(colRes.data.filter((c: CatalogColor) => c.is_active));
      setSizeGroups(sgRes.data.filter((g: SizeGroup) => g.is_active));
      setSizeSystems(ssRes.data.filter((s: SizeSystem) => s.is_active));
    } catch { console.error('Failed to fetch catalogs'); }
  };

  // Preloaded margin from tenant settings
  const [defaultMargin, setDefaultMargin] = useState('0');

  const fetchSettingsMargin = async () => {
    try {
      const res = await apiClient.get('/tenant-settings?group=operacion');
      const marginSetting = res.data.find((s: any) => s.key === 'operacion.default_landed_cost_percentage');
      if (marginSetting) setDefaultMargin(marginSetting.value || '0');
    } catch { /* use default */ }
  };

  useEffect(() => { fetchProducts(); fetchCatalogData(); fetchSettingsMargin(); }, []);

  // Refetch prices when branch changes or products load
  useEffect(() => {
    const effectiveBranch = getEffectiveBranchId();
    if (effectiveBranch && products.length > 0) {
      apiClient.get(`/pricing/product-list-prices?branch_id=${effectiveBranch}`)
        .then((res) => setCalculatedPrices(res.data))
        .catch(() => {});
    }
  }, [selectedBranchId, products]);

  // Fetch sizes when group changes
  useEffect(() => {
    if (!selectedSizeGroupId) { setSizeRows([]); return; }
    apiClient.get(`/catalogs/sizes?group_id=${selectedSizeGroupId}`)
      .then((res) => setSizeRows(res.data))
      .catch(() => setSizeRows([]));
  }, [selectedSizeGroupId]);

  // Auto-calculate base price
  useEffect(() => {
    const cost = parseFloat(formCost) || 0;
    const margin = parseFloat(formCostMargin) || 0;
    if (cost > 0) {
      const calculated = cost * (1 + margin / 100);
      setFormBasePrice(calculated.toFixed(2));
    }
  }, [formCost, formCostMargin]);

  // ─── Filtered Products ───────────────────────────────────
  const filtered = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || p.brand?.name.toLowerCase().includes(q) ||
      p.variants.some((v) => v.sku.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q)),
    );
  }, [products, searchQuery]);

  // ─── Collections tree helpers ────────────────────────────
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

  const getAncestorIds = useCallback((id: string): string[] => {
    const ancestors: string[] = [];
    let cur = flatCollections.find((c) => c.id === id);
    while (cur?.parent_id) { ancestors.push(cur.parent_id); cur = flatCollections.find((c) => c.id === cur!.parent_id); }
    return ancestors;
  }, [flatCollections]);

  const getDescendantIds = useCallback((id: string): string[] => {
    const desc: string[] = [];
    const walk = (pid: string) => { for (const c of flatCollections) if (c.parent_id === pid) { desc.push(c.id); walk(c.id); } };
    walk(id); return desc;
  }, [flatCollections]);

  const toggleCollection = useCallback((id: string) => {
    setSelectedCollections((prev) => {
      const isSelected = prev.includes(id);
      if (isSelected) { const toRemove = new Set([id, ...getDescendantIds(id)]); return prev.filter((c) => !toRemove.has(c)); }
      else { return Array.from(new Set([...prev, id, ...getAncestorIds(id)])); }
    });
  }, [getAncestorIds, getDescendantIds]);

  // ─── Collection collapse / search helpers ───────────────
  const toggleCollapse = useCallback((id: string) => {
    setCollapsedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const hasChildren = useCallback((id: string) => flatCollections.some((c) => c.parent_id === id), [flatCollections]);

  const filteredFlatCollections = useMemo(() => {
    if (!collectionSearch.trim()) return flatCollections;
    const q = collectionSearch.toLowerCase();
    const matchingIds = new Set<string>();
    // First pass: find direct matches
    for (const c of flatCollections) {
      if (c.name.toLowerCase().includes(q)) matchingIds.add(c.id);
    }
    // Add ancestors of matches (so parent tree is visible)
    for (const id of [...matchingIds]) {
      let cur = flatCollections.find((c) => c.id === id);
      while (cur?.parent_id) { matchingIds.add(cur.parent_id); cur = flatCollections.find((c) => c.id === cur!.parent_id); }
    }
    // Add descendants of matches (show children of matching parents)
    const addDescendants = (pid: string) => {
      for (const c of flatCollections) {
        if (c.parent_id === pid && !matchingIds.has(c.id)) { matchingIds.add(c.id); addDescendants(c.id); }
      }
    };
    for (const id of [...matchingIds]) addDescendants(id);
    return flatCollections.filter((c) => matchingIds.has(c.id));
  }, [flatCollections, collectionSearch]);

  const visibleCollections = useMemo(() => {
    if (collectionSearch.trim()) return filteredFlatCollections; // show all when searching
    return filteredFlatCollections.filter((c) => {
      // Check if any ancestor is collapsed
      let cur = flatCollections.find((f) => f.id === c.id);
      let parent = cur?.parent_id ? flatCollections.find((f) => f.id === cur!.parent_id) : null;
      while (parent) {
        if (collapsedCollections.has(parent.id)) return false;
        parent = parent.parent_id ? flatCollections.find((f) => f.id === parent!.parent_id) : null;
      }
      return true;
    });
  }, [filteredFlatCollections, collapsedCollections, flatCollections, collectionSearch]);

  // ─── Size helpers ────────────────────────────────────────
  const getMexValue = (row: SizeRow) => {
    const mexSys = sizeSystems.find((s) => s.name === 'MEX');
    if (!mexSys) return row.equivalencies[0]?.value || '?';
    return row.equivalencies.find((e) => e.size_system_id === mexSys.id)?.value || '?';
  };

  const getDisplayValue = (row: SizeRow) => {
    if (!selectedSizeSystemDisplay) return getMexValue(row);
    return row.equivalencies.find((e) => e.size_system_id === selectedSizeSystemDisplay)?.value || getMexValue(row);
  };

  const getEquivalencyMap = (row: SizeRow) => {
    const map: Record<string, string> = {};
    for (const eq of row.equivalencies) {
      const sysName = sizeSystems.find((s) => s.id === eq.size_system_id)?.name || eq.size_system_id;
      map[sysName] = eq.value;
    }
    return map;
  };

  const getSelectedSystemName = () => {
    if (!selectedSizeSystemDisplay) return 'MEX';
    return sizeSystems.find((s) => s.id === selectedSizeSystemDisplay)?.name || 'MEX';
  };

  // Add color to catalog
  const handleAddColor = async () => {
    if (!newColorName.trim()) return;
    setSavingNewColor(true);
    try {
      const res = await apiClient.post('/catalogs/colors', { name: newColorName.trim(), hex_code: newColorHex, branch_id: null });
      const newColor = res.data;
      setCatalogColors((prev) => [...prev, newColor]);
      setSelectedColorIds((prev) => [...prev, newColor.id]);
      setNewColorName(''); setNewColorHex('#000000');
      setShowNewColorDialog(false);
      toast({ title: 'Color agregado al catálogo' });
    } catch (error: any) {
      toast({ title: 'Error al crear color', description: error.response?.data?.message || 'Intenta de nuevo', variant: 'destructive' });
    } finally { setSavingNewColor(false); }
  };

  // Bulk stock apply
  const applyBulkStock = () => {
    const qty = parseInt(bulkStockValue) || 0;
    setVariants((prev) => prev.map((v) => {
      if (!v.enabled) return v;
      if (stockMode === 'local') {
        return { ...v, stockByBranch: { [selectedBranchId || '']: qty } };
      } else {
        const newStock: Record<string, number> = {};
        for (const br of branches) newStock[br.id] = qty;
        return { ...v, stockByBranch: newStock };
      }
    }));
    setShowBulkStockDialog(false); setBulkStockValue('');
    toast({ title: `Stock de ${qty} asignado a todas las variantes` });
  };

  // Bulk price apply
  const applyBulkPrice = () => {
    const price = bulkPriceValue;
    if (!price) return;
    applyToAll('price', price);
    setShowBulkPriceDialog(false); setBulkPriceValue('');
    toast({ title: `Precio $${parseFloat(price).toFixed(2)} asignado a todas las variantes` });
  };

  // ─── Wizard Lifecycle ────────────────────────────────────
  const openWizard = () => {
    setStep(0); setFormName(''); setFormBrandId(''); setFormDescription('');
    setFormCost(''); setFormCostMargin(defaultMargin); setFormBasePrice('');
    setSelectedCollections([]); setFormImages([]);
    setImageMode('upload'); setImageUrl('');
    setHasOptions(true); setSelectedColorIds([]); setSelectedSizeGroupId('');
    setSelectedSizeSystemDisplay(''); setSelectedSizeRowIds([]);
    setStockMode('local'); setVariants([]); setColorImages({});
    setActiveColorForImages(null);
    setCollectionSearch(''); setCollapsedCollections(new Set());
    setWizardOpen(true);
  };

  // ─── Generate matrix ─────────────────────────────────────
  const generateMatrix = useCallback(() => {
    const selColors = catalogColors.filter((c) => selectedColorIds.includes(c.id));
    const selSizes = sizeRows.filter((r) => selectedSizeRowIds.includes(r.id));
    const existingMap = new Map(variants.map((v) => [v.key, v]));
    const newVariants: WizardVariant[] = [];

    if (!hasOptions) {
      const key = '__single__';
      const existing = existingMap.get(key);
      newVariants.push(existing || {
        key, colorName: '', colorHex: '', sizeMex: '', sizeRowId: '',
        equivalencies: {}, sku: autoSku(formName, 'STD', ''),
        cost: formCost, price: formBasePrice, barcode: '',
        stockByBranch: selectedBranchId ? { [selectedBranchId]: 0 } : {}, enabled: true,
      });
    } else {
      const colorList = selColors.length > 0 ? selColors : [{ id: '', name: '', hex_code: '' }];
      const sizeList = selSizes.length > 0 ? selSizes : [null];

      for (const color of colorList) {
        for (const size of sizeList) {
          const mexVal = size ? getMexValue(size) : '';
          const key = `${color.name || 'STD'}-${mexVal || 'STD'}`;
          const existing = existingMap.get(key);
          if (existing) { newVariants.push(existing); continue; }
          newVariants.push({
            key, colorName: color.name, colorHex: color.hex_code,
            sizeMex: mexVal, sizeRowId: size?.id || '',
            equivalencies: size ? getEquivalencyMap(size) : {},
            sku: autoSku(formName, color.name || 'STD', mexVal),
            cost: formCost, price: formBasePrice, barcode: '',
            stockByBranch: selectedBranchId ? { [selectedBranchId]: 0 } : {},
            enabled: true,
          });
        }
      }
    }
    setVariants(newVariants);
  }, [catalogColors, selectedColorIds, sizeRows, selectedSizeRowIds, hasOptions, formName, formCost, formBasePrice, selectedBranchId, variants, sizeSystems]);

  // ─── Navigation ──────────────────────────────────────────
  const canGoNext = () => {
    if (step === 0) return formName.trim().length > 0 && formCost.trim().length > 0;
    if (step === 1) return !hasOptions || selectedColorIds.length > 0 || selectedSizeRowIds.length > 0;
    return true;
  };
  const goNext = () => { if (step === 1) generateMatrix(); setStep((s) => Math.min(s + 1, 2)); };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // ─── Image Upload (general) ─────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'general' | string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    target === 'general' ? setUploading(true) : setColorImageUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await apiClient.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';
      const fullUrl = `${baseUrl}${res.data.url}`;
      if (target === 'general') {
        setFormImages((prev) => [...prev, fullUrl]);
      } else {
        setColorImages((prev) => ({ ...prev, [target]: [...(prev[target] || []), fullUrl] }));
      }
    } catch { toast({ title: 'Error al subir imagen', variant: 'destructive' }); }
    finally { target === 'general' ? setUploading(false) : setColorImageUploading(false); e.target.value = ''; }
  };

  // ─── Variant editing ─────────────────────────────────────
  const updateVariant = (idx: number, field: keyof WizardVariant, value: any) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
  };

  const setVariantBranchStock = (idx: number, branchId: string, qty: number) => {
    setVariants((prev) => prev.map((v, i) =>
      i === idx ? { ...v, stockByBranch: { ...v.stockByBranch, [branchId]: qty } } : v,
    ));
  };

  const applyToAll = (field: 'cost' | 'price', value: string) => {
    setVariants((prev) => prev.map((v) => (v.enabled ? { ...v, [field]: value } : v)));
  };

  const autoGenerateSkus = () => {
    setVariants((prev) => prev.map((v) =>
      v.enabled ? { ...v, sku: autoSku(formName, v.colorName || 'STD', v.sizeMex || '') } : v,
    ));
    toast({ title: 'SKUs generados' });
  };

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    const enabled = variants.filter((v) => v.enabled);
    if (!enabled.length) { toast({ title: 'Sin variantes', variant: 'destructive' }); return; }
    const skuSet = new Set(enabled.map((v) => v.sku));
    if (skuSet.size !== enabled.length) { toast({ title: 'SKUs duplicados', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const payload = {
        name: formName,
        description: formDescription || undefined,
        brand_id: formBrandId || undefined,
        cost: parseFloat(formCost) || 0,
        images: formImages,
        color_images: colorImages,
        collection_ids: selectedCollections,
        variants: enabled.map((v) => ({
          sku: v.sku,
          attributes: {
            ...(v.colorName && { Color: v.colorName }),
            ...(v.sizeMex && { 'Talla MX': v.sizeMex }),
            ...Object.fromEntries(Object.entries(v.equivalencies).filter(([k]) => k !== 'MEX').map(([k, val]) => [`Talla ${k}`, val])),
          },
          price_override: null,
          cost: parseFloat(v.cost) || parseFloat(formCost) || 0,
          barcode: v.barcode || undefined,
          stock_by_branch: v.stockByBranch,
        })),
      };
      await apiClient.post('/products/wizard', payload);
      toast({ title: 'Producto creado', description: `"${formName}" con ${enabled.length} variante${enabled.length > 1 ? 's' : ''}.` });
      setWizardOpen(false);
      await fetchProducts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Revisa los datos', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // ─── Product List Helpers ─────────────────────────────────
  const handleToggle = async (p: Product) => {
    try { await apiClient.patch(`/products/${p.id}/toggle-status`); await fetchProducts();
      toast({ title: p.is_active ? 'Desactivado' : 'Reactivado' });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };
  const handleDelete = async (p: Product) => {
    try { await apiClient.delete(`/products/${p.id}`); await fetchProducts();
      toast({ title: 'Eliminado' });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };
  const getPriceRange = (p: Product) => {
    const calc = calculatedPrices[p.id];
    if (calc) {
      if (calc.min === 0 && calc.max === 0) return '$0.00';
      return calc.min === calc.max
        ? `$${calc.min.toFixed(2)}`
        : `$${calc.min.toFixed(2)} – $${calc.max.toFixed(2)}`;
    }
    // Fallback if no calculated prices available
    if (!p.variants.length) return `$${Number(p.base_price || 0).toFixed(2)}`;
    const prices = p.variants.map((v) => v.price_override ?? p.base_price ?? 0);
    const min = Math.min(...prices); const max = Math.max(...prices);
    return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
  };

  const enabledCount = variants.filter((v) => v.enabled).length;
  const totalStock = variants.filter((v) => v.enabled).reduce((sum, v) => sum + Object.values(v.stockByBranch).reduce((a, b) => a + b, 0), 0);
  const uniqueColors = [...new Set(variants.filter((v) => v.enabled && v.colorName).map((v) => v.colorName))];

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  const active = filtered.filter((p) => p.is_active);
  const inactive = filtered.filter((p) => !p.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Modelos de Zapatos</h2>
          <p className="text-muted-foreground">{products.length} modelo{products.length !== 1 ? 's' : ''} en tu catálogo</p>
        </div>
        <Button className="gap-2" onClick={openWizard}><Plus className="h-4 w-4" />Nuevo Modelo</Button>
      </div>

      {/* Search */}
      {products.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, SKU o marca..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      )}

      {/* Product List */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : products.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center"><Package className="h-8 w-8 text-primary" /></div>
          <h3 className="text-lg font-semibold mb-1">No hay modelos registrados</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">Usa el asistente para crear tu primer modelo de zapato.</p>
          <Button onClick={openWizard} className="gap-2"><Sparkles className="h-4 w-4" />Crear Primer Modelo</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {[...active, ...inactive].map((product) => (
            <Card key={product.id} className={cn('transition-all', !product.is_active && 'opacity-50 border-dashed')}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-lg bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                    {product.images?.[0] || product.image_url ? (
                      <img src={product.images?.[0] || product.image_url || ''} alt={product.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : <Package className="h-6 w-6 text-muted-foreground/40" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{product.name}</h3>
                      {!product.is_active && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactivo</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {product.brand && <Badge variant="outline" className="text-xs">{product.brand.name}</Badge>}
                      {product.collectionProducts?.map((cp) => <Badge key={cp.collection.id} variant="secondary" className="text-xs">{cp.collection.name}</Badge>)}
                      <span className="text-xs text-muted-foreground">{product.variants.length} variante{product.variants.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold">{getPriceRange(product)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(product.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => handleToggle(product)} className={product.is_active ? 'text-destructive' : 'text-green-600'}><Power className="h-4 w-4 mr-2" />{product.is_active ? 'Desactivar' : 'Reactivar'}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(product)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Add Color Dialog ─────────────────────────────────── */}
      <Dialog open={showNewColorDialog} onOpenChange={setShowNewColorDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Agregar Color al Catálogo</DialogTitle>
            <DialogDescription>El nuevo color quedará disponible para todos los productos.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input placeholder="Ej: Turquesa" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
                <Input value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} className="font-mono uppercase" maxLength={9} />
                <div className="h-8 w-8 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: newColorHex }} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewColorDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddColor} disabled={!newColorName.trim() || savingNewColor} className="gap-2">
              {savingNewColor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bulk Stock Dialog ────────────────────────────────── */}
      <Dialog open={showBulkStockDialog} onOpenChange={setShowBulkStockDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Asignar Stock a Todas</DialogTitle>
            <DialogDescription>
              {stockMode === 'local'
                ? 'Este valor se asignará como stock a todas las variantes activas en la sucursal seleccionada.'
                : 'Este valor se asignará a cada variante activa en cada sucursal.'}
            </DialogDescription></DialogHeader>
          <div className="space-y-2">
            <Label>Cantidad</Label>
            <Input type="number" min="0" step="1" placeholder="0" value={bulkStockValue} onChange={(e) => setBulkStockValue(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyBulkStock(); } }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkStockDialog(false)}>Cancelar</Button>
            <Button onClick={applyBulkStock}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bulk Price Dialog ────────────────────────────────── */}
      <Dialog open={showBulkPriceDialog} onOpenChange={setShowBulkPriceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cambiar Precio a Todas</DialogTitle>
            <DialogDescription>Este precio se aplicará a todas las variantes activas.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <Label>Precio</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={bulkPriceValue} onChange={(e) => setBulkPriceValue(e.target.value)} autoFocus className="font-mono"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyBulkPrice(); } }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkPriceDialog(false)}>Cancelar</Button>
            <Button onClick={applyBulkPrice}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* WIZARD DIALOG                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
          {/* Stepper */}
          <div className="flex items-center justify-center gap-1 pt-2 pb-3 shrink-0">
            {STEPS.map((s, i) => {
              const Icon = s.icon; const isActive = i === step; const isDone = i < step;
              return (
                <div key={i} className="flex items-center">
                  {i > 0 && <div className={cn('w-8 h-px mx-1', isDone ? 'bg-primary' : 'bg-border')} />}
                  <button type="button" onClick={() => { if (isDone) setStep(i); }}
                    className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                      isActive && 'bg-primary text-primary-foreground',
                      isDone && 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20',
                      !isActive && !isDone && 'bg-muted/40 text-muted-foreground')}>
                    {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <Separator />

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto min-h-0">

          {/* ─── STEP 0: Info Base + Financiera ────────────── */}
          {step === 0 && (
            <div className="space-y-5 py-4 px-1">
              <DialogHeader><DialogTitle>Información Base y Financiera</DialogTitle>
                <DialogDescription>Define la identidad del modelo y su costo de compra global.</DialogDescription></DialogHeader>

              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div className="col-span-2 space-y-2">
                  <Label>Nombre del Modelo <span className="text-destructive">*</span></Label>
                  <Input placeholder="Botas Timberland Pro" value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
                </div>

                {/* Brand */}
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Select value={formBrandId} onValueChange={setFormBrandId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar marca" /></SelectTrigger>
                    <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Input placeholder="Bota de trabajo reforzada" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                </div>

                {/* Collections */}
                <div className="col-span-2 space-y-2">
                  <Label>Colecciones</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {selectedCollections.length > 0 ? `${selectedCollections.length} seleccionada${selectedCollections.length > 1 ? 's' : ''}` : 'Seleccionar colecciones...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      {/* Search */}
                      <div className="p-2 border-b">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input placeholder="Buscar colección..." value={collectionSearch} onChange={(e) => setCollectionSearch(e.target.value)}
                            className="h-8 text-xs pl-7" />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto p-2 space-y-0.5">
                        {visibleCollections.map((c) => {
                          const checked = selectedCollections.includes(c.id);
                          const isParent = hasChildren(c.id);
                          const isCollapsed = collapsedCollections.has(c.id);
                          return (
                            <div key={c.id} className={cn('flex items-center gap-1 w-full rounded-md hover:bg-accent transition-colors', checked && 'bg-accent')}
                              style={{ paddingLeft: `${4 + c.depth * 16}px` }}>
                              {/* Collapse toggle */}
                              {isParent ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); toggleCollapse(c.id); }}
                                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted shrink-0">
                                  <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isCollapsed && '-rotate-90')} />
                                </button>
                              ) : <div className="w-6 shrink-0" />}
                              <button type="button" onClick={() => toggleCollection(c.id)}
                                className="flex items-center gap-2 flex-1 py-1.5 pr-2 text-sm">
                                <Checkbox checked={checked} className="pointer-events-none" /><span>{c.name}</span>
                              </button>
                            </div>);
                        })}
                        {visibleCollections.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">Sin resultados</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {selectedCollections.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCollections.map((id) => { const col = flatCollections.find((c) => c.id === id);
                        return <Badge key={id} variant="secondary" className="gap-1 pr-1">{col?.name}<button type="button" onClick={() => toggleCollection(id)} className="ml-0.5 rounded-full hover:bg-muted p-0.5"><X className="h-3 w-3" /></button></Badge>;
                      })}
                    </div>
                  )}
                </div>

                {/* ─── Financial Block (Simplified) ─────────── */}
                <div className="col-span-2 rounded-xl border bg-card p-4 space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">💰 Costo de Compra Global</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Costo de Compra<span className="text-destructive">*</span></Label>
                      <div className="flex items-center gap-1"><span className="text-sm text-muted-foreground">$</span>
                        <Input type="number" step="0.01" placeholder="1000.00" value={formCost} onChange={(e) => setFormCost(e.target.value)} className="font-mono" /></div>
                      <p className="text-[10px] text-muted-foreground">Precio que pagas a tu proveedor por este modelo.</p>
                    </div>
                    {parseFloat(formCost) > 0 && parseFloat(formCostMargin) > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Precio Base estimado</Label>
                        <p className="text-lg font-mono font-semibold text-primary">
                          ${(parseFloat(formCost) * (1 + parseFloat(formCostMargin) / 100)).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Costo + {formCostMargin}% operativo global</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 border p-2.5">
                    <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-[11px] text-muted-foreground">
                      El precio de venta se calcula automáticamente por el <span className="font-medium">Motor de Precios</span> según tus Listas de Precios, Costo Operativo y excepciones por sucursal. Puedes ajustarlo después en la vista de edición.
                    </p>
                  </div>
                </div>

                {/* Images */}
                <div className="col-span-2 space-y-3">
                  <Label>Imágenes del Modelo <span className="text-muted-foreground font-normal">(generales)</span></Label>
                  <div className="flex rounded-lg border overflow-hidden">
                    <button type="button" onClick={() => setImageMode('upload')} className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors', imageMode === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted')}><Upload className="h-3.5 w-3.5" />Subir</button>
                    <button type="button" onClick={() => setImageMode('url')} className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors', imageMode === 'url' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted')}><Link2 className="h-3.5 w-3.5" />URL</button>
                  </div>
                  {imageMode === 'upload' ? (
                    <label htmlFor="product-file" className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 cursor-pointer transition-colors', uploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/40 hover:bg-primary/5')}>
                      {uploading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground">{uploading ? 'Subiendo...' : 'Clic para subir'}</span>
                      <input id="product-file" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'general')} disabled={uploading} />
                    </label>
                  ) : (
                    <div className="flex gap-2">
                      <Input placeholder="https://ejemplo.com/zapato.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (imageUrl.trim()) { setFormImages((p) => [...p, imageUrl.trim()]); setImageUrl(''); } } }} />
                      <Button type="button" variant="outline" onClick={() => { if (imageUrl.trim()) { setFormImages((p) => [...p, imageUrl.trim()]); setImageUrl(''); } }}>Agregar</Button>
                    </div>
                  )}
                  {formImages.length > 0 && (
                    <div className="flex gap-2 flex-wrap">{formImages.map((url, i) => (
                      <div key={i} className="relative h-14 w-14 rounded-lg border bg-muted/30 overflow-hidden group">
                        <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <button type="button" onClick={() => setFormImages((p) => p.filter((_, j) => j !== i))} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4 text-white" /></button>
                      </div>
                    ))}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 1: Atributos (Catalogos) ────────────── */}
          {step === 1 && (
            <div className="space-y-5 py-4 px-1">
              <DialogHeader><DialogTitle>Constructor de Atributos</DialogTitle>
                <DialogDescription>Selecciona colores y tallas del catálogo maestro.</DialogDescription></DialogHeader>

              {/* Toggle */}
              <div className="flex items-center justify-between rounded-xl border p-4">
                <div><Label className="font-medium">¿Este producto tiene opciones (Tallas, Colores)?</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Si se desactiva, se creará una sola variante sin atributos.</p></div>
                <Switch checked={hasOptions} onCheckedChange={setHasOptions} />
              </div>

              {hasOptions && (
                <>
                  {/* ─── Colors ─────────────────────────────── */}
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">🎨 Colores</Label>
                      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setNewColorName(''); setNewColorHex('#000000'); setShowNewColorDialog(true); }}>
                        <PlusCircle className="h-3.5 w-3.5" />Agregar color
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {catalogColors.map((color) => {
                        const sel = selectedColorIds.includes(color.id);
                        return (
                          <button key={color.id} type="button" onClick={() =>
                            setSelectedColorIds((prev) => sel ? prev.filter((id) => id !== color.id) : [...prev, color.id])
                          } className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 border text-sm transition-all',
                            sel ? 'border-primary bg-primary/10 text-foreground shadow-sm' : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground')}>
                            <div className="h-4 w-4 rounded-full border border-border shadow-sm shrink-0" style={{ backgroundColor: color.hex_code }} />
                            {color.name}
                            {sel && <Check className="h-3 w-3 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                    {selectedColorIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">{selectedColorIds.length} color{selectedColorIds.length > 1 ? 'es' : ''} seleccionado{selectedColorIds.length > 1 ? 's' : ''}</p>
                    )}
                  </div>

                  {/* ─── Sizes ──────────────────────────────── */}
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <Label className="font-medium">📐 Tallas</Label>
                    {/* Group selector */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">Grupo:</Label>
                      <Tabs value={selectedSizeGroupId} onValueChange={(v) => { setSelectedSizeGroupId(v); setSelectedSizeRowIds([]); }}>
                        <TabsList>
                          {sizeGroups.map((g) => <TabsTrigger key={g.id} value={g.id}>{g.name}</TabsTrigger>)}
                        </TabsList>
                      </Tabs>
                    </div>

                    {/* Display system */}
                    {selectedSizeGroupId && sizeSystems.length > 1 && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground shrink-0">Mostrar en:</Label>
                        <div className="flex gap-1">
                          {sizeSystems.map((s) => (
                            <button key={s.id} type="button" onClick={() => setSelectedSizeSystemDisplay(s.id)}
                              className={cn('px-2 py-1 rounded text-xs font-medium transition-colors',
                                selectedSizeSystemDisplay === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}>{s.name}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Size pills */}
                    {selectedSizeGroupId && sizeRows.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {sizeRows.map((row) => {
                          const val = getDisplayValue(row);
                          const sel = selectedSizeRowIds.includes(row.id);
                          return (
                            <button key={row.id} type="button" onClick={() =>
                              setSelectedSizeRowIds((prev) => sel ? prev.filter((id) => id !== row.id) : [...prev, row.id])
                            } className={cn('px-3 py-1.5 rounded-full border text-sm font-mono transition-all',
                              sel ? 'border-primary bg-primary/10 text-foreground shadow-sm' : 'border-border hover:border-primary/40 text-muted-foreground')}>
                              {val}{sel && <Check className="h-3 w-3 text-primary inline ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick select all */}
                    {selectedSizeGroupId && sizeRows.length > 0 && (
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7"
                          onClick={() => setSelectedSizeRowIds(sizeRows.map((r) => r.id))}>Seleccionar todas</Button>
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7"
                          onClick={() => setSelectedSizeRowIds([])}>Limpiar</Button>
                      </div>
                    )}

                    {selectedSizeRowIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">{selectedSizeRowIds.length} talla{selectedSizeRowIds.length > 1 ? 's' : ''} seleccionada{selectedSizeRowIds.length > 1 ? 's' : ''}</p>
                    )}
                  </div>

                  {/* Preview count */}
                  {(selectedColorIds.length > 0 || selectedSizeRowIds.length > 0) && (
                    <div className="text-center text-sm text-muted-foreground">
                      → Se generarán <span className="font-semibold text-primary">
                        {Math.max(1, selectedColorIds.length) * Math.max(1, selectedSizeRowIds.length)}
                      </span> variante{(Math.max(1, selectedColorIds.length) * Math.max(1, selectedSizeRowIds.length)) > 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── STEP 2: Matriz de Variantes ──────────────── */}
          {step === 2 && (
            <div className="space-y-4 py-4 px-1">
              <DialogHeader><DialogTitle>Variantes, Fotos por Color y Stock</DialogTitle>
                <DialogDescription>{enabledCount} variantes activas.</DialogDescription></DialogHeader>

              {/* Controls */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Stock mode */}
                <div className="flex items-center gap-2 rounded-lg border p-2">
                  <button type="button" onClick={() => setStockMode('local')}
                    className={cn('flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                      stockMode === 'local' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                    📦 Recepción Local
                  </button>
                  <button type="button" onClick={() => setStockMode('multi')}
                    className={cn('flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                      stockMode === 'multi' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                    🌐 Multi-sucursal
                  </button>
                </div>

                {/* Bulk actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-1"><Settings2 className="h-3.5 w-3.5" />Acciones</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={autoGenerateSkus}>Generar SKUs automáticos</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyToAll('cost', formCost)}>Restaurar Costo a todas</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setBulkStockValue(''); setShowBulkStockDialog(true); }}>Asignar stock a todas</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* ─── Color Images ─────────────────────────── */}
              {uniqueColors.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Fotos por Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {uniqueColors.map((colorName) => {
                      const color = catalogColors.find((c) => c.name === colorName);
                      const imgs = colorImages[colorName] || [];
                      return (
                        <Popover key={colorName}>
                          <PopoverTrigger asChild>
                            <button type="button" className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors hover:border-primary/40',
                              imgs.length > 0 ? 'border-primary/30 bg-primary/5' : 'border-border')}>
                              <div className="h-4 w-4 rounded-full border shrink-0" style={{ backgroundColor: color?.hex_code || '#ccc' }} />
                              {colorName}
                              {imgs.length > 0 && <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">{imgs.length}</Badge>}
                              <ImagePlus className="h-3 w-3 text-muted-foreground ml-1" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72">
                            <div className="space-y-3">
                              <Label className="text-xs font-medium">Fotos de {colorName}</Label>
                              {imgs.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                  {imgs.map((url, i) => (
                                    <div key={i} className="relative h-12 w-12 rounded border overflow-hidden group">
                                      <img src={url} alt="" className="h-full w-full object-cover" />
                                      <button type="button" onClick={() => setColorImages((p) => ({ ...p, [colorName]: (p[colorName] || []).filter((_, j) => j !== i) }))}
                                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3 text-white" /></button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <label className={cn('flex flex-col items-center gap-1 rounded border-2 border-dashed py-3 cursor-pointer text-xs text-muted-foreground transition-colors',
                                colorImageUploading ? 'opacity-50' : 'hover:border-primary/40')}>
                                {colorImageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {colorImageUploading ? 'Subiendo...' : 'Subir foto'}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, colorName)} disabled={colorImageUploading} />
                              </label>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── Matrix Table ─────────────────────────── */}
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/40 border-b">
                      <th className="w-8 px-2 py-2"></th>
                      <th className="text-left px-3 py-2 font-medium">Variante</th>
                      <th className="text-left px-3 py-2 font-medium">SKU</th>
                      <th className="text-left px-3 py-2 font-medium">Barcode</th>
                      <th className="text-left px-3 py-2 font-medium w-24">Costo</th>
                      <th className="text-left px-3 py-2 font-medium w-24">Stock</th>
                    </tr></thead>
                    <tbody>
                      {variants.map((v, idx) => {
                        const totalStock = Object.values(v.stockByBranch).reduce((a, b) => a + b, 0);
                        const primarySystem = getSelectedSystemName();
                        const primarySizeVal = v.equivalencies[primarySystem] || v.sizeMex;
                        const otherEquivs = Object.entries(v.equivalencies).filter(([k]) => k !== primarySystem);
                        const tooltipText = otherEquivs.map(([k, val]) => `${k}: ${val}`).join(' · ');
                        return (
                          <tr key={v.key} className={cn('border-b last:border-b-0 transition-colors', !v.enabled && 'opacity-40 bg-muted/20', v.enabled && 'hover:bg-accent/30')}>
                            <td className="px-2 py-2"><Checkbox checked={v.enabled} onCheckedChange={(c) => updateVariant(idx, 'enabled', !!c)} /></td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {v.colorHex && <div className="h-5 w-5 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: v.colorHex }} title={v.colorName} />}
                                <span className="font-medium text-xs">
                                  {v.colorName}{v.colorName && primarySizeVal ? ' · ' : ''}
                                  {primarySizeVal && <span title={tooltipText || undefined}>{primarySizeVal}</span>}
                                </span>
                                {primarySizeVal && otherEquivs.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground cursor-help" title={tooltipText}>
                                    ℹ️
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Input value={v.sku} onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                                className="h-7 text-xs font-mono" disabled={!v.enabled} placeholder="SKU" />
                            </td>
                            <td className="px-3 py-2">
                              <Input value={v.barcode} onChange={(e) => updateVariant(idx, 'barcode', e.target.value)}
                                className="h-7 text-xs font-mono" disabled={!v.enabled} placeholder="Opcional" />
                            </td>
                            <td className="px-3 py-2">
                              <Input type="number" step="0.01" value={v.cost} onChange={(e) => updateVariant(idx, 'cost', e.target.value)}
                                className="h-7 text-xs" disabled={!v.enabled} />
                            </td>
                            <td className="px-3 py-2">
                              {stockMode === 'local' ? (
                                <Input type="number" min="0" value={v.stockByBranch[selectedBranchId || ''] || 0}
                                  onChange={(e) => setVariantBranchStock(idx, selectedBranchId || '', parseInt(e.target.value) || 0)}
                                  className="h-7 text-xs" disabled={!v.enabled} />
                              ) : (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button type="button" disabled={!v.enabled}
                                      className={cn('h-7 w-full rounded border bg-background px-2 text-xs font-mono text-center hover:bg-accent/30 transition-colors', !v.enabled && 'opacity-50')}>
                                      {totalStock}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-56 p-3">
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium">Distribuir stock</Label>
                                      {branches.map((br: BranchData) => (
                                        <div key={br.id} className="flex items-center justify-between gap-2">
                                          <span className="text-xs text-muted-foreground truncate flex-1">{br.name}</span>
                                          <Input type="number" min="0" value={v.stockByBranch[br.id] || 0}
                                            onChange={(e) => setVariantBranchStock(idx, br.id, parseInt(e.target.value) || 0)}
                                            className="h-7 w-16 text-xs text-center" />
                                        </div>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {variants.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No hay variantes.</div>}
              </div>

              {/* Summary */}
              {enabledCount > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="text-2xl font-bold text-primary">{enabledCount}</p><p className="text-xs text-muted-foreground">Variantes</p></div>
                    <div><p className="text-2xl font-bold text-primary">${formCost || '0'}</p><p className="text-xs text-muted-foreground">Costo Global</p></div>
                    <div><p className="text-2xl font-bold text-primary">{totalStock}</p><p className="text-xs text-muted-foreground">Stock Total</p></div>
                  </div>
                </div>
              )}
            </div>
          )}

          </div>{/* end scrollable */}

          {/* ─── Footer Navigation (sticky) ───────────────── */}
          <Separator className="shrink-0" />
          <div className="flex items-center justify-between pt-2 shrink-0">
            <Button type="button" variant="outline" onClick={step === 0 ? () => setWizardOpen(false) : goBack} className="gap-2">
              {step === 0 ? 'Cancelar' : <><ChevronLeft className="h-4 w-4" />Anterior</>}
            </Button>
            {step < 2 ? (
              <Button type="button" onClick={goNext} disabled={!canGoNext()} className="gap-2">
                Siguiente<ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={saving || enabledCount === 0} className="gap-2">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Creando...</> : <><Sparkles className="h-4 w-4" />Crear Producto ({enabledCount})</>}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
