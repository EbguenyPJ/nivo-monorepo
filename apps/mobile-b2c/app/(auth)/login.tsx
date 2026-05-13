import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
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
            disabled={loading || !email || !password}
            activeOpacity={0.8}
            style={{ opacity: email && password ? 1 : 0.5 }}
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
