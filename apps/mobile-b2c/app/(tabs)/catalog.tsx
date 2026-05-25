import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useCatalog, useCategories, type CatalogProduct } from '@/lib/queries';

export default function CatalogScreen() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const catalog = useCatalog({ search: search || undefined, category_id: categoryId });
  const categories = useCategories();

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderProduct = useCallback(({ item, index }: { item: CatalogProduct; index: number }) => {
    const isFav = favorites.has(item.id);
    const isOutOfStock = (item.total_stock ?? 0) <= 0;

    return (
      <Animated.View entering={FadeInDown.delay(index * 40).duration(300)} style={{ flex: 1, margin: 6 }}>
        <TouchableOpacity
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderRadius: 24,
            overflow: 'hidden',
            opacity: isOutOfStock ? 0.55 : 1,
          }}
          onPress={() => router.push(`/product/${item.id}`)}
          activeOpacity={0.8}
        >
          <View>
            {item.image_url ? (
              <View>
                <Image
                  source={{ uri: item.image_url }}
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                  }}
                  contentFit="cover"
                  transition={200}
                />
                {isOutOfStock && (
                  <View style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <View style={{
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      transform: [{ rotate: '-15deg' }],
                    }}>
                      <Text style={{ color: '#f87171', fontSize: 14, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>
                        Agotado
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ width: '100%', aspectRatio: 1, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="footsteps-outline" size={40} color="rgba(255,255,255,0.15)" />
                {isOutOfStock && (
                  <View style={{
                    position: 'absolute',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    transform: [{ rotate: '-15deg' }],
                  }}>
                    <Text style={{ color: '#f87171', fontSize: 14, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>
                      Agotado
                    </Text>
                  </View>
                )}
              </View>
            )}
            {/* Favorite heart */}
            <TouchableOpacity
              onPress={() => toggleFavorite(item.id)}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: 'rgba(0,0,0,0.45)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={18}
                color={isFav ? '#f87171' : 'rgba(255,255,255,0.6)'}
              />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 14 }}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>
              {item.brand_name ?? 'Sin marca'}
            </Text>
            <Text style={{ color: isOutOfStock ? 'rgba(255,255,255,0.4)' : '#f8fafc', fontSize: 14, fontWeight: '600', marginTop: 3 }} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
              <Text style={{ color: isOutOfStock ? 'rgba(255,255,255,0.3)' : '#818cf8', fontSize: 16, fontWeight: '800' }}>
                ${Number(item.min_price).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
              </Text>
              {item.min_price !== item.max_price && (
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginLeft: 4 }}>
                  — ${Number(item.max_price).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [favorites]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0f1a' }}>
      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
          }}
        >
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.35)" />
          <TextInput
            style={{ flex: 1, color: '#f8fafc', paddingVertical: 14, marginLeft: 10, fontSize: 15 }}
            placeholder="Buscar zapatos..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category pills */}
      <View style={{ height: 52 }}>
        <FlatList
          horizontal
          data={[{ id: undefined, name: 'Todos' }, ...(categories.data ?? [])]}
          keyExtractor={(c) => c.id ?? 'all'}
          style={{ flex: 1, paddingLeft: 8 }}
          contentContainerStyle={{ alignItems: 'center', gap: 8, paddingVertical: 10, paddingRight: 16 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: cat }) => {
            const isActive = categoryId === cat.id;
            return (
              <TouchableOpacity
                style={{
                  backgroundColor: isActive ? '#6366f1' : 'rgba(255,255,255,0.06)',
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: isActive ? 0 : 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
                onPress={() => setCategoryId(cat.id ?? undefined)}
              >
                <Text style={{
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)',
                  fontSize: 13,
                  fontWeight: isActive ? '700' : '500',
                }} numberOfLines={1}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Products grid */}
      {catalog.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={catalog.data?.data ?? []}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 120, paddingTop: 4 }}
          renderItem={renderProduct}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 80 }}>
              <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.12)" />
              <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 16 }}>No se encontraron productos</Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>Intenta con otra busqueda</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
