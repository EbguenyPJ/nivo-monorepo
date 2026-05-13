import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from './api-client';
import type { CustomerLoginDto, CustomerRegisterDto } from '@nivo/types';

interface AuthUser {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  phone: string | null;
  loyalty_points: number;
  membership_tier: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (dto: CustomerLoginDto) => Promise<void>;
  register: (dto: CustomerRegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  updatePushToken: (pushToken: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (dto) => {
    const res = await api.post<{ access_token: string; user: AuthUser }>(
      '/mobile/auth/login',
      dto,
    );
    await SecureStore.setItemAsync('auth_token', res.access_token);
    set({ user: res.user, token: res.access_token, isAuthenticated: true });
  },

  register: async (dto) => {
    const res = await api.post<{ access_token: string; user: AuthUser }>(
      '/mobile/auth/register',
      dto,
    );
    await SecureStore.setItemAsync('auth_token', res.access_token);
    set({ user: res.user, token: res.access_token, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const user = await api.get<AuthUser>('/mobile/auth/me');
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  updatePushToken: async (pushToken: string) => {
    await api.put('/mobile/auth/push-token', { push_token: pushToken });
  },
}));
