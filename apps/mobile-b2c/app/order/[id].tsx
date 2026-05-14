import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useOrderDetail } from '@/lib/queries';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; iconColor: string; bg: string }> = {
  pending_payment: { label: 'Pendiente de pago', color: 'text-amber-300', icon: 'time-outline', iconColor: '#fcd34d', bg: 'bg-amber-500/15' },
  paid: { label: 'Pagado', color: 'text-blue-300', icon: 'card-outline', iconColor: '#93c5fd', bg: 'bg-blue-500/15' },
  picking: { label: 'Preparando', color: 'text-blue-300', icon: 'hand-left-outline', iconColor: '#93c5fd', bg: 'bg-blue-500/15' },
  packed: { label: 'Empacado', color: 'text-cyan-300', icon: 'cube-outline', iconColor: '#67e8f9', bg: 'bg-cyan-500/15' },
  ready_for_pickup: { label: 'Listo para recoger', color: 'text-emerald-300', icon: 'storefront-outline', iconColor: '#6ee7b7', bg: 'bg-emerald-500/15' },
  picked_up: { label: 'Recogido', color: 'text-emerald-400', icon: 'checkmark-circle-outline', iconColor: '#34d399', bg: 'bg-emerald-500/15' },
  out_for_delivery: { label: 'En camino', color: 'text-indigo-300', icon: 'car-outline', iconColor: '#a5b4fc', bg: 'bg-indigo-500/15' },
  delivered: { label: 'Entregado', color: 'text-emerald-400', icon: 'checkmark-done-circle-outline', iconColor: '#34d399', bg: 'bg-emerald-500/15' },
  cancelled: { label: 'Cancelado', color: 'text-red-400', icon: 'close-circle-outline', iconColor: '#f87171', bg: 'bg-red-500/15' },
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading } = useOrderDetail(id);

  if (isLoading || !order) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const status = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'text-slate-300', icon: 'ellipse-outline', iconColor: '#cbd5e1', bg: 'bg-slate-500/15' };

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-5 pt-4 pb-12">
      <Animated.View entering={FadeInDown.duration(400)} className="items-center mb-6">
        <View className={`w-16 h-16 rounded-full items-center justify-center mb-3 ${status.bg}`}>
          <Ionicons name={status.icon as any} size={32} color={status.iconColor} />
        </View>
        <Text className="text-white text-2xl font-bold">{order.folio}</Text>
        <Text className={`${status.color} text-lg font-medium mt-1`}>{status.label}</Text>
        <Text className="text-slate-400 text-xs mt-1">
          {new Date(order.created_at).toLocaleDateString('es-MX', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </Animated.View>

      {/* Fulfillment info */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} className="bg-surface-card rounded-2xl p-4 mb-4 flex-row items-center">
        <View className="w-10 h-10 bg-brand-500/20 rounded-full items-center justify-center mr-3">
          <Ionicons
            name={order.fulfillment_type === 'bopis' ? 'storefront-outline' : 'car-outline'}
            size={20}
            color="#818cf8"
          />
        </View>
        <View>
          <Text className="text-white font-medium">
            {order.fulfillment_type === 'bopis' ? 'Recoger en tienda' : 'Envío a domicilio'}
          </Text>
          {order.pickup_branch_name && (
            <Text className="text-slate-400 text-sm mt-0.5">{order.pickup_branch_name}</Text>
          )}
        </View>
      </Animated.View>

      {/* Items */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Text className="text-white font-semibold text-lg mb-3">Artículos</Text>
        {order.items.map((item, idx) => {
          const attrs = Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' · ');
          return (
            <View key={idx} className="bg-surface-card rounded-xl p-4 mb-2 flex-row">
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} className="w-16 h-16 rounded-lg" contentFit="cover" />
              ) : (
                <View className="w-16 h-16 rounded-lg bg-slate-700 items-center justify-center">
                  <Ionicons name="footsteps-outline" size={22} color="#475569" />
                </View>
              )}
              <View className="flex-1 ml-3">
                <Text className="text-white font-medium" numberOfLines={1}>{item.product_name}</Text>
                <Text className="text-slate-400 text-xs">{attrs}</Text>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-slate-400 text-xs">x{item.quantity}</Text>
                  <Text className="text-brand-500 font-medium">
                    ${Number(item.subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </Animated.View>

      {/* Total */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)} className="bg-surface-card rounded-2xl p-5 mt-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-white font-bold text-lg">Total</Text>
          <Text className="text-white font-bold text-xl">
            ${Number(order.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}
