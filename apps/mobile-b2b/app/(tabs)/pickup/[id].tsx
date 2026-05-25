import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TextInput,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useScanPickupQR, useConfirmPickup, type PickupOrder } from '../../../src/hooks/use-pickup';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDER_PADDING = 48;
const THUMB_SIZE = 64;
const TRACK_WIDTH = SCREEN_WIDTH - SLIDER_PADDING * 2;
const SLIDE_THRESHOLD = TRACK_WIDTH - THUMB_SIZE - 16;

export default function PickupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scanQuery = useScanPickupQR();
  const confirmMutation = useConfirmPickup();

  const [order, setOrder] = useState<PickupOrder | null>(null);
  const [canPickup, setCanPickup] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const confirmedRef = useRef(false);

  const translateX = useSharedValue(0);
  const successScale = useSharedValue(0);
  const successOpacity = useSharedValue(0);

  // Load order data on mount
  useEffect(() => {
    if (!id) return;
    scanQuery.mutate(id, {
      onSuccess: (result: any) => {
        setOrder({
          ...result,
          customer_name: result.customer?.name,
          items: (result.items || []).map((it: any) => ({
            variant_name: it.variant?.product?.name || 'Producto',
            size: it.variant?.size_mex || it.variant?.sku || '-',
            quantity: it.quantity,
          })),
        });
        setCanPickup(result.pickup_info?.can_pickup ?? result.qr_valid ?? false);
      },
    });
  }, [id]);

  const handleConfirm = async () => {
    if (confirmedRef.current || !order) return;
    confirmedRef.current = true;
    setIsConfirming(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    confirmMutation.mutate(
      {
        orderId: id,
        recipient_name: recipientName.trim() || undefined,
      },
      {
        onSuccess: () => {
          setIsSuccess(true);
          successOpacity.value = withTiming(1, { duration: 300 });
          successScale.value = withSequence(
            withSpring(1.2),
            withSpring(1),
          );
          setTimeout(() => {
            router.back();
          }, 2000);
        },
        onError: () => {
          setIsConfirming(false);
          confirmedRef.current = false;
          translateX.value = withSpring(0);
        },
      },
    );
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (!canPickup) return;
      const clamped = Math.max(0, Math.min(e.translationX, SLIDE_THRESHOLD));
      translateX.value = clamped;
    })
    .onEnd(() => {
      if (!canPickup) return;
      if (translateX.value >= SLIDE_THRESHOLD * 0.85) {
        translateX.value = withSpring(SLIDE_THRESHOLD);
        runOnJS(handleConfirm)();
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

  const successAnimStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ scale: successScale.value }],
  }));

  // Loading state
  if (scanQuery.isPending || !order) {
    return (
      <>
        <Stack.Screen
          options={{
            headerTitle: 'Cargando...',
            headerStyle: { backgroundColor: '#020617' },
            headerTintColor: '#f8fafc',
          }}
        />
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#020617' }}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      </>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <>
        <Stack.Screen
          options={{
            headerTitle: 'Entrega Confirmada',
            headerStyle: { backgroundColor: '#020617' },
            headerTintColor: '#f8fafc',
            headerBackVisible: false,
          }}
        />
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#020617' }}>
          <Animated.View style={successAnimStyle} className="items-center">
            <View style={{ width: 112, height: 112, backgroundColor: '#059669', borderRadius: 56 }} className="items-center justify-center mb-6">
              <Ionicons name="checkmark" size={56} color="#ffffff" />
            </View>
            <Text className="text-white text-2xl font-bold text-center">
              Entrega Confirmada
            </Text>
            <Text style={{ color: '#64748b' }} className="text-base text-center mt-3">
              El pedido #{order.order_number} ha sido entregado al cliente.
            </Text>
          </Animated.View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: `Pedido #${order.order_number}`,
          headerStyle: { backgroundColor: '#020617' },
          headerTintColor: '#f8fafc',
        }}
      />
      <ScrollView className="flex-1" style={{ backgroundColor: '#020617' }} contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        {/* Status badge */}
        {canPickup ? (
          <View style={{ backgroundColor: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.25)', borderWidth: 1, borderRadius: 20 }} className="px-5 py-4 mb-4 flex-row items-center">
            <Ionicons name="checkmark-circle" size={24} color="#34d399" />
            <Text style={{ color: '#34d399' }} className="text-base font-bold ml-3">
              Listo para Entrega
            </Text>
          </View>
        ) : (
          <View style={{ backgroundColor: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.25)', borderWidth: 1, borderRadius: 20 }} className="px-5 py-4 mb-4">
            <View className="flex-row items-center">
              <Ionicons name="alert-circle" size={24} color="#fbbf24" />
              <Text style={{ color: '#fbbf24' }} className="text-base font-bold ml-3">
                No Disponible
              </Text>
            </View>
            {scanQuery.data?.message && (
              <Text style={{ color: 'rgba(251,191,36,0.7)' }} className="text-sm mt-2 ml-9">
                {scanQuery.data.message}
              </Text>
            )}
          </View>
        )}

        {/* Order info glass card */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 24 }} className="p-5 mb-4">
          <Text className="text-white text-2xl font-bold mb-1">
            ORD-{String(order.order_number).padStart(5, '0')}
          </Text>

          {order.customer_name && (
            <View className="flex-row items-center mt-3">
              <Ionicons name="person-outline" size={18} color="#64748b" />
              <Text style={{ color: '#64748b' }} className="text-base ml-2">
                {order.customer_name}
              </Text>
            </View>
          )}

          {/* Items list */}
          {order.items && order.items.length > 0 && (
            <View className="mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
              <Text className="text-slate-500 text-sm font-semibold mb-3 uppercase tracking-wide">
                Articulos
              </Text>
              {order.items.map((item, index) => (
                <View
                  key={index}
                  className="flex-row items-center justify-between py-2"
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-white text-base">{item.variant_name}</Text>
                    <Text className="text-slate-500 text-sm">Talla: {item.size}</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10 }} className="px-3 py-1">
                    <Text className="text-slate-300 text-sm font-semibold">
                      x{item.quantity}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Total */}
          <View className="mt-4 pt-4 flex-row items-center justify-between" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
            <Text className="text-slate-500 text-sm font-semibold">Total</Text>
            <Text style={{ color: '#34d399' }} className="text-xl font-bold">
              ${Number(order.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Pickup location glass card */}
        {order.pickup_location && (
          <View style={{ backgroundColor: 'rgba(14,165,233,0.08)', borderColor: 'rgba(14,165,233,0.20)', borderWidth: 1, borderRadius: 24 }} className="p-5 mb-4">
            <View className="flex-row items-center mb-3">
              <Ionicons name="location" size={22} color="#22d3ee" />
              <Text style={{ color: '#22d3ee' }} className="font-bold text-base ml-2">
                Ubicacion del Pedido
              </Text>
            </View>
            <Text className="text-white text-xl font-bold leading-7">
              {order.pickup_location}
            </Text>
          </View>
        )}

        {/* Recipient name input */}
        {canPickup && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 24 }} className="p-5 mb-6">
            <Text style={{ color: '#64748b' }} className="text-sm mb-2">
              Nombre de quien recoge (opcional)
            </Text>
            <TextInput
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderRadius: 16 }}
              className="text-white text-base px-4 py-3"
              placeholder="Nombre del cliente"
              placeholderTextColor="#475569"
              value={recipientName}
              onChangeText={setRecipientName}
            />
          </View>
        )}

        {/* Swipe to confirm */}
        {canPickup && (
          <View className="mt-2">
            {isConfirming ? (
              <View style={{ backgroundColor: '#059669', borderRadius: 20 }} className="py-5 items-center flex-row justify-center">
                <ActivityIndicator color="#ffffff" />
                <Text className="text-white text-lg font-bold ml-3">
                  Confirmando entrega...
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
              Se confirmara la entrega del pedido al cliente
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}
