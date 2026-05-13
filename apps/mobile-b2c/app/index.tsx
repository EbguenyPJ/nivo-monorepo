import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';

export default function Index() {
  const { isLoading, isAuthenticated } = useAuthStore();

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(tabs)/home' : '/(auth)/login'} />;
}
