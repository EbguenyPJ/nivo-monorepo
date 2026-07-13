import { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline } from 'react-native-svg';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import type { VerificationMethod } from '../hooks/use-deliveries';

export interface VerificationState {
  pin_code?: string;
  signature_data?: string;
  qr_payload?: string;
}

interface DeliveryVerificationProps {
  requiredMethods: VerificationMethod[];
  value: VerificationState;
  onChange: (next: VerificationState) => void;
}

const glassCard = {
  backgroundColor: 'rgba(255,255,255,0.06)',
  borderColor: 'rgba(255,255,255,0.10)',
  borderWidth: 1,
  borderRadius: 24,
} as const;

const methodButton = (done: boolean) => ({
  backgroundColor: done ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
  borderColor: done ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  borderRadius: 16,
  flex: 1,
  paddingVertical: 16,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});

// ─── Signature pad (PanResponder + SVG polylines) ────────────────

function SignaturePad({ onDone, onCancel }: { onDone: (data: string) => void; onCancel: () => void }) {
  const [strokes, setStrokes] = useState<string[]>([]);
  const currentStroke = useRef<string[]>([]);
  const [, forceRender] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStroke.current = [`${locationX.toFixed(1)},${locationY.toFixed(1)}`];
        forceRender((n) => n + 1);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStroke.current.push(`${locationX.toFixed(1)},${locationY.toFixed(1)}`);
        forceRender((n) => n + 1);
      },
      onPanResponderRelease: () => {
        if (currentStroke.current.length > 1) {
          setStrokes((prev) => [...prev, currentStroke.current.join(' ')]);
        }
        currentStroke.current = [];
        forceRender((n) => n + 1);
      },
    }),
  ).current;

  const hasSignature = strokes.length > 0;

  return (
    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(2,6,23,0.92)' }}>
      <View style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28 }} className="px-6 pt-6 pb-10">
        <Text className="text-white text-xl font-bold mb-1">Firma del cliente</Text>
        <Text style={{ color: '#64748b' }} className="text-sm mb-4">
          Pide al cliente que firme dentro del recuadro
        </Text>

        <View
          {...panResponder.panHandlers}
          style={{
            height: 260,
            backgroundColor: '#f8fafc',
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <Svg width="100%" height="100%">
            {strokes.map((points, i) => (
              <Polyline key={i} points={points} fill="none" stroke="#0f172a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {currentStroke.current.length > 1 && (
              <Polyline points={currentStroke.current.join(' ')} fill="none" stroke="#0f172a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </Svg>
          {!hasSignature && currentStroke.current.length === 0 && (
            <Text
              style={{ position: 'absolute', alignSelf: 'center', top: 118, color: '#94a3b8' }}
              className="text-base"
              pointerEvents="none"
            >
              Firma aqui
            </Text>
          )}
        </View>

        <View className="flex-row gap-3 mt-5">
          <Pressable
            onPress={() => { setStrokes([]); currentStroke.current = []; forceRender((n) => n + 1); }}
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16 }}
            className="flex-1 py-4 items-center"
          >
            <Text className="text-white font-semibold">Limpiar</Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16 }}
            className="flex-1 py-4 items-center"
          >
            <Text className="text-white font-semibold">Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={!hasSignature}
            onPress={() => onDone(JSON.stringify({ type: 'svg-polylines', strokes }))}
            style={{ backgroundColor: hasSignature ? '#059669' : 'rgba(255,255,255,0.06)', borderRadius: 16 }}
            className="flex-1 py-4 items-center"
          >
            <Text className="text-white font-bold">Guardar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── QR scanner modal ────────────────────────────────────────────

function QrScanner({ onScanned, onCancel }: { onScanned: (payload: string) => void; onCancel: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#020617' }}>
        <ActivityIndicator color="#0ea5e9" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#020617' }}>
        <Ionicons name="camera-outline" size={48} color="#64748b" />
        <Text className="text-white text-lg font-bold mt-4 text-center">Se necesita acceso a la camara</Text>
        <Pressable onPress={requestPermission} style={{ backgroundColor: '#0ea5e9', borderRadius: 16 }} className="px-8 py-4 mt-6">
          <Text className="text-white font-bold">Permitir camara</Text>
        </Pressable>
        <Pressable onPress={onCancel} className="mt-4">
          <Text style={{ color: '#64748b' }}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  const handleScan = (result: BarcodeScanningResult) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    onScanned(result.data);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#020617' }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScan}
      >
        <View className="flex-1 items-center justify-center">
          <View style={{ width: 240, height: 240, borderColor: '#22d3ee', borderWidth: 3, borderRadius: 24 }} />
          <Text className="text-white text-base font-semibold mt-6 text-center px-8">
            Escanea el QR del cliente para verificar la entrega
          </Text>
        </View>
        <Pressable
          onPress={onCancel}
          style={{ backgroundColor: 'rgba(2,6,23,0.8)', borderRadius: 16 }}
          className="mx-8 mb-12 py-4 items-center"
        >
          <Text className="text-white font-semibold">Cancelar</Text>
        </Pressable>
      </CameraView>
    </View>
  );
}

// ─── Main verification block ─────────────────────────────────────

export function DeliveryVerification({ requiredMethods, value, onChange }: DeliveryVerificationProps) {
  const [pinModal, setPinModal] = useState(false);
  const [signModal, setSignModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [pinDraft, setPinDraft] = useState('');

  if (requiredMethods.length === 0) return null;

  const pinDone = !!value.pin_code;
  const signDone = !!value.signature_data;
  const qrDone = !!value.qr_payload;

  return (
    <View style={glassCard} className="p-5 mb-4">
      <Text className="text-white text-base font-bold mb-1">Confirmación de Entrega</Text>
      <Text style={{ color: '#64748b' }} className="text-sm mb-4">
        {requiredMethods.length > 1 ? 'Completa los métodos requeridos' : 'Completa el método requerido'}
      </Text>

      <View className="flex-row gap-3">
        {requiredMethods.includes('pin') && (
          <Pressable style={methodButton(pinDone)} onPress={() => { setPinDraft(value.pin_code ?? ''); setPinModal(true); }}>
            <Ionicons name="keypad" size={24} color={pinDone ? '#34d399' : '#94a3b8'} />
            <Text style={{ color: pinDone ? '#34d399' : '#cbd5e1' }} className="text-sm font-semibold mt-2">
              Confirmar Código
            </Text>
          </Pressable>
        )}
        {requiredMethods.includes('signature') && (
          <Pressable style={methodButton(signDone)} onPress={() => setSignModal(true)}>
            <Ionicons name="create-outline" size={24} color={signDone ? '#34d399' : '#94a3b8'} />
            <Text style={{ color: signDone ? '#34d399' : '#cbd5e1' }} className="text-sm font-semibold mt-2">
              Firmar
            </Text>
          </Pressable>
        )}
        {requiredMethods.includes('qr') && (
          <Pressable style={methodButton(qrDone)} onPress={() => setQrModal(true)}>
            <Ionicons name="qr-code-outline" size={24} color={qrDone ? '#34d399' : '#94a3b8'} />
            <Text style={{ color: qrDone ? '#34d399' : '#cbd5e1' }} className="text-sm font-semibold mt-2">
              Escanear QR
            </Text>
          </Pressable>
        )}
      </View>

      {/* Captured states */}
      <View className="mt-3 gap-1">
        {pinDone && (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={16} color="#34d399" />
            <Text style={{ color: '#34d399' }} className="text-sm ml-1.5">Código capturado</Text>
            <Pressable onPress={() => { setPinDraft(value.pin_code ?? ''); setPinModal(true); }} className="ml-auto">
              <Text style={{ color: '#38bdf8' }} className="text-sm">Cambiar código</Text>
            </Pressable>
          </View>
        )}
        {signDone && (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={16} color="#34d399" />
            <Text style={{ color: '#34d399' }} className="text-sm ml-1.5">Firma capturada</Text>
            <Pressable onPress={() => setSignModal(true)} className="ml-auto">
              <Text style={{ color: '#38bdf8' }} className="text-sm">Volver a firmar</Text>
            </Pressable>
          </View>
        )}
        {qrDone && (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={16} color="#34d399" />
            <Text style={{ color: '#34d399' }} className="text-sm ml-1.5">QR verificado</Text>
            <Pressable onPress={() => setQrModal(true)} className="ml-auto">
              <Text style={{ color: '#38bdf8' }} className="text-sm">Volver a escanear</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── PIN modal ── */}
      <Modal visible={pinModal} transparent animationType="slide" onRequestClose={() => setPinModal(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(2,6,23,0.92)' }}>
          <View style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28 }} className="px-6 pt-6 pb-10">
            <Text className="text-white text-xl font-bold mb-1">Código de entrega</Text>
            <Text style={{ color: '#64748b' }} className="text-sm mb-4">
              Pide al cliente su código de 4 dígitos
            </Text>
            <TextInput
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderColor: 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderRadius: 16,
                fontSize: 28,
                letterSpacing: 12,
                textAlign: 'center',
              }}
              className="text-white px-4 py-4"
              placeholder="••••"
              placeholderTextColor="#475569"
              keyboardType="number-pad"
              maxLength={4}
              value={pinDraft}
              onChangeText={(t) => setPinDraft(t.replace(/[^0-9]/g, ''))}
              autoFocus
            />
            <View className="flex-row gap-3 mt-5">
              <Pressable
                onPress={() => setPinModal(false)}
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16 }}
                className="flex-1 py-4 items-center"
              >
                <Text className="text-white font-semibold">Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={pinDraft.length !== 4}
                onPress={() => { onChange({ ...value, pin_code: pinDraft }); setPinModal(false); }}
                style={{ backgroundColor: pinDraft.length === 4 ? '#059669' : 'rgba(255,255,255,0.06)', borderRadius: 16 }}
                className="flex-1 py-4 items-center"
              >
                <Text className="text-white font-bold">Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Signature modal ── */}
      <Modal visible={signModal} transparent animationType="slide" onRequestClose={() => setSignModal(false)}>
        <SignaturePad
          onDone={(data) => { onChange({ ...value, signature_data: data }); setSignModal(false); }}
          onCancel={() => setSignModal(false)}
        />
      </Modal>

      {/* ── QR modal ── */}
      <Modal visible={qrModal} animationType="slide" onRequestClose={() => setQrModal(false)}>
        <QrScanner
          onScanned={(payload) => { onChange({ ...value, qr_payload: payload }); setQrModal(false); }}
          onCancel={() => setQrModal(false)}
        />
      </Modal>
    </View>
  );
}
