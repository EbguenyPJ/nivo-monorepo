import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/auth.store';

function getDevApiBase(): string {
  // In Expo Go, derive the API host from the dev server URL
  const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.experienceUrl ?? '';
  const lanIp = debuggerHost.split(':')[0];
  if (lanIp && lanIp !== 'localhost') {
    return `http://${lanIp}:3000/api/v1`;
  }
  // iOS simulator can use localhost; Android emulator needs 10.0.2.2
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:3000/api/v1`;
}

const API_BASE = __DEV__
  ? getDevApiBase()
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
