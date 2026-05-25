import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useStripe } from '@stripe/stripe-react-native';
import { useCartStore } from '@/lib/cart-store';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api-client';
import {
  useCreateOrder, useBranches, useMyAddresses, useCreateAddress,
  type BranchWithStock, type SavedAddress,
} from '@/lib/queries';

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

  // Address state
  const addresses = useMyAddresses();
  const createAddress = useCreateAddress();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newStreet, setNewStreet] = useState('');
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newZipCode, setNewZipCode] = useState('');
  const [newReference, setNewReference] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

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

  // Auto-select default address when addresses load
  useEffect(() => {
    if (addresses.data?.items && !selectedAddressId) {
      const defaultAddr = addresses.data.items.find((a) => a.is_default);
      if (defaultAddr) setSelectedAddressId(defaultAddr.id);
      else if (addresses.data.items.length > 0) setSelectedAddressId(addresses.data.items[0].id);
    }
  }, [addresses.data]);

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

  const selectedAddress = addresses.data?.items?.find((a) => a.id === selectedAddressId) ?? null;
  const hasAddress = !!selectedAddress || showNewForm;
  const newFormValid = newStreet.trim().length > 3 && newCity.trim() && newState.trim() && newZipCode.trim().length >= 5;
  const canPay = fulfillmentType === 'delivery'
    ? (selectedAddress != null || (showNewForm && newFormValid))
    : !!pickupBranchId;

  async function handleSaveNewAddress() {
    if (!newFormValid) return;
    setSavingAddress(true);
    try {
      const addr = await createAddress.mutateAsync({
        label: newLabel.trim() || null,
        street: newStreet.trim(),
        neighborhood: newNeighborhood.trim() || null,
        city: newCity.trim(),
        state: newState.trim(),
        zip_code: newZipCode.trim(),
        country: 'Mexico',
        reference: newReference.trim() || null,
        is_default: (addresses.data?.items?.length ?? 0) === 0,
      });
      setSelectedAddressId(addr.id);
      setShowNewForm(false);
      // Clear form
      setNewLabel(''); setNewStreet(''); setNewNeighborhood('');
      setNewCity(''); setNewState(''); setNewZipCode(''); setNewReference('');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo guardar la direccion');
    } finally {
      setSavingAddress(false);
    }
  }

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
        if (selectedAddress) {
          orderPayload.shipping_address = {
            street: selectedAddress.street,
            neighborhood: selectedAddress.neighborhood || '',
            city: selectedAddress.city,
            state: selectedAddress.state,
            zip_code: selectedAddress.zip_code,
            country: selectedAddress.country || 'MX',
          };
        } else if (showNewForm) {
          orderPayload.shipping_address = {
            street: newStreet.trim(),
            neighborhood: newNeighborhood.trim(),
            city: newCity.trim(),
            state: newState.trim(),
            zip_code: newZipCode.trim(),
            country: 'MX',
          };
        }
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

      // Confirm payment with backend (records in DB, updates order to paid)
      await api.post(`/mobile/orders/${res.id}/confirm-payment`, {
        payment_intent_id: res.payment_intent_id,
      });

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

  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontSize: 14,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0f1a' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 140 }}>
        <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: '700', marginBottom: 20 }}>
          Metodo de entrega
        </Text>

        {/* Fulfillment type */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <TouchableOpacity
            style={{
              flex: 1, padding: 20, borderRadius: 20, borderWidth: 1,
              borderColor: fulfillmentType === 'bopis' ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
              backgroundColor: fulfillmentType === 'bopis' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)',
            }}
            onPress={() => setFulfillment('bopis')}
          >
            <Ionicons name="storefront-outline" size={28} color={fulfillmentType === 'bopis' ? '#818cf8' : 'rgba(255,255,255,0.4)'} />
            <Text style={{ marginTop: 8, fontWeight: '600', fontSize: 14, color: fulfillmentType === 'bopis' ? '#a5b4fc' : 'rgba(255,255,255,0.6)' }}>
              Recoger en tienda
            </Text>
            <Text style={{ color: '#34d399', fontSize: 12, marginTop: 4, fontWeight: '600' }}>Gratis</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1, padding: 20, borderRadius: 20, borderWidth: 1,
              borderColor: fulfillmentType === 'delivery' ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
              backgroundColor: fulfillmentType === 'delivery' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)',
            }}
            onPress={() => setFulfillment('delivery')}
          >
            <Ionicons name="car-outline" size={28} color={fulfillmentType === 'delivery' ? '#818cf8' : 'rgba(255,255,255,0.4)'} />
            <Text style={{ marginTop: 8, fontWeight: '600', fontSize: 14, color: fulfillmentType === 'delivery' ? '#a5b4fc' : 'rgba(255,255,255,0.6)' }}>
              Envio a domicilio
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>Costo segun zona</Text>
          </TouchableOpacity>
        </View>

        {/* BOPIS: Branch selection */}
        {fulfillmentType === 'bopis' && (
          <Animated.View entering={FadeIn.duration(250)} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#f8fafc', fontWeight: '600', marginBottom: 12, fontSize: 15 }}>Sucursal de recoleccion</Text>
            {userLocation && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="location" size={14} color="#34d399" />
                <Text style={{ color: '#34d399', fontSize: 12, marginLeft: 4 }}>Ordenadas por cercania a tu ubicacion</Text>
              </View>
            )}
            {branches.isLoading ? (
              <ActivityIndicator color="#6366f1" />
            ) : sortedBranches.length === 0 ? (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 16, padding: 16 }}>
                <Text style={{ color: '#f87171', fontSize: 13 }}>
                  No hay sucursales con stock disponible para todos los articulos de tu carrito.
                </Text>
              </View>
            ) : (
              sortedBranches.map((branch) => {
                const dist = formatDistance(branch);
                const isSelected = pickupBranchId === branch.id;
                return (
                  <TouchableOpacity
                    key={branch.id}
                    style={{
                      padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1,
                      borderColor: isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                      backgroundColor: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)',
                      flexDirection: 'row', alignItems: 'center',
                    }}
                    onPress={() => setFulfillment('bopis', branch.id)}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: isSelected ? '#6366f1' : 'rgba(255,255,255,0.08)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={isSelected ? 'checkmark' : 'storefront'} size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: '#f8fafc', fontWeight: '500', fontSize: 14 }}>{branch.name}</Text>
                      {branch.address && (
                        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{branch.address}</Text>
                      )}
                    </View>
                    {dist && (
                      <View style={{ backgroundColor: 'rgba(99,102,241,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ color: '#a5b4fc', fontSize: 12, fontWeight: '600' }}>{dist}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </Animated.View>
        )}

        {/* Delivery: Saved addresses + new address form */}
        {fulfillmentType === 'delivery' && (
          <Animated.View entering={SlideInDown.duration(300)} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#f8fafc', fontWeight: '600', marginBottom: 12, fontSize: 15 }}>Direccion de envio</Text>

            {/* Loading state */}
            {addresses.isLoading && <ActivityIndicator color="#6366f1" style={{ marginBottom: 12 }} />}

            {/* Saved addresses list */}
            {(addresses.data?.items ?? []).length > 0 && !showNewForm && (
              <View style={{ marginBottom: 12 }}>
                {addresses.data!.items.map((addr) => {
                  const isSelected = selectedAddressId === addr.id;
                  return (
                    <Pressable
                      key={addr.id}
                      style={{
                        padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1,
                        borderColor: isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                        backgroundColor: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)',
                        flexDirection: 'row', alignItems: 'center',
                      }}
                      onPress={() => setSelectedAddressId(addr.id)}
                    >
                      <View style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: isSelected ? '#6366f1' : 'rgba(255,255,255,0.08)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons
                          name={isSelected ? 'checkmark' : 'location-outline'}
                          size={16}
                          color={isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)'}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        {addr.label && (
                          <Text style={{ color: '#a5b4fc', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                            {addr.label}
                          </Text>
                        )}
                        <Text style={{ color: '#f8fafc', fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
                          {addr.street}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                          {[addr.neighborhood, addr.city, addr.state, addr.zip_code].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                      {addr.is_default && (
                        <View style={{ backgroundColor: 'rgba(52,211,153,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <Text style={{ color: '#34d399', fontSize: 10, fontWeight: '600' }}>Default</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Add new address button */}
            {!showNewForm && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  padding: 14, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed',
                  borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.06)',
                  marginBottom: 4,
                }}
                onPress={() => { setShowNewForm(true); setSelectedAddressId(null); }}
              >
                <Ionicons name="add-circle-outline" size={18} color="#818cf8" />
                <Text style={{ color: '#818cf8', fontWeight: '600', fontSize: 14, marginLeft: 8 }}>
                  Agregar nueva direccion
                </Text>
              </TouchableOpacity>
            )}

            {/* New address form */}
            {showNewForm && (
              <Animated.View entering={FadeIn.duration(200)} style={{
                backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20,
                borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)', padding: 16,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <Text style={{ color: '#a5b4fc', fontWeight: '700', fontSize: 14 }}>Nueva direccion</Text>
                  <TouchableOpacity onPress={() => {
                    setShowNewForm(false);
                    // Re-select first saved address if available
                    const firstAddr = addresses.data?.items?.[0];
                    if (firstAddr) setSelectedAddressId(firstAddr.id);
                  }}>
                    <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.35)" />
                  </TouchableOpacity>
                </View>

                <TextInput style={[inputStyle, { marginBottom: 10 }]} placeholder="Etiqueta (ej. Casa, Oficina)" placeholderTextColor="rgba(255,255,255,0.3)" value={newLabel} onChangeText={setNewLabel} />
                <TextInput style={[inputStyle, { marginBottom: 10 }]} placeholder="Calle y numero *" placeholderTextColor="rgba(255,255,255,0.3)" value={newStreet} onChangeText={setNewStreet} />
                <TextInput style={[inputStyle, { marginBottom: 10 }]} placeholder="Colonia" placeholderTextColor="rgba(255,255,255,0.3)" value={newNeighborhood} onChangeText={setNewNeighborhood} />
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Ciudad *" placeholderTextColor="rgba(255,255,255,0.3)" value={newCity} onChangeText={setNewCity} />
                  <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Estado *" placeholderTextColor="rgba(255,255,255,0.3)" value={newState} onChangeText={setNewState} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <TextInput style={[inputStyle, { flex: 1 }]} placeholder="C.P. *" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="number-pad" maxLength={5} value={newZipCode} onChangeText={setNewZipCode} />
                  <TextInput style={[inputStyle, { flex: 2 }]} placeholder="Referencia" placeholderTextColor="rgba(255,255,255,0.3)" value={newReference} onChangeText={setNewReference} />
                </View>

                <TouchableOpacity
                  style={{
                    height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'row',
                    backgroundColor: newFormValid ? '#6366f1' : 'rgba(255,255,255,0.06)',
                    marginTop: 4,
                  }}
                  onPress={handleSaveNewAddress}
                  disabled={!newFormValid || savingAddress}
                >
                  {savingAddress ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={16} color={newFormValid ? '#ffffff' : 'rgba(255,255,255,0.3)'} />
                      <Text style={{ color: newFormValid ? '#ffffff' : 'rgba(255,255,255,0.3)', fontWeight: '600', fontSize: 14, marginLeft: 6 }}>
                        Guardar direccion
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* Order summary */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 24, padding: 20, marginBottom: 16 }}>
          <Text style={{ color: '#f8fafc', fontWeight: '600', marginBottom: 14, fontSize: 15 }}>Resumen del pedido</Text>
          {items.map((item) => {
            const attrs = Object.values(item.attributes).join(' · ');
            return (
              <View key={item.variant_id} style={{ flexDirection: 'row', marginBottom: 12, alignItems: 'center' }}>
                {/* Product image */}
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="footsteps-outline" size={18} color="rgba(255,255,255,0.15)" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{item.product_name}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{attrs} x{item.quantity}</Text>
                </View>
                <Text style={{ color: '#818cf8', fontSize: 13, fontWeight: '700' }}>
                  ${(item.unit_price * item.quantity).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            );
          })}
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 16 }}>Total</Text>
            <Text style={{ color: '#f8fafc', fontWeight: '900', fontSize: 20 }}>
              ${total().toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 16, padding: 14, marginBottom: 8 }}>
          <Ionicons name="shield-checkmark" size={18} color="#818cf8" />
          <Text style={{ color: '#a5b4fc', fontSize: 12, marginLeft: 8, flex: 1 }}>
            Pago seguro procesado por Stripe. Tu informacion esta protegida.
          </Text>
        </View>
      </ScrollView>

      {/* Floating pay button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(12, 15, 26, 0.95)',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32,
      }}>
        <TouchableOpacity
          style={{
            height: 56, borderRadius: 16, overflow: 'hidden',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          }}
          onPress={handlePay}
          disabled={loading || !canPay}
          activeOpacity={0.8}
        >
          {canPay && !loading ? (
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 16 }}
            />
          ) : (
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          )}
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color={canPay ? '#ffffff' : 'rgba(255,255,255,0.35)'} />
              <Text style={{ color: canPay ? '#ffffff' : 'rgba(255,255,255,0.35)', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                Pagar ${total().toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
