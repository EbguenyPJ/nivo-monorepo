import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEmployeeLogin, usePinLogin } from '../src/hooks/use-login';
import { api } from '../src/api/client';

type LoginMode = 'credentials' | 'pin';

interface AvailableTenant {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  plan: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>('credentials');
  const [tenant, setTenant] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<AvailableTenant | null>(null);
  const [tenants, setTenants] = useState<AvailableTenant[]>([]);
  const [showTenantPicker, setShowTenantPicker] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [branchId, setBranchId] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useEmployeeLogin();
  const pinMutation = usePinLogin();
  const isLoading = loginMutation.isPending || pinMutation.isPending;

  useEffect(() => {
    api.get('/tenants/mobile/available')
      .then(res => {
        setTenants(res.data);
        if (res.data.length === 1) {
          setSelectedTenant(res.data[0]);
          setTenant(res.data[0].subdomain);
        }
      })
      .catch(() => setTenants([]))
      .finally(() => setLoadingTenants(false));
  }, []);

  const handleSelectTenant = (t: AvailableTenant) => {
    setSelectedTenant(t);
    setTenant(t.subdomain);
    setShowTenantPicker(false);
  };

  const handleCredentialLogin = () => {
    if (!tenant.trim() || !email.trim() || !password.trim()) return;
    loginMutation.mutate(
      { email: email.trim().toLowerCase(), password, tenant: tenant.trim().toLowerCase() },
      {
        onSuccess: () => {
          router.replace('/(tabs)/scanner');
        },
        onError: (err: any) => {
          const msg = err.response?.data?.message ?? 'Credenciales invalidas';
          Alert.alert('Error de autenticacion', msg);
        },
      },
    );
  };

  const handlePinLogin = () => {
    if (!tenant.trim() || !pin.trim() || !branchId.trim()) return;
    pinMutation.mutate(
      { pin_code: pin, tenant: tenant.trim().toLowerCase(), branch_id: branchId.trim() },
      {
        onSuccess: () => {
          router.replace('/(tabs)/scanner');
        },
        onError: (err: any) => {
          const msg = err.response?.data?.message ?? 'PIN invalido';
          Alert.alert('Error', msg);
        },
      },
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-8">
            {/* Logo / Header */}
            <View className="items-center mb-12">
              <LinearGradient
                colors={['#0ea5e9', '#06b6d4']}
                style={{ width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
              >
                <Ionicons name="storefront" size={40} color="#ffffff" />
              </LinearGradient>
              <Text className="text-3xl font-bold text-white">Nivo Staff</Text>
              <Text style={{ color: '#64748b' }} className="text-base mt-2">
                Herramienta para empleados
              </Text>
            </View>

            {/* Glass Form Card */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 24 }} className="p-6">
              {/* Mode Switcher */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16 }} className="flex-row p-1 mb-6">
                <TouchableOpacity
                  className="flex-1 py-3 items-center"
                  style={[
                    { borderRadius: 12 },
                    mode === 'credentials' ? {} : undefined,
                  ]}
                  onPress={() => setMode('credentials')}
                >
                  {mode === 'credentials' ? (
                    <LinearGradient
                      colors={['#0ea5e9', '#06b6d4']}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12 }}
                    />
                  ) : null}
                  <Text className={`font-semibold ${mode === 'credentials' ? 'text-white' : 'text-slate-500'}`}>
                    Email
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 items-center"
                  style={{ borderRadius: 12 }}
                  onPress={() => setMode('pin')}
                >
                  {mode === 'pin' ? (
                    <LinearGradient
                      colors={['#0ea5e9', '#06b6d4']}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12 }}
                    />
                  ) : null}
                  <Text className={`font-semibold ${mode === 'pin' ? 'text-white' : 'text-slate-500'}`}>
                    PIN Rapido
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tenant Selector */}
              <Text style={{ color: '#64748b' }} className="text-sm mb-2 ml-1">Tienda</Text>
              {loadingTenants ? (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 }} className="rounded-2xl px-4 py-4 mb-4 items-center">
                  <ActivityIndicator color="#64748b" size="small" />
                </View>
              ) : tenants.length > 0 ? (
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 }}
                  className="rounded-2xl px-4 py-4 mb-4 flex-row items-center"
                  onPress={() => setShowTenantPicker(true)}
                >
                  {selectedTenant?.logo_url ? (
                    <Image
                      source={{ uri: selectedTenant.logo_url }}
                      className="w-8 h-8 rounded-lg mr-3"
                    />
                  ) : (
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.10)' }} className="w-8 h-8 rounded-lg items-center justify-center mr-3">
                      <Ionicons name="business" size={16} color="#94a3b8" />
                    </View>
                  )}
                  <Text className={`flex-1 text-lg ${selectedTenant ? 'text-white' : 'text-slate-500'}`}>
                    {selectedTenant?.name || 'Selecciona tu tienda'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#64748b" />
                </TouchableOpacity>
              ) : (
                <TextInput
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 }}
                  className="text-white text-lg px-4 py-4 rounded-2xl mb-4"
                  placeholder="subdominio de tu tienda"
                  placeholderTextColor="#475569"
                  value={tenant}
                  onChangeText={setTenant}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}

              {/* Tenant Picker Modal */}
              <Modal visible={showTenantPicker} animationType="slide" transparent>
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                  <View style={{ backgroundColor: 'rgba(15,23,42,0.95)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} className="max-h-[70%]">
                    <View className="flex-row items-center justify-between px-6 py-4" style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
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
                          className="flex-row items-center px-6 py-4"
                          style={{
                            borderBottomWidth: 1,
                            borderBottomColor: 'rgba(255,255,255,0.06)',
                            backgroundColor: selectedTenant?.id === item.id ? 'rgba(14,165,233,0.10)' : 'transparent',
                          }}
                          onPress={() => handleSelectTenant(item)}
                        >
                          {item.logo_url ? (
                            <Image
                              source={{ uri: item.logo_url }}
                              className="w-10 h-10 rounded-xl mr-4"
                            />
                          ) : (
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} className="w-10 h-10 rounded-xl items-center justify-center mr-4">
                              <Ionicons name="business" size={20} color="#94a3b8" />
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="text-white text-base font-semibold">{item.name}</Text>
                            <Text className="text-slate-400 text-sm">{item.subdomain}.nivo.mx</Text>
                          </View>
                          {selectedTenant?.id === item.id && (
                            <Ionicons name="checkmark-circle" size={22} color="#22d3ee" />
                          )}
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                </View>
              </Modal>

              {mode === 'credentials' ? (
                <>
                  <Text style={{ color: '#64748b' }} className="text-sm mb-2 ml-1">Email</Text>
                  <TextInput
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 }}
                    className="text-white text-lg px-4 py-4 rounded-2xl mb-4"
                    placeholder="empleado@nivo.com"
                    placeholderTextColor="#475569"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />

                  <Text style={{ color: '#64748b' }} className="text-sm mb-2 ml-1">Contrasena</Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 }} className="flex-row items-center rounded-2xl mb-6">
                    <TextInput
                      className="flex-1 text-white text-lg px-4 py-4"
                      placeholder="--------"
                      placeholderTextColor="#475569"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      className="px-4"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={22}
                        color="#64748b"
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={handleCredentialLogin}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={isLoading ? ['#0284c7', '#0e7490'] : ['#0ea5e9', '#06b6d4']}
                      style={{ borderRadius: 16, paddingVertical: 18, alignItems: 'center' }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text className="text-white text-lg font-bold">Iniciar Sesion</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ color: '#64748b' }} className="text-sm mb-2 ml-1">ID de Sucursal</Text>
                  <TextInput
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 }}
                    className="text-white text-lg px-4 py-4 rounded-2xl mb-4"
                    placeholder="UUID de la sucursal"
                    placeholderTextColor="#475569"
                    value={branchId}
                    onChangeText={setBranchId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={{ color: '#64748b' }} className="text-sm mb-2 ml-1">PIN del empleado</Text>
                  <TextInput
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 }}
                    className="text-white text-center text-3xl tracking-[16px] px-4 py-5 rounded-2xl mb-6"
                    placeholder="- - - -"
                    placeholderTextColor="#475569"
                    value={pin}
                    onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                  />

                  <TouchableOpacity
                    onPress={handlePinLogin}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={isLoading ? ['#0284c7', '#0e7490'] : ['#0ea5e9', '#06b6d4']}
                      style={{ borderRadius: 16, paddingVertical: 18, alignItems: 'center' }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text className="text-white text-lg font-bold">Entrar con PIN</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
