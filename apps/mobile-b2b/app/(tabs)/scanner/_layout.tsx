import { Stack } from 'expo-router';

export default function ScannerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#020617' },
      }}
    />
  );
}
