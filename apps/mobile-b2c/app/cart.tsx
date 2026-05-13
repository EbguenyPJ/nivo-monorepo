import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCartStore, type CartItem } from '@/lib/cart-store';

export default function CartScreen() {
  const { items, updateQuantity, removeItem, total, itemCount } = useCartStore();

  function renderItem({ item }: { item: CartItem }) {
    const attrs = Object.values(item.attributes).join(' · ');

    return (
      <View className="bg-surface-card rounded-2xl p-4 mb-3 flex-row">
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} className="w-24 h-24 rounded-xl" contentFit="cover" />
        ) : (
          <View className="w-24 h-24 rounded-xl bg-slate-700 items-center justify-center">
            <Ionicons name="footsteps-outline" size={32} color="#475569" />
          </View>
        )}

        <View className="flex-1 ml-3">
          <Text className="text-white font-semibold" numberOfLines={2}>{item.product_name}</Text>
          <Text className="text-slate-400 text-xs mt-0.5">{attrs}</Text>
          <Text className="text-brand-500 font-bold text-base mt-1">
            ${Number(item.unit_price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </Text>

          <View className="flex-row items-center mt-2.5">
            <TouchableOpacity
              className="w-9 h-9 bg-slate-700 rounded-lg items-center justify-center"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateQuantity(item.variant_id, item.quantity - 1);
              }}
            >
              <Ionicons name="remove" size={18} color="#f8fafc" />
            </TouchableOpacity>
            <Text className="text-white font-bold text-base mx-4">{item.quantity}</Text>
            <TouchableOpacity
              className="w-9 h-9 bg-slate-700 rounded-lg items-center justify-center"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateQuantity(item.variant_id, item.quantity + 1);
              }}
              disabled={item.quantity >= item.stock_available}
              style={{ opacity: item.quantity >= item.stock_available ? 0.35 : 1 }}
            >
              <Ionicons name="add" size={18} color="#f8fafc" />
            </TouchableOpacity>

            <TouchableOpacity
              className="ml-auto p-1"
              onPress={() => removeItem(item.variant_id)}
            >
              <Ionicons name="trash-outline" size={18} color="#f87171" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-8">
        <Ionicons name="bag-outline" size={64} color="#334155" />
        <Text className="text-white text-xl font-bold mt-5">Tu carrito está vacío</Text>
        <Text className="text-slate-400 text-sm text-center mt-2">
          Explora nuestro catálogo y encuentra los zapatos que te encantan
        </Text>
        <TouchableOpacity
          className="bg-brand-500 rounded-xl px-8 py-3.5 mt-6 flex-row items-center"
          onPress={() => router.push('/(tabs)/catalog')}
        >
          <Ionicons name="grid-outline" size={18} color="#ffffff" />
          <Text className="text-white font-semibold ml-2">Ver catálogo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={items}
        keyExtractor={(i) => i.variant_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140 }}
      />

      {/* Bottom bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-slate-800 px-5 pt-4 pb-8">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-slate-400">
            {itemCount()} artículo{itemCount() > 1 ? 's' : ''}
          </Text>
          <Text className="text-white text-xl font-bold">
            ${total().toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <TouchableOpacity
          className="bg-brand-500 rounded-2xl py-4 items-center flex-row justify-center"
          onPress={() => router.push('/checkout')}
          activeOpacity={0.8}
        >
          <Ionicons name="lock-closed" size={18} color="#ffffff" />
          <Text className="text-white font-bold text-base ml-2">Continuar al pago</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
