import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  variant_id: string;
  product_name: string;
  sku: string;
  image_url: string | null;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.variant_id === item.variant_id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variant_id === item.variant_id
                  ? { ...i, quantity: i.quantity + (item.quantity || 1) }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: item.quantity || 1 }] };
        }),
      removeItem: (variantId) =>
        set((state) => ({ items: state.items.filter((i) => i.variant_id !== variantId) })),
      updateQuantity: (variantId, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((i) => i.variant_id !== variantId)
            : state.items.map((i) => (i.variant_id === variantId ? { ...i, quantity } : i)),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'nivo-cart' },
  ),
);

export const getCartTotal = () => {
  const items = useCartStore.getState().items;
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
};

export const getCartItemCount = () => {
  const items = useCartStore.getState().items;
  return items.reduce((sum, i) => sum + i.quantity, 0);
};
