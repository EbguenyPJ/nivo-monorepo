import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCartStore, type CartItem } from '@/lib/cart-store';

export default function CartScreen() {
  const { items, updateQuantity, removeItem, total, itemCount } = useCartStore();

  const subtotal = total();
  const delivery = 0;
  const orderTotal = subtotal + delivery;

  function renderItem({ item }: { item: CartItem }) {
    const attrs = Object.values(item.attributes).join(' · ');

    return (
      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          borderRadius: 24,
          padding: 16,
          marginBottom: 12,
          flexDirection: 'row',
        }}
      >
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={{ width: 90, height: 90, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)' }}
            contentFit="cover"
          />
        ) : (
          <View style={{ width: 90, height: 90, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="footsteps-outline" size={32} color="rgba(255,255,255,0.15)" />
          </View>
        )}

        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: '#f8fafc', fontSize: 15, fontWeight: '600' }} numberOfLines={2}>
                {item.product_name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>{attrs}</Text>
            </View>
            <TouchableOpacity
              onPress={() => removeItem(item.variant_id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.25)" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            {/* Quantity controls */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12 }}>
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateQuantity(item.variant_id, item.quantity - 1);
                }}
              >
                <Ionicons name="remove" size={16} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
              <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 15, minWidth: 24, textAlign: 'center' }}>
                {item.quantity}
              </Text>
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: item.quantity >= item.stock_available ? 'rgba(255,255,255,0.06)' : '#6366f1',
                  opacity: item.quantity >= item.stock_available ? 0.4 : 1,
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateQuantity(item.variant_id, item.quantity + 1);
                }}
                disabled={item.quantity >= item.stock_available}
              >
                <Ionicons name="add" size={16} color={item.quantity >= item.stock_available ? 'rgba(255,255,255,0.3)' : '#ffffff'} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '800' }}>
              ${(Number(item.unit_price) * item.quantity).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: '#0c0f1a' }}>
        <View style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Ionicons name="bag-outline" size={48} color="rgba(255,255,255,0.2)" />
        </View>
        <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: '700', marginTop: 8 }}>Tu carrito esta vacio</Text>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
          Explora nuestro catalogo y encuentra los zapatos que te encantan
        </Text>
        <TouchableOpacity
          style={{
            borderRadius: 16,
            paddingHorizontal: 28,
            height: 52,
            marginTop: 24,
            flexDirection: 'row',
            alignItems: 'center',
            overflow: 'hidden',
          }}
          onPress={() => router.push('/(tabs)/catalog')}
        >
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
          <Ionicons name="grid-outline" size={18} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginLeft: 8 }}>Ver catalogo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0f1a' }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.variant_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 220 }}
      />

      {/* Bottom checkout bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 32,
          backgroundColor: 'rgba(12, 15, 26, 0.95)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {/* Price breakdown */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Subtotal</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' }}>
            ${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Envio</Text>
          <Text style={{ color: '#34d399', fontSize: 14, fontWeight: '600' }}>Gratis</Text>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '700' }}>Total</Text>
          <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: '900' }}>
            ${orderTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <TouchableOpacity
          style={{
            height: 56,
            borderRadius: 16,
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => router.push('/checkout')}
          activeOpacity={0.8}
        >
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
          <Ionicons name="lock-closed" size={18} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
            Continuar al pago
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
