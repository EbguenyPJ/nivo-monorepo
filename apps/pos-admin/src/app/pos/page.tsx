'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Button, Input, Badge, Skeleton, toast } from '@nivo/ui';
import {
  Search, ArrowLeft, ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { usePosSessionStore } from '@/store/posSessionStore';
import { useBranchStore } from '@/store/branchStore';
import { offlineDB, type OfflineSale } from '@/lib/offline/indexedDB';
import { startSyncListener } from '@/lib/offline/sync-queue';
import { CashRegisterSetup } from './components/CashRegisterSetup';
import { SwitchCashierDialog } from './components/SwitchCashierDialog';
import { SaleConfirmation } from './components/SaleConfirmation';
import { ReceiptDialog } from './components/ReceiptDialog';
import { Breadcrumbs } from './components/Breadcrumbs';
import { CollectionGrid } from './components/CollectionGrid';
import { ProductGrid, type VariantCard } from './components/ProductGrid';
import { SizePickerModal, type SizeOption } from './components/SizePickerModal';
import { TicketPanel } from './components/TicketPanel';
import { PaymentModal } from './components/PaymentModal';

// ─── Types ───────────────────────────────────────────────────────

interface CollectionNode {
  id: string;
  name: string;
  color: string | null;
  image_url: string | null;
  children: CollectionNode[];
}

interface ProductVariant {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price_override: number | null;
  cost: number;
  barcode: string | null;
  images: string[];
  stock_available: number;
}

// ─── Helpers to extract attributes ───────────────────────────
function variantColor(v: ProductVariant): string {
  return v.attributes?.['Color'] || '';
}

function variantSize(v: ProductVariant): number {
  return parseFloat(v.attributes?.['Talla MX'] || '0');
}

function variantImage(v: ProductVariant): string | undefined {
  return v.images?.[0] || undefined;
}

interface Product {
  id: string;
  name: string;
  brand?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  variants: ProductVariant[];
}

interface PriceListInfo {
  id: string;
  name: string;
  is_default: boolean;
}

interface CatalogData {
  collections: CollectionNode[];
  collection_products: Record<string, string[]>;
  products: Product[];
  variant_prices: Record<string, number>;
  price_lists: PriceListInfo[];
}

interface CustomerResult {
  id: string;
  name: string;
  email: string;
  phone: string;
}

// ─── Page ────────────────────────────────────────────────────────

export default function PosPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // ─── Auth & Session ─────────────────────────────────────────
  const { isAuthenticated, userType, user } = useAuthStore();
  const { session, posEmployee, cashRegister, loading: sessionLoading, loadActiveSession, closeSession } = usePosSessionStore();
  const { selectedBranchId } = useBranchStore();

  // ─── Catalog data ───────────────────────────────────────────
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // ─── Navigation ─────────────────────────────────────────────
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null);

  // ─── Search ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const searchMode = searchQuery.trim().length > 0;

  // ─── Size picker ────────────────────────────────────────────
  const [sizePickerData, setSizePickerData] = useState<{
    productName: string;
    color: string;
    image_url?: string | null;
    price: number;
    productId: string;
    sizes: SizeOption[];
  } | null>(null);

  // ─── Payment ────────────────────────────────────────────────
  const [showPayment, setShowPayment] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // ─── Dialogs ────────────────────────────────────────────────
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closingAmount, setClosingAmount] = useState('');
  const [confirmSale, setConfirmSale] = useState<{
    id: string; total: number; paymentMethod: string; itemCount: number;
    customerName?: string; items: { name: string; variant: string; qty: number; price: number }[];
  } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // ─── Customer ───────────────────────────────────────────────
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // ─── Stores ─────────────────────────────────────────────────
  const { items, addItem, clearCart, total } = useCartStore();

  // ─── Route guard ────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) router.replace('/login');
    else if (userType === 'super-admin') router.replace('/admin');
  }, [mounted, isAuthenticated, userType, router]);

  // ─── Session + connectivity ─────────────────────────────────
  useEffect(() => {
    if (!mounted || !isAuthenticated || userType === 'super-admin') return;
    loadActiveSession();
    startSyncListener();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [mounted, isAuthenticated, userType]);

  // ─── Load catalog when session active ───────────────────────
  useEffect(() => {
    if (!session) return;
    fetchCatalog();
  }, [session]);

  const fetchCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const res = await apiClient.get(`/pos/catalog?branch_id=${session!.branch_id}`);
      setCatalog(res.data);

      // Cache products for offline
      try {
        await offlineDB.products.clear();
        await offlineDB.products.bulkPut(
          (res.data.products || []).map((p: Product) => ({
            id: p.id,
            name: p.name,
            brand: p.brand?.name || '',
            category: p.category?.name || '',
            variants: p.variants.map((v) => ({
              id: v.id, sku: v.sku, color: variantColor(v), size_mex: variantSize(v),
              price: parseFloat(String(v.price_override)) || 0, barcode: v.barcode,
              stock: v.stock_available ?? 0,
            })),
          })),
        );
      } catch {}
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el catalogo.', variant: 'destructive' });
    } finally {
      setLoadingCatalog(false);
    }
  };

  // ─── Customer search debounce ───────────────────────────────
  useEffect(() => {
    if (!customerQuery.trim() || customerQuery.length < 2) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true);
      try {
        const res = await apiClient.get(`/customers?search=${encodeURIComponent(customerQuery)}`);
        setCustomerResults(res.data || []);
        setShowCustomerDropdown(true);
      } catch {
        setCustomerResults([]);
      } finally {
        setSearchingCustomers(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  // ─── Build product map for quick access ─────────────────────
  const productMap = useMemo(() => {
    if (!catalog) return new Map<string, Product>();
    const map = new Map<string, Product>();
    for (const p of catalog.products) {
      map.set(p.id, p);
    }
    return map;
  }, [catalog]);

  // ─── Resolve current view (collections or products) ─────────
  const currentView = useMemo(() => {
    if (!catalog) return { type: 'loading' as const };

    // Find current collection's children
    const findChildren = (id: string | null): CollectionNode[] => {
      if (id === null) return catalog.collections;
      const findInTree = (nodes: CollectionNode[]): CollectionNode | null => {
        for (const n of nodes) {
          if (n.id === id) return n;
          const found = findInTree(n.children);
          if (found) return found;
        }
        return null;
      };
      const node = findInTree(catalog.collections);
      return node?.children || [];
    };

    const children = findChildren(currentCollectionId);

    if (children.length > 0) {
      return { type: 'collections' as const, collections: children };
    }

    // Leaf collection → show products
    if (currentCollectionId) {
      const productIds = catalog.collection_products[currentCollectionId] || [];
      const products = productIds.map((id) => productMap.get(id)).filter(Boolean) as Product[];
      return { type: 'products' as const, products };
    }

    // Root with no collections → show all products
    if (catalog.collections.length === 0) {
      return { type: 'products' as const, products: catalog.products };
    }

    return { type: 'collections' as const, collections: catalog.collections };
  }, [catalog, currentCollectionId, productMap]);

  // ─── Build variant cards for product view ───────────────────
  const variantCards = useMemo((): VariantCard[] => {
    if (currentView.type !== 'products') return [];
    const cards: VariantCard[] = [];

    for (const product of currentView.products) {
      // Group variants by color
      const byColor = new Map<string, ProductVariant[]>();
      for (const v of product.variants) {
        const key = variantColor(v) || 'default';
        if (!byColor.has(key)) byColor.set(key, []);
        byColor.get(key)!.push(v);
      }

      for (const [color, variants] of byColor) {
        const totalStock = variants.reduce((sum, v) => sum + (v.stock_available ?? 0), 0);
        const firstVariant = variants[0];
        const price = catalog?.variant_prices[firstVariant.id] ?? parseFloat(String(firstVariant.price_override)) ?? 0;

        cards.push({
          variant_id: firstVariant.id,
          product_id: product.id,
          product_name: product.name,
          color,
          image_url: variantImage(firstVariant),
          price,
          total_stock: totalStock,
        });
      }
    }

    return cards;
  }, [currentView, catalog]);

  // ─── Search results (override) ──────────────────────────────
  const searchResults = useMemo((): VariantCard[] => {
    if (!searchMode || !catalog) return [];
    const q = searchQuery.toLowerCase();

    const cards: VariantCard[] = [];
    for (const product of catalog.products) {
      const byColor = new Map<string, ProductVariant[]>();
      for (const v of product.variants) {
        const key = variantColor(v) || 'default';
        if (!byColor.has(key)) byColor.set(key, []);
        byColor.get(key)!.push(v);
      }

      for (const [color, variants] of byColor) {
        // Check if any variant matches the query
        const matches = variants.some(
          (v) =>
            product.name.toLowerCase().includes(q) ||
            (v.sku && v.sku.toLowerCase().includes(q)) ||
            color.toLowerCase().includes(q) ||
            (product.brand?.name && product.brand.name.toLowerCase().includes(q)) ||
            (v.barcode && v.barcode.includes(q)),
        );
        if (!matches) continue;

        const totalStock = variants.reduce((sum, v) => sum + (v.stock_available ?? 0), 0);
        const firstVariant = variants[0];
        const price = catalog.variant_prices[firstVariant.id] ?? parseFloat(String(firstVariant.price_override)) ?? 0;

        cards.push({
          variant_id: firstVariant.id,
          product_id: product.id,
          product_name: product.name,
          color,
          image_url: variantImage(firstVariant),
          price,
          total_stock: totalStock,
        });
      }
    }

    return cards;
  }, [searchMode, searchQuery, catalog]);

  // ─── Navigation handlers ────────────────────────────────────

  const handleCollectionSelect = useCallback((col: CollectionNode) => {
    setCurrentCollectionId(col.id);
    setBreadcrumb((prev) => [...prev, { id: col.id, name: col.name }]);
  }, []);

  const handleBreadcrumbNavigate = useCallback((id: string | null, index: number) => {
    setCurrentCollectionId(id);
    if (id === null) {
      setBreadcrumb([]);
    } else {
      setBreadcrumb((prev) => prev.slice(0, index + 1));
    }
  }, []);

  // ─── Product selection → size picker ────────────────────────

  const handleVariantCardSelect = useCallback((card: VariantCard) => {
    if (!catalog) return;
    const product = productMap.get(card.product_id);
    if (!product) return;

    // Get all variants for this product + color
    const colorVariants = product.variants.filter(
      (v) => (variantColor(v) || 'default') === card.color,
    );

    // If only one size → add directly to cart
    if (colorVariants.length === 1) {
      const v = colorVariants[0];
      const price = catalog.variant_prices[v.id] ?? parseFloat(String(v.price_override)) ?? 0;
      addItem({
        id: v.id,
        variant_id: v.id,
        product_id: product.id,
        name: product.name,
        variant_label: `${variantColor(v)} - ${variantSize(v)}`,
        image_url: variantImage(v),
        default_price: price,
        price,
        stock: v.stock_available ?? 0,
      });
      setSearchQuery('');
      searchRef.current?.focus();
      return;
    }

    // Multiple sizes → show picker
    const sizes: SizeOption[] = colorVariants.map((v) => ({
      variant_id: v.id,
      size_mex: variantSize(v),
      stock: v.stock_available ?? 0,
      sku: v.sku,
      barcode: v.barcode,
    }));

    setSizePickerData({
      productName: product.name,
      color: card.color,
      image_url: card.image_url,
      price: card.price,
      productId: product.id,
      sizes,
    });
  }, [catalog, productMap, addItem]);

  const handleSizeSelect = useCallback((size: SizeOption) => {
    if (!sizePickerData || !catalog) return;
    const product = productMap.get(sizePickerData.productId);
    if (!product) return;

    const price = catalog.variant_prices[size.variant_id] ?? sizePickerData.price;

    addItem({
      id: size.variant_id,
      variant_id: size.variant_id,
      product_id: sizePickerData.productId,
      name: sizePickerData.productName,
      variant_label: `${sizePickerData.color} - ${size.size_mex}`,
      image_url: sizePickerData.image_url ?? undefined,
      default_price: price,
      price,
      stock: size.stock,
    });

    setSizePickerData(null);
    setSearchQuery('');
    searchRef.current?.focus();
  }, [sizePickerData, catalog, productMap, addItem]);

  // ─── Barcode scan handler ───────────────────────────────────

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery && catalog) {
      // Try exact barcode/sku match
      for (const p of catalog.products) {
        for (const v of p.variants) {
          if (v.barcode === searchQuery || v.sku === searchQuery) {
            const price = catalog.variant_prices[v.id] ?? parseFloat(String(v.price_override)) ?? 0;
            addItem({
              id: v.id,
              variant_id: v.id,
              product_id: p.id,
              name: p.name,
              variant_label: `${variantColor(v)} - ${variantSize(v)}`,
              image_url: variantImage(v),
              default_price: price,
              price,
              stock: v.stock_available ?? 0,
            });
            setSearchQuery('');
            searchRef.current?.focus();
            return;
          }
        }
      }

      // If only one search result, select it
      if (searchResults.length === 1) {
        handleVariantCardSelect(searchResults[0]);
      }
    }
  }, [searchQuery, catalog, addItem, searchResults, handleVariantCardSelect]);

  // ─── F12 hotkey ─────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' && items.length > 0 && !showPayment) {
        e.preventDefault();
        setShowPayment(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, showPayment]);

  // ─── Payment ────────────────────────────────────────────────

  const handlePaymentConfirm = async (method: 'cash' | 'card' | 'mixed', amountReceived?: number) => {
    if (items.length === 0 || !session) return;
    setProcessingPayment(true);

    const cartTotal = total();
    const saleData = {
      id: crypto.randomUUID(),
      pos_session_id: session.id,
      branch_id: session.branch_id,
      employee_id: user?.sub || user?.id,
      customer_id: selectedCustomer?.id || undefined,
      total_amount: cartTotal,
      discount_amount: 0,
      tax_amount: 0,
      payment_method: method,
      sale_type: 'in_store',
      items: items.map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
        unit_price: i.price,
        discount: 0,
        subtotal: i.price * i.quantity,
      })),
    };

    const receiptItems = items.map((i) => ({
      name: i.name,
      variant: i.variant_label,
      qty: i.quantity,
      price: i.price,
    }));

    try {
      const response = await apiClient.post('/pos/transactions', saleData);
      setShowPayment(false);
      setConfirmSale({
        id: response.data.id,
        total: cartTotal,
        paymentMethod: method,
        itemCount: items.length,
        customerName: selectedCustomer?.name,
        items: receiptItems,
      });
      clearCart();
      setSelectedCustomer(null);
      setCustomerQuery('');
      fetchCatalog(); // Refresh stock
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'No se pudo registrar la venta.';
      if (msg.includes('Stock insuficiente')) {
        toast({ title: 'Stock insuficiente', description: msg, variant: 'destructive' });
        fetchCatalog();
      } else {
        // Save offline
        try {
          const offlineSale: OfflineSale = {
            ...saleData,
            created_at: new Date().toISOString(),
            synced: false,
          };
          await offlineDB.sales.add(offlineSale);
          setShowPayment(false);
          setConfirmSale({
            id: saleData.id,
            total: cartTotal,
            paymentMethod: method,
            itemCount: items.length,
            customerName: selectedCustomer?.name,
            items: receiptItems,
          });
          clearCart();
          setSelectedCustomer(null);
          setCustomerQuery('');
          toast({
            title: 'Venta guardada offline',
            description: 'Se sincronizara automaticamente cuando haya conexion.',
          });
        } catch {
          toast({ title: 'Error', description: msg, variant: 'destructive' });
        }
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  // ─── Close session ──────────────────────────────────────────

  const handleCloseSession = async () => {
    try {
      await closeSession(parseFloat(closingAmount) || 0);
      toast({ title: 'Caja cerrada', description: 'Tu turno ha finalizado.' });
      router.push('/dashboard');
    } catch {
      toast({ title: 'Error', description: 'No se pudo cerrar la caja.', variant: 'destructive' });
    }
  };

  // ─── Render guards ──────────────────────────────────────────

  if (!mounted || !isAuthenticated || userType === 'super-admin') return null;

  const needsSession = !sessionLoading && !session;

  if (needsSession) {
    return (
      <CashRegisterSetup
        onReady={() => {
          loadActiveSession();
        }}
      />
    );
  }

  // ─── Main layout ────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background">
      {/* Dialogs */}
      <SwitchCashierDialog
        open={showSwitchDialog}
        onClose={() => setShowSwitchDialog(false)}
        onSwitched={() => {
          setShowSwitchDialog(false);
          loadActiveSession();
        }}
      />

      <SaleConfirmation
        open={!!confirmSale && !showReceipt}
        onClose={() => {
          setConfirmSale(null);
          searchRef.current?.focus();
        }}
        onPrintReceipt={() => setShowReceipt(true)}
        sale={confirmSale}
      />

      {confirmSale && showReceipt && (
        <ReceiptDialog
          open={showReceipt}
          onClose={() => {
            setShowReceipt(false);
            setConfirmSale(null);
            searchRef.current?.focus();
          }}
          sale={confirmSale}
          branchName={session?.branch?.name || ''}
          employeeName={user?.name || ''}
        />
      )}

      {/* Size Picker */}
      <SizePickerModal
        open={!!sizePickerData}
        productName={sizePickerData?.productName || ''}
        color={sizePickerData?.color || ''}
        image_url={sizePickerData?.image_url}
        price={sizePickerData?.price || 0}
        sizes={sizePickerData?.sizes || []}
        onSelect={handleSizeSelect}
        onClose={() => setSizePickerData(null)}
      />

      {/* Payment Modal */}
      <PaymentModal
        open={showPayment}
        total={total()}
        processingPayment={processingPayment}
        onConfirm={handlePaymentConfirm}
        onClose={() => setShowPayment(false)}
      />

      {/* Close Session Dialog */}
      {showCloseDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-background rounded-lg p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold">Cerrar Caja</h3>
            <p className="text-sm text-muted-foreground">
              Ingresa el monto de cierre para finalizar tu turno.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Monto de Cierre ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCloseDialog(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleCloseSession}>
                Cerrar Caja
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LEFT PANEL (65%) — Catalog ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search bar */}
        <div className="flex items-center gap-3 p-3 border-b">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Escanear codigo de barras o buscar producto..."
              className="pl-10 h-11 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
          </div>
        </div>

        {/* Breadcrumbs */}
        {!searchMode && breadcrumb.length > 0 && (
          <div className="px-3 border-b">
            <Breadcrumbs items={breadcrumb} onNavigate={handleBreadcrumbNavigate} />
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-auto p-3">
          {sessionLoading || loadingCatalog ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : searchMode ? (
            /* Search results */
            searchResults.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-lg">Sin resultados para &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-sm">Intenta con otro termino de busqueda</p>
                </div>
              </div>
            ) : (
              <ProductGrid variants={searchResults} onSelect={handleVariantCardSelect} />
            )
          ) : currentView.type === 'collections' ? (
            <CollectionGrid
              collections={currentView.collections}
              onSelect={handleCollectionSelect}
            />
          ) : currentView.type === 'products' ? (
            <ProductGrid variants={variantCards} onSelect={handleVariantCardSelect} />
          ) : null}
        </div>
      </div>

      {/* ═══ RIGHT PANEL (35%) — Ticket ═══ */}
      <div className="w-[380px] border-l bg-card flex-shrink-0">
        <TicketPanel
          cashRegisterName={cashRegister?.name}
          employeeName={posEmployee?.name}
          isOnline={isOnline}
          onCobrar={() => setShowPayment(true)}
          onSwitchCashier={() => setShowSwitchDialog(true)}
          onCloseSession={() => setShowCloseDialog(true)}
          selectedCustomer={selectedCustomer}
          onCustomerSelect={setSelectedCustomer}
          customerQuery={customerQuery}
          onCustomerQueryChange={setCustomerQuery}
          customerResults={customerResults}
          showCustomerDropdown={showCustomerDropdown}
          onShowCustomerDropdown={setShowCustomerDropdown}
          searchingCustomers={searchingCustomers}
          processingPayment={processingPayment}
        />
      </div>
    </div>
  );
}
