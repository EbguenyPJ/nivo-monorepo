import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useAuthStore } from '../../src/stores/auth.store';
import { HeaderLogout } from '../../src/components/header-logout';
import { BranchSelector } from '../../src/components/branch-selector';

function HeaderTitle({ title }: { title: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 16 }}>{title}</Text>
      <BranchSelector />
    </View>
  );
}

export default function TabsLayout() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#020617' },
        headerTintColor: '#f8fafc',
        headerShadowVisible: false,
        headerRight: () => <HeaderLogout />,
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: 'rgba(255,255,255,0.06)' },
        tabBarActiveTintColor: '#22d3ee',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
      }}
    >
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Escaner',
          headerTitle: () => <HeaderTitle title="Inventario" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="barcode-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pickup"
        options={{
          title: 'Recoleccion',
          headerTitle: () => <HeaderTitle title="Click & Collect" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="bag-handle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Gastos',
          headerTitle: () => <HeaderTitle title="Caja Chica" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Entregas',
          headerTitle: () => <HeaderTitle title="Entregas" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="bicycle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
