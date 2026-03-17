import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Nivo Mobile' }} />
        <Stack.Screen name="login" options={{ title: 'Iniciar Sesión', headerShown: false }} />
        <Stack.Screen name="scanner" options={{ title: 'Escanear Inventario' }} />
        <Stack.Screen name="pos" options={{ title: 'Caja Móvil' }} />
        <Stack.Screen name="sync" options={{ title: 'Estado de Sincronización' }} />
      </Stack>
    </>
  );
}
