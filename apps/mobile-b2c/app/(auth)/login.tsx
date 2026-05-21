import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
  FlatList, Image, Modal,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '@/lib/auth-store';
import { api, setActiveTenant } from '@/lib/api-client';

interface AvailableTenant {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  plan: string;
}

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tenants, setTenants] = useState<AvailableTenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<AvailableTenant | null>(null);
  const [showTenantPicker, setShowTenantPicker] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    fetch((__DEV__ ? api.get<AvailableTenant[]>('/tenants/mobile/available') : Promise.resolve([])) as any)
      .catch(() => []);
    api.get<AvailableTenant[]>('/tenants/mobile/available')
      .then((data) => {
        setTenants(data);
        if (data.length === 1) {
          setSelectedTenant(data[0]);
          setActiveTenant(data[0].subdomain);
        }
      })
      .catch(() => setTenants([]))
      .finally(() => setLoadingTenants(false));
  }, []);

  const handleSelectTenant = (t: AvailableTenant) => {
    setSelectedTenant(t);
    setActiveTenant(t.subdomain);
    setShowTenantPicker(false);
  };

  async function handleLogin() {
    if (!selectedTenant) {
      setError('Selecciona una tienda primero');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-surface"
    >
      <View className="flex-1 justify-center px-8">
        <Animated.View entering={FadeInDown.duration(500)} className="items-center mb-10">
          <View className="w-20 h-20 bg-brand-500/20 rounded-2xl items-center justify-center mb-4">
            <Ionicons name="storefront" size={36} color="#818cf8" />
          </View>
          <Text className="text-4xl font-bold text-white">Nivo</Text>
          <Text className="text-slate-400 mt-1">Tu tienda de zapatos favorita</Text>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeInDown.duration(200)} className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 mb-4 flex-row items-center">
            <Ionicons name="alert-circle" size={18} color="#f87171" />
            <Text className="text-red-300 text-sm ml-2 flex-1">{error}</Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          {/* Tenant Selector */}
          {loadingTenants ? (
            <View className="bg-slate-800 rounded-xl px-4 py-4 mb-3 border border-slate-700 items-center">
              <ActivityIndicator color="#64748b" size="small" />
            </View>
          ) : tenants.length > 0 ? (
            <TouchableOpacity
              className="bg-slate-800 rounded-xl px-4 py-4 mb-3 border border-slate-700 flex-row items-center"
              onPress={() => setShowTenantPicker(true)}
            >
              {selectedTenant?.logo_url ? (
                <Image source={{ uri: selectedTenant.logo_url }} className="w-8 h-8 rounded-lg mr-3" />
              ) : (
                <Ionicons name="business-outline" size={18} color="#64748b" />
              )}
              <Text className={`flex-1 text-base ml-3 ${selectedTenant ? 'text-white' : 'text-slate-500'}`}>
                {selectedTenant?.name || 'Selecciona tu tienda'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </TouchableOpacity>
          ) : null}

          {/* Tenant Picker Modal */}
          <Modal visible={showTenantPicker} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
              <View className="bg-slate-900 rounded-t-3xl max-h-[70%]">
                <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-800">
                  <Text className="text-white text-lg font-bold">Selecciona tu tienda</Text>
                  <TouchableOpacity onPress={() => setShowTenantPicker(false)}>
                    <Ionicons name="close" size={24} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={tenants}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      className={`flex-row items-center px-6 py-4 border-b border-slate-800 ${
                        selectedTenant?.id === item.id ? 'bg-brand-500/10' : ''
                      }`}
                      onPress={() => handleSelectTenant(item)}
                    >
                      {item.logo_url ? (
                        <Image source={{ uri: item.logo_url }} className="w-10 h-10 rounded-xl mr-4" />
                      ) : (
                        <View className="w-10 h-10 rounded-xl bg-slate-700 items-center justify-center mr-4">
                          <Ionicons name="business" size={20} color="#94a3b8" />
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-white text-base font-semibold">{item.name}</Text>
                        <Text className="text-slate-400 text-sm">{item.subdomain}.nivo.mx</Text>
                      </View>
                      {selectedTenant?.id === item.id && (
                        <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>

          <View className="flex-row items-center bg-slate-800 rounded-xl px-4 mb-3 border border-slate-700">
            <Ionicons name="mail-outline" size={18} color="#64748b" />
            <TextInput
              className="flex-1 text-white py-4 ml-3 text-base"
              placeholder="Correo electrónico"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View className="flex-row items-center bg-slate-800 rounded-xl px-4 mb-6 border border-slate-700">
            <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
            <TextInput
              className="flex-1 text-white py-4 ml-3 text-base"
              placeholder="Contraseña"
              placeholderTextColor="#64748b"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className="bg-brand-500 rounded-2xl py-4 items-center mb-4 flex-row justify-center"
            onPress={handleLogin}
            disabled={loading || !email || !password || !selectedTenant}
            activeOpacity={0.8}
            style={{ opacity: email && password && selectedTenant ? 1 : 0.5 }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#ffffff" />
                <Text className="text-white font-bold text-base ml-2">Iniciar sesión</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity className="py-3">
            <Text className="text-brand-500 text-center text-sm">
              ¿No tienes cuenta? <Text className="font-semibold">Regístrate</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
