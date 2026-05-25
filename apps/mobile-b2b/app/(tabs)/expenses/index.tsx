import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../../src/stores/auth.store';

export default function ExpensesIndex() {
  const employee = useAuthStore((s) => s.employee);

  return (
    <View className="flex-1 px-6 pt-6" style={{ backgroundColor: '#020617' }}>
      {/* Glass employee info card */}
      <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 24 }} className="p-6 mb-6">
        <View className="flex-row items-center">
          <View style={{ backgroundColor: 'rgba(14,165,233,0.15)', borderRadius: 16 }} className="w-12 h-12 items-center justify-center mr-4">
            <Ionicons name="person" size={24} color="#22d3ee" />
          </View>
          <View className="flex-1">
            <Text style={{ color: '#64748b' }} className="text-sm">Sesion activa</Text>
            <Text className="text-white text-lg font-bold mt-1">{employee?.name}</Text>
            <Text className="text-slate-500 text-sm mt-1 capitalize">{employee?.role}</Text>
          </View>
        </View>
      </View>

      {/* Gradient register button */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/expenses/new')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#0ea5e9', '#06b6d4']}
          style={{ borderRadius: 20, paddingVertical: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add-circle" size={28} color="#ffffff" />
          <Text className="text-white text-xl font-bold ml-3">Registrar Gasto</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Info section */}
      <View className="mt-8 items-center">
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20 }} className="p-6 items-center">
          <Ionicons name="receipt-outline" size={48} color="#334155" />
          <Text className="text-slate-600 text-base mt-4 text-center">
            Registra salidas de dinero de la caja chica con foto del ticket como comprobante.
          </Text>
        </View>
      </View>
    </View>
  );
}
