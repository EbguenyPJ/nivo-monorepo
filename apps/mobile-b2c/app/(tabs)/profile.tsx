import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '@/lib/auth-store';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40 }}>
      {/* User card */}
      <Animated.View entering={FadeInDown.duration(400)} className="bg-surface-card rounded-2xl p-5 mb-6 items-center">
        <View className="w-20 h-20 bg-brand-500/20 rounded-full items-center justify-center mb-4">
          <Ionicons name="person" size={36} color="#818cf8" />
        </View>
        <Text className="text-white text-xl font-bold">{user?.name}</Text>
        <Text className="text-slate-400 text-sm mt-1">{user?.email}</Text>
        {user?.phone && (
          <View className="flex-row items-center mt-1.5">
            <Ionicons name="call-outline" size={13} color="#64748b" />
            <Text className="text-slate-400 text-sm ml-1.5">{user.phone}</Text>
          </View>
        )}
      </Animated.View>

      {/* Menu items */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} className="bg-surface-card rounded-2xl overflow-hidden mb-6">
        <MenuItem
          label="Mis pedidos"
          icon="cube-outline"
          color="#818cf8"
          onPress={() => router.push('/(tabs)/layaways')}
        />
        <View className="h-px bg-slate-700 mx-4" />
        <MenuItem
          label="Mi QR de lealtad"
          icon="qr-code-outline"
          color="#fbbf24"
          onPress={() => router.push('/(tabs)/loyalty')}
        />
        <View className="h-px bg-slate-700 mx-4" />
        <MenuItem
          label="Catálogo"
          icon="grid-outline"
          color="#34d399"
          onPress={() => router.push('/(tabs)/catalog')}
        />
        <View className="h-px bg-slate-700 mx-4" />
        <MenuItem
          label="Direcciones"
          icon="location-outline"
          color="#f97316"
          onPress={() => {}}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <TouchableOpacity
          className="bg-red-500/10 border border-red-500/30 rounded-2xl py-4 items-center flex-row justify-center"
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={18} color="#f87171" />
          <Text className="text-red-400 font-semibold ml-2">Cerrar sesión</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

function MenuItem({ label, icon, color, onPress }: { label: string; icon: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-4"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: color + '20' }}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text className="text-white flex-1 font-medium">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#475569" />
    </TouchableOpacity>
  );
}
