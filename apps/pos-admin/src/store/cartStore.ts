import { create } from 'zustand';

interface CartItem {
  id: string;
  variant_id: string;
  name: string;
  variant_label: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
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

  clearCart: () => set({ items: [] }),

  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
}));
