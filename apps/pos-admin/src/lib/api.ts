import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const authData = localStorage.getItem('nivo-auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.state?.token) {
          config.headers.Authorization = `Bearer ${parsed.state.token}`;
        }
        // Inject X-Tenant-Id for tenant-scoped API calls (needed in localhost dev)
        if (parsed.state?.tenant?.subdomain) {
          config.headers['X-Tenant-Id'] = parsed.state.tenant.subdomain;
        }
      } catch {}
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('nivo-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
