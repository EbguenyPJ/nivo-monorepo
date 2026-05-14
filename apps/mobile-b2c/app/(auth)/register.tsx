import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from 'expo-vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-surface"
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-12">
        <Animated.View entering={FadeInDown.duration(500)} className="items-center mb-8">
          <View className="w-16 h-16 bg-brand-500/20 rounded-2xl items-center justify-center mb-3">
            <Ionicons name="person-add" size={28} color="#818cf8" />
          </View>
          <Text className="text-3xl font-bold text-white">Crear cuenta</Text>
          <Text className="text-slate-400 mt-1">Únete al club Nivo</Text>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeInDown.duration(200)} className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 mb-4 flex-row items-center">
            <Ionicons name="alert-circle" size={18} color="#f87171" />
            <Text className="text-red-300 text-sm ml-2 flex-1">{error}</Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View className="flex-row items-center bg-slate-800 rounded-xl px-4 mb-3 border border-slate-700">
            <Ionicons name="person-outline" size={18} color="#64748b" />
            <TextInput
              className="flex-1 text-white py-4 ml-3 text-base"
              placeholder="Nombre completo"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />
          </View>

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

          <View className="flex-row items-center bg-slate-800 rounded-xl px-4 mb-3 border border-slate-700">
            <Ionicons name="call-outline" size={18} color="#64748b" />
            <TextInput
              className="flex-1 text-white py-4 ml-3 text-base"
              placeholder="Teléfono (opcional)"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View className="flex-row items-center bg-slate-800 rounded-xl px-4 mb-6 border border-slate-700">
            <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
            <TextInput
              className="flex-1 text-white py-4 ml-3 text-base"
              placeholder="Contraseña (mín. 6 caracteres)"
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
            onPress={handleRegister}
            disabled={loading || !isValid}
            activeOpacity={0.8}
            style={{ opacity: isValid ? 1 : 0.5 }}
          >
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

        <TouchableOpacity onPress={() => router.back()} className="py-3">
          <Text className="text-brand-500 text-center text-sm">
            Ya tengo cuenta, <Text className="font-semibold">iniciar sesión</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
