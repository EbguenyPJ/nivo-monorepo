import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMyLayaways, type LayawaySummary } from '@/lib/queries';

export default function LayawaysScreen() {
  const { data, isLoading, refetch, isRefetching } = useMyLayaways();

  function statusBadge(status: string) {
    switch (status) {
      case 'active':
        return { label: 'Activo', bg: 'rgba(251,191,36,0.12)', color: '#fcd34d', icon: 'time-outline' as const };
      case 'paid_delivered':
        return { label: 'Completado', bg: 'rgba(52,211,153,0.12)', color: '#6ee7b7', icon: 'checkmark-circle-outline' as const };
      case 'cancelled_refunded':
      case 'cancelled_forfeited':
        return { label: 'Cancelado', bg: 'rgba(248,113,113,0.12)', color: '#fca5a5', icon: 'close-circle-outline' as const };
      default:
        return { label: status, bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', icon: 'ellipse-outline' as const };
    }
  }

  function renderLayaway({ item, index }: { item: LayawaySummary; index: number }) {
    const badge = statusBadge(item.status);
    const total = Number(item.total_amount) || 0;
    const balance = Number(item.balance_due) || 0;
    const isOverdue = item.status === 'active' && new Date(item.due_date) < new Date();
    const progress = item.status === 'active' && total > 0
      ? ((total - balance) / total) * 100
      : item.status === 'paid_delivered' ? 100 : 0;

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
        <TouchableOpacity
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
          onPress={() => router.push(`/layaway/${item.id}`)}
          activeOpacity={0.7}
        >
          {/* Product image */}
          {item.first_image_url ? (
            <Image
              source={{ uri: item.first_image_url }}
              style={{
                width: 56, height: 56, borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.04)',
              }}
              contentFit="cover"
            />
          ) : (
            <View style={{
              width: 56, height: 56, borderRadius: 16,
              backgroundColor: 'rgba(99,102,241,0.12)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="layers-outline" size={22} color="#818cf8" />
            </View>
          )}

          {/* Info */}
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                {item.first_product_name ?? item.folio}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: badge.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <Ionicons name={badge.icon} size={11} color={badge.color} />
                <Text style={{ color: badge.color, fontSize: 10, fontWeight: '600', marginLeft: 3 }}>{badge.label}</Text>
              </View>
            </View>

            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 6 }}>
              {item.folio} · {item.branch_name}
            </Text>

            {/* Progress bar */}
            {item.status === 'active' && (
              <View style={{ marginBottom: 6 }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${Math.min(progress, 100)}%`, backgroundColor: '#6366f1', borderRadius: 2 }} />
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                {item.item_count} art. · Total: ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </Text>
              {item.status === 'active' && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 15 }}>
                    ${balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                    <Ionicons
                      name={isOverdue ? 'alert-circle' : 'calendar-outline'}
                      size={10}
                      color={isOverdue ? '#f87171' : 'rgba(255,255,255,0.3)'}
                    />
                    <Text style={{
                      fontSize: 10, marginLeft: 3,
                      color: isOverdue ? '#f87171' : 'rgba(255,255,255,0.35)',
                      fontWeight: isOverdue ? '600' : '400',
                    }}>
                      {isOverdue ? 'Vencido' : `Vence ${new Date(item.due_date).toLocaleDateString('es-MX')}`}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0f1a' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0f1a' }}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(l) => l.id}
        renderItem={renderLayaway}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              width: 80, height: 80, borderRadius: 24,
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Ionicons name="layers-outline" size={40} color="rgba(255,255,255,0.2)" />
            </View>
            <Text style={{ color: '#f8fafc', fontSize: 18, fontWeight: '700', marginTop: 8 }}>Sin apartados</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              Cuando apartes productos en tienda, apareceran aqui
            </Text>
          </View>
        }
      />
    </View>
  );
}
