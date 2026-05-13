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
import { useActiveAudits, useScanBarcode, useSubmitAudit, type BatchScanEntry } from '../../../src/hooks/use-audit';

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
      'Finalizar Auditoría',
      `¿Enviar ${scans.length} SKUs (${totalItems} unidades) al servidor?`,
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
      <View className="flex-1 bg-slate-950 items-center justify-center px-8">
        <Ionicons name="camera-outline" size={64} color="#64748b" />
        <Text className="text-white text-xl font-bold mt-6 text-center">
          Permiso de Cámara Requerido
        </Text>
        <Text className="text-slate-400 text-center mt-3 mb-8">
          Nivo Staff necesita acceso a la cámara para escanear códigos de barras durante la auditoría.
        </Text>
        <TouchableOpacity
          className="bg-brand py-4 px-8 rounded-xl"
          onPress={requestPermission}
        >
          <Text className="text-white text-lg font-bold">Permitir Cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Audit selection
  if (!selectedAuditId) {
    return (
      <View className="flex-1 bg-slate-950 px-6 pt-6">
        <Text className="text-white text-xl font-bold mb-2">Seleccionar Auditoría</Text>
        <Text className="text-slate-400 mb-6">
          Elige una auditoría en estado "Contando" para iniciar el escaneo.
        </Text>

        {auditsLoading ? (
          <ActivityIndicator size="large" color="#6366f1" className="mt-12" />
        ) : !auditsData?.data?.length ? (
          <View className="items-center mt-16">
            <Ionicons name="clipboard-outline" size={56} color="#475569" />
            <Text className="text-slate-500 text-lg mt-4 text-center">
              No hay auditorías activas en tu sucursal.
            </Text>
            <Text className="text-slate-600 text-sm mt-2 text-center">
              Solicita al administrador que inicie una auditoría desde el panel POS Admin.
            </Text>
          </View>
        ) : (
          <FlatList
            data={auditsData.data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-3"
                onPress={() => setSelectedAuditId(item.id)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white text-lg font-bold">
                      AUD-{String(item.folio_number).padStart(4, '0')}
                    </Text>
                    <Text className="text-slate-400 text-sm mt-1">
                      Tipo: {item.type === 'full' ? 'Completa' : 'Parcial'}
                    </Text>
                  </View>
                  <View className="bg-amber-500/20 px-3 py-1 rounded-lg">
                    <Text className="text-amber-400 text-sm font-semibold">Contando</Text>
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
    <View className="flex-1 bg-slate-950">
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
              <View className="w-72 h-48 border-2 border-brand rounded-2xl" />
              <Text className="text-white text-sm mt-4 bg-black/50 px-4 py-2 rounded-lg">
                Apunta al código de barras
              </Text>
            </View>

            {/* Live counter */}
            <View className="absolute top-4 left-4 right-4 flex-row justify-between">
              <View className="bg-black/70 px-4 py-2 rounded-xl flex-row items-center">
                <Ionicons name="barcode" size={18} color="#818cf8" />
                <Text className="text-white font-bold ml-2">{scans.length} SKUs</Text>
              </View>
              <View className="bg-black/70 px-4 py-2 rounded-xl flex-row items-center">
                <Ionicons name="cube" size={18} color="#34d399" />
                <Text className="text-white font-bold ml-2">{totalItems} uds</Text>
              </View>
            </View>

            {/* Pause button */}
            <TouchableOpacity
              className="absolute bottom-6 left-6 bg-black/70 p-4 rounded-full"
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
                  Alert.alert('¿Salir?', 'Se perderán los escaneos no enviados.', [
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
              <Ionicons name="arrow-back" size={22} color="#818cf8" />
              <Text className="text-brand-light ml-2 font-semibold">Cambiar Auditoría</Text>
            </TouchableOpacity>
            <View className="bg-slate-800 px-3 py-1 rounded-lg">
              <Text className="text-slate-300 text-sm font-mono">{scans.length} SKUs | {totalItems} uds</Text>
            </View>
          </View>

          {/* Scanned items list */}
          <FlatList
            data={scans}
            keyExtractor={(item) => item.barcode}
            contentContainerStyle={{ paddingBottom: 160 }}
            ListEmptyComponent={
              <View className="items-center mt-16">
                <Ionicons name="scan-outline" size={56} color="#475569" />
                <Text className="text-slate-500 text-lg mt-4">Inicia el escaneo</Text>
                <Text className="text-slate-600 text-sm mt-1">
                  Presiona el botón verde para activar la cámara
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-2 flex-row items-center justify-between">
                <View className="flex-1 mr-4">
                  <Text className="text-white font-bold text-base" numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <Text className="text-slate-400 text-sm mt-1">
                    {item.color} · Talla {item.size_mex} · SKU: {item.sku}
                  </Text>
                </View>
                <View className="bg-brand/20 rounded-xl px-4 py-2 min-w-[56px] items-center">
                  <Text className="text-brand-light text-xl font-bold">{item.qty}</Text>
                </View>
              </View>
            )}
          />

          {/* Action buttons */}
          <View className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-slate-950">
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-emerald-600 py-5 rounded-xl items-center flex-row justify-center"
                onPress={() => setIsScanning(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="scan" size={22} color="#ffffff" />
                <Text className="text-white text-lg font-bold ml-2">Escanear</Text>
              </TouchableOpacity>

              {scans.length > 0 && (
                <TouchableOpacity
                  className={`flex-1 py-5 rounded-xl items-center flex-row justify-center ${submitMutation.isPending ? 'bg-brand-dark' : 'bg-brand'}`}
                  onPress={handleSubmitAudit}
                  disabled={submitMutation.isPending}
                  activeOpacity={0.8}
                >
                  {submitMutation.isPending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={22} color="#ffffff" />
                      <Text className="text-white text-lg font-bold ml-2">Enviar</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
