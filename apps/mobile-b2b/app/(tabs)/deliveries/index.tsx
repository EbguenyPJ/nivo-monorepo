import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from 'expo-vector-icons';
import { router } from 'expo-router';
import { useDeliveryOrders } from '../../../src/hooks/use-deliveries';
import { OrderStatus } from '@nivo/types';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  [OrderStatus.PACKED]: { label: 'Empacado', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  [OrderStatus.OUT_FOR_DELIVERY]: { label: 'En Camino', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  [OrderStatus.READY_FOR_PICKUP]: { label: 'Listo', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
};

export default function DeliveriesIndex() {
  const { data: orders, isLoading, refetch, isRefetching } = useDeliveryOrders();

  return (
    <View className="flex-1 bg-slate-950 px-6 pt-4">
      {isLoading ? (
        <ActivityIndicator size="large" color="#6366f1" className="mt-16" />
      ) : !orders?.length ? (
        <View className="items-center mt-20">
          <Ionicons name="checkmark-circle" size={64} color="#334155" />
          <Text className="text-slate-500 text-xl font-bold mt-6">Sin entregas pendientes</Text>
          <Text className="text-slate-600 text-sm mt-2 text-center">
            Cuando se asignen pedidos de entrega a tu sucursal, aparecerán aquí.
          </Text>
          <TouchableOpacity
            className="mt-6 bg-slate-900 border border-slate-800 px-6 py-3 rounded-xl flex-row items-center"
            onPress={() => refetch()}
          >
            <Ionicons name="refresh" size={18} color="#818cf8" />
            <Text className="text-brand-light font-semibold ml-2">Actualizar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const statusInfo = STATUS_LABELS[item.status] ?? {
              label: item.status,
              color: 'text-slate-400',
              bg: 'bg-slate-800',
            };
            const address = item.shipping_address;

            return (
              <TouchableOpacity
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-3"
                onPress={() => router.push(`/(tabs)/deliveries/${item.id}`)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1 mr-3">
                    <Text className="text-white text-lg font-bold">
                      Pedido #{item.order_number}
                    </Text>
                    {item.customer_name && (
                      <Text className="text-slate-400 text-sm mt-1">
                        {item.customer_name}
                      </Text>
                    )}
                  </View>
                  <View className={`px-3 py-1 rounded-lg ${statusInfo.bg}`}>
                    <Text className={`text-sm font-semibold ${statusInfo.color}`}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                {address && (
                  <View className="flex-row items-start">
                    <Ionicons name="location-outline" size={16} color="#64748b" className="mt-0.5" />
                    <Text className="text-slate-500 text-sm ml-2 flex-1" numberOfLines={2}>
                      {[address.street, address.city, address.state].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                )}

                <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-800">
                  <Text className="text-slate-500 text-sm">
                    ${item.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </Text>
                  <View className="flex-row items-center">
                    <Text className="text-brand-light text-sm font-semibold mr-1">Ver detalle</Text>
                    <Ionicons name="chevron-forward" size={16} color="#818cf8" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
