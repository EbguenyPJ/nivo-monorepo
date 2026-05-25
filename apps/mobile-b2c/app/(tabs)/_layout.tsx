import { Tabs, router } from 'expo-router';
import { View, Text, Pressable, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '@/lib/cart-store';

function CartBadge() {
  const count = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  if (count === 0) return null;
  return (
    <TouchableOpacity
      onPress={() => router.push('/cart')}
      style={{ marginRight: 16, position: 'relative' }}
    >
      <Ionicons name="bag-handle-outline" size={24} color="#f8fafc" />
      <View style={{ position: 'absolute', top: -4, right: -8, backgroundColor: '#6366f1', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{count > 9 ? '9+' : count}</Text>
      </View>
    </TouchableOpacity>
  );
}

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  home: { active: 'home', inactive: 'home-outline' },
  catalog: { active: 'grid', inactive: 'grid-outline' },
  loyalty: { active: 'qr-code', inactive: 'qr-code-outline' },
  layaways: { active: 'layers', inactive: 'layers-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#0c0f1a',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        paddingBottom: bottomPad,
        paddingTop: 10,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.index === index;
        const icons = TAB_ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 4,
            }}
          >
            <Ionicons
              name={(isFocused ? icons.active : icons.inactive) as any}
              size={22}
              color={isFocused ? '#818cf8' : 'rgba(255,255,255,0.35)'}
            />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                marginTop: 4,
                color: isFocused ? '#818cf8' : 'rgba(255,255,255,0.35)',
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: '#0c0f1a' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '800', fontSize: 20, letterSpacing: -0.5 },
        headerShadowVisible: false,
        headerRight: () => <CartBadge />,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Inicio',
          headerTitle: 'Nivo',
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Tienda',
          headerTitle: 'Catalogo',
        }}
      />
      <Tabs.Screen
        name="loyalty"
        options={{
          title: 'Wallet',
          headerTitle: 'Mi Tarjeta',
          headerRight: () => null,
        }}
      />
      <Tabs.Screen
        name="layaways"
        options={{
          title: 'Apartados',
          headerTitle: 'Mis Apartados',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          headerTitle: 'Mi Cuenta',
          headerRight: () => null,
        }}
      />
    </Tabs>
  );
}
