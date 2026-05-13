import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../src/stores/auth.store';

export default function Index() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const token = useAuthStore((s) => s.token);

  if (!isHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/scanner" />;
}
