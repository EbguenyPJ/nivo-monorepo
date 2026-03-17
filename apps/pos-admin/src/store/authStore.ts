import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api';

interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
}

interface AuthState {
  token: string | null;
  user: any | null;
  userType: 'super-admin' | 'employee' | null;
  tenant: TenantInfo | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, tenant?: string) => Promise<void>;
  loginAsEmployee: (token: string, user: any, tenant: TenantInfo) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      userType: null,
      tenant: null,
      isAuthenticated: false,

      login: async (email: string, password: string, tenant?: string) => {
        const body: any = { email, password };
        if (tenant) body.tenant = tenant;

        const response = await apiClient.post('/auth/login', body);
        const { access_token, user, tenant: tenantData } = response.data;

        set({
          token: access_token,
          user,
          userType: tenantData ? 'employee' : 'super-admin',
          tenant: tenantData || null,
          isAuthenticated: true,
        });
      },

      loginAsEmployee: (token: string, user: any, tenant: TenantInfo) => {
        set({
          token,
          user,
          userType: 'employee',
          tenant,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          token: null,
          user: null,
          userType: null,
          tenant: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'nivo-auth',
    },
  ),
);
