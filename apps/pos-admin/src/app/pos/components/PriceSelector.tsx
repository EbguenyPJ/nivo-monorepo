'use client';

import { useState, useEffect, useRef } from 'react';
import { MoreVertical, Loader2 } from 'lucide-react';
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
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (prices.length > 0) return;

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
        className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700/50 transition-all"
        title="Cambiar lista de precios"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 w-56 bg-slate-800/95 border border-slate-700/50 rounded-xl shadow-2xl shadow-black/40 py-1.5 backdrop-blur-xl">
          <p className="px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
            Lista de precios
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            </div>
          ) : prices.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-3">Sin listas</p>
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
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'text-slate-300 hover:bg-slate-700/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-cyan-400' : 'bg-slate-600'
                    }`} />
                    {opt.price_list_name}
                  </span>
                  <span className="tabular-nums font-mono text-xs text-slate-400">
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
