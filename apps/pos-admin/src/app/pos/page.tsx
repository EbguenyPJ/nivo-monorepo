'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Button, Input, Badge, Separator, Skeleton, toast } from '@nivo/ui';
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote, ArrowLeft,
  Wifi, WifiOff, LogOut, ShoppingBag,
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
}

export default function PosPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closingAmount, setClosingAmount] = useState('');
  const [confirmSale, setConfirmSale] = useState<{
    id: string; total: number; paymentMethod: string; itemCount: number;
  } | null>(null);

  // Stores
  const { items, addItem, removeItem, updateQuantity, clearCart, total } = useCartStore();
  const user = useAuthStore((s) => s.user);
  const { session, loading: sessionLoading, loadActiveSession, openSession, closeSession } = usePosSessionStore();

  // Check session on mount
  useEffect(() => {
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
  }, []);

  // Load products when session is active
  useEffect(() => {
    if (!session) return;
    fetchProducts();
  }, [session]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await apiClient.get('/products');
      const prods: Product[] = response.data;

      // Flatten to display items (one per variant)
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
              price: parseFloat(String(v.price)) || 0, barcode: v.barcode, stock: 0,
            })),
          })),
        );
      } catch {}
    } catch {
      // Try loading from offline cache
      try {
        const cached = await offlineDB.products.toArray();
        const flat: DisplayItem[] = [];
        for (const p of cached) {
          for (const v of p.variants) {
            flat.push({
              productId: p.id, variantId: v.id, productName: p.name,
              brand: p.brand, color: v.color, size: parseFloat(String(v.size_mex)) || 0,
              price: parseFloat(String(v.price)) || 0, sku: v.sku, barcode: v.barcode,
            });
          }
        }
        setDisplayItems(flat);
        toast({ title: 'Modo offline', description: 'Productos cargados desde caché local.' });
      } catch {
        toast({ title: 'Error', description: 'No se pudieron cargar los productos.', variant: 'destructive' });
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
    addItem({
      id: item.variantId,
      variant_id: item.variantId,
      name: item.productName,
      variant_label: `${item.color} - Talla ${item.size}`,
      price: parseFloat(String(item.price)) || 0,
    });
    setSearchQuery('');
    searchRef.current?.focus();
  }, [addItem]);

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

    try {
      const response = await apiClient.post('/pos/transactions', saleData);
      setConfirmSale({
        id: response.data.id,
        total: cartTotal,
        paymentMethod: method,
        itemCount: items.length,
      });
      clearCart();
    } catch {
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
        });
        clearCart();
        toast({
          title: 'Venta guardada offline',
          description: 'Se sincronizará automáticamente cuando haya conexión.',
        });
      } catch {
        toast({ title: 'Error', description: 'No se pudo registrar la venta.', variant: 'destructive' });
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
        open={!!confirmSale}
        onClose={() => {
          setConfirmSale(null);
          searchRef.current?.focus();
        }}
        sale={confirmSale}
      />

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
                <Skeleton key={i} className="h-28 rounded-lg" />
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
              {filteredItems.map((item) => (
                <button
                  key={item.variantId}
                  onClick={() => handleAddToCart(item)}
                  className="text-left rounded-lg border bg-card p-3 hover:border-primary hover:shadow-md transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <p className="font-medium text-sm truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.color} · Talla {item.size}
                  </p>
                  {item.brand && (
                    <p className="text-xs text-muted-foreground truncate">{item.brand}</p>
                  )}
                  <p className="text-lg font-bold mt-1">${Number(item.price).toFixed(2)}</p>
                </button>
              ))}
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

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">El carrito está vacío</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                  <p className="text-sm font-semibold">${Number(item.price).toFixed(2)}</p>
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
            ))
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
