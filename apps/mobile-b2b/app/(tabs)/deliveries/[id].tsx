import { useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  TextInput,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useOrderDetail, useDeliverOrder } from '../../../src/hooks/use-deliveries';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDER_PADDING = 48;
const THUMB_SIZE = 64;
const TRACK_WIDTH = SCREEN_WIDTH - SLIDER_PADDING * 2;
const SLIDE_THRESHOLD = TRACK_WIDTH - THUMB_SIZE - 16;

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading } = useOrderDetail(id);
  const deliverMutation = useDeliverOrder();

  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);
  const deliveredRef = useRef(false);

  const translateX = useSharedValue(0);

  const handleDeliver = async () => {
    if (deliveredRef.current) return;
    deliveredRef.current = true;
    setIsDelivering(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Ubicación requerida',
          'Necesitamos tu ubicación GPS para confirmar la entrega. Activa el permiso en Configuración.',
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
      Alert.alert('Error GPS', 'No se pudo obtener tu ubicación. Intenta de nuevo.');
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
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
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
      <View className="flex-1 bg-slate-950 px-6 pt-4">
        {/* Order info */}
        <View className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4">
          <Text className="text-white text-xl font-bold mb-1">
            Pedido #{order.order_number}
          </Text>
          {order.customer_name && (
            <Text className="text-slate-400 text-base">{order.customer_name}</Text>
          )}
          <View className="flex-row items-center mt-3">
            <Text className="text-emerald-400 text-2xl font-bold">
              ${order.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Delivery address */}
        {address && (
          <View className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4">
            <View className="flex-row items-center mb-3">
              <Ionicons name="navigate-circle" size={22} color="#818cf8" />
              <Text className="text-brand-light font-bold text-base ml-2">
                Dirección de Entrega
              </Text>
            </View>
            <Text className="text-white text-base">{address.street}</Text>
            {address.city && (
              <Text className="text-slate-400 text-sm mt-1">
                {[address.city, address.state, address.zip_code].filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
        )}

        {/* Recipient / Notes */}
        <View className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
          <Text className="text-slate-400 text-sm mb-2">Nombre de quien recibe (opcional)</Text>
          <TextInput
            className="bg-slate-800 text-white text-base px-4 py-3 rounded-xl mb-3"
            placeholder="Juan Pérez"
            placeholderTextColor="#475569"
            value={recipientName}
            onChangeText={setRecipientName}
          />
          <Text className="text-slate-400 text-sm mb-2">Notas (opcional)</Text>
          <TextInput
            className="bg-slate-800 text-white text-base px-4 py-3 rounded-xl"
            placeholder="Ej: Se dejó con el vecino"
            placeholderTextColor="#475569"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* Swipe to deliver */}
        <View className="mb-10">
          {isDelivering ? (
            <View className="bg-emerald-600 rounded-2xl py-5 items-center flex-row justify-center">
              <ActivityIndicator color="#ffffff" />
              <Text className="text-white text-lg font-bold ml-3">Confirmando entrega...</Text>
            </View>
          ) : (
            <View className="bg-slate-800 rounded-2xl h-[72px] justify-center overflow-hidden">
              <Animated.Text
                className="text-slate-500 text-base font-semibold text-center absolute w-full"
                style={labelOpacity}
              >
                Desliza para confirmar entrega →
              </Animated.Text>
              <GestureDetector gesture={panGesture}>
                <Animated.View
                  className="w-16 h-16 bg-emerald-600 rounded-xl items-center justify-center ml-1"
                  style={thumbStyle}
                >
                  <Ionicons name="checkmark-done" size={28} color="#ffffff" />
                </Animated.View>
              </GestureDetector>
            </View>
          )}
          <Text className="text-slate-600 text-xs text-center mt-3">
            Se capturará tu ubicación GPS automáticamente
          </Text>
        </View>
      </View>
    </>
  );
}
