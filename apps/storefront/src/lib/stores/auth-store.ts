import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../api';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface AuthState {
  token: string | null;
  customer: Customer | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      customer: null,
      login: async (email, password) => {
        const { data } = await apiClient.post('/mobile/auth/login', { email, password });
        set({ token: data.access_token, customer: data.customer });
      },
      register: async (regData) => {
        const { data } = await apiClient.post('/mobile/auth/register', regData);
        set({ token: data.access_token, customer: data.customer });
      },
      logout: () => set({ token: null, customer: null }),
    }),
    { name: 'nivo-storefront-auth' },
  ),
);
