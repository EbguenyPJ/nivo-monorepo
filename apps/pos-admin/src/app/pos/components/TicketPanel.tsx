'use client';

import { useRef, useEffect, useState } from 'react';
import { Button, Input, Badge } from '@nivo/ui';
import {
  Plus, Minus, Trash2, User, ShoppingBag, Monitor, RefreshCw,
  LogOut, Wifi, WifiOff, AlertTriangle,
} from 'lucide-react';
import { useCartStore, type CartItem } from '@/store/cartStore';
import { PriceSelector } from './PriceSelector';
import { RetroTotal } from './RetroTotal';

interface CustomerResult {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface TicketPanelProps {
  cashRegisterName?: string;
  employeeName?: string;
  isOnline: boolean;
  onCobrar: () => void;
  onSwitchCashier: () => void;
  onCloseSession: () => void;
  selectedCustomer: CustomerResult | null;
  onCustomerSelect: (c: CustomerResult | null) => void;
  customerQuery: string;
  onCustomerQueryChange: (q: string) => void;
  customerResults: CustomerResult[];
  showCustomerDropdown: boolean;
  onShowCustomerDropdown: (show: boolean) => void;
  searchingCustomers: boolean;
  processingPayment: boolean;
}

export function TicketPanel({
  cashRegisterName,
  employeeName,
  isOnline,
  onCobrar,
  onSwitchCashier,
  onCloseSession,
  selectedCustomer,
  onCustomerSelect,
  customerQuery,
  onCustomerQueryChange,
  customerResults,
  showCustomerDropdown,
  onShowCustomerDropdown,
  searchingCustomers,
  processingPayment,
}: TicketPanelProps) {
  const { items, removeItem, updateQuantity, updateItemPrice, clearCart, total } = useCartStore();
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when items change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [items.length]);

  const cartTotal = total();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {cashRegisterName && (
            <Badge variant="outline" className="text-xs px-2 py-1 gap-1 flex-shrink-0">
              <Monitor className="h-3 w-3" />
              {cashRegisterName}
            </Badge>
          )}
          {employeeName && (
            <Badge variant="secondary" className="text-xs px-2 py-1 gap-1 flex-shrink-0">
              <User className="h-3 w-3" />
              {employeeName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant={isOnline ? 'secondary' : 'destructive'} className="gap-1 px-2 py-1 text-xs">
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onSwitchCashier}
            title="Cambiar cajero"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onCloseSession}
            title="Cerrar caja"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Customer Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-1.5 pl-8">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{selectedCustomer.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {selectedCustomer.phone || selectedCustomer.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => {
                  onCustomerSelect(null);
                  onCustomerQueryChange('');
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar cliente..."
                className="pl-8 h-8 text-xs"
                value={customerQuery}
                onChange={(e) => onCustomerQueryChange(e.target.value)}
                onFocus={() => customerResults.length > 0 && onShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => onShowCustomerDropdown(false), 200)}
              />
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-32 overflow-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-1.5 hover:bg-accent text-xs transition-colors"
                      onMouseDown={() => {
                        onCustomerSelect(c);
                        onCustomerQueryChange('');
                        onShowCustomerDropdown(false);
                      }}
                    >
                      <p className="font-medium">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[c.phone, c.email].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {searchingCustomers && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Item List */}
      <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingBag className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">Ticket vacio</p>
          </div>
        ) : (
          items.map((item) => (
            <TicketItem
              key={item.id}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
              onUpdatePrice={updateItemPrice}
            />
          ))
        )}
      </div>

      {/* Total + Cobrar */}
      <div className="border-t p-3 space-y-3">
        <RetroTotal subtotal={cartTotal} tax={0} total={cartTotal} />

        <Button
          className="w-full h-12 text-base font-bold gap-2"
          disabled={items.length === 0 || processingPayment}
          onClick={onCobrar}
        >
          COBRAR (F12)
        </Button>

        {items.length > 0 && (
          <Button
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={clearCart}
            disabled={processingPayment}
          >
            Vaciar ticket
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Individual ticket item ──────────────────────────────────────

function TicketItem({
  item,
  onUpdateQuantity,
  onRemove,
  onUpdatePrice,
}: {
  item: CartItem;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onUpdatePrice: (id: string, price: number, priceListId: string, priceListName: string) => void;
}) {
  const stockWarning = item.stock >= 0 && item.quantity >= item.stock;
  const lineTotal = item.price * item.quantity;

  return (
    <div className={`rounded-lg border p-2.5 transition-colors ${
      stockWarning ? 'border-orange-500/40' : ''
    }`}>
      <div className="flex items-start gap-2">
        {/* Mini image */}
        <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-muted-foreground/30" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{item.variant_label}</p>

          {/* Quantity controls + price */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              >
                <Minus className="h-2.5 w-2.5" />
              </Button>
              <span className="w-6 text-center text-xs font-medium tabular-nums">
                {item.quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              >
                <Plus className="h-2.5 w-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={() => onRemove(item.id)}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold tabular-nums">
                ${lineTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
              <PriceSelector
                variantId={item.variant_id}
                currentPrice={item.price}
                currentPriceListId={item.price_list_id}
                onSelect={(price, plId, plName) => onUpdatePrice(item.id, price, plId, plName)}
              />
            </div>
          </div>

          {stockWarning && (
            <p className="text-[10px] text-orange-500 flex items-center gap-0.5 mt-1">
              <AlertTriangle className="h-2.5 w-2.5" />
              Stock limitado ({item.stock})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
