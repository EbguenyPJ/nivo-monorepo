import { create } from 'zustand';

export interface CartItem {
  id: string;           // variant_id (used as key for grouping)
  variant_id: string;
  product_id: string;
  name: string;
  variant_label: string;  // "Rojo - 26 MX"
  image_url?: string;
  default_price: number;  // Precio de lista default
  price: number;          // Precio actual (puede cambiar por selector)
  price_list_id?: string; // Lista seleccionada para este ítem
  price_list_name?: string;
  quantity: number;
  stock: number;          // Para validación visual (-1 = desconocido)
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateItemPrice: (id: string, price: number, priceListId: string, priceListName: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        };
      }
      return { items: [...state.items, { ...item, quantity: 1 }] };
    });
  },

  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

  updateQuantity: (id, quantity) => {
    if (quantity <= 0) {
      set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
    } else {
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
      }));
    }
  },

  updateItemPrice: (id, price, priceListId, priceListName) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id
          ? { ...i, price, price_list_id: priceListId, price_list_name: priceListName }
          : i,
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
}));
