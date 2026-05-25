import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StripeProvider } from '@stripe/stripe-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '@/lib/auth-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 2 },
  },
});

const STRIPE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder';

export default function RootLayout() {
  const loadSession = useAuthStore((s) => s.loadSession);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StripeProvider publishableKey={STRIPE_KEY} merchantIdentifier="merchant.com.nivo.client">
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#0c0f1a' },
              headerTintColor: '#f8fafc',
              headerTitleStyle: { fontWeight: '700', fontSize: 17 },
              contentStyle: { backgroundColor: '#0c0f1a' },
              animation: 'slide_from_right',
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="product/[id]" options={{ title: 'Detalle' }} />
            <Stack.Screen name="cart" options={{ title: 'Carrito' }} />
            <Stack.Screen name="checkout" options={{ title: 'Pagar' }} />
            <Stack.Screen name="order/[id]" options={{ title: 'Pedido' }} />
            <Stack.Screen name="layaway/[id]" options={{ title: 'Apartado' }} />
          </Stack>
        </StripeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
