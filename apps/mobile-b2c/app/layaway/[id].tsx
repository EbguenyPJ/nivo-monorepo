import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useStripe } from '@stripe/stripe-react-native';
import { useAuthStore } from '@/lib/auth-store';
import { useLayawayDetail, useLayawayPayment } from '@/lib/queries';
import { api } from '@/lib/api-client';

export default function LayawayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: layaway, isLoading, refetch } = useLayawayDetail(id);
  const payMutation = useLayawayPayment();
  const stripe = useStripe();
  const user = useAuthStore((s) => s.user);

  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  if (isLoading || !layaway) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0c0f1a' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const balanceDue = Number(layaway.balance_due) || 0;
  const totalAmount = Number(layaway.total_amount) || 0;
  const isActive = layaway.status === 'active';
  const progress = totalAmount > 0 ? ((totalAmount - balanceDue) / totalAmount) * 100 : 0;

  async function handlePay() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0 || amount > balanceDue) {
      Alert.alert('Error', 'Ingresa un monto valido');
      return;
    }

    setPaying(true);
    try {
      // Step 1: Create PaymentIntent on the backend
      const res = await payMutation.mutateAsync({
        layaway_id: id,
        amount,
        stripe_payment_method_id: '', // not needed anymore, backend creates PI
      });

      // Step 2: Present Stripe PaymentSheet
      const { error: initError } = await stripe.initPaymentSheet({
        paymentIntentClientSecret: res.client_secret,
        merchantDisplayName: 'Nivo',
        style: 'alwaysDark',
        defaultBillingDetails: {
          name: user?.name,
          email: user?.email,
        },
      });

      if (initError) {
        Alert.alert('Error', initError.message);
        setPaying(false);
        return;
      }

      const { error: presentError } = await stripe.presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Pago fallido', presentError.message);
        }
        setPaying(false);
        return;
      }

      // Step 3: Confirm payment on the backend (records in DB)
      await api.post('/mobile/layaways/confirm-payment', {
        layaway_id: id,
        payment_intent_id: (res as any).payment_intent_id,
        amount,
      });

      Alert.alert(
        'Pago exitoso',
        `Se aplico un abono de $${amount.toFixed(2)} con tarjeta`,
      );
      setPayAmount('');
      refetch();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo procesar el pago');
    } finally {
      setPaying(false);
    }
  }

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: '#0c0f1a' }} contentContainerClassName="px-5 pt-4 pb-12">
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', marginBottom: 24 }}>
        {(layaway as any).first_image_url ? (
          <Image
            source={{ uri: (layaway as any).first_image_url }}
            style={{ width: 80, height: 80, borderRadius: 22, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.04)' }}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)']}
            style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderRadius: 22 }}
          >
            <Ionicons name="layers" size={32} color="#818cf8" />
          </LinearGradient>
        )}
        <Text style={{ color: '#f8fafc', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>{layaway.folio}</Text>
        {(layaway as any).first_product_name && (
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>{(layaway as any).first_product_name}</Text>
        )}
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 2 }}>{layaway.branch_name}</Text>
      </Animated.View>

      {/* Progress */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        className="p-6 mb-4"
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          borderRadius: 24,
        }}
      >
        <View className="flex-row justify-between mb-3">
          <Text className="text-white/50 text-sm">Progreso de pago</Text>
          <Text className="text-brand-400 font-bold">{Math.round(progress)}%</Text>
        </View>
        <View style={{ height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <View style={{ width: `${Math.min(progress, 100)}%`, height: '100%' }}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, borderRadius: 6 }}
            />
          </View>
        </View>
        <View className="flex-row justify-between mt-4">
          <View>
            <Text className="text-white/30 text-xs">Total</Text>
            <Text className="text-white font-semibold">
              ${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-white/30 text-xs">Saldo pendiente</Text>
            <Text className="text-emerald-400 font-black text-xl">
              ${balanceDue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
        {layaway.due_date && (
          <View className="flex-row items-center mt-3">
            <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.3)" />
            <Text className="text-white/35 text-xs ml-1.5">
              Vence: {new Date(layaway.due_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Pay section */}
      {isActive && (
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          className="p-5 mb-4"
          style={{
            backgroundColor: 'rgba(99,102,241,0.06)',
            borderColor: 'rgba(99,102,241,0.2)',
            borderWidth: 1,
            borderRadius: 24,
          }}
        >
          <View className="flex-row items-center mb-4">
            <Ionicons name="card-outline" size={18} color="#818cf8" />
            <Text className="text-brand-300 font-bold ml-2">Realizar abono</Text>
          </View>
          <TextInput
            className="text-white text-base mb-3"
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
            placeholder={`Monto (max $${balanceDue.toFixed(2)})`}
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="decimal-pad"
            value={payAmount}
            onChangeText={setPayAmount}
          />
          <View className="flex-row gap-2 mb-4">
            {[100, 200, 500].filter((v) => v <= balanceDue).map((val) => (
              <TouchableOpacity
                key={val}
                className="flex-1 py-3 items-center rounded-xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                onPress={() => setPayAmount(String(val))}
              >
                <Text className="text-white/60 text-sm font-semibold">${val}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              className="flex-1 py-3 items-center rounded-xl"
              style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}
              onPress={() => setPayAmount(balanceDue.toFixed(2))}
            >
              <Text className="text-brand-300 text-sm font-semibold">Liquidar</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            className="rounded-2xl py-4 items-center flex-row justify-center overflow-hidden"
            onPress={handlePay}
            disabled={paying}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                position: 'absolute',
                left: 0, right: 0, top: 0, bottom: 0,
                borderRadius: 16,
              }}
            />
            {paying ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={16} color="#ffffff" />
                <Text className="text-white font-bold ml-2">Pagar con tarjeta</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Items */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <Text className="text-white font-bold text-lg mb-3 tracking-tight">Articulos</Text>
        {(layaway.items ?? []).map((item, idx) => {
          const attrs = Object.entries(item.attributes ?? {}).map(([k, v]) => `${k}: ${v}`).join(' — ');
          return (
            <View
              key={idx}
              className="p-4 mb-2 flex-row"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderRadius: 20,
              }}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} className="w-14 h-14 rounded-xl" contentFit="cover" />
              ) : (
                <View className="w-14 h-14 rounded-xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                  <Ionicons name="footsteps-outline" size={18} color="rgba(255,255,255,0.15)" />
                </View>
              )}
              <View className="flex-1 ml-3">
                <Text className="text-white font-semibold text-sm" numberOfLines={1}>{item.product_name}</Text>
                <Text className="text-white/35 text-xs">{attrs}</Text>
                <Text className="text-white/50 text-xs mt-1">
                  x{item.quantity} — ${(Number(item.subtotal) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          );
        })}
      </Animated.View>

      {/* Payment history */}
      {(layaway.payments ?? []).length > 0 && (
        <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mt-6">
          <Text className="text-white font-bold text-lg mb-3 tracking-tight">Historial de pagos</Text>
          {(layaway.payments ?? []).map((pmt) => (
            <View
              key={pmt.id}
              className="flex-row justify-between items-center p-4 mb-2"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderRadius: 20,
              }}
            >
              <View className="flex-row items-center">
                <View
                  className="w-9 h-9 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: 'rgba(52,211,153,0.15)' }}
                >
                  <Ionicons name="checkmark" size={14} color="#34d399" />
                </View>
                <View>
                  <Text className="text-white font-semibold">
                    ${Number(pmt.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </Text>
                  <Text className="text-white/35 text-xs capitalize">{pmt.payment_method}</Text>
                </View>
              </View>
              <Text className="text-white/30 text-xs">
                {new Date(pmt.created_at).toLocaleDateString('es-MX')}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );
}
