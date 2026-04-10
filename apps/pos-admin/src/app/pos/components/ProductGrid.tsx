'use client';

import { ShoppingBag } from 'lucide-react';

export interface VariantCard {
  variant_id: string;
  product_id: string;
  product_name: string;
  color: string;
  image_url?: string | null;
  price: number;
  total_stock: number;
}

interface ProductGridProps {
  variants: VariantCard[];
  onSelect: (variant: VariantCard) => void;
}

export function ProductGrid({ variants, onSelect }: ProductGridProps) {
  if (variants.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg text-slate-400">Sin productos en esta coleccion</p>
          <p className="text-sm">Asigna productos a la coleccion desde inventario</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {variants.map((v) => {
        const outOfStock = v.total_stock === 0;
        return (
          <button
            key={`${v.product_id}-${v.color}`}
            type="button"
            onClick={() => onSelect(v)}
            className={`group text-left rounded-2xl bg-slate-900/80 overflow-hidden transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
              outOfStock
                ? 'opacity-50 ring-1 ring-orange-500/30'
                : 'hover:shadow-xl hover:shadow-slate-900/50 hover:scale-[1.02] active:scale-[0.97]'
            }`}
          >
            {/* Image */}
            <div className="aspect-[4/3] bg-slate-800/50 relative overflow-hidden">
              {v.image_url ? (
                <img
                  src={v.image_url}
                  alt={`${v.product_name} ${v.color}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="h-8 w-8 text-slate-700" />
                </div>
              )}
              {outOfStock && (
                <div className="absolute top-2 right-2 bg-orange-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                  Sin stock
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <p className="font-medium text-sm text-slate-200 truncate">{v.product_name}</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{v.color}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-base font-bold text-white">
                  ${v.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                {!outOfStock && (
                  <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full font-medium">
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
