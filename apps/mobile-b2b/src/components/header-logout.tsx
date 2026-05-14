import { TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from 'expo-vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';
import { queryClient } from '../api/query-client';

export function HeaderLogout() {
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que deseas salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await logout();
          queryClient.clear();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <TouchableOpacity onPress={handleLogout} className="mr-4">
      <Ionicons name="log-out-outline" size={24} color="#f87171" />
    </TouchableOpacity>
  );
}
