import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../../src/stores/auth.store';

export default function ExpensesIndex() {
  const employee = useAuthStore((s) => s.employee);

  return (
    <View className="flex-1 bg-slate-950 px-6 pt-6">
      <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <Text className="text-slate-400 text-sm">Sesión activa</Text>
        <Text className="text-white text-lg font-bold mt-1">{employee?.name}</Text>
        <Text className="text-slate-500 text-sm mt-1 capitalize">{employee?.role}</Text>
      </View>

      <TouchableOpacity
        className="bg-brand py-6 rounded-2xl items-center flex-row justify-center"
        onPress={() => router.push('/(tabs)/expenses/new')}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={28} color="#ffffff" />
        <Text className="text-white text-xl font-bold ml-3">Registrar Gasto</Text>
      </TouchableOpacity>

      <View className="mt-8 items-center">
        <Ionicons name="receipt-outline" size={48} color="#334155" />
        <Text className="text-slate-600 text-base mt-4 text-center">
          Registra salidas de dinero de la caja chica con foto del ticket como comprobante.
        </Text>
      </View>
    </View>
  );
}
