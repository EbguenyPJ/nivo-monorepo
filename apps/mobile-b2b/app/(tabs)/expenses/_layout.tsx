import { Stack } from 'expo-router';

export default function ExpensesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#020617' },
        headerTintColor: '#f8fafc',
        contentStyle: { backgroundColor: '#020617' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ headerTitle: 'Nuevo Gasto' }} />
    </Stack>
  );
}
