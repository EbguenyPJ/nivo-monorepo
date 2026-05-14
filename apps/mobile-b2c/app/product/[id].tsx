import { useState, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  FlatList, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { useProductDetail, type VariantWithStock } from '@/lib/queries';
import { useCartStore } from '@/lib/cart-store';

const { width: SCREEN_W } = Dimensions.get('window');

const COLOR_HEX_MAP: Record<string, string> = {
  negro: '#1a1a1a', blanco: '#f5f5f5', rojo: '#dc2626', azul: '#2563eb',
  'azul marino': '#1e3a5f', café: '#7c4a1e', beige: '#d4b896', gris: '#6b7280',
  rosa: '#ec4899', verde: '#16a34a', amarillo: '#eab308', naranja: '#ea580c',
  morado: '#9333ea', vino: '#722f37', camel: '#c19a6b', plata: '#c0c0c0',
  oro: '#d4af37', nude: '#e8c4a2', coral: '#ff7f50', turquesa: '#40e0d0',
  black: '#1a1a1a', white: '#f5f5f5', red: '#dc2626', blue: '#2563eb',
  brown: '#7c4a1e', gray: '#6b7280', pink: '#ec4899', green: '#16a34a',
};

function getColorHex(name: string): string | null {
  const lower = name.toLowerCase().trim();
  return COLOR_HEX_MAP[lower] ?? null;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isLoading } = useProductDetail(id);
  const addItem = useCartStore((s) => s.addItem);
  const imageListRef = useRef<FlatList>(null);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const colors = useMemo(() => {
    if (!product) return [];
    const map = new Map<string, { name: string; hex: string | null; hasStock: boolean }>();
    product.variants.forEach((v) => {
      const color = v.attributes['Color'] ?? v.attributes['color'];
      if (!color) return;
      const existing = map.get(color);
      map.set(color, {
        name: color,
        hex: getColorHex(color),
        hasStock: (existing?.hasStock || false) || v.total_stock > 0,
      });
    });
    return Array.from(map.values());
  }, [product]);

  const sizes = useMemo(() => {
    if (!product || !selectedColor) return [];
    const map = new Map<string, { size: string; inStock: boolean; stock: number }>();
    product.variants
      .filter((v) => (v.attributes['Color'] ?? v.attributes['color']) === selectedColor)
      .forEach((v) => {
        const size = v.attributes['Talla MX'] || v.attributes['Talla'] || v.attributes['talla'];
        if (!size) return;
        map.set(size, { size, inStock: v.total_stock > 0, stock: v.total_stock });
      });
    return Array.from(map.values()).sort((a, b) => parseFloat(a.size) - parseFloat(b.size));
  }, [product, selectedColor]);

  const selectedVariant = useMemo<VariantWithStock | null>(() => {
    if (!product || !selectedColor || !selectedSize) return null;
    return product.variants.find((v) => {
      const vColor = v.attributes['Color'] ?? v.attributes['color'];
      const vSize = v.attributes['Talla MX'] || v.attributes['Talla'] || v.attributes['talla'];
      return vColor === selectedColor && vSize === selectedSize;
    }) ?? null;
  }, [product, selectedColor, selectedSize]);

  if (isLoading || !product) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const displayPrice = selectedVariant?.price || product.base_price;
  const images = selectedVariant?.images?.length
    ? selectedVariant.images
    : product.images?.length
      ? product.images
      : [];

  function handleAddToCart() {
    if (!selectedVariant || selectedVariant.total_stock <= 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem({
      variant_id: selectedVariant.id,
      product_id: product!.id,
      product_name: product!.name,
      image_url: images[0] ?? null,
      attributes: selectedVariant.attributes,
      sku: selectedVariant.sku,
      unit_price: selectedVariant.price,
      stock_available: selectedVariant.total_stock,
    });
    router.push('/cart');
  }

  const canAdd = selectedVariant && selectedVariant.total_stock > 0;
  const buttonLabel = !selectedColor
    ? 'Selecciona un color'
    : !selectedSize
      ? 'Selecciona una talla'
      : selectedVariant && selectedVariant.total_stock <= 0
        ? 'Agotado'
        : `Agregar al carrito · $${Number(displayPrice).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Image carousel */}
        {images.length > 0 ? (
          <View>
            <FlatList
              ref={imageListRef}
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              onMomentumScrollEnd={(e) => {
                setActiveImageIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
              }}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={{ width: SCREEN_W, height: SCREEN_W }} contentFit="cover" />
              )}
            />
            {images.length > 1 && (
              <View className="flex-row justify-center mt-3 gap-1.5">
                {images.map((_, i) => (
                  <View
                    key={i}
                    className={`rounded-full ${i === activeImageIdx ? 'w-6 h-2 bg-brand-500' : 'w-2 h-2 bg-slate-600'}`}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View className="w-full bg-slate-800 items-center justify-center" style={{ height: SCREEN_W }}>
            <Ionicons name="footsteps-outline" size={80} color="#475569" />
          </View>
        )}

        <View className="px-5 pt-5">
          {/* Brand + name */}
          {product.brand_name && (
            <Text className="text-brand-500 text-sm font-semibold uppercase tracking-wider">
              {product.brand_name}
            </Text>
          )}
          <Text className="text-white text-2xl font-bold mt-1">{product.name}</Text>

          {/* Price */}
          <Animated.View entering={FadeIn.duration(300)} key={displayPrice}>
            <Text className="text-white text-3xl font-bold mt-3">
              ${Number(displayPrice).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </Animated.View>

          {product.description && (
            <Text className="text-slate-400 text-sm mt-3 leading-5">{product.description}</Text>
          )}

          {/* Color selector — hex swatches */}
          {colors.length > 0 && (
            <View className="mt-7">
              <Text className="text-slate-300 font-semibold mb-3">
                Color{selectedColor ? `: ${selectedColor}` : ''}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {colors.map((c) => {
                  const isSelected = selectedColor === c.name;
                  const hex = c.hex;
                  return (
                    <TouchableOpacity
                      key={c.name}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedColor(c.name);
                        setSelectedSize(null);
                        setActiveImageIdx(0);
                      }}
                      className={`items-center justify-center rounded-full ${isSelected ? 'border-2 border-brand-500 p-0.5' : 'p-0.5'}`}
                    >
                      {hex ? (
                        <View
                          className="w-10 h-10 rounded-full border border-slate-600"
                          style={{ backgroundColor: hex }}
                        />
                      ) : (
                        <View className={`px-4 py-2 rounded-full border ${isSelected ? 'border-brand-500 bg-brand-500/20' : 'border-slate-600 bg-slate-800'}`}>
                          <Text className={isSelected ? 'text-brand-100 text-sm' : 'text-slate-300 text-sm'}>
                            {c.name}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Size grid */}
          {sizes.length > 0 && (
            <Animated.View entering={FadeIn.duration(200)} className="mt-6">
              <Text className="text-slate-300 font-semibold mb-3">Talla MX</Text>
              <View className="flex-row flex-wrap gap-2">
                {sizes.map(({ size, inStock, stock }) => {
                  const isSelected = selectedSize === size;
                  return (
                    <TouchableOpacity
                      key={size}
                      disabled={!inStock}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedSize(size);
                      }}
                      className={`w-16 h-14 rounded-xl items-center justify-center border ${
                        !inStock
                          ? 'border-slate-700 bg-slate-800/40'
                          : isSelected
                            ? 'border-brand-500 bg-brand-500/20'
                            : 'border-slate-600 bg-slate-800'
                      }`}
                      style={{ opacity: inStock ? 1 : 0.35 }}
                    >
                      <Text
                        className={`text-base font-medium ${
                          !inStock
                            ? 'text-slate-600 line-through'
                            : isSelected
                              ? 'text-brand-100'
                              : 'text-slate-200'
                        }`}
                      >
                        {size}
                      </Text>
                      {inStock && stock <= 3 && (
                        <Text className="text-amber-400 text-[9px]">Últimos {stock}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Stock by branch */}
          {selectedVariant && selectedVariant.stock_by_branch?.length > 0 && (
            <Animated.View entering={SlideInDown.duration(250)} className="mt-5 bg-surface-card rounded-xl p-4">
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Disponibilidad por sucursal
              </Text>
              {selectedVariant.stock_by_branch.map((sb) => (
                <View key={sb.branch_id} className="flex-row justify-between items-center py-1.5">
                  <Text className="text-slate-300 text-sm">{sb.branch_name}</Text>
                  <Text className={`text-sm font-medium ${sb.stock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {sb.stock > 0 ? `${sb.stock} disp.` : 'Agotado'}
                  </Text>
                </View>
              ))}
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* Floating add-to-cart */}
      <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-slate-800 px-5 pt-4 pb-8">
        <TouchableOpacity
          className={`rounded-2xl py-4 items-center flex-row justify-center ${canAdd ? 'bg-brand-500' : 'bg-slate-700'}`}
          disabled={!canAdd}
          onPress={handleAddToCart}
          activeOpacity={0.8}
        >
          {canAdd && <Ionicons name="bag-add-outline" size={20} color="#ffffff" />}
          <Text className={`font-bold text-base ${canAdd ? 'text-white ml-2' : 'text-slate-400'}`}>
            {buttonLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
