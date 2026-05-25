import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/lib/auth-store';

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError(null);
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
      });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message ?? 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  }

  const isValid = name.trim().length >= 2 && email.includes('@') && password.length >= 6;

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
        <ScrollView contentContainerClassName="flex-grow justify-center px-7 py-12">
          <Animated.View entering={FadeInDown.duration(600)} className="items-center mb-10">
            <View
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                borderWidth: 1,
              }}
              className="w-20 h-20 rounded-3xl items-center justify-center mb-4"
            >
              <Ionicons name="person-add" size={32} color="#818cf8" />
            </View>
            <Text className="text-4xl font-black text-white tracking-tight">Crear cuenta</Text>
            <Text className="text-white/40 mt-2 text-base">Unete al club Nivo</Text>
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
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
              }}
              className="flex-row items-center rounded-2xl px-5 mb-3"
            >
              <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.35)" />
              <TextInput
                className="flex-1 text-white py-4 ml-3 text-base"
                placeholder="Nombre completo"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={name}
                onChangeText={setName}
              />
            </View>

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
              className="flex-row items-center rounded-2xl px-5 mb-3"
            >
              <Ionicons name="call-outline" size={18} color="rgba(255,255,255,0.35)" />
              <TextInput
                className="flex-1 text-white py-4 ml-3 text-base"
                placeholder="Telefono (opcional)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
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
                placeholder="Contrasena (min. 6 caracteres)"
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
              className="rounded-2xl py-4.5 items-center mb-4 flex-row justify-center overflow-hidden"
              onPress={handleRegister}
              disabled={loading || !isValid}
              activeOpacity={0.8}
              style={{ opacity: isValid ? 1 : 0.5 }}
            >
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  position: 'absolute',
                  left: 0, right: 0, top: 0, bottom: 0,
                  borderRadius: 16,
                }}
              />
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                  <Text className="text-white font-bold text-base ml-2">Crear cuenta</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={() => router.back()} className="py-4">
            <Text className="text-white/50 text-center text-sm">
              Ya tengo cuenta, <Text className="font-semibold text-brand-400">iniciar sesion</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
