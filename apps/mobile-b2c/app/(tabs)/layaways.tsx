import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMyLayaways, type LayawaySummary } from '@/lib/queries';

export default function LayawaysScreen() {
  const { data, isLoading, refetch, isRefetching } = useMyLayaways();

  function statusBadge(status: string) {
    switch (status) {
      case 'active':
        return { label: 'Activo', bg: 'bg-amber-500/20', text: 'text-amber-300', icon: 'time-outline' as const };
      case 'paid_delivered':
        return { label: 'Completado', bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: 'checkmark-circle-outline' as const };
      case 'cancelled_refunded':
      case 'cancelled_forfeited':
        return { label: 'Cancelado', bg: 'bg-red-500/20', text: 'text-red-300', icon: 'close-circle-outline' as const };
      default:
        return { label: status, bg: 'bg-slate-600/20', text: 'text-slate-300', icon: 'ellipse-outline' as const };
    }
  }

  function renderLayaway({ item, index }: { item: LayawaySummary; index: number }) {
    const badge = statusBadge(item.status);
    const isOverdue = item.status === 'active' && new Date(item.due_date) < new Date();
    const progress = item.status === 'active'
      ? ((Number(item.total_amount) - Number(item.balance_due)) / Number(item.total_amount)) * 100
      : item.status === 'paid_delivered' ? 100 : 0;

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
        <TouchableOpacity
          className="bg-surface-card rounded-2xl p-4 mb-3"
          onPress={() => router.push(`/layaway/${item.id}`)}
          activeOpacity={0.7}
        >
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-brand-500/20 rounded-full items-center justify-center mr-3">
                <Ionicons name="layers-outline" size={20} color="#818cf8" />
              </View>
              <View>
                <Text className="text-white font-semibold">{item.folio}</Text>
                <Text className="text-slate-400 text-xs mt-0.5">{item.branch_name}</Text>
              </View>
            </View>
            <View className={`${badge.bg} px-3 py-1 rounded-full flex-row items-center`}>
              <Ionicons name={badge.icon} size={12} color={badge.text === 'text-amber-300' ? '#fcd34d' : badge.text === 'text-emerald-300' ? '#6ee7b7' : '#fca5a5'} />
              <Text className={`${badge.text} text-xs font-medium ml-1`}>{badge.label}</Text>
            </View>
          </View>

          {item.status === 'active' && (
            <View className="mb-3">
              <View className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <View
                  className="h-full bg-brand-500 rounded-full"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </View>
            </View>
          )}

          <View className="flex-row justify-between items-end">
            <View>
              <Text className="text-slate-400 text-xs">
                {item.item_count} artículo{item.item_count > 1 ? 's' : ''} · Total: ${Number(item.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            {item.status === 'active' && (
              <View className="items-end">
                <Text className="text-emerald-400 font-bold text-lg">
                  ${Number(item.balance_due).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <Ionicons name={isOverdue ? 'alert-circle' : 'calendar-outline'} size={11} color={isOverdue ? '#f87171' : '#64748b'} />
                  <Text className={`text-xs ml-1 ${isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                    {isOverdue ? 'Vencido' : `Vence ${new Date(item.due_date).toLocaleDateString('es-MX')}`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(l) => l.id}
        renderItem={renderLayaway}
        contentContainerClassName="px-4 pt-4 pb-8"
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Ionicons name="layers-outline" size={56} color="#334155" />
            <Text className="text-white text-lg font-semibold mt-4">Sin apartados</Text>
            <Text className="text-slate-400 mt-2 text-center px-8">
              Cuando apartes productos en tienda, aparecerán aquí
            </Text>
          </View>
        }
      />
    </View>
  );
}
