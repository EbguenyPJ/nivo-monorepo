import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const TENANT = process.env.EXPO_PUBLIC_TENANT_SUBDOMAIN ?? 'demo';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-subdomain': TENANT,
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? 'Error de servidor');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = await getToken();
    const headers: Record<string, string> = {
      'x-tenant-subdomain': TENANT,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.message ?? 'Error de servidor');
    }
    return res.json();
  },
};
