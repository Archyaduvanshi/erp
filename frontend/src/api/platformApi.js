const configured = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080/api';
const API_BASE = configured.replace(/\/+$/, '').endsWith('/api') ? configured.replace(/\/+$/, '') : `${configured.replace(/\/+$/, '')}/api`;
const SESSION_KEY = 'erp.platform.session';
let token = '';
let refreshPromise = null;

const stripSecrets = (value = {}) => {
  const { accessToken, refreshToken, password, passwordHash, token: ignored, ...safe } = value;
  return safe;
};

const saveSession = (session) => {
  const safe = stripSecrets(session);
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
  return safe;
};

const clearSession = () => {
  token = '';
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('erp.platform.accessToken');
  localStorage.removeItem('erp.platform.accessToken');
  window.dispatchEvent(new Event('erp:platform-session-cleared'));
};

const cachedSession = () => {
  try { return stripSecrets(JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') || {}); }
  catch { return null; }
};

async function refresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_BASE}/platform/auth/refresh`, {
    method: 'POST', credentials: 'include', headers: { Accept: 'application/json' },
  }).then(async (response) => {
    if (!response.ok) throw new Error('Platform session expired.');
    const body = await response.json();
    token = response.headers.get('X-Access-Token') || body.accessToken || '';
    return saveSession(body);
  }).catch((error) => { clearSession(); throw error; }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function request(path, options = {}, retry = true) {
  const isPublic = ['/platform/auth/login', '/platform/auth/refresh', '/platform/auth/logout'].includes(path);
  if (!isPublic && !token) await refresh();
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!isPublic && token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  if (response.status === 401 && !isPublic && retry) {
    token = '';
    await refresh();
    return request(path, options, false);
  }
  if (!response.ok) {
    let message = response.statusText || 'Unable to contact the platform service.';
    try { const body = await response.json(); message = body.message || message; } catch { /* response has no JSON body */ }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

const query = (params = {}) => {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== '' && value != null) values.set(key, value); });
  const result = values.toString();
  return result ? `?${result}` : '';
};

export const platformAuthApi = {
  login: async (payload) => {
    const response = await request('/platform/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    token = response.accessToken || '';
    return saveSession(response);
  },
  restore: refresh,
  cachedSession,
  logout: async () => { try { await request('/platform/auth/logout', { method: 'POST' }); } finally { clearSession(); } },
};

export const platformApi = {
  overview: () => request('/platform/overview'),
  institutes: (filters) => request(`/platform/institutes${query(filters)}`),
  createInstitute: (payload) => request('/platform/institutes', { method: 'POST', body: JSON.stringify(payload) }),
  institute: (id) => request(`/platform/institutes/${id}`),
  suspend: (id, payload) => request(`/platform/institutes/${id}/suspend`, { method: 'POST', body: JSON.stringify(payload) }),
  reactivate: (id, payload) => request(`/platform/institutes/${id}/reactivate`, { method: 'POST', body: JSON.stringify(payload) }),
  features: (id) => request(`/platform/institutes/${id}/features`),
  featureDirectory: (filters) => request(`/platform/features${query(filters)}`),
  updateFeature: (id, payload) => request(`/platform/institutes/${id}/features`, { method: 'PUT', body: JSON.stringify(payload) }),
  plans: () => request('/platform/plans'),
  featureRegistry: () => request('/platform/features/options'),
  savePlan: (payload) => request(payload.id ? `/platform/plans/${payload.id}` : '/platform/plans', { method: payload.id ? 'PUT' : 'POST', body: JSON.stringify(payload) }),
  planStatus: (id, payload) => request(`/platform/plans/${id}/status`, { method: 'PUT', body: JSON.stringify(payload) }),
  subscriptionSummary: () => request('/platform/subscriptions/summary'),
  endTrial: (id, payload) => request(`/platform/institutes/${id}/subscriptions/end-trial`, { method: 'POST', body: JSON.stringify(payload) }),
  extendTrial: (id, payload) => request(`/platform/institutes/${id}/subscriptions/extend-trial`, { method: 'POST', body: JSON.stringify(payload) }),
  subscriptions: (id) => request(`/platform/institutes/${id}/subscriptions`),
  subscriptionDirectory: (filters) => request(`/platform/subscriptions${query(filters)}`),
  changeSubscription: (id, payload) => request(`/platform/institutes/${id}/subscriptions`, { method: 'POST', body: JSON.stringify(payload) }),
  usage: (id) => request(`/platform/institutes/${id}/usage`),
  usageOverview: () => request('/platform/usage/overview'),
  usageDirectory: (filters) => request(`/platform/usage${query(filters)}`),
  gateway: (id) => request(`/platform/institutes/${id}/gateway`),
  currentGatewayMerchant: (id) => request(`/platform/institutes/${id}/gateway/cashfree/merchant`),
  linkGatewayMerchant: (id, payload) => request(`/platform/institutes/${id}/gateway/cashfree/merchant`, { method: 'PUT', body: JSON.stringify(payload) }),
  createGatewayMerchant: (id) => request(`/platform/institutes/${id}/gateway/cashfree/merchant`, { method: 'POST' }),
  refreshGatewayMerchant: (id) => request(`/platform/institutes/${id}/gateway/cashfree/refresh`, { method: 'POST' }),
  gatewayOnboardingLink: (id) => request(`/platform/institutes/${id}/gateway/cashfree/onboarding-link`, { method: 'POST' }),
  gatewayAttempts: (id, filters) => request(`/platform/institutes/${id}/gateway/cashfree/attempts${query(filters)}`),
  gateways: (filters) => request(`/platform/gateways${query(filters)}`),
  invoices: (filters) => request(`/platform/billing${query(filters)}`),
  createInvoice: (payload) => request('/platform/billing', { method: 'POST', body: JSON.stringify(payload) }),
  markInvoicePaid: (id, payload) => request(`/platform/billing/${id}/mark-paid`, { method: 'POST', body: JSON.stringify(payload) }),
  waiveInvoice: (id, payload) => request(`/platform/billing/${id}/waive`, { method: 'POST', body: JSON.stringify(payload) }),
  cancelInvoice: (id, payload) => request(`/platform/billing/${id}/cancel`, { method: 'POST', body: JSON.stringify(payload) }),
  notes: (id) => request(`/platform/institutes/${id}/notes`),
  addNote: (id, payload) => request(`/platform/institutes/${id}/notes`, { method: 'POST', body: JSON.stringify(payload) }),
  audits: (filters) => request(`/platform/audit${query(filters)}`),
  settings: () => request('/platform/settings'),
  updateSettings: (payload) => request('/platform/settings', { method: 'PUT', body: JSON.stringify(payload) }),
};
