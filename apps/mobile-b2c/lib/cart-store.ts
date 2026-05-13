import { create } from 'zustand';

export interface CartItem {
  variant_id: string;
  product_id: string;
  product_name: string;
  image_url: string | null;
  attributes: Record<string, string>;
  sku: string;
  unit_price: number;
  quantity: number;
  stock_available: number;
}

interface CartState {
  items: CartItem[];
  fulfillmentType: 'bopis' | 'delivery';
  pickupBranchId: string | null;

  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  setFulfillment: (type: 'bopis' | 'delivery', branchId?: string) => void;
  clear: () => void;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  fulfillmentType: 'bopis',
  pickupBranchId: null,

  addItem: (item) => {
    const { items } = get();
    const existing = items.find((i) => i.variant_id === item.variant_id);
    if (existing) {
      if (existing.quantity < existing.stock_available) {
        set({
          items: items.map((i) =>
            i.variant_id === item.variant_id
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          ),
        });
      }
    } else {
      set({ items: [...items, { ...item, quantity: 1 }] });
    }
  },

  removeItem: (variantId) => {
    set({ items: get().items.filter((i) => i.variant_id !== variantId) });
  },

  updateQuantity: (variantId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(variantId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.variant_id === variantId
          ? { ...i, quantity: Math.min(quantity, i.stock_available) }
          : i,
      ),
    });
  },

  setFulfillment: (type, branchId) => {
    set({ fulfillmentType: type, pickupBranchId: branchId ?? null });
  },

  clear: () => set({ items: [], pickupBranchId: null }),

  total: () =>
    get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),

  itemCount: () =>
    get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
