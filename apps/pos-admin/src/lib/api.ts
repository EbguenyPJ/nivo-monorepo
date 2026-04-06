import axios from 'axios';
import { useBranchStore, GENERAL_BRANCH_ID } from '@/store/branchStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Endpoints that are global (not branch-scoped) — never inject branch_id
const BRANCH_EXCLUDED_PATHS = [
  '/products',
  '/brands',
  '/collections',
  '/catalogs/',
  '/tenant-settings',
  '/pricing/price-lists',
  '/pricing/product-list-prices',
  '/pricing/variant-prices',
  '/pricing/calculate',
  '/branches',
  '/reports/branch-comparison',
  '/storage-locations',
  '/customers',
  '/employees',
  '/pos',
];

function shouldExcludeBranchParam(url: string | undefined): boolean {
  if (!url) return true;
  return BRANCH_EXCLUDED_PATHS.some((path) => url.startsWith(path) || url === path);
}

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
        // Inject X-Tenant-Id: from store first, fallback to subdomain detection
        if (parsed.state?.tenant?.subdomain) {
          config.headers['X-Tenant-Id'] = parsed.state.tenant.subdomain;
        } else {
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
      } catch {}
    }

    // Auto-inject branch_id for branch-scoped endpoints
    const branchState = useBranchStore.getState();
    if (
      !branchState.isGeneralSelected &&
      branchState.selectedBranchId &&
      branchState.selectedBranchId !== GENERAL_BRANCH_ID &&
      config.method === 'get' &&
      !shouldExcludeBranchParam(config.url)
    ) {
      config.params = {
        ...config.params,
        branch_id: branchState.selectedBranchId,
      };
    }
  }
  return config;
});

// Endpoints where a 401 is expected (e.g. wrong PIN) and should NOT kill the session
const AUTH_SAFE_PATHS = ['/pos/verify-pin'];

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const requestUrl = error.config?.url || '';
      const isSafePath = AUTH_SAFE_PATHS.some((path) => requestUrl.includes(path));
      if (!isSafePath) {
        localStorage.removeItem('nivo-auth');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
