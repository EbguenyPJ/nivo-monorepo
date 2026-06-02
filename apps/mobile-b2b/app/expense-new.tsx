import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useUploadExpense, useExpenseCategories } from '../src/hooks/use-expenses';
import { useAuthStore } from '../src/stores/auth.store';

export default function NewExpenseScreen() {
  const branchId = useAuthStore((s) => s.employee?.branch_id);
  const { data: categories, isLoading: catLoading } = useExpenseCategories();
  const uploadMutation = useUploadExpense();

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentSource, setPaymentSource] = useState<'cash' | 'bank'>('cash');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const takePhoto = async () => {
    const permResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la camara para tomar foto del ticket.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la galeria.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    if (!branchId) {
      Alert.alert('Error', 'No se detecto la sucursal activa.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Campo requerido', 'Selecciona una categoria.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Monto invalido', 'Ingresa un monto mayor a $0.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Campo requerido', 'Agrega una descripcion del gasto.');
      return;
    }

    uploadMutation.mutate(
      {
        branch_id: branchId,
        category_id: categoryId,
        amount: parsedAmount,
        description: description.trim(),
        payment_source: paymentSource,
        receipt_uri: receiptUri ?? undefined,
      },
      {
        onSuccess: () => {
          router.back();
        },
      },
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: 'Nuevo Gasto',
          headerStyle: { backgroundColor: '#020617' },
          headerTintColor: '#f8fafc',
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        style={{ backgroundColor: '#020617' }}
      >
        <ScrollView
          className="flex-1 px-6 pt-4"
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category selector */}
          <Text style={{ color: '#64748b' }} className="text-sm mb-3 ml-1">Categoria</Text>
          {catLoading ? (
            <ActivityIndicator color="#0ea5e9" className="my-4" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
              {categories
                ?.filter((c) => c.is_active)
                .map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={
                      categoryId === cat.id
                        ? { backgroundColor: 'rgba(14,165,233,0.20)', borderColor: '#0ea5e9', borderWidth: 1, borderRadius: 16 }
                        : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 16 }
                    }
                    className="px-5 py-3 mr-3"
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <Text
                      className="font-semibold"
                      style={{ color: categoryId === cat.id ? '#22d3ee' : '#94a3b8' }}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}

          {/* Amount - glass input */}
          <Text style={{ color: '#64748b' }} className="text-sm mb-2 ml-1">Monto</Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderRadius: 16 }} className="flex-row items-center mb-5">
            <Text className="text-slate-500 text-2xl pl-4">$</Text>
            <TextInput
              className="flex-1 text-white text-2xl font-bold px-3 py-4"
              placeholder="0.00"
              placeholderTextColor="#475569"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Payment source */}
          <Text style={{ color: '#64748b' }} className="text-sm mb-3 ml-1">Fuente de pago</Text>
          <View className="flex-row gap-3 mb-5">
            <TouchableOpacity
              className="flex-1 py-4 items-center"
              style={
                paymentSource === 'cash'
                  ? { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: '#059669', borderWidth: 1, borderRadius: 16 }
                  : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 16 }
              }
              onPress={() => setPaymentSource('cash')}
            >
              <Ionicons
                name="cash-outline"
                size={22}
                color={paymentSource === 'cash' ? '#34d399' : '#64748b'}
              />
              <Text
                className="mt-1 font-semibold"
                style={{ color: paymentSource === 'cash' ? '#34d399' : '#64748b' }}
              >
                Efectivo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 py-4 items-center"
              style={
                paymentSource === 'bank'
                  ? { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 16 }
                  : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 16 }
              }
              onPress={() => setPaymentSource('bank')}
            >
              <Ionicons
                name="card-outline"
                size={22}
                color={paymentSource === 'bank' ? '#60a5fa' : '#64748b'}
              />
              <Text
                className="mt-1 font-semibold"
                style={{ color: paymentSource === 'bank' ? '#60a5fa' : '#64748b' }}
              >
                Banco
              </Text>
            </TouchableOpacity>
          </View>

          {/* Description - glass input */}
          <Text style={{ color: '#64748b' }} className="text-sm mb-2 ml-1">Descripcion</Text>
          <TextInput
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderRadius: 16, minHeight: 80 }}
            className="text-white text-base px-4 py-4 mb-5"
            placeholder="Ej: Limpieza de sucursal"
            placeholderTextColor="#475569"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Receipt photo */}
          <Text style={{ color: '#64748b' }} className="text-sm mb-3 ml-1">Foto del ticket (opcional)</Text>
          {receiptUri ? (
            <View className="mb-5">
              <Image
                source={{ uri: receiptUri }}
                style={{ borderRadius: 20 }}
                className="w-full h-64"
                resizeMode="cover"
              />
              <View className="flex-row gap-3 mt-3">
                <TouchableOpacity
                  className="flex-1 py-3 items-center flex-row justify-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 16 }}
                  onPress={takePhoto}
                >
                  <Ionicons name="camera" size={20} color="#22d3ee" />
                  <Text style={{ color: '#22d3ee' }} className="ml-2 font-semibold">Retomar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 items-center flex-row justify-center"
                  style={{ backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.25)', borderWidth: 1, borderRadius: 16 }}
                  onPress={() => setReceiptUri(null)}
                >
                  <Ionicons name="trash" size={20} color="#f87171" />
                  <Text style={{ color: '#f87171' }} className="ml-2 font-semibold">Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="flex-row gap-3 mb-5">
              <TouchableOpacity
                className="flex-1 py-8 items-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderStyle: 'dashed', borderRadius: 20 }}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={32} color="#22d3ee" />
                <Text style={{ color: '#22d3ee' }} className="mt-2 font-semibold">Tomar Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-8 items-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderStyle: 'dashed', borderRadius: 20 }}
                onPress={pickFromGallery}
              >
                <Ionicons name="images" size={32} color="#22d3ee" />
                <Text style={{ color: '#22d3ee' }} className="mt-2 font-semibold">Galeria</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Submit button */}
        <View className="px-6 pb-6 pt-4" style={{ backgroundColor: '#020617' }}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={uploadMutation.isPending}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={uploadMutation.isPending ? ['#0284c7', '#0e7490'] : ['#0ea5e9', '#06b6d4']}
              style={{ borderRadius: 16, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
            >
              {uploadMutation.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
                  <Text className="text-white text-lg font-bold ml-2">Registrar Gasto</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
