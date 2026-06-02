import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { usePickupOrders, useScanPickupQR } from '../../src/hooks/use-pickup';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  paid:             { label: 'Pagado',    color: '#60a5fa', bg: 'rgba(59,130,246,0.15)',  icon: 'card-outline' },
  picking:          { label: 'Surtiendo', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)',  icon: 'search-outline' },
  packed:           { label: 'Empacado',  color: '#a78bfa', bg: 'rgba(139,92,246,0.15)',  icon: 'cube-outline' },
  ready_for_pickup: { label: 'Listo',     color: '#34d399', bg: 'rgba(16,185,129,0.15)',  icon: 'checkmark-circle-outline' },
};

const FILTER_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'paid', label: 'Pagados' },
  { key: 'picking', label: 'Surtiendo' },
  { key: 'packed', label: 'Empacados' },
  { key: 'ready_for_pickup', label: 'Listos' },
];

export default function PickupIndex() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerMode, setIsScannerMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const cooldownRef = useRef(false);

  const { data: orders, isLoading, refetch, isRefetching } = usePickupOrders();
  const scanMutation = useScanPickupQR();

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (statusFilter === 'all') return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  // Count per status for badges
  const statusCounts = useMemo(() => {
    if (!orders) return {};
    const counts: Record<string, number> = { all: orders.length };
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (cooldownRef.current) return;
      cooldownRef.current = true;

      const orderId = result.data;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      scanMutation.mutate(orderId, {
        onSuccess: () => {
          setIsScannerMode(false);
          router.push(`/pickup-order/${orderId}`);
        },
        onSettled: () => {
          setTimeout(() => {
            cooldownRef.current = false;
          }, 1500);
        },
      });
    },
    [scanMutation],
  );

  // Scanner mode
  if (isScannerMode) {
    if (!permission?.granted) {
      return (
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#020617' }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 24 }} className="p-8 items-center">
            <Ionicons name="camera-outline" size={64} color="#0ea5e9" />
            <Text className="text-white text-xl font-bold mt-6 text-center">
              Permiso de Camara Requerido
            </Text>
            <Text style={{ color: '#64748b' }} className="text-center mt-3 mb-8">
              Nivo Staff necesita acceso a la camara para escanear codigos QR de recoleccion.
            </Text>
            <TouchableOpacity onPress={requestPermission} activeOpacity={0.8}>
              <LinearGradient
                colors={['#0ea5e9', '#06b6d4']}
                style={{ borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32 }}
              >
                <Text className="text-white text-lg font-bold">Permitir Camara</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-4 py-3 px-6"
              onPress={() => setIsScannerMode(false)}
            >
              <Text style={{ color: '#64748b' }} className="font-semibold">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View className="flex-1" style={{ backgroundColor: '#020617' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarCodeScanned}
        >
          {/* Scan overlay */}
          <View className="flex-1 items-center justify-center">
            <View style={{ width: 256, height: 256, borderWidth: 2, borderColor: '#0ea5e9', borderRadius: 28 }} />
            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text className="text-white text-sm">Apunta al codigo QR del cliente</Text>
            </View>
          </View>

          {/* Loading indicator */}
          {scanMutation.isPending && (
            <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <ActivityIndicator size="large" color="#0ea5e9" />
              <Text className="text-white font-bold mt-3">Verificando pedido...</Text>
            </View>
          )}

          {/* Back button */}
          <TouchableOpacity
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}
            className="absolute top-12 left-6 p-3"
            onPress={() => setIsScannerMode(false)}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        </CameraView>
      </View>
    );
  }

  // List mode
  return (
    <View className="flex-1" style={{ backgroundColor: '#020617' }}>
      {/* Scan QR button */}
      <View className="px-6 pt-3">
        <TouchableOpacity
          onPress={() => setIsScannerMode(true)}
          activeOpacity={0.8}
          className="mb-2"
        >
          <LinearGradient
            colors={['#0ea5e9', '#06b6d4']}
            style={{ borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="qr-code-outline" size={20} color="#ffffff" />
            <Text className="text-white text-base font-bold ml-2">
              Escanear QR de Cliente
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Status filter chips */}
      <View style={{ height: 36, marginBottom: 4 }}>
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
              <Ionicons name="bag-handle-outline" size={64} color="#334155" />
              <Text className="text-slate-500 text-xl font-bold mt-6">
                {statusFilter === 'all'
                  ? 'No hay pedidos de recoleccion'
                  : `Sin pedidos "${FILTER_OPTIONS.find(f => f.key === statusFilter)?.label}"`}
              </Text>
              <Text className="text-slate-600 text-sm mt-2 text-center">
                Los pedidos Click & Collect apareceran aqui automaticamente.
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
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={({ item }) => {
              const info = STATUS_CONFIG[item.status] ?? { label: item.status, color: '#94a3b8', bg: 'rgba(255,255,255,0.06)', icon: 'ellipse-outline' };
              return (
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 14 }}
                  className="p-3.5 mb-2"
                  onPress={() => router.push(`/pickup-order/${item.id}`)}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-1 mr-2">
                      <Text className="text-white text-base font-bold">
                        Pedido #{item.order_number}
                      </Text>
                      {(item as any).customer?.name && (
                        <Text style={{ color: '#64748b', fontSize: 12 }} className="mt-0.5">
                          {(item as any).customer.name}
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

                  <View className="flex-row items-center justify-between mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                    <View className="flex-row items-center">
                      <Ionicons name="cube-outline" size={14} color="#64748b" />
                      <Text style={{ color: '#64748b', fontSize: 12 }} className="ml-1">
                        {(item as any).items?.length ?? 0} art.
                      </Text>
                      <Text style={{ color: '#475569', fontSize: 12 }} className="ml-3">
                        ${Number(item.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
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
