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
  isImpersonating: boolean;
  // Saved super-admin session to restore on exit impersonation
  _savedAdminToken: string | null;
  _savedAdminUser: any | null;
  _savedImpersonatedTenantId: string | null;
  login: (email: string, password: string, tenant?: string) => Promise<void>;
  loginAsEmployee: (token: string, user: any, tenant: TenantInfo) => void;
  exitImpersonation: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      userType: null,
      tenant: null,
      isAuthenticated: false,
      isImpersonating: false,
      _savedAdminToken: null,
      _savedAdminUser: null,
      _savedImpersonatedTenantId: null,

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
          isImpersonating: false,
          _savedAdminToken: null,
          _savedAdminUser: null,
          _savedImpersonatedTenantId: null,
        });
      },

      loginAsEmployee: (token: string, user: any, tenant: TenantInfo) => {
        const state = get();
        set({
          token,
          user,
          userType: 'employee',
          tenant,
          isAuthenticated: true,
          isImpersonating: true,
          // Save the current super-admin session
          _savedAdminToken: state.token,
          _savedAdminUser: state.user,
          _savedImpersonatedTenantId: tenant.id,
        });
      },

      exitImpersonation: () => {
        const state = get();
        set({
          token: state._savedAdminToken,
          user: state._savedAdminUser,
          userType: 'super-admin',
          tenant: null,
          isAuthenticated: true,
          isImpersonating: false,
          _savedAdminToken: null,
          _savedAdminUser: null,
          _savedImpersonatedTenantId: null,
        });
      },

      logout: () => {
        set({
          token: null,
          user: null,
          userType: null,
          tenant: null,
          isAuthenticated: false,
          isImpersonating: false,
          _savedAdminToken: null,
          _savedAdminUser: null,
          _savedImpersonatedTenantId: null,
        });
      },
    }),
    {
      name: 'nivo-auth',
    },
  ),
);
