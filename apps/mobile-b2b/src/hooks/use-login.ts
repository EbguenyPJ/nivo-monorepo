import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore, type EmployeeSession, type TenantSession } from '../stores/auth.store';

interface LoginPayload {
  email: string;
  password: string;
  tenant: string;
}

interface PinLoginPayload {
  pin_code: string;
  tenant: string;
  branch_id: string;
}

interface LoginResponse {
  access_token: string;
  user: EmployeeSession;
  tenant: TenantSession;
}

export function useEmployeeLogin() {
  const login = useAuthStore((s) => s.login);

  return useMutation<LoginResponse, Error, LoginPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<LoginResponse>('/auth/login', payload);
      return data;
    },
    onSuccess: async (data) => {
      await login(data.access_token, data.user, data.tenant);
    },
  });
}

export function usePinLogin() {
  const login = useAuthStore((s) => s.login);

  return useMutation<LoginResponse, Error, PinLoginPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<LoginResponse>('/auth/login/pin', payload);
      return data;
    },
    onSuccess: async (data) => {
      await login(data.access_token, data.user, data.tenant);
    },
  });
}
