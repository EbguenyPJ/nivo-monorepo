'use client';

import { useEffect, useState, useMemo } from 'react';
import { X, ShoppingBag, Plus, Check } from 'lucide-react';
import { Button } from '@nivo/ui';

// ─── Color name → CSS color mapping ──────────────────────────────
const COLOR_MAP: Record<string, string> = {
  negro: '#1a1a1a', black: '#1a1a1a',
  blanco: '#f5f5f5', white: '#f5f5f5',
  rojo: '#dc2626', red: '#dc2626',
  azul: '#2563eb', blue: '#2563eb',
  verde: '#16a34a', green: '#16a34a',
  amarillo: '#eab308', yellow: '#eab308',
  naranja: '#ea580c', orange: '#ea580c',
  rosa: '#ec4899', pink: '#ec4899',
  morado: '#9333ea', purple: '#9333ea',
  gris: '#6b7280', gray: '#6b7280', grey: '#6b7280',
  cafe: '#92400e', marron: '#92400e', brown: '#92400e',
  beige: '#d4b896', crema: '#f5f0e1',
  turquesa: '#06b6d4', cyan: '#06b6d4',
  coral: '#f97316',
  vino: '#7f1d1d', burgundy: '#7f1d1d',
  dorado: '#ca8a04', gold: '#ca8a04',
  plateado: '#94a3b8', silver: '#94a3b8',
  olivo: '#65a30d', olive: '#65a30d',
  celeste: '#38bdf8',
};

function getColorCSS(colorName: string): string {
  const key = colorName.toLowerCase().trim();
  return COLOR_MAP[key] || '#6b7280';
}

// ─── Types ───────────────────────────────────────────────────────

interface VariantData {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price_override: number | null;
  barcode: string | null;
  images: string[];
  stock_available: number;
}

interface ProductData {
  id: string;
  name: string;
  brand?: { id: string; name: string } | null;
  variants: VariantData[];
}

export interface QuickViewSelection {
  variant_id: string;
  product_id: string;
  product_name: string;
  color: string;
  size: number;
  sku: string;
  price: number;
  stock: number;
  image_url?: string;
}

interface QuickViewModalProps {
  open: boolean;
  product: ProductData | null;
  variantPrices: Record<string, number>;
  preselectedColor: string;
  onAddToCart: (selection: QuickViewSelection) => void;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────

export function QuickViewModal({
  open,
  product,
  variantPrices,
  preselectedColor,
  onAddToCart,
  onClose,
}: QuickViewModalProps) {
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [addedAnimation, setAddedAnimation] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (open && product) {
      setSelectedColor(preselectedColor || '');
      setSelectedSize(null);
      setAddedAnimation(false);
    }
  }, [open, product, preselectedColor]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Derive available colors
  const colors = useMemo(() => {
    if (!product) return [];
    const colorSet = new Map<string, { name: string; image?: string }>();
    for (const v of product.variants) {
      const c = v.attributes?.['Color'] || '';
      if (c && !colorSet.has(c)) {
        colorSet.set(c, { name: c, image: v.images?.[0] });
      }
    }
    return Array.from(colorSet.values());
  }, [product]);

  // Variants for selected color
  const colorVariants = useMemo(() => {
    if (!product || !selectedColor) return [];
    return product.variants
      .filter((v) => (v.attributes?.['Color'] || '') === selectedColor)
      .sort((a, b) => {
        const sA = parseFloat(a.attributes?.['Talla MX'] || '0');
        const sB = parseFloat(b.attributes?.['Talla MX'] || '0');
        return sA - sB;
      });
  }, [product, selectedColor]);

  // Gallery images for selected color
  const galleryImages = useMemo(() => {
    const imgs: string[] = [];
    for (const v of colorVariants) {
      for (const img of v.images || []) {
        if (!imgs.includes(img)) imgs.push(img);
      }
    }
    return imgs;
  }, [colorVariants]);

  const [mainImage, setMainImage] = useState<string | null>(null);
  useEffect(() => {
    setMainImage(galleryImages[0] || null);
  }, [galleryImages]);

  // Selected variant data
  const selectedVariant = selectedSize
    ? colorVariants.find((v) => v.id === selectedSize)
    : null;

  const selectedPrice = selectedVariant
    ? variantPrices[selectedVariant.id] ?? parseFloat(String(selectedVariant.price_override)) ?? 0
    : 0;

  if (!open || !product) return null;

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    const size = parseFloat(selectedVariant.attributes?.['Talla MX'] || '0');
    const image = selectedVariant.images?.[0] || galleryImages[0];

    onAddToCart({
      variant_id: selectedVariant.id,
      product_id: product.id,
      product_name: product.name,
      color: selectedColor,
      size,
      sku: selectedVariant.sku,
      price: selectedPrice,
      stock: selectedVariant.stock_available ?? 0,
      image_url: image,
    });

    // Brief animation then close
    setAddedAnimation(true);
    setTimeout(() => {
      setAddedAnimation(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl max-h-[85vh] rounded-2xl bg-slate-900/95 border border-slate-700/40 shadow-2xl shadow-black/50 backdrop-blur-xl overflow-hidden flex flex-col">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-all backdrop-blur-sm"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ═══ LEFT — Gallery ═══ */}
          <div className="w-[45%] flex flex-col p-5 border-r border-slate-800/60">
            {/* Main image */}
            <div className="flex-1 rounded-xl bg-slate-800/50 overflow-hidden flex items-center justify-center mb-3">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-600">
                  <ShoppingBag className="h-16 w-16" />
                  <span className="text-xs">Sin imagen</span>
                </div>
              )}
            </div>

            {/* Thumbnail carousel */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMainImage(img)}
                    className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                      mainImage === img
                        ? 'border-cyan-500 shadow-sm shadow-cyan-500/30'
                        : 'border-slate-700/40 hover:border-slate-500'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ═══ RIGHT — Selectors ═══ */}
          <div className="flex-1 flex flex-col p-5 overflow-y-auto">
            {/* Header */}
            <div className="mb-5">
              <h2 className="text-xl font-bold text-white">{product.name}</h2>
              {product.brand && (
                <p className="text-sm text-slate-400 mt-0.5">{product.brand.name}</p>
              )}
              {selectedVariant && (
                <p className="text-[10px] text-slate-500 mt-1 font-mono">{selectedVariant.sku}</p>
              )}
            </div>

            {/* Color selector */}
            {colors.length > 1 && (
              <div className="mb-5">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">
                  Color: <span className="text-slate-300">{selectedColor}</span>
                </p>
                <div className="flex gap-2.5 flex-wrap">
                  {colors.map((c) => {
                    const isActive = c.name === selectedColor;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                          setSelectedColor(c.name);
                          setSelectedSize(null);
                        }}
                        className={`relative w-9 h-9 rounded-full transition-all duration-200 ${
                          isActive
                            ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-slate-900 scale-110'
                            : 'hover:scale-110 hover:ring-1 hover:ring-slate-500 hover:ring-offset-1 hover:ring-offset-slate-900'
                        }`}
                        title={c.name}
                      >
                        <div
                          className="w-full h-full rounded-full border border-slate-600/50"
                          style={{ backgroundColor: getColorCSS(c.name) }}
                        />
                        {isActive && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white drop-shadow-lg" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size grid */}
            <div className="mb-5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">
                Talla
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {colorVariants.map((v) => {
                  const size = parseFloat(v.attributes?.['Talla MX'] || '0');
                  const stock = v.stock_available ?? 0;
                  const price = variantPrices[v.id] ?? parseFloat(String(v.price_override)) ?? 0;
                  const isSelected = selectedSize === v.id;
                  const lowStock = stock > 0 && stock <= 3;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedSize(v.id)}
                      className={`relative rounded-xl p-3 text-left transition-all duration-200 border ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-500/60 shadow-sm shadow-cyan-500/10'
                          : stock === 0
                          ? 'bg-slate-800/30 border-slate-700/20 opacity-40'
                          : 'bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-600/50'
                      }`}
                    >
                      {/* Size */}
                      <p className={`text-lg font-bold tabular-nums ${
                        isSelected ? 'text-cyan-400' : 'text-white'
                      }`}>
                        {size}
                      </p>

                      {/* Stock badge */}
                      <span className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        stock === 0
                          ? 'bg-red-500/20 text-red-400'
                          : lowStock
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {stock === 0 ? 'Agotado' : `${stock} disp.`}
                      </span>

                      {/* Price */}
                      <p className="text-xs text-slate-400 font-mono tabular-nums mt-1">
                        ${price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Add to cart button */}
            <div className="pt-3 border-t border-slate-800/60">
              {selectedVariant && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-400">Precio:</span>
                  <span className="text-2xl font-bold text-white font-mono tabular-nums">
                    ${selectedPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <Button
                className={`w-full h-12 text-base font-bold gap-2 transition-all duration-300 ${
                  addedAnimation
                    ? 'bg-emerald-600 hover:bg-emerald-600'
                    : ''
                }`}
                disabled={!selectedVariant}
                onClick={handleAddToCart}
              >
                {addedAnimation ? (
                  <>
                    <Check className="h-5 w-5" />
                    Agregado
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Agregar al Ticket
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
