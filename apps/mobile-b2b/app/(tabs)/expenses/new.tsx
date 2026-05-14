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
import { router, Stack } from 'expo-router';
import { useUploadExpense, useExpenseCategories } from '../../../src/hooks/use-expenses';
import { useAuthStore } from '../../../src/stores/auth.store';

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
      Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara para tomar foto del ticket.');
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
      Alert.alert('Permiso denegado', 'Se necesita acceso a la galería.');
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
      Alert.alert('Error', 'No se detectó la sucursal activa.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Campo requerido', 'Selecciona una categoría.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a $0.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Campo requerido', 'Agrega una descripción del gasto.');
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
        className="flex-1 bg-slate-950"
      >
        <ScrollView
          className="flex-1 px-6 pt-4"
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category selector */}
          <Text className="text-slate-400 text-sm mb-3 ml-1">Categoría</Text>
          {catLoading ? (
            <ActivityIndicator color="#6366f1" className="my-4" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
              {categories
                ?.filter((c) => c.is_active)
                .map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    className={`px-5 py-3 rounded-xl mr-3 border ${
                      categoryId === cat.id
                        ? 'bg-brand border-brand-light'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <Text
                      className={`font-semibold ${
                        categoryId === cat.id ? 'text-white' : 'text-slate-400'
                      }`}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}

          {/* Amount */}
          <Text className="text-slate-400 text-sm mb-2 ml-1">Monto</Text>
          <View className="flex-row items-center bg-slate-900 rounded-xl border border-slate-800 mb-5">
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
          <Text className="text-slate-400 text-sm mb-3 ml-1">Fuente de pago</Text>
          <View className="flex-row gap-3 mb-5">
            <TouchableOpacity
              className={`flex-1 py-4 rounded-xl items-center border ${
                paymentSource === 'cash'
                  ? 'bg-emerald-600/20 border-emerald-500'
                  : 'bg-slate-900 border-slate-800'
              }`}
              onPress={() => setPaymentSource('cash')}
            >
              <Ionicons
                name="cash-outline"
                size={22}
                color={paymentSource === 'cash' ? '#34d399' : '#64748b'}
              />
              <Text
                className={`mt-1 font-semibold ${
                  paymentSource === 'cash' ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                Efectivo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-4 rounded-xl items-center border ${
                paymentSource === 'bank'
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-slate-900 border-slate-800'
              }`}
              onPress={() => setPaymentSource('bank')}
            >
              <Ionicons
                name="card-outline"
                size={22}
                color={paymentSource === 'bank' ? '#60a5fa' : '#64748b'}
              />
              <Text
                className={`mt-1 font-semibold ${
                  paymentSource === 'bank' ? 'text-blue-400' : 'text-slate-500'
                }`}
              >
                Banco
              </Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text className="text-slate-400 text-sm mb-2 ml-1">Descripción</Text>
          <TextInput
            className="bg-slate-900 text-white text-base px-4 py-4 rounded-xl border border-slate-800 mb-5"
            placeholder="Ej: Limpieza de sucursal"
            placeholderTextColor="#475569"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 80 }}
          />

          {/* Receipt photo */}
          <Text className="text-slate-400 text-sm mb-3 ml-1">Foto del ticket (opcional)</Text>
          {receiptUri ? (
            <View className="mb-5">
              <Image
                source={{ uri: receiptUri }}
                className="w-full h-64 rounded-xl"
                resizeMode="cover"
              />
              <View className="flex-row gap-3 mt-3">
                <TouchableOpacity
                  className="flex-1 bg-slate-900 border border-slate-800 py-3 rounded-xl items-center flex-row justify-center"
                  onPress={takePhoto}
                >
                  <Ionicons name="camera" size={20} color="#818cf8" />
                  <Text className="text-brand-light ml-2 font-semibold">Retomar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-red-900/30 border border-red-800 py-3 rounded-xl items-center flex-row justify-center"
                  onPress={() => setReceiptUri(null)}
                >
                  <Ionicons name="trash" size={20} color="#f87171" />
                  <Text className="text-red-400 ml-2 font-semibold">Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="flex-row gap-3 mb-5">
              <TouchableOpacity
                className="flex-1 bg-slate-900 border border-dashed border-slate-700 rounded-xl py-8 items-center"
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={32} color="#818cf8" />
                <Text className="text-brand-light mt-2 font-semibold">Tomar Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-slate-900 border border-dashed border-slate-700 rounded-xl py-8 items-center"
                onPress={pickFromGallery}
              >
                <Ionicons name="images" size={32} color="#818cf8" />
                <Text className="text-brand-light mt-2 font-semibold">Galería</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Submit button */}
        <View className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-slate-950">
          <TouchableOpacity
            className={`py-5 rounded-xl items-center flex-row justify-center ${
              uploadMutation.isPending ? 'bg-brand-dark' : 'bg-brand'
            }`}
            onPress={handleSubmit}
            disabled={uploadMutation.isPending}
            activeOpacity={0.8}
          >
            {uploadMutation.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
                <Text className="text-white text-lg font-bold ml-2">Registrar Gasto</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
