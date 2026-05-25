import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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
    <View className="flex-1" style={{ backgroundColor: '#0c0f1a' }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
      >
        {/* Hero Gradient Header */}
        <LinearGradient
          colors={['#1a1040', '#0c0f1a']}
          locations={[0, 1]}
          style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}
        >
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>
            Hola, {user?.name?.split(' ')[0] ?? 'Cliente'}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: 15 }}>Bienvenido a Nivo</Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: 20 }}>
          {/* Loyalty Card */}
          <Animated.View entering={FadeInDown.duration(400)} style={{ marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/loyalty')}
              activeOpacity={0.8}
              style={{ borderRadius: 24, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#4338ca', '#6366f1', '#818cf8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 24, padding: 24 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>Puntos de lealtad</Text>
                    <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900' }}>
                      {loyalty.data?.points?.toLocaleString() ?? '--'}
                    </Text>
                  </View>
                  <View
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: 14 }}
                  >
                    <Ionicons name="qr-code" size={28} color="#ffffff" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                  <Ionicons name="star" size={14} color="#fbbf24" />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginLeft: 6 }}>
                    Nivel: {loyalty.data?.tier ?? 'Bronce'} — Toca para ver tu QR
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Active Orders */}
          {pendingOrders.length > 0 && (
            <Animated.View entering={FadeInDown.delay(100)} style={{ marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18, marginBottom: 12, letterSpacing: -0.3 }}>Pedidos activos</Text>
              {pendingOrders.slice(0, 3).map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderRadius: 24,
                    padding: 16,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                  onPress={() => router.push(`/order/${order.id}`)}
                  activeOpacity={0.7}
                >
                  {order.first_image_url ? (
                    <Image
                      source={{ uri: order.first_image_url }}
                      style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', marginRight: 12 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
                    >
                      <Ionicons name="cube-outline" size={20} color="#818cf8" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f8fafc', fontWeight: '600', fontSize: 14 }}>{order.first_product_name ?? order.folio}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                      {order.folio} · {order.fulfillment_type === 'bopis' ? 'Recoger en tienda' : 'Envio a domicilio'}
                    </Text>
                  </View>
                  <View
                    style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                  >
                    <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
                      {order.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* Active Layaways */}
          {activeLayaways.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200)} style={{ marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18, marginBottom: 12, letterSpacing: -0.3 }}>Apartados pendientes</Text>
              {activeLayaways.slice(0, 3).map((lay) => (
                <TouchableOpacity
                  key={lay.id}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderRadius: 24,
                    padding: 16,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                  onPress={() => router.push(`/layaway/${lay.id}`)}
                  activeOpacity={0.7}
                >
                  {lay.first_image_url ? (
                    <Image
                      source={{ uri: lay.first_image_url }}
                      style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', marginRight: 12 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(52,211,153,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
                    >
                      <Ionicons name="layers-outline" size={20} color="#34d399" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f8fafc', fontWeight: '600', fontSize: 14 }}>{lay.first_product_name ?? lay.folio}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                      {lay.folio} · Vence: {new Date(lay.due_date).toLocaleDateString('es-MX')}
                    </Text>
                  </View>
                  <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 14 }}>
                    ${Number(lay.balance_due).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* Quick actions */}
          <Animated.View entering={FadeInDown.delay(300)} className="flex-row gap-3 mt-2">
            {[
              { icon: 'grid-outline' as const, label: 'Catalogo', route: '/(tabs)/catalog' },
              { icon: 'card-outline' as const, label: 'Apartados', route: '/(tabs)/layaways' },
              { icon: 'qr-code-outline' as const, label: 'Mi QR', route: '/(tabs)/loyalty' },
            ].map((action) => (
              <TouchableOpacity
                key={action.label}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                }}
                className="flex-1 rounded-3xl py-6 items-center"
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.7}
              >
                <Ionicons name={action.icon} size={24} color="#818cf8" />
                <Text className="text-white/60 text-xs mt-2.5 font-medium">{action.label}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
