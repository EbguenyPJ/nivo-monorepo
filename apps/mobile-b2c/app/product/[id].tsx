import { useState, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  FlatList, Dimensions, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useProductDetail, type VariantWithStock } from '@/lib/queries';
import { useCartStore } from '@/lib/cart-store';

const { width: SCREEN_W } = Dimensions.get('window');
const THUMB_SIZE = 56;

const COLOR_HEX_MAP: Record<string, string> = {
  // Spanish
  negro: '#1a1a1a', blanco: '#f5f5f5', rojo: '#dc2626', azul: '#2563eb',
  'azul marino': '#1e3a5f', 'azul cielo': '#87ceeb', cafe: '#7c4a1e',
  'cafe oscuro': '#3e1f0d', beige: '#d4b896', gris: '#6b7280',
  'gris oscuro': '#374151', 'gris claro': '#d1d5db',
  rosa: '#ec4899', 'rosa pastel': '#fbcfe8', verde: '#16a34a',
  'verde olivo': '#556b2f', 'verde militar': '#4a5d23', 'verde menta': '#98ff98',
  'verde bosque': '#228b22', 'verde esmeralda': '#50c878',
  amarillo: '#eab308', naranja: '#ea580c', morado: '#9333ea',
  'morado oscuro': '#581c87', lila: '#c084fc', lavanda: '#e6e6fa',
  vino: '#722f37', 'vino tinto': '#722f37', camel: '#c19a6b',
  plata: '#c0c0c0', oro: '#d4af37', dorado: '#d4af37',
  nude: '#e8c4a2', coral: '#ff7f50', turquesa: '#40e0d0',
  salmon: '#fa8072', marfil: '#fffff0', crema: '#fffdd0',
  terracota: '#cc4e3a', arena: '#c2b280', mostaza: '#e1ad01',
  durazno: '#ffcba4', menta: '#98ff98', aqua: '#00ffff',
  cian: '#00bcd4', celeste: '#87ceeb', hueso: '#f5f5dc',
  chocolate: '#7b3f00', cereza: '#de3163', burdeos: '#800020',
  // English
  black: '#1a1a1a', white: '#f5f5f5', red: '#dc2626', blue: '#2563eb',
  navy: '#1e3a5f', brown: '#7c4a1e', gray: '#6b7280', grey: '#6b7280',
  pink: '#ec4899', green: '#16a34a', yellow: '#eab308', orange: '#ea580c',
  purple: '#9333ea', olive: '#556b2f', gold: '#d4af37', silver: '#c0c0c0',
  teal: '#008080', tan: '#d2b48c', cream: '#fffdd0', ivory: '#fffff0',
  maroon: '#800000', burgundy: '#800020', khaki: '#c3b091',
  charcoal: '#36454f', taupe: '#483c32', mint: '#98ff98',
};

function getColorHex(name: string): string | null {
  const lower = name.toLowerCase().trim();
  // Try exact match first
  if (COLOR_HEX_MAP[lower]) return COLOR_HEX_MAP[lower];
  // Try partial match (e.g. "Azul Marino Oscuro" matches "azul marino")
  for (const [key, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return hex;
  }
  return null;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isLoading } = useProductDetail(id);
  const addItem = useCartStore((s) => s.addItem);
  const imageListRef = useRef<FlatList>(null);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Extract unique colors
  const colors = useMemo(() => {
    if (!product) return [];
    const map = new Map<string, { name: string; hex: string | null; hasStock: boolean }>();
    product.variants.forEach((v) => {
      const color = v.attributes['Color'] ?? v.attributes['color'] ?? v.attributes['COLOR'];
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

  // Auto-select first color if only one or none selected
  const effectiveColor = selectedColor ?? (colors.length === 1 ? colors[0].name : null);

  // Extract sizes for selected color (or all if no color attribute)
  const sizes = useMemo(() => {
    if (!product) return [];
    const map = new Map<string, { size: string; inStock: boolean; stock: number }>();
    const hasColorAttr = colors.length > 0;

    product.variants
      .filter((v) => {
        if (!hasColorAttr) return true;
        if (!effectiveColor) return false;
        const vColor = v.attributes['Color'] ?? v.attributes['color'] ?? v.attributes['COLOR'];
        return vColor === effectiveColor;
      })
      .forEach((v) => {
        const size =
          v.attributes['Talla MX'] ?? v.attributes['Talla'] ?? v.attributes['talla'] ??
          v.attributes['Size'] ?? v.attributes['size'] ?? v.attributes['TALLA MX'];
        if (!size) return;
        const existing = map.get(size);
        map.set(size, {
          size,
          inStock: (existing?.inStock || false) || v.total_stock > 0,
          stock: (existing?.stock || 0) + v.total_stock,
        });
      });
    return Array.from(map.values()).sort((a, b) => parseFloat(a.size) - parseFloat(b.size));
  }, [product, effectiveColor, colors.length]);

  // Find the selected variant
  const selectedVariant = useMemo<VariantWithStock | null>(() => {
    if (!product || !selectedSize) return null;
    const hasColorAttr = colors.length > 0;
    return product.variants.find((v) => {
      const vColor = v.attributes['Color'] ?? v.attributes['color'] ?? v.attributes['COLOR'];
      const vSize =
        v.attributes['Talla MX'] ?? v.attributes['Talla'] ?? v.attributes['talla'] ??
        v.attributes['Size'] ?? v.attributes['size'] ?? v.attributes['TALLA MX'];
      if (hasColorAttr && vColor !== effectiveColor) return false;
      return vSize === selectedSize;
    }) ?? null;
  }, [product, effectiveColor, selectedSize, colors.length]);

  if (isLoading || !product) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0f1a' }}>
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
  const buttonLabel = colors.length > 0 && !effectiveColor
    ? 'Selecciona un color'
    : !selectedSize
      ? 'Selecciona una talla'
      : selectedVariant && selectedVariant.total_stock <= 0
        ? 'Agotado'
        : 'Agregar al carrito';

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0f1a' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Hero image */}
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
                <Image
                  source={{ uri: item }}
                  style={{ width: SCREEN_W, height: SCREEN_W * 1.05, backgroundColor: 'rgba(255,255,255,0.03)' }}
                  contentFit="cover"
                />
              )}
            />
            {/* Thumbnail gallery */}
            {images.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 8, paddingHorizontal: 16 }}>
                {images.map((img, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setActiveImageIdx(i);
                      imageListRef.current?.scrollToIndex({ index: i, animated: true });
                    }}
                    style={{
                      width: THUMB_SIZE,
                      height: THUMB_SIZE,
                      borderRadius: 12,
                      overflow: 'hidden',
                      borderWidth: i === activeImageIdx ? 2 : 1,
                      borderColor: i === activeImageIdx ? '#818cf8' : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={{ width: '100%', height: SCREEN_W, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="footsteps-outline" size={80} color="rgba(255,255,255,0.12)" />
          </View>
        )}

        {/* Info Card — glass floating */}
        <View style={{ paddingHorizontal: 20, marginTop: -24 }}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              borderRadius: 24,
              padding: 24,
            }}
          >
            {product.brand_name && (
              <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                {product.brand_name}
              </Text>
            )}
            <Text style={{ color: '#f8fafc', fontSize: 24, fontWeight: '900', marginTop: 4, letterSpacing: -0.5 }}>
              {product.name}
            </Text>

            <Animated.View entering={FadeIn.duration(300)} key={displayPrice}>
              <Text style={{ color: '#f8fafc', fontSize: 28, fontWeight: '900', marginTop: 8 }}>
                ${Number(displayPrice).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </Text>
            </Animated.View>

            {product.description && (
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 12, lineHeight: 21 }}>
                {product.description}
              </Text>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {/* Color selector */}
          {colors.length > 0 && (
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '700', marginBottom: 12 }}>
                Color{effectiveColor ? `: ${effectiveColor}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {colors.map((c) => {
                  const isSelected = effectiveColor === c.name;
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
                      activeOpacity={0.7}
                      style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 22,
                        padding: 3,
                        borderWidth: isSelected ? 2 : 0,
                        borderColor: isSelected ? '#818cf8' : 'transparent',
                      }}
                    >
                      {hex ? (
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: hex,
                            borderWidth: hex === '#f5f5f5' || hex === '#fffff0' || hex === '#fffdd0' ? 2 : 1,
                            borderColor: 'rgba(255,255,255,0.2)',
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                            borderWidth: 1,
                            borderColor: isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          <Text style={{
                            color: isSelected ? '#a5b4fc' : 'rgba(255,255,255,0.6)',
                            fontSize: 13,
                            fontWeight: '500',
                          }}>
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

          {/* Size grid — using Pressable for reliable touch handling */}
          {sizes.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '700', marginBottom: 12 }}>Talla MX</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {sizes.map(({ size, inStock, stock }) => {
                  const isSelected = selectedSize === size;
                  return (
                    <Pressable
                      key={size}
                      disabled={!inStock}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedSize(size);
                      }}
                      style={({ pressed }) => ({
                        width: 64,
                        height: 48,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: !inStock
                          ? 'rgba(255,255,255,0.02)'
                          : isSelected
                            ? 'rgba(99,102,241,0.25)'
                            : pressed
                              ? 'rgba(255,255,255,0.12)'
                              : 'rgba(255,255,255,0.06)',
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: !inStock
                          ? 'rgba(255,255,255,0.05)'
                          : isSelected
                            ? '#818cf8'
                            : 'rgba(255,255,255,0.1)',
                        opacity: inStock ? 1 : 0.35,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: !inStock
                            ? 'rgba(255,255,255,0.3)'
                            : isSelected
                              ? '#a5b4fc'
                              : 'rgba(255,255,255,0.7)',
                          textDecorationLine: inStock ? 'none' : 'line-through',
                        }}
                      >
                        {size}
                      </Text>
                      {inStock && stock <= 3 && (
                        <Text style={{ color: '#fbbf24', fontSize: 9, fontWeight: '600' }}>
                          Ultimos {stock}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Stock by branch */}
          {selectedVariant && selectedVariant.stock_by_branch?.length > 0 && (
            <Animated.View
              entering={SlideInDown.duration(250)}
              style={{
                marginTop: 20,
                padding: 20,
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                Disponibilidad por sucursal
              </Text>
              {selectedVariant.stock_by_branch.map((sb) => (
                <View key={sb.branch_id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{sb.branch_name}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: sb.stock > 0 ? '#34d399' : '#f87171' }}>
                    {sb.stock > 0 ? `${sb.stock} disp.` : 'Agotado'}
                  </Text>
                </View>
              ))}
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* Floating add-to-cart */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 32,
          backgroundColor: 'rgba(12, 15, 26, 0.92)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {canAdd && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Total</Text>
            <Text style={{ color: '#f8fafc', fontSize: 18, fontWeight: '800' }}>
              ${Number(displayPrice).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        )}
        <TouchableOpacity
          disabled={!canAdd}
          onPress={handleAddToCart}
          activeOpacity={0.8}
          style={{
            height: 56,
            borderRadius: 16,
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {canAdd ? (
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                position: 'absolute',
                left: 0, right: 0, top: 0, bottom: 0,
                borderRadius: 16,
              }}
            />
          ) : (
            <View
              style={{
                position: 'absolute',
                left: 0, right: 0, top: 0, bottom: 0,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
            />
          )}
          {canAdd && <Ionicons name="bag-add-outline" size={20} color="#ffffff" />}
          <Text style={{
            fontWeight: '700',
            fontSize: 16,
            color: canAdd ? '#ffffff' : 'rgba(255,255,255,0.4)',
            marginLeft: canAdd ? 8 : 0,
          }}>
            {buttonLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
