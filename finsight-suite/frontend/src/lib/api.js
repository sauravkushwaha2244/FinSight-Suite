import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function apiFetch(path, options = {}) {
  const { responseType, ...fetchOptions } = options;
  let token = null;

  if (typeof window !== 'undefined') {
    token = localStorage.getItem('finsight_token');
  }

  if (!token) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    } catch (e) {
      // Supabase is optional when using the local backend authentication.
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const detailMsg = errorData?.detail || errorData?.message || `API error: ${response.status}`;
    const err = new Error(typeof detailMsg === 'object' ? JSON.stringify(detailMsg) : detailMsg);
    err.status = response.status;
    err.data = errorData;
    throw err;
  }

  return responseType === 'blob' ? response.blob() : response.json();
}

export const api = {
  get: (path, options) => apiFetch(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiFetch(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (path, body, options) => apiFetch(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: (path, options) => apiFetch(path, { ...options, method: 'DELETE' }),
  download: (path, options) => apiFetch(path, { ...options, method: 'GET', responseType: 'blob' }),
};
