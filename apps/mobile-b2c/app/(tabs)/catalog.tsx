import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from 'expo-vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useCatalog, useCategories, type CatalogProduct } from '@/lib/queries';

export default function CatalogScreen() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();

  const catalog = useCatalog({ search: search || undefined, category_id: categoryId });
  const categories = useCategories();

  const renderProduct = useCallback(({ item, index }: { item: CatalogProduct; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} className="flex-1 m-1.5">
      <TouchableOpacity
        className="bg-surface-card rounded-xl overflow-hidden"
        onPress={() => router.push(`/product/${item.id}`)}
        activeOpacity={0.8}
      >
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            className="w-full aspect-square"
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="w-full aspect-square bg-slate-700 items-center justify-center">
            <Ionicons name="footsteps-outline" size={40} color="#475569" />
          </View>
        )}
        <View className="p-3">
          <Text className="text-slate-400 text-xs" numberOfLines={1}>
            {item.brand_name ?? 'Sin marca'}
          </Text>
          <Text className="text-white font-medium text-sm mt-0.5" numberOfLines={2}>
            {item.name}
          </Text>
          <View className="flex-row items-baseline mt-1.5">
            <Text className="text-brand-500 font-bold text-base">
              ${Number(item.min_price).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
            </Text>
            {item.min_price !== item.max_price && (
              <Text className="text-slate-500 text-xs ml-1">
                — ${Number(item.max_price).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  ), []);

  return (
    <View className="flex-1 bg-surface">
      {/* Search */}
      <View className="px-4 pt-2 pb-1">
        <View className="flex-row items-center bg-slate-800 rounded-xl px-4">
          <Ionicons name="search" size={18} color="#64748b" />
          <TextInput
            className="flex-1 text-white py-3 ml-2 text-base"
            placeholder="Buscar zapatos..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category pills */}
      <FlatList
        horizontal
        data={[{ id: undefined, name: 'Todos' }, ...(categories.data ?? [])]}
        keyExtractor={(c) => c.id ?? 'all'}
        className="max-h-12 px-2"
        contentContainerClassName="gap-2 py-2"
        showsHorizontalScrollIndicator={false}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            className={`px-4 py-1.5 rounded-full ${
              categoryId === cat.id ? 'bg-brand-500' : 'bg-slate-800'
            }`}
            onPress={() => setCategoryId(cat.id ?? undefined)}
          >
            <Text className={categoryId === cat.id ? 'text-white text-sm font-medium' : 'text-slate-400 text-sm'}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Products grid */}
      {catalog.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={catalog.data?.data ?? []}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerClassName="px-2.5 pb-8"
          renderItem={renderProduct}
          ListEmptyComponent={
            <View className="items-center mt-20">
              <Ionicons name="search-outline" size={48} color="#334155" />
              <Text className="text-slate-400 mt-3 text-base">No se encontraron productos</Text>
              <Text className="text-slate-500 text-sm mt-1">Intenta con otra búsqueda</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
