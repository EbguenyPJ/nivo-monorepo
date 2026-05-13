import { Tabs, router } from 'expo-router';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '@/lib/cart-store';

function CartBadge() {
  const count = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  if (count === 0) return null;
  return (
    <TouchableOpacity
      onPress={() => router.push('/cart')}
      className="mr-4 relative"
    >
      <Ionicons name="bag-handle-outline" size={24} color="#f8fafc" />
      <View className="absolute -top-1 -right-2 bg-brand-500 rounded-full w-5 h-5 items-center justify-center">
        <Text className="text-white text-[10px] font-bold">{count > 9 ? '9+' : count}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#020617',
          borderTopColor: '#1e293b',
          height: 88,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#020617' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerRight: () => <CartBadge />,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Inicio',
          headerTitle: 'Nivo',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Tienda',
          headerTitle: 'Catálogo',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="loyalty"
        options={{
          title: 'Wallet',
          headerTitle: 'Mi Tarjeta',
          tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} />,
          headerRight: () => null,
        }}
      />
      <Tabs.Screen
        name="layaways"
        options={{
          title: 'Apartados',
          headerTitle: 'Mis Apartados',
          tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          headerTitle: 'Mi Cuenta',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          headerRight: () => null,
        }}
      />
    </Tabs>
  );
}
