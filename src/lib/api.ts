import { Subscription, AnalyticsSummary, Category, FilterOptions, User } from '../types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('subtrack_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('subtrack_token', token);
  } else {
    localStorage.removeItem('subtrack_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      setAuthToken(null);
      // Let the app re-render login without hard reloading
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<{ success: boolean; token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    register: (data: { name: string; email: string; password: string; currency?: string; seedSamples?: boolean }) =>
      request<{ success: boolean; token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    demo: () =>
      request<{ success: boolean; token: string; user: User }>('/auth/demo', {
        method: 'POST',
      }),
    getMe: () =>
      request<{ success: boolean; user: User }>('/auth/me'),
    updateMe: (data: Partial<User>) =>
      request<{ success: boolean; user: User }>('/auth/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  subscriptions: {
    list: (filters?: Partial<FilterOptions>) => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, val]) => {
          if (val && val !== 'all') params.append(key, val);
        });
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      return request<{ success: boolean; data: Subscription[]; count: number }>(`/subscriptions${qs}`);
    },
    get: (id: string) =>
      request<{ success: boolean; data: Subscription }>(`/subscriptions/${id}`),
    create: (data: Partial<Subscription>) =>
      request<{ success: boolean; data: Subscription; message: string }>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Subscription>) =>
      request<{ success: boolean; data: Subscription; message: string }>(`/subscriptions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/subscriptions/${id}`, {
        method: 'DELETE',
      }),
    renew: (id: string) =>
      request<{ success: boolean; data: Subscription; message: string }>(`/subscriptions/${id}/renew`, {
        method: 'POST',
      }),
    toggleStatus: (id: string, status: string) =>
      request<{ success: boolean; data: Subscription; message: string }>(`/subscriptions/${id}/toggle-status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    resetSeed: () =>
      request<{ success: boolean; message: string }>('/subscriptions/reset-seed', {
        method: 'POST',
      }),
    import: (subscriptions: Partial<Subscription>[]) =>
      request<{ success: boolean; importedCount: number; message: string }>('/subscriptions/import', {
        method: 'POST',
        body: JSON.stringify({ subscriptions }),
      }),
  },

  analytics: {
    getSummary: () =>
      request<{ success: boolean; data: AnalyticsSummary }>('/analytics/summary'),
  },

  categories: {
    list: () =>
      request<{ success: boolean; data: Category[] }>('/categories'),
    create: (data: { name: string; icon?: string; color?: string }) =>
      request<{ success: boolean; data: Category }>('/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
