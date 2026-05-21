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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
    loginMutation.mutate({ email: email.trim().toLowerCase(), password, tenant: tenant.trim().toLowerCase() });
  };

  const handlePinLogin = () => {
    if (!tenant.trim() || !pin.trim() || !branchId.trim()) return;
    pinMutation.mutate({ pin_code: pin, tenant: tenant.trim().toLowerCase(), branch_id: branchId.trim() });
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
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
              <View className="w-20 h-20 rounded-2xl bg-brand items-center justify-center mb-4">
                <Ionicons name="storefront" size={40} color="#ffffff" />
              </View>
              <Text className="text-3xl font-bold text-white">Nivo Staff</Text>
              <Text className="text-slate-400 text-base mt-2">
                Herramienta para empleados
              </Text>
            </View>

            {/* Mode Switcher */}
            <View className="flex-row bg-slate-900 rounded-xl p-1 mb-8">
              <TouchableOpacity
                className={`flex-1 py-3 rounded-lg items-center ${mode === 'credentials' ? 'bg-brand' : ''}`}
                onPress={() => setMode('credentials')}
              >
                <Text className={`font-semibold ${mode === 'credentials' ? 'text-white' : 'text-slate-400'}`}>
                  Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 rounded-lg items-center ${mode === 'pin' ? 'bg-brand' : ''}`}
                onPress={() => setMode('pin')}
              >
                <Text className={`font-semibold ${mode === 'pin' ? 'text-white' : 'text-slate-400'}`}>
                  PIN Rápido
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tenant Selector */}
            <Text className="text-slate-400 text-sm mb-2 ml-1">Tienda</Text>
            {loadingTenants ? (
              <View className="bg-slate-900 rounded-xl px-4 py-4 mb-4 border border-slate-800 items-center">
                <ActivityIndicator color="#64748b" size="small" />
              </View>
            ) : tenants.length > 0 ? (
              <TouchableOpacity
                className="bg-slate-900 rounded-xl px-4 py-4 mb-4 border border-slate-800 flex-row items-center"
                onPress={() => setShowTenantPicker(true)}
              >
                {selectedTenant?.logo_url ? (
                  <Image
                    source={{ uri: selectedTenant.logo_url }}
                    className="w-8 h-8 rounded-lg mr-3"
                  />
                ) : (
                  <View className="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center mr-3">
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
                className="bg-slate-900 text-white text-lg px-4 py-4 rounded-xl mb-4 border border-slate-800"
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
                          selectedTenant?.id === item.id ? 'bg-brand/10' : ''
                        }`}
                        onPress={() => handleSelectTenant(item)}
                      >
                        {item.logo_url ? (
                          <Image
                            source={{ uri: item.logo_url }}
                            className="w-10 h-10 rounded-xl mr-4"
                          />
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

            {mode === 'credentials' ? (
              <>
                <Text className="text-slate-400 text-sm mb-2 ml-1">Email</Text>
                <TextInput
                  className="bg-slate-900 text-white text-lg px-4 py-4 rounded-xl mb-4 border border-slate-800"
                  placeholder="empleado@nivo.com"
                  placeholderTextColor="#475569"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />

                <Text className="text-slate-400 text-sm mb-2 ml-1">Contraseña</Text>
                <View className="flex-row items-center bg-slate-900 rounded-xl mb-6 border border-slate-800">
                  <TextInput
                    className="flex-1 text-white text-lg px-4 py-4"
                    placeholder="••••••••"
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
                  className={`py-5 rounded-xl items-center ${isLoading ? 'bg-brand-dark' : 'bg-brand'}`}
                  onPress={handleCredentialLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white text-lg font-bold">Iniciar Sesión</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text className="text-slate-400 text-sm mb-2 ml-1">ID de Sucursal</Text>
                <TextInput
                  className="bg-slate-900 text-white text-lg px-4 py-4 rounded-xl mb-4 border border-slate-800"
                  placeholder="UUID de la sucursal"
                  placeholderTextColor="#475569"
                  value={branchId}
                  onChangeText={setBranchId}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text className="text-slate-400 text-sm mb-2 ml-1">PIN del empleado</Text>
                <TextInput
                  className="bg-slate-900 text-white text-center text-3xl tracking-[16px] px-4 py-5 rounded-xl mb-6 border border-slate-800"
                  placeholder="• • • •"
                  placeholderTextColor="#475569"
                  value={pin}
                  onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                />

                <TouchableOpacity
                  className={`py-5 rounded-xl items-center ${isLoading ? 'bg-brand-dark' : 'bg-brand'}`}
                  onPress={handlePinLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white text-lg font-bold">Entrar con PIN</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
