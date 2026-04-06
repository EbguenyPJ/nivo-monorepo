'use client';

import { ShoppingBag } from 'lucide-react';

export interface VariantCard {
  variant_id: string;
  product_id: string;
  product_name: string;
  color: string;
  image_url?: string | null;
  price: number;
  total_stock: number; // Sum of all sizes for this color
}

interface ProductGridProps {
  variants: VariantCard[];
  onSelect: (variant: VariantCard) => void;
}

export function ProductGrid({ variants, onSelect }: ProductGridProps) {
  if (variants.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg">Sin productos en esta coleccion</p>
          <p className="text-sm">Asigna productos a la coleccion desde inventario</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {variants.map((v) => {
        const outOfStock = v.total_stock === 0;
        return (
          <button
            key={`${v.product_id}-${v.color}`}
            type="button"
            onClick={() => onSelect(v)}
            className={`text-left rounded-xl border bg-card overflow-hidden transition-all focus:outline-none focus:ring-2 focus:ring-ring ${
              outOfStock
                ? 'opacity-60 border-orange-500/40'
                : 'hover:border-primary hover:shadow-md active:scale-[0.97]'
            }`}
          >
            {/* Image */}
            <div className="aspect-[4/3] bg-muted relative overflow-hidden">
              {v.image_url ? (
                <img
                  src={v.image_url}
                  alt={`${v.product_name} ${v.color}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              {outOfStock && (
                <div className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  Sin stock
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-2.5">
              <p className="font-medium text-sm truncate">{v.product_name}</p>
              <p className="text-xs text-muted-foreground truncate">{v.color}</p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-base font-bold">
                  ${v.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                {!outOfStock && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {v.total_stock} disp.
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
