'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Button, Input, Badge, Separator, Skeleton, toast } from '@nivo/ui';
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote, ArrowLeft,
  Wifi, WifiOff, LogOut, ShoppingBag, User, Printer, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { usePosSessionStore } from '@/store/posSessionStore';
import { offlineDB, type OfflineSale } from '@/lib/offline/indexedDB';
import { startSyncListener } from '@/lib/offline/sync-queue';
import { OpenSessionDialog } from './components/OpenSessionDialog';
import { SaleConfirmation } from './components/SaleConfirmation';
import { ReceiptDialog } from './components/ReceiptDialog';

interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  size_mex: number;
  price: number;
  cost: number;
  barcode: string | null;
  stock_available: number;
}

interface Product {
  id: string;
  name: string;
  brand?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  variants: ProductVariant[];
}

interface DisplayItem {
  productId: string;
  variantId: string;
  productName: string;
  brand: string;
  color: string;
  size: number;
  price: number;
  sku: string;
  barcode: string | null;
  stock: number;
}

interface CustomerResult {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export default function PosPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closingAmount, setClosingAmount] = useState('');
  const [confirmSale, setConfirmSale] = useState<{
    id: string; total: number; paymentMethod: string; itemCount: number;
    customerName?: string; items: { name: string; variant: string; qty: number; price: number }[];
  } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Stores
  const { items, addItem, removeItem, updateQuantity, clearCart, total } = useCartStore();
  const { isAuthenticated, userType, user } = useAuthStore();
  const { session, loading: sessionLoading, loadActiveSession, openSession, closeSession } = usePosSessionStore();

  // Route protection
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (userType === 'super-admin') {
      router.replace('/admin');
    }
  }, [mounted, isAuthenticated, userType, router]);

  // Check session on mount
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

  // Load products when session is active (use POS products endpoint with stock)
  useEffect(() => {
    if (!session) return;
    fetchProducts();
  }, [session]);

  // Customer search debounce
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

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      // Use POS products endpoint that includes stock per branch
      const response = await apiClient.get(`/pos/products?branch_id=${session!.branch_id}`);
      const prods: Product[] = response.data;

      const flat: DisplayItem[] = [];
      for (const p of prods) {
        for (const v of p.variants || []) {
          flat.push({
            productId: p.id,
            variantId: v.id,
            productName: p.name,
            brand: p.brand?.name || '',
            color: v.color,
            size: parseFloat(String(v.size_mex)) || 0,
            price: parseFloat(String(v.price)) || 0,
            sku: v.sku,
            barcode: v.barcode,
            stock: v.stock_available ?? 0,
          });
        }
      }
      setDisplayItems(flat);

      // Cache for offline
      try {
        await offlineDB.products.clear();
        await offlineDB.products.bulkPut(
          prods.map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand?.name || '',
            category: p.category?.name || '',
            variants: p.variants.map((v) => ({
              id: v.id, sku: v.sku, color: v.color, size_mex: v.size_mex,
              price: parseFloat(String(v.price)) || 0, barcode: v.barcode,
              stock: v.stock_available ?? 0,
            })),
          })),
        );
      } catch {}
    } catch {
      // Fallback: try regular products endpoint then offline cache
      try {
        const response = await apiClient.get('/products');
        const prods: Product[] = response.data;
        const flat: DisplayItem[] = [];
        for (const p of prods) {
          for (const v of p.variants || []) {
            flat.push({
              productId: p.id, variantId: v.id, productName: p.name,
              brand: p.brand?.name || '', color: v.color,
              size: parseFloat(String(v.size_mex)) || 0,
              price: parseFloat(String(v.price)) || 0,
              sku: v.sku, barcode: v.barcode, stock: -1, // -1 = unknown stock
            });
          }
        }
        setDisplayItems(flat);
      } catch {
        try {
          const cached = await offlineDB.products.toArray();
          const flat: DisplayItem[] = [];
          for (const p of cached) {
            for (const v of p.variants) {
              flat.push({
                productId: p.id, variantId: v.id, productName: p.name,
                brand: p.brand, color: v.color, size: parseFloat(String(v.size_mex)) || 0,
                price: parseFloat(String(v.price)) || 0, sku: v.sku, barcode: v.barcode,
                stock: (v as any).stock ?? -1,
              });
            }
          }
          setDisplayItems(flat);
          toast({ title: 'Modo offline', description: 'Productos cargados desde caché local.' });
        } catch {
          toast({ title: 'Error', description: 'No se pudieron cargar los productos.', variant: 'destructive' });
        }
      }
    } finally {
      setLoadingProducts(false);
    }
  };

  // Filter items by search
  const filteredItems = displayItems.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.productName.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.color.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      (item.barcode && item.barcode.includes(q)) ||
      item.size.toString().includes(q)
    );
  });

  // Handle adding product to cart
  const handleAddToCart = useCallback((item: DisplayItem) => {
    // Check stock
    if (item.stock !== -1 && item.stock <= 0) {
      toast({ title: 'Sin stock', description: `${item.productName} no tiene stock disponible.`, variant: 'destructive' });
      return;
    }
    const existingInCart = items.find((i) => i.id === item.variantId);
    const currentQty = existingInCart?.quantity || 0;
    if (item.stock !== -1 && currentQty >= item.stock) {
      toast({ title: 'Stock limitado', description: `Solo hay ${item.stock} unidades disponibles.`, variant: 'destructive' });
      return;
    }

    addItem({
      id: item.variantId,
      variant_id: item.variantId,
      name: item.productName,
      variant_label: `${item.color} - Talla ${item.size}`,
      price: parseFloat(String(item.price)) || 0,
    });
    setSearchQuery('');
    searchRef.current?.focus();
  }, [addItem, items]);

  // Handle barcode scan (Enter key in search)
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery) {
      const barcodeMatch = displayItems.find(
        (item) => item.barcode === searchQuery || item.sku === searchQuery,
      );
      if (barcodeMatch) {
        handleAddToCart(barcodeMatch);
      } else if (filteredItems.length === 1) {
        handleAddToCart(filteredItems[0]);
      }
    }
  };

  // Process payment
  const handlePayment = async (method: 'cash' | 'card') => {
    if (items.length === 0 || !session) return;
    setProcessingPayment(true);

    const cartTotal = total();
    const saleData = {
      id: crypto.randomUUID(),
      pos_session_id: session.id,
      branch_id: session.branch_id,
      employee_id: user?.sub || user?.id,
      customer_id: selectedCustomer?.id || null,
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
      // Refresh products to update stock
      fetchProducts();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'No se pudo registrar la venta.';
      if (msg.includes('Stock insuficiente')) {
        toast({ title: 'Stock insuficiente', description: msg, variant: 'destructive' });
        fetchProducts(); // Refresh stock
      } else {
        // Save offline
        try {
          const offlineSale: OfflineSale = {
            ...saleData,
            created_at: new Date().toISOString(),
            synced: false,
          };
          await offlineDB.sales.add(offlineSale);
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
            description: 'Se sincronizará automáticamente cuando haya conexión.',
          });
        } catch {
          toast({ title: 'Error', description: msg, variant: 'destructive' });
        }
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  // Close session
  const handleCloseSession = async () => {
    try {
      await closeSession(parseFloat(closingAmount) || 0);
      toast({ title: 'Caja cerrada', description: 'Tu turno ha finalizado.' });
      router.push('/dashboard');
    } catch {
      toast({ title: 'Error', description: 'No se pudo cerrar la caja.', variant: 'destructive' });
    }
  };

  // Route protection render gate
  if (!mounted || !isAuthenticated || userType === 'super-admin') {
    return null;
  }

  const needsSession = !sessionLoading && !session;

  return (
    <div className="flex h-screen bg-background">
      {/* Open Session Dialog */}
      <OpenSessionDialog
        open={needsSession}
        onSessionOpened={() => loadActiveSession()}
        onOpenSession={openSession}
      />

      {/* Sale Confirmation Dialog */}
      <SaleConfirmation
        open={!!confirmSale && !showReceipt}
        onClose={() => {
          setConfirmSale(null);
          searchRef.current?.focus();
        }}
        onPrintReceipt={() => setShowReceipt(true)}
        sale={confirmSale}
      />

      {/* Receipt Dialog */}
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

      {/* Close Session Dialog */}
      {showCloseDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-background rounded-lg p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold">Cerrar Caja</h3>
            <p className="text-sm text-muted-foreground">Ingresa el monto de cierre para finalizar tu turno.</p>
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

      {/* Product Grid */}
      <div className="flex-1 flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Escanear código de barras o buscar producto..."
              className="pl-10 h-12 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
          </div>
          <Badge variant={isOnline ? 'secondary' : 'destructive'} className="gap-1 px-3 py-1.5">
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
          {session && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowCloseDialog(true)}>
              <LogOut className="h-4 w-4" />
              Cerrar Caja
            </Button>
          )}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-auto">
          {sessionLoading || loadingProducts ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-40" />
                {searchQuery ? (
                  <>
                    <p className="text-lg">Sin resultados para &ldquo;{searchQuery}&rdquo;</p>
                    <p className="text-sm">Intenta con otro término de búsqueda</p>
                  </>
                ) : displayItems.length === 0 ? (
                  <>
                    <p className="text-lg">No hay productos registrados</p>
                    <p className="text-sm">Agrega productos desde el panel de inventario</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg">Escanea un código de barras</p>
                    <p className="text-sm">o busca un producto para comenzar</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredItems.map((item) => {
                const outOfStock = item.stock !== -1 && item.stock <= 0;
                const lowStock = item.stock !== -1 && item.stock > 0 && item.stock <= 3;
                return (
                  <button
                    key={item.variantId}
                    onClick={() => handleAddToCart(item)}
                    disabled={outOfStock}
                    className={`text-left rounded-lg border bg-card p-3 transition-all focus:outline-none focus:ring-2 focus:ring-ring ${
                      outOfStock
                        ? 'opacity-50 cursor-not-allowed border-destructive/30'
                        : 'hover:border-primary hover:shadow-md active:scale-[0.98]'
                    }`}
                  >
                    <p className="font-medium text-sm truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.color} · Talla {item.size}
                    </p>
                    {item.brand && (
                      <p className="text-xs text-muted-foreground truncate">{item.brand}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-lg font-bold">${Number(item.price).toFixed(2)}</p>
                      {item.stock !== -1 && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          outOfStock
                            ? 'bg-destructive/10 text-destructive'
                            : lowStock
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {outOfStock ? 'Agotado' : `${item.stock} disp.`}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 border-l bg-card flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Carrito de Venta</h3>
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'producto' : 'productos'}
          </p>
        </div>

        {/* Customer Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2 pl-10">
                <div>
                  <p className="text-sm font-medium">{selectedCustomer.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedCustomer.phone || selectedCustomer.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerQuery('');
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <Input
                  ref={customerSearchRef}
                  placeholder="Buscar cliente (nombre, email, tel)..."
                  className="pl-10 h-9 text-sm"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                />
                {showCustomerDropdown && customerResults.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-40 overflow-auto">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm transition-colors"
                        onMouseDown={() => {
                          setSelectedCustomer(c);
                          setCustomerQuery('');
                          setShowCustomerDropdown(false);
                        }}
                      >
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[c.phone, c.email].filter(Boolean).join(' · ')}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {searchingCustomers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">El carrito está vacío</p>
            </div>
          ) : (
            items.map((item) => {
              const displayInfo = displayItems.find((d) => d.variantId === item.id);
              const stockExceeded = displayInfo && displayInfo.stock !== -1 && item.quantity >= displayInfo.stock;
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                    <p className="text-sm font-semibold">${Number(item.price).toFixed(2)}</p>
                    {stockExceeded && (
                      <p className="text-xs text-yellow-600 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        Máx. stock alcanzado
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={!!stockExceeded}
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t p-4 space-y-3">
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>${total().toFixed(2)}</span>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="gap-2 h-12"
              disabled={items.length === 0 || processingPayment}
              onClick={() => handlePayment('cash')}
            >
              <Banknote className="h-5 w-5" />
              Efectivo
            </Button>
            <Button
              className="gap-2 h-12"
              disabled={items.length === 0 || processingPayment}
              onClick={() => handlePayment('card')}
            >
              <CreditCard className="h-5 w-5" />
              Tarjeta
            </Button>
          </div>
          {items.length > 0 && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={clearCart}
              disabled={processingPayment}
            >
              Vaciar carrito
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
