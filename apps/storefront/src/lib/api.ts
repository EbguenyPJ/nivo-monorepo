import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const authData = localStorage.getItem('nivo-storefront-auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.state?.token) {
          config.headers.Authorization = `Bearer ${parsed.state.token}`;
        }
      } catch {}
    }

    const hostname = window.location.hostname;
    if (hostname.endsWith('.localhost')) {
      const sub = hostname.replace('.localhost', '');
      if (sub) config.headers['X-Tenant-Id'] = sub;
    } else {
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        config.headers['X-Tenant-Id'] = parts[0];
      }
    }
  }
  return config;
});
