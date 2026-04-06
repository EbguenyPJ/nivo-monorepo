'use client';

import { useEffect } from 'react';
import { X, ShoppingBag } from 'lucide-react';

export interface SizeOption {
  variant_id: string;
  size_mex: number;
  stock: number;
  sku: string;
  barcode: string | null;
}

interface SizePickerModalProps {
  open: boolean;
  productName: string;
  color: string;
  image_url?: string | null;
  price: number;
  sizes: SizeOption[];
  onSelect: (size: SizeOption) => void;
  onClose: () => void;
}

export function SizePickerModal({
  open,
  productName,
  color,
  image_url,
  price,
  sizes,
  onSelect,
  onClose,
}: SizePickerModalProps) {
  // Keyboard: Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  // Sort sizes numerically
  const sorted = [...sizes].sort((a, b) => a.size_mex - b.size_mex);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
          {/* Header with image */}
          <div className="flex items-center gap-4 p-4 border-b">
            <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
              {image_url ? (
                <img src={image_url} alt={productName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{productName}</h3>
              <p className="text-sm text-muted-foreground">{color}</p>
              <p className="text-lg font-bold mt-0.5">
                ${price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Size grid */}
          <div className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
              Selecciona talla
            </p>
            <div className="grid grid-cols-4 gap-2">
              {sorted.map((s) => {
                const hasStock = s.stock > 0;
                return (
                  <button
                    key={s.variant_id}
                    type="button"
                    onClick={() => onSelect(s)}
                    className={`relative h-14 rounded-lg border text-center transition-all focus:outline-none focus:ring-2 focus:ring-ring ${
                      hasStock
                        ? 'bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary active:scale-95'
                        : 'bg-muted/30 border-orange-500/40 text-muted-foreground'
                    }`}
                  >
                    <span className="text-base font-semibold">{s.size_mex}</span>
                    <span className={`block text-[10px] leading-tight ${
                      hasStock ? 'text-muted-foreground' : 'text-orange-500'
                    }`}>
                      {hasStock ? `${s.stock} disp.` : 'Sin stock'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
