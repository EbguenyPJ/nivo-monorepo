import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../../src/stores/auth.store';
import { HeaderLogout } from '../../src/components/header-logout';
import { BranchSelector } from '../../src/components/branch-selector';

function TabBarBackground() {
  return (
    <BlurView
      intensity={60}
      tint="dark"
      style={StyleSheet.absoluteFill}
    />
  );
}

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
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          backgroundColor: 'rgba(15,23,42,0.95)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.06)',
          paddingBottom: 20,
          paddingTop: 8,
          elevation: 20,
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarActiveTintColor: '#22d3ee',
        tabBarInactiveTintColor: '#475569',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#020617' },
        headerTintColor: '#f8fafc',
        headerRight: () => <HeaderLogout />,
      }}
    >
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Escaner',
          headerTitle: () => <HeaderTitle title="Inventario" />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barcode-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pickup"
        options={{
          title: 'Recoleccion',
          headerTitle: () => <HeaderTitle title="Click & Collect" />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bag-handle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Gastos',
          headerTitle: () => <HeaderTitle title="Caja Chica" />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Entregas',
          headerTitle: () => <HeaderTitle title="Entregas" />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bicycle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
