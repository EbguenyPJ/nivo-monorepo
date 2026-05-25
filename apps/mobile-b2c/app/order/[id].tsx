import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useOrderDetail } from '@/lib/queries';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; iconColor: string; bg: string }> = {
  pending_payment: { label: 'Pendiente de pago', color: 'text-amber-300', icon: 'time-outline', iconColor: '#fcd34d', bg: 'rgba(251,191,36,0.12)' },
  paid: { label: 'Pagado', color: 'text-blue-300', icon: 'card-outline', iconColor: '#93c5fd', bg: 'rgba(96,165,250,0.12)' },
  picking: { label: 'Preparando', color: 'text-blue-300', icon: 'hand-left-outline', iconColor: '#93c5fd', bg: 'rgba(96,165,250,0.12)' },
  packed: { label: 'Empacado', color: 'text-cyan-300', icon: 'cube-outline', iconColor: '#67e8f9', bg: 'rgba(103,232,249,0.12)' },
  ready_for_pickup: { label: 'Listo para recoger', color: 'text-emerald-300', icon: 'storefront-outline', iconColor: '#6ee7b7', bg: 'rgba(110,231,183,0.12)' },
  picked_up: { label: 'Recogido', color: 'text-emerald-400', icon: 'checkmark-circle-outline', iconColor: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  out_for_delivery: { label: 'En camino', color: 'text-indigo-300', icon: 'car-outline', iconColor: '#a5b4fc', bg: 'rgba(165,180,252,0.12)' },
  delivered: { label: 'Entregado', color: 'text-emerald-400', icon: 'checkmark-done-circle-outline', iconColor: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  cancelled: { label: 'Cancelado', color: 'text-red-400', icon: 'close-circle-outline', iconColor: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading } = useOrderDetail(id);

  if (isLoading || !order) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0c0f1a' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const status = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'text-white/60', icon: 'ellipse-outline', iconColor: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)' };

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: '#0c0f1a' }} contentContainerClassName="px-5 pt-4 pb-12">
      <Animated.View entering={FadeInDown.duration(400)} className="items-center mb-6">
        <View
          className="w-18 h-18 rounded-3xl items-center justify-center mb-3"
          style={{ backgroundColor: status.bg, width: 72, height: 72, borderRadius: 22 }}
        >
          <Ionicons name={status.icon as any} size={34} color={status.iconColor} />
        </View>
        <Text className="text-white text-2xl font-black tracking-tight">{order.folio}</Text>
        <Text className={`${status.color} text-lg font-semibold mt-1`}>{status.label}</Text>
        <Text className="text-white/30 text-xs mt-1">
          {new Date(order.created_at).toLocaleDateString('es-MX', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </Animated.View>

      {/* Status Timeline */}
      <Animated.View
        entering={FadeInDown.delay(50).duration(400)}
        className="p-5 mb-4"
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          borderRadius: 24,
        }}
      >
        {(() => {
          const bopisFlow = ['paid', 'picking', 'packed', 'ready_for_pickup', 'picked_up'];
          const deliveryFlow = ['paid', 'picking', 'packed', 'out_for_delivery', 'delivered'];
          const flow = order.fulfillment_type === 'bopis' ? bopisFlow : deliveryFlow;
          const currentIdx = flow.indexOf(order.status);
          const isCancelled = order.status === 'cancelled';

          if (isCancelled) return (
            <View className="flex-row items-center justify-center py-2">
              <Ionicons name="close-circle" size={20} color="#f87171" />
              <Text className="text-red-400 font-medium ml-2">Pedido cancelado</Text>
            </View>
          );

          return flow.map((step, idx) => {
            const stepConfig = STATUS_CONFIG[step];
            const isCompleted = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <View key={step} className="flex-row items-start">
                <View className="items-center mr-3">
                  {isCompleted ? (
                    <View className={`w-7 h-7 rounded-full items-center justify-center ${isCurrent ? 'bg-brand-500' : 'bg-emerald-500'}`}>
                      <Ionicons name={isCurrent ? 'ellipse' : 'checkmark'} size={isCurrent ? 8 : 14} color="#ffffff" />
                    </View>
                  ) : (
                    <View className="w-7 h-7 rounded-full" style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
                  )}
                  {idx < flow.length - 1 && (
                    <View className={`w-0.5 h-7 ${isCompleted ? 'bg-emerald-500' : ''}`} style={!isCompleted ? { backgroundColor: 'rgba(255,255,255,0.06)' } : undefined} />
                  )}
                </View>
                <Text className={`text-sm pt-1 ${isCompleted ? (isCurrent ? 'text-brand-400 font-bold' : 'text-emerald-400') : 'text-white/20'}`}>
                  {stepConfig?.label || step}
                </Text>
              </View>
            );
          });
        })()}
      </Animated.View>

      {/* Out for delivery indicator */}
      {order.status === 'out_for_delivery' && (
        <Animated.View
          entering={FadeInDown.delay(75).duration(400)}
          className="p-4 mb-4 flex-row items-center"
          style={{
            backgroundColor: 'rgba(99,102,241,0.08)',
            borderColor: 'rgba(99,102,241,0.15)',
            borderWidth: 1,
            borderRadius: 20,
          }}
        >
          <View className="w-3 h-3 bg-indigo-400 rounded-full mr-3" />
          <View>
            <Text className="text-indigo-300 font-semibold">Tu pedido esta en camino</Text>
            <Text className="text-indigo-400/50 text-xs mt-0.5">El repartidor se dirige a tu ubicacion</Text>
          </View>
        </Animated.View>
      )}

      {/* Fulfillment info */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        className="p-5 mb-4 flex-row items-center"
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          borderRadius: 24,
        }}
      >
        <View
          style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}
          className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
        >
          <Ionicons
            name={order.fulfillment_type === 'bopis' ? 'storefront-outline' : 'car-outline'}
            size={20}
            color="#818cf8"
          />
        </View>
        <View>
          <Text className="text-white font-semibold">
            {order.fulfillment_type === 'bopis' ? 'Recoger en tienda' : 'Envio a domicilio'}
          </Text>
          {order.pickup_branch_name && (
            <Text className="text-white/40 text-sm mt-0.5">{order.pickup_branch_name}</Text>
          )}
        </View>
      </Animated.View>

      {/* Items */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Text className="text-white font-bold text-lg mb-3 tracking-tight">Articulos</Text>
        {order.items.map((item, idx) => {
          const attrs = Object.entries(item.attributes ?? {}).map(([k, v]) => `${k}: ${v}`).join(' — ');
          return (
            <View
              key={idx}
              className="p-4 mb-2 flex-row"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderRadius: 20,
              }}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} className="w-16 h-16 rounded-xl" contentFit="cover" />
              ) : (
                <View className="w-16 h-16 rounded-xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                  <Ionicons name="footsteps-outline" size={22} color="rgba(255,255,255,0.15)" />
                </View>
              )}
              <View className="flex-1 ml-3">
                <Text className="text-white font-semibold" numberOfLines={1}>{item.product_name}</Text>
                <Text className="text-white/35 text-xs">{attrs}</Text>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-white/35 text-xs">x{item.quantity}</Text>
                  <Text className="text-brand-400 font-semibold">
                    ${Number(item.subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </Animated.View>

      {/* Total */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(400)}
        className="p-5 mt-4"
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          borderRadius: 24,
        }}
      >
        <View className="flex-row justify-between items-center">
          <Text className="text-white font-bold text-lg">Total</Text>
          <Text className="text-white font-black text-xl">
            ${Number(order.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}
