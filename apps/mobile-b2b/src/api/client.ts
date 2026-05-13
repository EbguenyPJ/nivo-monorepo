import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const API_BASE = __DEV__
  ? 'http://localhost:3000/api/v1'
  : 'https://api.nivo.com/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const { token, tenant } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (tenant?.subdomain) {
    config.headers['x-tenant-id'] = tenant.subdomain;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
