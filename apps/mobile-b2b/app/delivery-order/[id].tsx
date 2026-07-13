import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  TextInput,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useOrderDetail, useDeliverOrder, useTrackLocation, useDeliveryRequirements } from '../../src/hooks/use-deliveries';
import { DeliveryVerification, type VerificationState } from '../../src/components/DeliveryVerification';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDER_PADDING = 48;
const THUMB_SIZE = 64;
const TRACK_WIDTH = SCREEN_WIDTH - SLIDER_PADDING * 2;
const SLIDE_THRESHOLD = TRACK_WIDTH - THUMB_SIZE - 16;

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading } = useOrderDetail(id);
  const { data: requirements } = useDeliveryRequirements(id);
  const deliverMutation = useDeliverOrder();

  const trackMutation = useTrackLocation();

  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [verification, setVerification] = useState<VerificationState>({});
  const [isDelivering, setIsDelivering] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const deliveredRef = useRef(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentRef = useRef(0);

  const pulseOpacity = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (order?.status !== 'out_for_delivery') return;

    let cancelled = false;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      setIsTracking(true);
      pulseOpacity.value = withRepeat(withTiming(0.3, { duration: 1000 }), -1, true);

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 15_000 },
        (loc) => {
          const now = Date.now();
          if (now - lastSentRef.current < 14_000) return;
          lastSentRef.current = now;
          trackMutation.mutate({
            orderId: id,
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        },
      );
    };

    startTracking();

    return () => {
      cancelled = true;
      watchRef.current?.remove();
      setIsTracking(false);
    };
  }, [order?.status, id]);

  const requiredMethods = requirements?.required_methods ?? [];
  const verificationComplete =
    (!requiredMethods.includes('pin') || !!verification.pin_code) &&
    (!requiredMethods.includes('signature') || !!verification.signature_data) &&
    (!requiredMethods.includes('qr') || !!verification.qr_payload);

  const handleDeliver = async () => {
    if (deliveredRef.current) return;
    if (!verificationComplete) {
      translateX.value = withSpring(0);
      Alert.alert('Verificación pendiente', 'Completa los métodos de confirmación requeridos antes de entregar.');
      return;
    }
    deliveredRef.current = true;
    setIsDelivering(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Ubicacion requerida',
          'Necesitamos tu ubicacion GPS para confirmar la entrega. Activa el permiso en Configuracion.',
        );
        setIsDelivering(false);
        deliveredRef.current = false;
        translateX.value = withSpring(0);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      deliverMutation.mutate(
        {
          orderId: id,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          recipient_name: recipientName.trim() || undefined,
          notes: notes.trim() || undefined,
          pin_code: verification.pin_code,
          signature_data: verification.signature_data,
          qr_payload: verification.qr_payload,
        },
        {
          onSuccess: () => {
            router.back();
          },
          onError: () => {
            setIsDelivering(false);
            deliveredRef.current = false;
            translateX.value = withSpring(0);
          },
        },
      );
    } catch {
      Alert.alert('Error GPS', 'No se pudo obtener tu ubicacion. Intenta de nuevo.');
      setIsDelivering(false);
      deliveredRef.current = false;
      translateX.value = withSpring(0);
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const clamped = Math.max(0, Math.min(e.translationX, SLIDE_THRESHOLD));
      translateX.value = clamped;
    })
    .onEnd(() => {
      if (translateX.value >= SLIDE_THRESHOLD * 0.85) {
        translateX.value = withSpring(SLIDE_THRESHOLD);
        runOnJS(handleDeliver)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const labelOpacity = useAnimatedStyle(() => ({
    opacity: 1 - translateX.value / SLIDE_THRESHOLD,
  }));

  if (isLoading || !order) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#020617' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  const address = order.shipping_address;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: `Pedido #${order.order_number}`,
          headerStyle: { backgroundColor: '#020617' },
          headerTintColor: '#f8fafc',
        }}
      />
      <View className="flex-1" style={{ backgroundColor: '#020617' }}>
        <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Order info glass card */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 24 }} className="p-5 mb-4">
          <Text className="text-white text-xl font-bold mb-1">
            Pedido #{order.order_number}
          </Text>
          {order.customer_name && (
            <Text style={{ color: '#64748b' }} className="text-base">{order.customer_name}</Text>
          )}
          {/* El costo del pedido no se muestra al repartidor */}
        </View>

        {/* Delivery address glass card */}
        {address && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 24 }} className="p-5 mb-4">
            <View className="flex-row items-center mb-3">
              <Ionicons name="navigate-circle" size={22} color="#22d3ee" />
              <Text style={{ color: '#22d3ee' }} className="font-bold text-base ml-2">
                Direccion de Entrega
              </Text>
            </View>
            <Text className="text-white text-base">{address.street}</Text>
            {address.city && (
              <Text style={{ color: '#64748b' }} className="text-sm mt-1">
                {[address.city, address.state, address.zip_code].filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
        )}

        {/* GPS Tracking indicator */}
        {isTracking && (
          <View style={{ backgroundColor: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.20)', borderWidth: 1, borderRadius: 20 }} className="px-5 py-3 mb-4 flex-row items-center">
            <Animated.View style={pulseStyle}>
              <View style={{ width: 12, height: 12, backgroundColor: '#34d399', borderRadius: 6, marginRight: 12 }} />
            </Animated.View>
            <Text style={{ color: '#34d399' }} className="text-sm font-semibold">
              Rastreando ubicacion GPS...
            </Text>
          </View>
        )}

        {/* Recipient / Notes glass card */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 24 }} className="p-5 mb-6">
          <Text style={{ color: '#64748b' }} className="text-sm mb-2">Nombre de quien recibe (opcional)</Text>
          <TextInput
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderRadius: 16 }}
            className="text-white text-base px-4 py-3 mb-3"
            placeholder="Juan Perez"
            placeholderTextColor="#475569"
            value={recipientName}
            onChangeText={setRecipientName}
          />
          <Text style={{ color: '#64748b' }} className="text-sm mb-2">Notas (opcional)</Text>
          <TextInput
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderRadius: 16 }}
            className="text-white text-base px-4 py-3"
            placeholder="Ej: Se dejo con el vecino"
            placeholderTextColor="#475569"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Verificación de entrega (PIN / firma / QR según settings del tenant) */}
        <DeliveryVerification
          requiredMethods={requirements?.required_methods ?? []}
          value={verification}
          onChange={setVerification}
        />

        </ScrollView>

        {/* Swipe to deliver */}
        <View className="mb-10 px-6">
          {isDelivering ? (
            <View style={{ backgroundColor: '#059669', borderRadius: 20 }} className="py-5 items-center flex-row justify-center">
              <ActivityIndicator color="#ffffff" />
              <Text className="text-white text-lg font-bold ml-3">Confirmando entrega...</Text>
            </View>
          ) : !verificationComplete ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 20, height: 72 }} className="flex-row items-center justify-center">
              <Ionicons name="lock-closed" size={18} color="#64748b" />
              <Text className="text-slate-500 text-base font-semibold ml-2">
                Completa la verificación para entregar
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 20, height: 72 }} className="justify-center overflow-hidden">
              <Animated.Text
                className="text-slate-500 text-base font-semibold text-center absolute w-full"
                style={labelOpacity}
              >
                Desliza para confirmar entrega
              </Animated.Text>
              <GestureDetector gesture={panGesture}>
                <Animated.View
                  style={[thumbStyle, { width: 64, height: 64, backgroundColor: '#059669', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }]}
                >
                  <Ionicons name="checkmark-done" size={28} color="#ffffff" />
                </Animated.View>
              </GestureDetector>
            </View>
          )}
          <Text className="text-slate-600 text-xs text-center mt-3">
            Se capturara tu ubicacion GPS automaticamente
          </Text>
        </View>
      </View>
    </>
  );
}
