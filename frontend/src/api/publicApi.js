import { useQuery } from '@tanstack/react-query';

const base = (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080/api').replace(/\/+$/, '');
const api = base.endsWith('/api') ? base : `${base}/api`;

// Public requests deliberately do not attach sessions, tokens, or refresh interceptors.
export async function publicRequest(path, options = {}) {
  const response = await fetch(`${api}/public/${path}`, {
    credentials: 'omit', signal: AbortSignal.timeout(15000), ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 429 ? 'Too many requests. Please wait before trying again.' : body.message || 'Unable to connect. Please try again.');
    error.fieldErrors = body.fieldErrors || {};
    throw error;
  }
  return body;
}

export const usePublicConfig = () => useQuery({
  queryKey: ['public', 'config'], queryFn: () => publicRequest('config'), staleTime: 60000, retry: false,
});
