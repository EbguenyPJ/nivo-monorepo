import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/lib/auth-store';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  function handleLogout() {
    Alert.alert('Cerrar sesion', 'Estas seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesion',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#0c0f1a' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}>
        {/* User card */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderRadius: 28,
            }}
            className="p-6 mb-6 items-center"
          >
            <LinearGradient
              colors={['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)']}
              className="w-24 h-24 rounded-3xl items-center justify-center mb-5"
              style={{ borderRadius: 24 }}
            >
              <Ionicons name="person" size={40} color="#818cf8" />
            </LinearGradient>
            <Text className="text-white text-xl font-black">{user?.name}</Text>
            <Text className="text-white/40 text-sm mt-1">{user?.email}</Text>
            {user?.phone && (
              <View className="flex-row items-center mt-2">
                <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.3)" />
                <Text className="text-white/40 text-sm ml-1.5">{user.phone}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Menu items */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderRadius: 24,
            overflow: 'hidden',
          }}
          className="mb-6"
        >
          <MenuItem
            label="Mis pedidos"
            icon="cube-outline"
            color="#818cf8"
            onPress={() => router.push('/(tabs)/layaways')}
          />
          <View className="h-px mx-5" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <MenuItem
            label="Mi QR de lealtad"
            icon="qr-code-outline"
            color="#fbbf24"
            onPress={() => router.push('/(tabs)/loyalty')}
          />
          <View className="h-px mx-5" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <MenuItem
            label="Catalogo"
            icon="grid-outline"
            color="#34d399"
            onPress={() => router.push('/(tabs)/catalog')}
          />
          <View className="h-px mx-5" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <MenuItem
            label="Direcciones"
            icon="location-outline"
            color="#f97316"
            onPress={() => {}}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <TouchableOpacity
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderColor: 'rgba(239, 68, 68, 0.2)',
              borderWidth: 1,
              borderRadius: 20,
            }}
            className="py-4 items-center flex-row justify-center"
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color="#f87171" />
            <Text className="text-red-400 font-semibold ml-2">Cerrar sesion</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function MenuItem({ label, icon, color, onPress }: { label: string; icon: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-5 py-4"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: color + '15' }}
      >
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text className="text-white flex-1 font-semibold">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
    </TouchableOpacity>
  );
}
