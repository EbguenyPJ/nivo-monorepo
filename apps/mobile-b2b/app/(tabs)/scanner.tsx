import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useActiveAudits, useScanBarcode, useSubmitAudit, type BatchScanEntry } from '../../src/hooks/use-audit';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scans, setScans] = useState<BatchScanEntry[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const lastScannedRef = useRef<string>('');
  const cooldownRef = useRef(false);

  const { data: auditsData, isLoading: auditsLoading } = useActiveAudits();
  const scanMutation = useScanBarcode();
  const submitMutation = useSubmitAudit();

  const totalItems = scans.reduce((sum, s) => sum + s.qty, 0);

  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!selectedAuditId || cooldownRef.current) return;

      const barcode = result.data;
      if (barcode === lastScannedRef.current) return;

      cooldownRef.current = true;
      lastScannedRef.current = barcode;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const existing = scans.find((s) => s.barcode === barcode);
      if (existing) {
        setScans((prev) =>
          prev.map((s) => (s.barcode === barcode ? { ...s, qty: s.qty + 1 } : s)),
        );
        setTimeout(() => { cooldownRef.current = false; }, 400);
        return;
      }

      scanMutation.mutate(
        { audit_id: selectedAuditId, barcode },
        {
          onSuccess: (data) => {
            const v = data.variant;
            setScans((prev) => [
              {
                sku: v.sku,
                barcode: barcode,
                variant_id: v.id,
                product_name: v.product_name,
                color: v.color,
                size_mex: v.size_mex,
                qty: 1,
              },
              ...prev,
            ]);
          },
          onError: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          },
          onSettled: () => {
            setTimeout(() => { cooldownRef.current = false; }, 400);
          },
        },
      );
    },
    [selectedAuditId, scans, scanMutation],
  );

  const handleSubmitAudit = () => {
    if (!selectedAuditId || scans.length === 0) return;
    Alert.alert(
      'Finalizar Auditoria',
      `Enviar ${scans.length} SKUs (${totalItems} unidades) al servidor?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'default',
          onPress: () => {
            submitMutation.mutate(
              {
                audit_id: selectedAuditId,
                counts: scans.map((s) => ({
                  audit_id: selectedAuditId,
                  variant_id: s.variant_id,
                  counted_quantity: s.qty,
                })),
              },
              {
                onSuccess: () => {
                  setScans([]);
                  setIsScanning(false);
                  setSelectedAuditId(null);
                  lastScannedRef.current = '';
                },
              },
            );
          },
        },
      ],
    );
  };

  // Permission not granted
  if (!permission?.granted) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#020617' }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 24 }} className="p-8 items-center">
          <Ionicons name="camera-outline" size={64} color="#0ea5e9" />
          <Text className="text-white text-xl font-bold mt-6 text-center">
            Permiso de Camara Requerido
          </Text>
          <Text style={{ color: '#64748b' }} className="text-center mt-3 mb-8">
            Nivo Staff necesita acceso a la camara para escanear codigos de barras durante la auditoria.
          </Text>
          <TouchableOpacity onPress={requestPermission} activeOpacity={0.8}>
            <LinearGradient
              colors={['#0ea5e9', '#06b6d4']}
              style={{ borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32 }}
            >
              <Text className="text-white text-lg font-bold">Permitir Camara</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Audit selection
  if (!selectedAuditId) {
    return (
      <View className="flex-1 px-6 pt-6" style={{ backgroundColor: '#020617' }}>
        <Text className="text-white text-xl font-bold mb-2">Seleccionar Auditoria</Text>
        <Text style={{ color: '#64748b' }} className="mb-6">
          Elige una auditoria en estado "Contando" para iniciar el escaneo.
        </Text>

        {auditsLoading ? (
          <ActivityIndicator size="large" color="#0ea5e9" className="mt-12" />
        ) : !auditsData?.data?.length ? (
          <View className="items-center mt-16">
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20 }} className="p-6 items-center">
              <Ionicons name="clipboard-outline" size={56} color="#475569" />
              <Text className="text-slate-500 text-lg mt-4 text-center">
                No hay auditorias activas en tu sucursal.
              </Text>
              <Text className="text-slate-600 text-sm mt-2 text-center">
                Solicita al administrador que inicie una auditoria desde el panel POS Admin.
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={auditsData.data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 20 }}
                className="p-5 mb-3"
                onPress={() => setSelectedAuditId(item.id)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white text-lg font-bold">
                      AUD-{String(item.folio_number).padStart(4, '0')}
                    </Text>
                    <Text style={{ color: '#64748b' }} className="text-sm mt-1">
                      Tipo: {item.type === 'full' ? 'Completa' : 'Parcial'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(245,158,11,0.15)' }} className="px-3 py-1 rounded-lg">
                    <Text style={{ color: '#fbbf24' }} className="text-sm font-semibold">Contando</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#020617' }}>
      {/* Camera viewport */}
      {isScanning ? (
        <View className="flex-1">
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
            onBarcodeScanned={handleBarCodeScanned}
          >
            {/* Scan overlay */}
            <View className="flex-1 items-center justify-center">
              <View style={{ width: 288, height: 192, borderWidth: 2, borderColor: '#0ea5e9', borderRadius: 20 }} />
              <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, marginTop: 16, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text className="text-white text-sm">Apunta al codigo de barras</Text>
              </View>
            </View>

            {/* Live counter pills */}
            <View className="absolute top-4 left-4 right-4 flex-row justify-between">
              <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} className="px-4 py-2 flex-row items-center">
                <Ionicons name="barcode" size={18} color="#22d3ee" />
                <Text className="text-white font-bold ml-2">{scans.length} SKUs</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} className="px-4 py-2 flex-row items-center">
                <Ionicons name="cube" size={18} color="#34d399" />
                <Text className="text-white font-bold ml-2">{totalItems} uds</Text>
              </View>
            </View>

            {/* Pause button */}
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}
              className="absolute bottom-6 left-6 p-4"
              onPress={() => setIsScanning(false)}
            >
              <Ionicons name="pause" size={28} color="#ffffff" />
            </TouchableOpacity>
          </CameraView>
        </View>
      ) : (
        <View className="flex-1 px-6 pt-4">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() => {
                if (scans.length > 0) {
                  Alert.alert('Salir?', 'Se perderan los escaneos no enviados.', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Salir',
                      style: 'destructive',
                      onPress: () => {
                        setScans([]);
                        setSelectedAuditId(null);
                        lastScannedRef.current = '';
                      },
                    },
                  ]);
                } else {
                  setSelectedAuditId(null);
                }
              }}
            >
              <Ionicons name="arrow-back" size={22} color="#22d3ee" />
              <Text style={{ color: '#22d3ee' }} className="ml-2 font-semibold">Cambiar Auditoria</Text>
            </TouchableOpacity>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} className="px-3 py-1">
              <Text className="text-slate-300 text-sm font-mono">{scans.length} SKUs | {totalItems} uds</Text>
            </View>
          </View>

          {/* Scanned items list */}
          <FlatList
            data={scans}
            keyExtractor={(item) => item.barcode}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <View className="items-center mt-16">
                <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20 }} className="p-8 items-center">
                  <Ionicons name="scan-outline" size={56} color="#475569" />
                  <Text className="text-slate-500 text-lg mt-4">Inicia el escaneo</Text>
                  <Text className="text-slate-600 text-sm mt-1">
                    Presiona el boton verde para activar la camara
                  </Text>
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <View
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 20 }}
                className="p-4 mb-2 flex-row items-center justify-between"
              >
                <View className="flex-1 mr-4">
                  <Text className="text-white font-bold text-base" numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <Text style={{ color: '#64748b' }} className="text-sm mt-1">
                    {item.color} - Talla {item.size_mex} - SKU: {item.sku}
                  </Text>
                </View>
                <View style={{ backgroundColor: 'rgba(14,165,233,0.15)', borderRadius: 16 }} className="px-4 py-2 min-w-[56px] items-center">
                  <Text style={{ color: '#22d3ee' }} className="text-xl font-bold">{item.qty}</Text>
                </View>
              </View>
            )}
          />

          {/* Action buttons */}
          <View className="px-6 pb-6 pt-4" style={{ backgroundColor: '#020617' }}>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1"
                onPress={() => setIsScanning(true)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#059669', '#10b981']}
                  style={{ borderRadius: 16, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                >
                  <Ionicons name="scan" size={22} color="#ffffff" />
                  <Text className="text-white text-lg font-bold ml-2">Escanear</Text>
                </LinearGradient>
              </TouchableOpacity>

              {scans.length > 0 && (
                <TouchableOpacity
                  className="flex-1"
                  onPress={handleSubmitAudit}
                  disabled={submitMutation.isPending}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={submitMutation.isPending ? ['#0284c7', '#0e7490'] : ['#0ea5e9', '#06b6d4']}
                    style={{ borderRadius: 16, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                  >
                    {submitMutation.isPending ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={22} color="#ffffff" />
                        <Text className="text-white text-lg font-bold ml-2">Enviar</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
