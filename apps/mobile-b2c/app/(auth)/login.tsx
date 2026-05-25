import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
  FlatList, Image, Modal,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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
    let cancelled = false;
    async function loadTenants(retries = 3) {
      for (let i = 0; i < retries; i++) {
        try {
          const data = await api.get<AvailableTenant[]>('/tenants/mobile/available');
          if (cancelled) return;
          setTenants(data);
          if (data.length === 1) {
            setSelectedTenant(data[0]);
            setActiveTenant(data[0].subdomain);
          }
          return;
        } catch {
          if (i < retries - 1) await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (!cancelled) setTenants([]);
    }
    loadTenants().finally(() => { if (!cancelled) setLoadingTenants(false); });
    return () => { cancelled = true; };
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
      setError(e.message ?? 'Error al iniciar sesion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={['#0c0f1a', '#1a1040', '#0c0f1a']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-7">
          <Animated.View entering={FadeInDown.duration(600)} className="items-center mb-12">
            <View
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                borderWidth: 1,
              }}
              className="w-24 h-24 rounded-3xl items-center justify-center mb-5"
            >
              <Ionicons name="storefront" size={42} color="#818cf8" />
            </View>
            <Text className="text-5xl font-black text-white tracking-tight">Nivo</Text>
            <Text className="text-white/40 mt-2 text-base tracking-wide">Tu tienda de zapatos favorita</Text>
          </Animated.View>

          {error && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
                borderWidth: 1,
              }}
              className="rounded-2xl p-4 mb-5 flex-row items-center"
            >
              <Ionicons name="alert-circle" size={18} color="#f87171" />
              <Text className="text-red-300 text-sm ml-2 flex-1">{error}</Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(150).duration(500)}>
            {/* Tenant Selector */}
            {loadingTenants ? (
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderWidth: 1,
                }}
                className="rounded-2xl px-5 py-4 mb-3 items-center"
              >
                <ActivityIndicator color="#64748b" size="small" />
              </View>
            ) : tenants.length > 0 ? (
              <TouchableOpacity
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderWidth: 1,
                }}
                className="rounded-2xl px-5 py-4 mb-3 flex-row items-center"
                onPress={() => setShowTenantPicker(true)}
              >
                {selectedTenant?.logo_url ? (
                  <Image source={{ uri: selectedTenant.logo_url }} className="w-8 h-8 rounded-lg mr-3" />
                ) : (
                  <Ionicons name="business-outline" size={18} color="rgba(255,255,255,0.4)" />
                )}
                <Text className={`flex-1 text-base ml-3 ${selectedTenant ? 'text-white' : 'text-white/40'}`}>
                  {selectedTenant?.name || 'Selecciona tu tienda'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            ) : null}

            {/* Tenant Picker Modal */}
            <Modal visible={showTenantPicker} animationType="slide" transparent>
              <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
                <View
                  style={{
                    backgroundColor: '#121628',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                  }}
                  className="rounded-t-3xl max-h-[70%]"
                >
                  <View className="flex-row items-center justify-between px-6 py-5">
                    <Text className="text-white text-lg font-bold">Selecciona tu tienda</Text>
                    <TouchableOpacity onPress={() => setShowTenantPicker(false)}>
                      <Ionicons name="close" size={24} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={tenants}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        className="flex-row items-center px-6 py-4"
                        style={{
                          backgroundColor: selectedTenant?.id === item.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                          borderBottomWidth: 1,
                          borderBottomColor: 'rgba(255,255,255,0.05)',
                        }}
                        onPress={() => handleSelectTenant(item)}
                      >
                        {item.logo_url ? (
                          <Image source={{ uri: item.logo_url }} className="w-10 h-10 rounded-xl mr-4" />
                        ) : (
                          <View
                            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                            className="w-10 h-10 rounded-xl items-center justify-center mr-4"
                          >
                            <Ionicons name="business" size={20} color="rgba(255,255,255,0.5)" />
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-white text-base font-semibold">{item.name}</Text>
                          <Text className="text-white/30 text-sm">{item.subdomain}.nivo.mx</Text>
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

            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
              }}
              className="flex-row items-center rounded-2xl px-5 mb-3"
            >
              <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.35)" />
              <TextInput
                className="flex-1 text-white py-4 ml-3 text-base"
                placeholder="Correo electronico"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
              }}
              className="flex-row items-center rounded-2xl px-5 mb-8"
            >
              <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.35)" />
              <TextInput
                className="flex-1 text-white py-4 ml-3 text-base"
                placeholder="Contrasena"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading || !email || !password || !selectedTenant}
              activeOpacity={0.8}
              style={{
                height: 56,
                borderRadius: 16,
                overflow: 'hidden',
                opacity: email && password && selectedTenant ? 1 : 0.5,
                marginBottom: 16,
              }}
            >
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={22} color="#ffffff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>Iniciar sesion</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Link href="/(auth)/register" asChild>
            <TouchableOpacity className="py-4">
              <Text className="text-white/50 text-center text-sm">
                No tienes cuenta? <Text className="font-semibold text-brand-400">Registrate</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
