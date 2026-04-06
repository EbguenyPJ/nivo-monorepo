'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';

interface PriceOption {
  price_list_id: string;
  price_list_name: string;
  price: number;
  is_default: boolean;
}

interface PriceSelectorProps {
  variantId: string;
  currentPrice: number;
  currentPriceListId?: string;
  onSelect: (price: number, priceListId: string, priceListName: string) => void;
}

export function PriceSelector({ variantId, currentPrice, currentPriceListId, onSelect }: PriceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<PriceOption[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { selectedBranchId } = useBranchStore();

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (prices.length > 0) return; // Already loaded

    setLoading(true);
    try {
      const res = await apiClient.get(
        `/pos/variant-prices-all?variant_id=${variantId}&branch_id=${selectedBranchId}`,
      );
      setPrices(res.data.prices || []);
    } catch {
      setPrices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (opt: PriceOption) => {
    onSelect(opt.price, opt.price_list_id, opt.price_list_name);
    setOpen(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
        title="Cambiar lista de precios"
      >
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 w-56 bg-popover border border-border rounded-lg shadow-xl py-1">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : prices.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Sin listas de precios
            </p>
          ) : (
            prices.map((opt) => {
              const isSelected = currentPriceListId
                ? opt.price_list_id === currentPriceListId
                : opt.is_default;
              return (
                <button
                  key={opt.price_list_id}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between ${
                    isSelected ? 'bg-accent/50 font-medium' : ''
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                    {opt.price_list_name}
                  </span>
                  <span className="tabular-nums font-mono text-xs">
                    ${opt.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
