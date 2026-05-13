'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Button, Skeleton, toast } from '@nivo/ui';
import { Search, ArrowLeft, ShoppingBag } from 'lucide-react';
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
import { SaleSuccessModal, type SaleReceiptData, type TicketConfig } from './components/SaleSuccessModal';
import { Breadcrumbs } from './components/Breadcrumbs';
import { CollectionGrid } from './components/CollectionGrid';
import { ProductGrid, type VariantCard } from './components/ProductGrid';
import { QuickViewModal, type QuickViewSelection } from './components/QuickViewModal';
import { TicketPanel } from './components/TicketPanel';
import { PaymentModal, type PaymentEntry } from './components/PaymentModal';
import { useCashOperation } from './components/CashOperationsMenu';
import { CashCloseModal } from './components/CashCloseModal';

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

  const { isAuthenticated, userType, user } = useAuthStore();
  const { session, posEmployee, cashRegister, loading: sessionLoading, loadActiveSession, closeSession, clearSession } = usePosSessionStore();
  const { selectedBranchId } = useBranchStore();

  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const searchMode = searchQuery.trim().length > 0;

  // QuickView state
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [quickViewColor, setQuickViewColor] = useState('');

  const [showPayment, setShowPayment] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [confirmSale, setConfirmSale] = useState<SaleReceiptData | null>(null);
  const [ticketConfig, setTicketConfig] = useState<TicketConfig | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const cashOps = useCashOperation();

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  const { items, addItem, clearCart, total } = useCartStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) router.replace('/login');
    else if (userType === 'super-admin') router.replace('/admin');
  }, [mounted, isAuthenticated, userType, router]);

  useEffect(() => {
    if (!mounted || !isAuthenticated || userType === 'super-admin') return;
    loadActiveSession();
    startSyncListener();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [mounted, isAuthenticated, userType]);

  useEffect(() => {
    if (!session) return;
    fetchCatalog();
    fetchTicketConfig();
  }, [session]);

  const fetchCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const res = await apiClient.get(`/pos/catalog?branch_id=${session!.branch_id}`);
      setCatalog(res.data);
      try {
        await offlineDB.products.clear();
        await offlineDB.products.bulkPut(
          (res.data.products || []).map((p: Product) => ({
            id: p.id, name: p.name, brand: p.brand?.name || '', category: p.category?.name || '',
            variants: p.variants.map((v) => ({
              id: v.id, sku: v.sku, color: variantColor(v), size_mex: variantSize(v),
              price: parseFloat(String(v.price_override)) || 0, barcode: v.barcode, stock: v.stock_available ?? 0,
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

  const fetchTicketConfig = async () => {
    try {
      const res = await apiClient.get(`/pos/ticket-config?branch_id=${session!.branch_id}`);
      setTicketConfig(res.data);
    } catch {}
  };

  useEffect(() => {
    if (!customerQuery.trim() || customerQuery.length < 2) {
      setCustomerResults([]); setShowCustomerDropdown(false); return;
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true);
      try {
        const res = await apiClient.get(`/customers?search=${encodeURIComponent(customerQuery)}`);
        setCustomerResults(res.data || []); setShowCustomerDropdown(true);
      } catch { setCustomerResults([]); }
      finally { setSearchingCustomers(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  const productMap = useMemo(() => {
    if (!catalog) return new Map<string, Product>();
    const map = new Map<string, Product>();
    for (const p of catalog.products) map.set(p.id, p);
    return map;
  }, [catalog]);

  const currentView = useMemo(() => {
    if (!catalog) return { type: 'loading' as const };
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
      return findInTree(catalog.collections)?.children || [];
    };
    const children = findChildren(currentCollectionId);
    if (children.length > 0) return { type: 'collections' as const, collections: children };
    if (currentCollectionId) {
      const productIds = catalog.collection_products[currentCollectionId] || [];
      const products = productIds.map((id) => productMap.get(id)).filter(Boolean) as Product[];
      return { type: 'products' as const, products };
    }
    if (catalog.collections.length === 0) return { type: 'products' as const, products: catalog.products };
    return { type: 'collections' as const, collections: catalog.collections };
  }, [catalog, currentCollectionId, productMap]);

  const variantCards = useMemo((): VariantCard[] => {
    if (currentView.type !== 'products') return [];
    const cards: VariantCard[] = [];
    for (const product of currentView.products) {
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
          variant_id: firstVariant.id, product_id: product.id, product_name: product.name,
          color, image_url: variantImage(firstVariant), price, total_stock: totalStock,
        });
      }
    }
    return cards;
  }, [currentView, catalog]);

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
        const matches = variants.some(
          (v) => product.name.toLowerCase().includes(q) || (v.sku && v.sku.toLowerCase().includes(q)) ||
            color.toLowerCase().includes(q) || (product.brand?.name && product.brand.name.toLowerCase().includes(q)) ||
            (v.barcode && v.barcode.includes(q)),
        );
        if (!matches) continue;
        const totalStock = variants.reduce((sum, v) => sum + (v.stock_available ?? 0), 0);
        const firstVariant = variants[0];
        const price = catalog.variant_prices[firstVariant.id] ?? parseFloat(String(firstVariant.price_override)) ?? 0;
        cards.push({
          variant_id: firstVariant.id, product_id: product.id, product_name: product.name,
          color, image_url: variantImage(firstVariant), price, total_stock: totalStock,
        });
      }
    }
    return cards;
  }, [searchMode, searchQuery, catalog]);

  // ─── Navigation ─────────────────────────────────────────────

  const handleCollectionSelect = useCallback((col: CollectionNode) => {
    setCurrentCollectionId(col.id);
    setBreadcrumb((prev) => [...prev, { id: col.id, name: col.name }]);
  }, []);

  const handleBreadcrumbNavigate = useCallback((id: string | null, index: number) => {
    setCurrentCollectionId(id);
    if (id === null) setBreadcrumb([]);
    else setBreadcrumb((prev) => prev.slice(0, index + 1));
  }, []);

  // ─── Product card click → QuickView ────────────────────────

  const handleVariantCardSelect = useCallback((card: VariantCard) => {
    if (!catalog) return;
    const product = productMap.get(card.product_id);
    if (!product) return;

    // Get all variants for this product + color
    const colorVariants = product.variants.filter(
      (v) => (variantColor(v) || 'default') === card.color,
    );

    // If only ONE variant total for this color (1 size) → add directly
    if (colorVariants.length === 1) {
      const v = colorVariants[0];
      const price = catalog.variant_prices[v.id] ?? parseFloat(String(v.price_override)) ?? 0;
      addItem({
        id: v.id, variant_id: v.id, product_id: product.id, name: product.name,
        variant_label: `${variantColor(v)} - ${variantSize(v)}`,
        image_url: variantImage(v), default_price: price, price, stock: v.stock_available ?? 0,
      });
      setSearchQuery('');
      searchRef.current?.focus();
      return;
    }

    // Multiple sizes → open QuickView
    setQuickViewProduct(product);
    setQuickViewColor(card.color);
  }, [catalog, productMap, addItem]);

  // ─── QuickView add to cart ──────────────────────────────────

  const handleQuickViewAdd = useCallback((sel: QuickViewSelection) => {
    addItem({
      id: sel.variant_id, variant_id: sel.variant_id, product_id: sel.product_id,
      name: sel.product_name,
      variant_label: `${sel.color} - ${sel.size}`,
      image_url: sel.image_url, default_price: sel.price, price: sel.price, stock: sel.stock,
    });
    setSearchQuery('');
    searchRef.current?.focus();
  }, [addItem]);

  // ─── Barcode scan ───────────────────────────────────────────

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery && catalog) {
      for (const p of catalog.products) {
        for (const v of p.variants) {
          if (v.barcode === searchQuery || v.sku === searchQuery) {
            const price = catalog.variant_prices[v.id] ?? parseFloat(String(v.price_override)) ?? 0;
            addItem({
              id: v.id, variant_id: v.id, product_id: p.id, name: p.name,
              variant_label: `${variantColor(v)} - ${variantSize(v)}`,
              image_url: variantImage(v), default_price: price, price, stock: v.stock_available ?? 0,
            });
            setSearchQuery('');
            searchRef.current?.focus();
            return;
          }
        }
      }
      if (searchResults.length === 1) handleVariantCardSelect(searchResults[0]);
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

  const handlePaymentConfirm = async (payments: PaymentEntry[]) => {
    if (items.length === 0 || !session || payments.length === 0) return;
    setProcessingPayment(true);
    const cartTotal = total();

    // Determine display method label
    const methodLabel = payments.length === 1
      ? payments[0].payment_method_name
      : payments.map((p) => p.payment_method_name).join(' + ');

    // Calculate cash change using tendered amount (actual cash handed over)
    const cashTendered = payments
      .filter((p) => p.payment_method_name.toLowerCase().includes('efectivo'))
      .reduce((sum, p) => sum + (p.tendered ?? p.amount), 0);
    const nonCashTotal = payments
      .filter((p) => !p.payment_method_name.toLowerCase().includes('efectivo'))
      .reduce((sum, p) => sum + p.amount, 0);
    const cashNeeded = cartTotal - nonCashTotal;
    const cashChange = Math.max(0, cashTendered - cashNeeded);

    const saleData = {
      id: crypto.randomUUID(), pos_session_id: session.id, branch_id: session.branch_id,
      employee_id: user?.sub || user?.id, customer_id: selectedCustomer?.id || undefined,
      total_amount: cartTotal, discount_amount: 0, tax_amount: 0,
      payment_method: payments.length === 1
        ? (payments[0].payment_method_name.toLowerCase().includes('efectivo') ? 'cash' : 'card')
        : 'mixed',
      sale_type: 'in_store',
      items: items.map((i) => ({
        variant_id: i.variant_id, quantity: i.quantity, unit_price: i.price, discount: 0, subtotal: i.price * i.quantity,
      })),
      payments: payments.map((p) => ({
        payment_method_id: p.payment_method_id,
        payment_method_name: p.payment_method_name,
        amount: p.amount,
        reference: p.reference,
      })),
    };
    const receiptItems = items.map((i) => ({
      name: i.name, variant: i.variant_label, qty: i.quantity, unitPrice: i.price,
    }));
    const receiptPayments = payments.map((p) => ({
      method: p.payment_method_name, amount: p.amount, reference: p.reference,
    }));

    const buildReceiptData = (saleId: string): SaleReceiptData => ({
      id: saleId, total: cartTotal, paymentMethod: methodLabel, itemCount: items.length,
      customerName: selectedCustomer?.name, items: receiptItems,
      payments: receiptPayments, cashChange,
    });

    try {
      const response = await apiClient.post('/pos/transactions', saleData);
      setShowPayment(false);
      setConfirmSale(buildReceiptData(response.data.id));
      clearCart(); setSelectedCustomer(null); setCustomerQuery('');
      fetchCatalog();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'No se pudo registrar la venta.';
      if (msg.includes('Stock insuficiente')) {
        toast({ title: 'Stock insuficiente', description: msg, variant: 'destructive' });
        fetchCatalog();
      } else {
        try {
          const offlineSale: OfflineSale = { ...saleData, created_at: new Date().toISOString(), synced: false };
          await offlineDB.sales.add(offlineSale);
          setShowPayment(false);
          setConfirmSale(buildReceiptData(saleData.id));
          clearCart(); setSelectedCustomer(null); setCustomerQuery('');
          toast({ title: 'Venta guardada offline', description: 'Se sincronizara automaticamente cuando haya conexion.' });
        } catch { toast({ title: 'Error', description: msg, variant: 'destructive' }); }
      }
    } finally { setProcessingPayment(false); }
  };

  const handleCloseSessionCorteZ = async (declaredAmount: number) => {
    const result = await closeSession(declaredAmount);
    if (!result) throw new Error('No se pudo cerrar la caja');
    return result;
  };

  const handleCloseComplete = () => {
    setShowCloseDialog(false);
    clearSession(); // Now clear session after the reveal modal is dismissed
    toast({ title: 'Caja cerrada', description: 'Tu turno ha finalizado.' });
    router.push('/dashboard');
  };

  // ─── Render guards ──────────────────────────────────────────

  if (!mounted || !isAuthenticated || userType === 'super-admin') return null;

  const needsSession = !sessionLoading && !session;

  if (needsSession) {
    return <CashRegisterSetup onReady={() => { loadActiveSession(); }} />;
  }

  // ─── Main layout ────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Dialogs */}
      <SwitchCashierDialog
        open={showSwitchDialog}
        onClose={() => setShowSwitchDialog(false)}
        onSwitched={() => { setShowSwitchDialog(false); loadActiveSession(); }}
      />
      <SaleSuccessModal
        open={!!confirmSale}
        sale={confirmSale}
        ticketConfig={ticketConfig}
        employeeName={posEmployee?.name || user?.name || ''}
        onClose={() => { setConfirmSale(null); searchRef.current?.focus(); }}
      />

      {/* QuickView Modal */}
      <QuickViewModal
        open={!!quickViewProduct}
        product={quickViewProduct}
        variantPrices={catalog?.variant_prices || {}}
        preselectedColor={quickViewColor}
        onAddToCart={handleQuickViewAdd}
        onClose={() => setQuickViewProduct(null)}
      />

      {/* Payment Modal */}
      <PaymentModal
        open={showPayment}
        total={total()}
        processingPayment={processingPayment}
        onConfirm={handlePaymentConfirm}
        onClose={() => setShowPayment(false)}
      />

      {/* Corte Z — Cash Close Modal */}
      <CashCloseModal
        open={showCloseDialog}
        sessionId={session?.id || ''}
        employeeName={posEmployee?.name || ''}
        cashRegisterName={cashRegister?.name || ''}
        onClose={handleCloseComplete}
        onCloseSession={handleCloseSessionCorteZ}
      />

      {/* Cash Operations Menu (Cash In / Cash Out / Audit) */}
      <cashOps.CashOperationsMenuWithState
        sessionId={session?.id || ''}
        employeeId={posEmployee?.id || ''}
        branchId={session?.branch_id || ''}
      />

      {/* ═══ LEFT PANEL (65%) — Catalog ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search bar */}
        <div className="flex items-center gap-3 p-4">
          <Link href="/dashboard">
            <button className="p-2.5 rounded-xl bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-800/40">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              ref={searchRef}
              placeholder="Escanear codigo de barras o buscar producto..."
              className="w-full pl-11 pr-16 h-12 text-base rounded-xl bg-slate-900 border border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 backdrop-blur-sm transition-all shadow-sm shadow-slate-900/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
            {/* Shortcut badge */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-2 py-1 rounded-md bg-slate-800/60 border border-slate-700/30">
              <span className="text-[10px] text-slate-500 font-mono">F12</span>
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        {!searchMode && breadcrumb.length > 0 && (
          <div className="px-4 pb-1">
            <Breadcrumbs items={breadcrumb} onNavigate={handleBreadcrumbNavigate} />
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-auto px-4 pb-4">
          {sessionLoading || loadingCatalog ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-2xl bg-slate-900/50" />
              ))}
            </div>
          ) : searchMode ? (
            searchResults.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-lg text-slate-400">Sin resultados para &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-sm">Intenta con otro termino de busqueda</p>
                </div>
              </div>
            ) : (
              <ProductGrid variants={searchResults} onSelect={handleVariantCardSelect} />
            )
          ) : currentView.type === 'collections' ? (
            <CollectionGrid collections={currentView.collections} onSelect={handleCollectionSelect} />
          ) : currentView.type === 'products' ? (
            <ProductGrid variants={variantCards} onSelect={handleVariantCardSelect} />
          ) : null}
        </div>
      </div>

      {/* ═══ RIGHT PANEL (35%) — Ticket ═══ */}
      <div className="w-[380px] border-l border-slate-800/60 flex-shrink-0">
        <TicketPanel
          cashRegisterName={cashRegister?.name}
          employeeName={posEmployee?.name}
          isOnline={isOnline}
          onCobrar={() => setShowPayment(true)}
          onSwitchCashier={() => setShowSwitchDialog(true)}
          onCloseSession={() => setShowCloseDialog(true)}
          onCashIn={cashOps.openCashIn}
          onCashOut={cashOps.openCashOut}
          onAudit={cashOps.openAudit}
          onExpense={cashOps.openExpense}
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
