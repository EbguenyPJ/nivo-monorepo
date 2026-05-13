import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { EmployeeRole } from '@nivo/types';

const TOKEN_KEY = 'nivo_staff_token';
const SESSION_KEY = 'nivo_staff_session';

export interface EmployeeSession {
  id: string;
  email: string;
  name: string;
  role: EmployeeRole;
  role_id?: string;
  is_owner: boolean;
  branch_id?: string;
}

export interface TenantSession {
  id: string;
  name: string;
  subdomain: string;
}

interface AuthState {
  token: string | null;
  employee: EmployeeSession | null;
  tenant: TenantSession | null;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  login: (token: string, employee: EmployeeSession, tenant: TenantSession) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  employee: null,
  tenant: null,
  isHydrated: false,

  hydrate: async () => {
    try {
      const [token, session] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(SESSION_KEY),
      ]);
      if (token && session) {
        const parsed = JSON.parse(session);
        set({
          token,
          employee: parsed.employee,
          tenant: parsed.tenant,
          isHydrated: true,
        });
      } else {
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },

  login: async (token, employee, tenant) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ employee, tenant })),
    ]);
    set({ token, employee, tenant });
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(SESSION_KEY),
    ]);
    set({ token: null, employee: null, tenant: null });
  },
}));
