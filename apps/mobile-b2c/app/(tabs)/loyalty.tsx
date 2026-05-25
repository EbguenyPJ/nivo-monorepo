import { useEffect, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Brightness from 'expo-brightness';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLoyaltyProfile } from '@/lib/queries';
import { useAuthStore } from '@/lib/auth-store';

const TIER_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  bronze: { color: '#cd7f32', bg: 'bg-amber-900/30', icon: 'medal-outline', label: 'Bronce' },
  silver: { color: '#c0c0c0', bg: 'bg-slate-400/20', icon: 'medal-outline', label: 'Plata' },
  gold: { color: '#ffd700', bg: 'bg-yellow-500/20', icon: 'trophy-outline', label: 'Oro' },
  wholesale: { color: '#818cf8', bg: 'bg-brand-500/20', icon: 'diamond-outline', label: 'Mayoreo' },
};

export default function LoyaltyScreen() {
  const user = useAuthStore((s) => s.user);
  const loyalty = useLoyaltyProfile();
  const prevBrightness = useRef<number | null>(null);

  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  useEffect(() => {
    pulseScale.value = withRepeat(withTiming(1.03, { duration: 1500 }), -1, true);
  }, [pulseScale]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          if (Platform.OS !== 'web') {
            const { status } = await Brightness.requestPermissionsAsync();
            if (status === 'granted' && mounted) {
              prevBrightness.current = await Brightness.getBrightnessAsync();
              await Brightness.setBrightnessAsync(1);
            }
          }
        } catch {}
      })();

      return () => {
        mounted = false;
        if (prevBrightness.current != null && Platform.OS !== 'web') {
          Brightness.setBrightnessAsync(prevBrightness.current).catch(() => {});
          prevBrightness.current = null;
        }
      };
    }, []),
  );

  if (loyalty.isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0c0f1a' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const data = loyalty.data;
  const qrPayload = JSON.stringify({
    type: 'nivo_loyalty',
    customer_id: user?.customer_id ?? user?.id,
    ts: Date.now(),
  });

  const tier = TIER_CONFIG[data?.tier ?? 'bronze'] ?? TIER_CONFIG.bronze;

  return (
    <View className="flex-1" style={{ backgroundColor: '#0c0f1a' }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 16, paddingBottom: 60, paddingHorizontal: 20 }}>
        <Animated.Text entering={FadeIn.duration(400)} className="text-white text-2xl font-black mb-1 tracking-tight">
          Mi Tarjeta Nivo
        </Animated.Text>
        <Text className="text-white/35 text-sm mb-8">
          Presenta este QR en tienda para acumular puntos
        </Text>

        {/* QR Card */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={pulseStyle}>
          <View
            className="rounded-3xl p-7 items-center w-full"
            style={{
              maxWidth: 320,
              backgroundColor: '#ffffff',
              shadowColor: '#6366f1',
              shadowOpacity: 0.35,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 12 },
              elevation: 15,
            }}
          >
            <QRCode
              value={qrPayload}
              size={220}
              color="#0c0f1a"
              backgroundColor="#ffffff"
              ecl="M"
            />
            <Text className="text-slate-900 font-black text-lg mt-5">{user?.name}</Text>
            <Text className="text-slate-500 text-xs mt-1">{user?.email}</Text>
            <View className="flex-row items-center mt-2">
              <Ionicons name={tier.icon as any} size={14} color={tier.color} />
              <Text className="text-xs font-bold ml-1" style={{ color: tier.color }}>
                Nivel {tier.label}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Points & Tier cards */}
        <View className="flex-row gap-4 mt-8 w-full">
          <Animated.View
            entering={FadeInDown.delay(200)}
            className="flex-1 rounded-3xl p-5 items-center"
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
            }}
          >
            <Ionicons name="star" size={22} color="#fbbf24" />
            <Text className="text-white text-3xl font-black mt-2">
              {data?.points?.toLocaleString() ?? '0'}
            </Text>
            <Text className="text-white/35 text-xs mt-1">Puntos</Text>
          </Animated.View>
          <Animated.View
            entering={FadeInDown.delay(300)}
            className="flex-1 rounded-3xl p-5 items-center overflow-hidden"
          >
            <LinearGradient
              colors={[tier.color + '20', tier.color + '08']}
              style={{
                position: 'absolute',
                left: 0, right: 0, top: 0, bottom: 0,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: tier.color + '30',
              }}
            />
            <Ionicons name={tier.icon as any} size={22} color={tier.color} />
            <Text className="text-2xl font-black mt-2 capitalize" style={{ color: tier.color }}>
              {tier.label}
            </Text>
            <Text className="text-white/35 text-xs mt-1">Nivel</Text>
          </Animated.View>
        </View>

        {/* Stats */}
        <Animated.View
          entering={FadeInDown.delay(400)}
          className="rounded-3xl p-5 w-full mt-4"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
          }}
        >
          <View className="flex-row justify-between items-center py-1.5">
            <View className="flex-row items-center">
              <Ionicons name="bag-check-outline" size={16} color="rgba(255,255,255,0.35)" />
              <Text className="text-white/50 text-sm ml-2">Compras totales</Text>
            </View>
            <Text className="text-white font-bold">{data?.total_purchases ?? 0}</Text>
          </View>
          <View className="h-px my-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <View className="flex-row justify-between items-center py-1.5">
            <View className="flex-row items-center">
              <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.35)" />
              <Text className="text-white/50 text-sm ml-2">Miembro desde</Text>
            </View>
            <Text className="text-white font-medium">
              {data?.member_since
                ? new Date(data.member_since).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
                : '--'}
            </Text>
          </View>
        </Animated.View>

        <Text className="text-white/20 text-xs text-center mt-6">
          El brillo de pantalla se ha maximizado para facilitar la lectura del escaner.
        </Text>
      </ScrollView>
    </View>
  );
}
