import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from 'expo-vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useStripe } from '@stripe/stripe-react-native';
import { useLayawayDetail, useLayawayPayment } from '@/lib/queries';

export default function LayawayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: layaway, isLoading, refetch } = useLayawayDetail(id);
  const stripe = useStripe();
  const payMutation = useLayawayPayment();

  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  if (isLoading || !layaway) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const balanceDue = Number(layaway.balance_due);
  const isActive = layaway.status === 'active';
  const progress = ((Number(layaway.total_amount) - balanceDue) / Number(layaway.total_amount)) * 100;

  async function handlePay() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0 || amount > balanceDue) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    setPaying(true);
    try {
      const res = await payMutation.mutateAsync({
        layaway_id: id,
        amount,
        stripe_payment_method_id: '',
      });

      const { error } = await stripe.initPaymentSheet({
        paymentIntentClientSecret: res.client_secret,
        merchantDisplayName: 'Nivo',
        style: 'alwaysDark',
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      const { error: presentError } = await stripe.presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Error', presentError.message);
        }
        return;
      }

      Alert.alert('Abono registrado', `Se aplicó un abono de $${amount.toFixed(2)}`);
      setPayAmount('');
      refetch();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo procesar el pago');
    } finally {
      setPaying(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-5 pt-4 pb-12">
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} className="items-center mb-6">
        <View className="w-14 h-14 bg-brand-500/20 rounded-full items-center justify-center mb-3">
          <Ionicons name="layers" size={28} color="#818cf8" />
        </View>
        <Text className="text-white text-2xl font-bold">{layaway.folio}</Text>
        <Text className="text-slate-400 text-sm mt-1">{layaway.branch_name}</Text>
      </Animated.View>

      {/* Progress */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} className="bg-surface-card rounded-2xl p-5 mb-4">
        <View className="flex-row justify-between mb-2">
          <Text className="text-slate-400 text-sm">Progreso de pago</Text>
          <Text className="text-brand-500 font-medium">{Math.round(progress)}%</Text>
        </View>
        <View className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <View
            className="h-full bg-brand-500 rounded-full"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </View>
        <View className="flex-row justify-between mt-3">
          <View>
            <Text className="text-slate-500 text-xs">Total</Text>
            <Text className="text-white font-medium">
              ${Number(layaway.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-slate-500 text-xs">Saldo pendiente</Text>
            <Text className="text-emerald-400 font-bold text-xl">
              ${balanceDue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
        {layaway.due_date && (
          <View className="flex-row items-center mt-3">
            <Ionicons name="calendar-outline" size={13} color="#64748b" />
            <Text className="text-slate-400 text-xs ml-1.5">
              Vence: {new Date(layaway.due_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Pay section */}
      {isActive && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} className="bg-brand-500/10 border border-brand-500/30 rounded-2xl p-5 mb-4">
          <View className="flex-row items-center mb-3">
            <Ionicons name="card-outline" size={18} color="#818cf8" />
            <Text className="text-brand-100 font-medium ml-2">Realizar abono</Text>
          </View>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 text-base mb-3 border border-slate-700"
            placeholder={`Monto (máx $${balanceDue.toFixed(2)})`}
            placeholderTextColor="#64748b"
            keyboardType="decimal-pad"
            value={payAmount}
            onChangeText={setPayAmount}
          />
          <View className="flex-row gap-2 mb-4">
            {[100, 200, 500].filter((v) => v <= balanceDue).map((val) => (
              <TouchableOpacity
                key={val}
                className="flex-1 bg-slate-700 rounded-xl py-2.5 items-center"
                onPress={() => setPayAmount(String(val))}
              >
                <Text className="text-slate-300 text-sm font-medium">${val}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              className="flex-1 bg-brand-500/20 rounded-xl py-2.5 items-center"
              onPress={() => setPayAmount(balanceDue.toFixed(2))}
            >
              <Text className="text-brand-100 text-sm font-medium">Liquidar</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            className="bg-brand-500 rounded-2xl py-4 items-center flex-row justify-center"
            onPress={handlePay}
            disabled={paying}
            activeOpacity={0.8}
          >
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
        <Text className="text-white font-semibold text-lg mb-3">Artículos</Text>
        {layaway.items.map((item, idx) => {
          const attrs = Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' · ');
          return (
            <View key={idx} className="bg-surface-card rounded-xl p-4 mb-2 flex-row">
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} className="w-14 h-14 rounded-lg" contentFit="cover" />
              ) : (
                <View className="w-14 h-14 rounded-lg bg-slate-700 items-center justify-center">
                  <Ionicons name="footsteps-outline" size={18} color="#475569" />
                </View>
              )}
              <View className="flex-1 ml-3">
                <Text className="text-white font-medium text-sm" numberOfLines={1}>{item.product_name}</Text>
                <Text className="text-slate-400 text-xs">{attrs}</Text>
                <Text className="text-slate-300 text-xs mt-1">
                  x{item.quantity} — ${Number(item.subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          );
        })}
      </Animated.View>

      {/* Payment history */}
      {layaway.payments.length > 0 && (
        <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mt-6">
          <Text className="text-white font-semibold text-lg mb-3">Historial de pagos</Text>
          {layaway.payments.map((pmt) => (
            <View key={pmt.id} className="flex-row justify-between items-center bg-surface-card rounded-xl p-4 mb-2">
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-emerald-500/20 rounded-full items-center justify-center mr-3">
                  <Ionicons name="checkmark" size={14} color="#34d399" />
                </View>
                <View>
                  <Text className="text-white font-medium">
                    ${Number(pmt.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </Text>
                  <Text className="text-slate-400 text-xs capitalize">{pmt.payment_method}</Text>
                </View>
              </View>
              <Text className="text-slate-400 text-xs">
                {new Date(pmt.created_at).toLocaleDateString('es-MX')}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );
}
