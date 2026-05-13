'use client';

import { useRef, useEffect } from 'react';
import { Button, Input, Badge } from '@nivo/ui';
import {
  Plus, Minus, Trash2, User, ShoppingBag, Monitor, RefreshCw,
  LogOut, Wifi, WifiOff, AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
  ClipboardCheck, MoreHorizontal, Wallet,
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
  onCashIn?: () => void;
  onCashOut?: () => void;
  onAudit?: () => void;
  onExpense?: () => void;
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
  onCashIn,
  onCashOut,
  onAudit,
  onExpense,
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

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [items.length]);

  const cartTotal = total();

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="p-3 border-b border-slate-800/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {cashRegisterName && (
            <Badge variant="outline" className="text-[10px] px-2 py-1 gap-1 flex-shrink-0 border-slate-700 text-slate-400 bg-slate-800/50">
              <Monitor className="h-3 w-3" />
              {cashRegisterName}
            </Badge>
          )}
          {employeeName && (
            <Badge variant="secondary" className="text-[10px] px-2 py-1 gap-1 flex-shrink-0 bg-slate-800 text-slate-300 border-0">
              <User className="h-3 w-3" />
              {employeeName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
            isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {isOnline ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button
            onClick={onSwitchCashier}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
            title="Cambiar cajero"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCloseSession}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all"
            title="Cerrar caja"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Cash Operations Bar */}
      {(onCashIn || onCashOut || onAudit || onExpense) && (
        <div className="px-3 py-1.5 border-b border-slate-800/60 flex items-center gap-1.5">
          <span className="text-[10px] text-slate-600 mr-1">Caja:</span>
          {onCashIn && (
            <button
              onClick={onCashIn}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
              title="Entrada de efectivo"
            >
              <ArrowDownToLine className="h-3 w-3" />
              Entrada
            </button>
          )}
          {onCashOut && (
            <button
              onClick={onCashOut}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
              title="Retiro de valores"
            >
              <ArrowUpFromLine className="h-3 w-3" />
              Retiro
            </button>
          )}
          {onAudit && (
            <button
              onClick={onAudit}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all"
              title="Arqueo de caja (Corte X)"
            >
              <ClipboardCheck className="h-3 w-3" />
              Arqueo
            </button>
          )}
          {onExpense && (
            <button
              onClick={onExpense}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
              title="Registrar gasto de caja"
            >
              <Wallet className="h-3 w-3" />
              Gasto
            </button>
          )}
        </div>
      )}

      {/* Customer Search */}
      <div className="p-3 border-b border-slate-800/60">
        <div className="relative">
          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-cyan-500/5 border border-cyan-500/20 rounded-xl px-3 py-1.5 pl-8">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{selectedCustomer.name}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {selectedCustomer.phone || selectedCustomer.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 text-slate-500 hover:text-red-400"
                onClick={() => { onCustomerSelect(null); onCustomerQueryChange(''); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar cliente..."
                className="pl-8 h-8 text-xs bg-slate-800/50 border-slate-700/50 text-slate-300 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                value={customerQuery}
                onChange={(e) => onCustomerQueryChange(e.target.value)}
                onFocus={() => customerResults.length > 0 && onShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => onShowCustomerDropdown(false), 200)}
              />
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-slate-800/95 border border-slate-700/50 rounded-xl shadow-2xl shadow-black/40 max-h-32 overflow-auto backdrop-blur-xl">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700/50 text-xs transition-colors"
                      onMouseDown={() => {
                        onCustomerSelect(c);
                        onCustomerQueryChange('');
                        onShowCustomerDropdown(false);
                      }}
                    >
                      <p className="font-medium text-slate-200">{c.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {[c.phone, c.email].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {searchingCustomers && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <div className="h-3 w-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Item List */}
      <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
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
      <div className="border-t border-slate-800/60 p-3 space-y-3">
        <RetroTotal subtotal={cartTotal} tax={0} total={cartTotal} />

        <Button
          className="w-full h-12 text-base font-bold gap-2 bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
          disabled={items.length === 0 || processingPayment}
          onClick={onCobrar}
        >
          COBRAR (F12)
        </Button>

        {items.length > 0 && (
          <button
            className="w-full text-center text-[10px] text-slate-600 hover:text-slate-400 py-1 transition-colors"
            onClick={clearCart}
            disabled={processingPayment}
          >
            Vaciar ticket
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Glass Ticket Item ───────────────────────────────────────────

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
    <div className={`rounded-xl bg-slate-800/40 border backdrop-blur-sm p-2.5 transition-all ${
      stockWarning ? 'border-orange-500/30' : 'border-slate-700/20'
    }`}>
      <div className="flex items-start gap-2.5">
        {/* Mini image */}
        <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-slate-700" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
          <p className="text-[10px] text-slate-400 truncate">{item.variant_label}</p>

          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1">
              <button
                className="h-6 w-6 flex items-center justify-center rounded-md bg-slate-700/60 text-slate-300 hover:bg-slate-600 hover:text-white transition-all"
                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className="w-6 text-center text-xs font-semibold text-white tabular-nums">
                {item.quantity}
              </span>
              <button
                className="h-6 w-6 flex items-center justify-center rounded-md bg-slate-700/60 text-slate-300 hover:bg-slate-600 hover:text-white transition-all"
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
              <button
                className="h-6 w-6 flex items-center justify-center rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                onClick={() => onRemove(item.id)}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>

            <div className="flex items-center gap-0.5">
              <span className="text-sm font-semibold text-white tabular-nums">
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
            <p className="text-[10px] text-orange-400 flex items-center gap-0.5 mt-1">
              <AlertTriangle className="h-2.5 w-2.5" />
              Stock limitado ({item.stock})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
