import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useStripe } from '@stripe/stripe-react-native';
import { useCartStore } from '@/lib/cart-store';
import { useAuthStore } from '@/lib/auth-store';
import { useCreateOrder, useBranches, type BranchWithStock } from '@/lib/queries';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CheckoutScreen() {
  const stripe = useStripe();
  const { items, total, fulfillmentType, pickupBranchId, setFulfillment, clear } = useCartStore();
  const user = useAuthStore((s) => s.user);
  const createOrder = useCreateOrder();
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');

  const variantIds = items.map((i) => i.variant_id);
  const branches = useBranches(variantIds);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
  }, []);

  const sortedBranches = useMemo(() => {
    const raw = (branches.data ?? []).filter((b) => b.has_stock);
    if (!userLocation) {
      return raw.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
    }
    return raw
      .map((b) => ({
        ...b,
        local_distance: b.latitude != null && b.longitude != null
          ? haversineKm(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
          : b.distance_km ?? 9999,
      }))
      .sort((a, b) => a.local_distance - b.local_distance);
  }, [branches.data, userLocation]);

  const addressValid = street.trim().length > 3 && city.trim() && state.trim() && zipCode.trim().length >= 5;
  const canPay = fulfillmentType === 'delivery' ? addressValid : !!pickupBranchId;

  async function handlePay() {
    if (!user) return;
    setLoading(true);

    try {
      const orderPayload: any = {
        customer_id: user.customer_id,
        fulfillment_type: fulfillmentType,
        items: items.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      };

      if (fulfillmentType === 'bopis' && pickupBranchId) {
        orderPayload.pickup_branch_id = pickupBranchId;
      }
      if (fulfillmentType === 'delivery') {
        orderPayload.shipping_address = {
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          zip_code: zipCode.trim(),
          country: 'MX',
        };
      }

      const res = await createOrder.mutateAsync(orderPayload);

      const { error } = await stripe.initPaymentSheet({
        paymentIntentClientSecret: res.client_secret,
        merchantDisplayName: 'Nivo',
        style: 'alwaysDark',
        defaultBillingDetails: { name: user.name, email: user.email },
      });

      if (error) {
        Alert.alert('Error de pago', error.message);
        setLoading(false);
        return;
      }

      const { error: presentError } = await stripe.presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Pago fallido', presentError.message);
        }
        setLoading(false);
        return;
      }

      clear();
      router.replace(`/order/${res.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo crear el pedido');
    } finally {
      setLoading(false);
    }
  }

  function formatDistance(branch: typeof sortedBranches[0]): string | null {
    const d = 'local_distance' in branch ? (branch as any).local_distance : branch.distance_km;
    if (d == null) return null;
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  }

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 140 }}>
        <Text className="text-white text-xl font-bold mb-5">Método de entrega</Text>

        {/* Fulfillment type */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            className={`flex-1 p-5 rounded-2xl border ${
              fulfillmentType === 'bopis'
                ? 'border-brand-500 bg-brand-500/15'
                : 'border-slate-700 bg-surface-card'
            }`}
            onPress={() => setFulfillment('bopis')}
          >
            <Ionicons name="storefront-outline" size={28} color={fulfillmentType === 'bopis' ? '#818cf8' : '#64748b'} />
            <Text className={`mt-2 font-semibold ${fulfillmentType === 'bopis' ? 'text-brand-100' : 'text-slate-300'}`}>
              Recoger en tienda
            </Text>
            <Text className="text-emerald-400 text-xs mt-1 font-medium">Gratis</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 p-5 rounded-2xl border ${
              fulfillmentType === 'delivery'
                ? 'border-brand-500 bg-brand-500/15'
                : 'border-slate-700 bg-surface-card'
            }`}
            onPress={() => setFulfillment('delivery')}
          >
            <Ionicons name="car-outline" size={28} color={fulfillmentType === 'delivery' ? '#818cf8' : '#64748b'} />
            <Text className={`mt-2 font-semibold ${fulfillmentType === 'delivery' ? 'text-brand-100' : 'text-slate-300'}`}>
              Envío a domicilio
            </Text>
            <Text className="text-slate-500 text-xs mt-1">Costo según zona</Text>
          </TouchableOpacity>
        </View>

        {/* BOPIS: Branch selection with Haversine */}
        {fulfillmentType === 'bopis' && (
          <Animated.View entering={FadeIn.duration(250)} className="mb-6">
            <Text className="text-white font-semibold mb-3">Sucursal de recolección</Text>
            {userLocation && (
              <View className="flex-row items-center mb-3">
                <Ionicons name="location" size={14} color="#34d399" />
                <Text className="text-emerald-400 text-xs ml-1">Ordenadas por cercanía a tu ubicación</Text>
              </View>
            )}
            {branches.isLoading ? (
              <ActivityIndicator color="#6366f1" />
            ) : sortedBranches.length === 0 ? (
              <View className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <Text className="text-red-300 text-sm">
                  No hay sucursales con stock disponible para todos los artículos de tu carrito.
                </Text>
              </View>
            ) : (
              sortedBranches.map((branch) => {
                const dist = formatDistance(branch);
                const isSelected = pickupBranchId === branch.id;
                return (
                  <TouchableOpacity
                    key={branch.id}
                    className={`p-4 rounded-xl mb-2.5 border flex-row items-center ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/15'
                        : 'border-slate-700 bg-surface-card'
                    }`}
                    onPress={() => setFulfillment('bopis', branch.id)}
                  >
                    <View className={`w-10 h-10 rounded-full items-center justify-center ${isSelected ? 'bg-brand-500' : 'bg-slate-700'}`}>
                      <Ionicons name={isSelected ? 'checkmark' : 'storefront'} size={18} color="#ffffff" />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-white font-medium">{branch.name}</Text>
                      {branch.address && (
                        <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>{branch.address}</Text>
                      )}
                    </View>
                    {dist && (
                      <View className="bg-brand-500/20 px-2.5 py-1 rounded-lg">
                        <Text className="text-brand-100 text-xs font-medium">{dist}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </Animated.View>
        )}

        {/* Delivery: Address form */}
        {fulfillmentType === 'delivery' && (
          <Animated.View entering={SlideInDown.duration(300)} className="mb-6">
            <Text className="text-white font-semibold mb-3">Dirección de envío</Text>
            <TextInput
              className="bg-surface-card text-white rounded-xl px-4 py-3.5 mb-3 border border-slate-700"
              placeholder="Calle y número"
              placeholderTextColor="#475569"
              value={street}
              onChangeText={setStreet}
            />
            <View className="flex-row gap-3 mb-3">
              <TextInput
                className="flex-1 bg-surface-card text-white rounded-xl px-4 py-3.5 border border-slate-700"
                placeholder="Ciudad"
                placeholderTextColor="#475569"
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                className="flex-1 bg-surface-card text-white rounded-xl px-4 py-3.5 border border-slate-700"
                placeholder="Estado"
                placeholderTextColor="#475569"
                value={state}
                onChangeText={setState}
              />
            </View>
            <TextInput
              className="bg-surface-card text-white rounded-xl px-4 py-3.5 border border-slate-700"
              placeholder="Código postal"
              placeholderTextColor="#475569"
              keyboardType="number-pad"
              maxLength={5}
              value={zipCode}
              onChangeText={setZipCode}
            />
          </Animated.View>
        )}

        {/* Order summary */}
        <View className="bg-surface-card rounded-2xl p-5 mb-4">
          <Text className="text-white font-semibold mb-3">Resumen del pedido</Text>
          {items.map((item) => {
            const attrs = Object.values(item.attributes).join(' · ');
            return (
              <View key={item.variant_id} className="flex-row justify-between mb-2">
                <View className="flex-1 mr-3">
                  <Text className="text-slate-300 text-sm" numberOfLines={1}>{item.product_name}</Text>
                  <Text className="text-slate-500 text-xs">{attrs} × {item.quantity}</Text>
                </View>
                <Text className="text-slate-200 text-sm font-medium">
                  ${(item.unit_price * item.quantity).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            );
          })}
          <View className="h-px bg-slate-700 my-3" />
          <View className="flex-row justify-between">
            <Text className="text-white font-bold text-lg">Total</Text>
            <Text className="text-white font-bold text-xl">
              ${total().toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center bg-brand-500/10 rounded-xl p-3 mb-2">
          <Ionicons name="shield-checkmark" size={18} color="#818cf8" />
          <Text className="text-brand-100 text-xs ml-2 flex-1">
            Pago seguro procesado por Stripe. Tu información está protegida.
          </Text>
        </View>
      </ScrollView>

      {/* Floating pay button */}
      <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-slate-800 px-5 pt-4 pb-8">
        <TouchableOpacity
          className={`rounded-2xl py-4.5 items-center flex-row justify-center ${canPay && !loading ? 'bg-brand-500' : 'bg-slate-700'}`}
          onPress={handlePay}
          disabled={loading || !canPay}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color="#ffffff" />
              <Text className="text-white font-bold text-base ml-2">
                Pagar ${total().toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
