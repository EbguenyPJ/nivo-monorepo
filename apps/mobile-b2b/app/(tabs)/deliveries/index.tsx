import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDeliveryOrders } from '../../../src/hooks/use-deliveries';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  paid:             { label: 'Pagado',    color: '#60a5fa', bg: 'rgba(59,130,246,0.15)',  icon: 'card-outline' },
  picking:          { label: 'Surtiendo', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)',  icon: 'search-outline' },
  packed:           { label: 'Empacado',  color: '#a78bfa', bg: 'rgba(139,92,246,0.15)',  icon: 'cube-outline' },
  out_for_delivery: { label: 'En Camino', color: '#fb923c', bg: 'rgba(249,115,22,0.15)',  icon: 'bicycle-outline' },
};

const FILTER_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'paid', label: 'Pagados' },
  { key: 'picking', label: 'Surtiendo' },
  { key: 'packed', label: 'Empacados' },
  { key: 'out_for_delivery', label: 'En Camino' },
];

export default function DeliveriesIndex() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: orders, isLoading, refetch, isRefetching } = useDeliveryOrders();

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (statusFilter === 'all') return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const statusCounts = useMemo(() => {
    if (!orders) return {};
    const counts: Record<string, number> = { all: orders.length };
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  return (
    <View className="flex-1" style={{ backgroundColor: '#020617' }}>
      {/* Status filter chips */}
      <View style={{ height: 36, marginTop: 8, marginBottom: 4 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', height: 36 }}
        >
          {FILTER_OPTIONS.map((opt) => {
            const isActive = statusFilter === opt.key;
            const count = statusCounts[opt.key] || 0;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setStatusFilter(opt.key)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: isActive ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.06)',
                  borderColor: isActive ? '#0ea5e9' : 'rgba(255,255,255,0.10)',
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  marginRight: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{ color: isActive ? '#0ea5e9' : '#94a3b8', fontWeight: isActive ? '700' : '500', fontSize: 12 }}
                >
                  {opt.label}
                </Text>
                {count > 0 && (
                  <View
                    style={{
                      backgroundColor: isActive ? '#0ea5e9' : 'rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      minWidth: 16,
                      height: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 4,
                      paddingHorizontal: 3,
                    }}
                  >
                    <Text style={{ color: isActive ? '#fff' : '#94a3b8', fontSize: 9, fontWeight: '700' }}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders list */}
      <View className="flex-1 px-6">
        {isLoading ? (
          <ActivityIndicator size="large" color="#0ea5e9" className="mt-16" />
        ) : !filteredOrders.length ? (
          <View className="items-center mt-16">
            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20 }} className="p-8 items-center">
              <Ionicons name="bicycle-outline" size={64} color="#334155" />
              <Text className="text-slate-500 text-xl font-bold mt-6">
                {statusFilter === 'all'
                  ? 'Sin entregas pendientes'
                  : `Sin pedidos "${FILTER_OPTIONS.find(f => f.key === statusFilter)?.label}"`}
              </Text>
              <Text className="text-slate-600 text-sm mt-2 text-center">
                Cuando se asignen pedidos de entrega a tu sucursal, apareceran aqui.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 16 }}
                className="mt-6 px-6 py-3 flex-row items-center"
                onPress={() => refetch()}
              >
                <Ionicons name="refresh" size={18} color="#22d3ee" />
                <Text style={{ color: '#22d3ee' }} className="font-semibold ml-2">Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            data={filteredOrders}
            keyExtractor={(item) => item.id}
            onRefresh={refetch}
            refreshing={isRefetching}
            contentContainerStyle={{ paddingBottom: 96 }}
            renderItem={({ item }) => {
              const info = STATUS_CONFIG[item.status] ?? { label: item.status, color: '#94a3b8', bg: 'rgba(255,255,255,0.06)', icon: 'ellipse-outline' };
              const address = item.shipping_address;

              return (
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 14 }}
                  className="p-3.5 mb-2"
                  onPress={() => router.push(`/(tabs)/deliveries/${item.id}`)}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-1 mr-2">
                      <Text className="text-white text-base font-bold">
                        Pedido #{item.order_number}
                      </Text>
                      {item.customer_name && (
                        <Text style={{ color: '#64748b', fontSize: 12 }} className="mt-0.5">
                          {item.customer_name}
                        </Text>
                      )}
                    </View>
                    <View style={{ backgroundColor: info.bg, flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Ionicons name={info.icon as any} size={12} color={info.color} />
                      <Text style={{ color: info.color, marginLeft: 3, fontSize: 12, fontWeight: '600' }}>
                        {info.label}
                      </Text>
                    </View>
                  </View>

                  {address && (
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="location-outline" size={13} color="#64748b" />
                      <Text style={{ color: '#64748b', fontSize: 12 }} className="ml-1 flex-1" numberOfLines={1}>
                        {[address.street, address.city, address.state].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  )}

                  <View className="flex-row items-center justify-between mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                    <Text style={{ color: '#475569', fontSize: 12 }}>
                      ${Number(item.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#334155" />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}
