import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth.store';
import { HeaderLogout } from '../../src/components/header-logout';

export default function TabsLayout() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
          height: 88,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerStyle: { backgroundColor: '#020617' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerRight: () => <HeaderLogout />,
      }}
    >
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Escáner',
          headerTitle: 'Auditoría de Inventario',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barcode-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Gastos',
          headerTitle: 'Caja Chica',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Entregas',
          headerTitle: 'Entregas Pendientes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bicycle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
