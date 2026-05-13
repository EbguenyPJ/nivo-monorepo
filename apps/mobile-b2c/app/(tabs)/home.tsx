import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '@/lib/auth-store';
import { useLoyaltyProfile, useMyOrders, useMyLayaways } from '@/lib/queries';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const loyalty = useLoyaltyProfile();
  const orders = useMyOrders();
  const layaways = useMyLayaways();

  const isRefreshing = loyalty.isRefetching || orders.isRefetching;

  function onRefresh() {
    loyalty.refetch();
    orders.refetch();
    layaways.refetch();
  }

  const activeLayaways = layaways.data?.items.filter((l) => l.status === 'active') ?? [];
  const pendingOrders = orders.data?.items.filter(
    (o) => !['delivered', 'picked_up', 'cancelled'].includes(o.status),
  ) ?? [];

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
    >
      <Text className="text-2xl font-bold text-white mb-1">
        Hola, {user?.name?.split(' ')[0] ?? 'Cliente'}
      </Text>
      <Text className="text-slate-400 mb-6">Bienvenido a Nivo</Text>

      {/* Loyalty Card */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <TouchableOpacity
          className="bg-brand-500/15 border border-brand-500/30 rounded-2xl p-5 mb-5"
          onPress={() => router.push('/(tabs)/loyalty')}
          activeOpacity={0.8}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-brand-100 text-sm font-medium mb-1">Puntos de lealtad</Text>
              <Text className="text-white text-3xl font-bold">
                {loyalty.data?.points?.toLocaleString() ?? '—'}
              </Text>
            </View>
            <View className="bg-brand-500/30 rounded-full p-3">
              <Ionicons name="qr-code" size={28} color="#818cf8" />
            </View>
          </View>
          <View className="flex-row items-center mt-3">
            <Ionicons name="star" size={14} color="#fbbf24" />
            <Text className="text-brand-100 text-xs ml-1.5">
              Nivel: {loyalty.data?.tier ?? 'Bronce'} · Toca para ver tu QR
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Active Orders */}
      {pendingOrders.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100)} className="mb-5">
          <Text className="text-white font-semibold text-lg mb-3">Pedidos activos</Text>
          {pendingOrders.slice(0, 3).map((order) => (
            <TouchableOpacity
              key={order.id}
              className="bg-surface-card rounded-xl p-4 mb-2.5 flex-row items-center"
              onPress={() => router.push(`/order/${order.id}`)}
              activeOpacity={0.7}
            >
              <View className="w-10 h-10 bg-brand-500/20 rounded-full items-center justify-center mr-3">
                <Ionicons name="cube-outline" size={20} color="#818cf8" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium">{order.folio}</Text>
                <Text className="text-slate-400 text-xs mt-0.5">
                  {order.fulfillment_type === 'bopis' ? 'Recoger en tienda' : 'Envío a domicilio'}
                </Text>
              </View>
              <View className="bg-amber-500/20 px-3 py-1 rounded-full">
                <Text className="text-amber-300 text-xs font-medium capitalize">
                  {order.status.replace(/_/g, ' ')}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Active Layaways */}
      {activeLayaways.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200)} className="mb-5">
          <Text className="text-white font-semibold text-lg mb-3">Apartados pendientes</Text>
          {activeLayaways.slice(0, 3).map((lay) => (
            <TouchableOpacity
              key={lay.id}
              className="bg-surface-card rounded-xl p-4 mb-2.5 flex-row items-center"
              onPress={() => router.push(`/layaway/${lay.id}`)}
              activeOpacity={0.7}
            >
              <View className="w-10 h-10 bg-emerald-500/20 rounded-full items-center justify-center mr-3">
                <Ionicons name="layers-outline" size={20} color="#34d399" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium">{lay.folio}</Text>
                <Text className="text-slate-400 text-xs mt-0.5">
                  Vence: {new Date(lay.due_date).toLocaleDateString('es-MX')}
                </Text>
              </View>
              <Text className="text-emerald-400 font-bold">
                ${Number(lay.balance_due).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Quick actions */}
      <Animated.View entering={FadeInDown.delay(300)} className="flex-row gap-3 mt-2">
        <TouchableOpacity
          className="flex-1 bg-surface-card rounded-2xl py-5 items-center"
          onPress={() => router.push('/(tabs)/catalog')}
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={24} color="#818cf8" />
          <Text className="text-slate-300 text-xs mt-2 font-medium">Catálogo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-surface-card rounded-2xl py-5 items-center"
          onPress={() => router.push('/(tabs)/layaways')}
          activeOpacity={0.7}
        >
          <Ionicons name="card-outline" size={24} color="#818cf8" />
          <Text className="text-slate-300 text-xs mt-2 font-medium">Apartados</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-surface-card rounded-2xl py-5 items-center"
          onPress={() => router.push('/(tabs)/loyalty')}
          activeOpacity={0.7}
        >
          <Ionicons name="qr-code-outline" size={24} color="#818cf8" />
          <Text className="text-slate-300 text-xs mt-2 font-medium">Mi QR</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}
