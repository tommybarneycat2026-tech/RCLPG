const API_URL = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('rclpg_token');
}

function getExpiry() {
  return localStorage.getItem('rclpg_expires_at');
}

export { getToken, getExpiry };

export function clearSession() {
  localStorage.removeItem('rclpg_token');
  localStorage.removeItem('rclpg_expires_at');
  localStorage.removeItem('rclpg_admin');
}

export function isSessionExpired() {
  const expiry = getExpiry();
  if (!expiry) return true;
  return new Date() >= new Date(expiry);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token && !isSessionExpired()) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSession();
    if (!path.includes('/auth/login')) {
      window.location.href = '/login';
    }
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  }

  if (!response.ok) {
    throw new Error('Download failed');
  }

  return response;
}

export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (name, username, email, password, phoneNumber) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password, phoneNumber }),
    }),
  me: () => request('/auth/me'),
  getProfile: () => request('/users/me'),
  updateProfile: (body) =>
    request('/users/me', { method: 'PUT', body: JSON.stringify(body) }),
  getUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/users${qs ? `?${qs}` : ''}`);
  },
  getUser: (adminId) => request(`/users/${adminId}`),
  updateUser: (adminId, body) =>
    request(`/users/${adminId}`, { method: 'PUT', body: JSON.stringify(body) }),
  archiveUser: (adminId) =>
    request(`/users/${adminId}/archive`, { method: 'PATCH' }),
  createUser: (body) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
  getMetrics: () => request('/dashboard/metrics'),
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  createProduct: (body) => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (productId, body) =>
    request(`/products/${productId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProduct: (productId) => request(`/products/${productId}`, { method: 'DELETE' }),
  getWeeklySummary: () => request('/products/summary/weekly'),
  getCustomers: (search = '') => request(`/customers?search=${encodeURIComponent(search)}`),
  getSales: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/sales?${qs}`);
  },
  createSale: (body) => request('/sales', { method: 'POST', body: JSON.stringify(body) }),
  updateSale: (saleId, body) =>
    request(`/sales/${saleId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSale: (saleId) => request(`/sales/${saleId}`, { method: 'DELETE' }),
  getCredits: () => request('/credits'),
  getCreditSummary: (saleId) => request(`/credits/${saleId}/summary`),
  getCreditHistory: (saleId) => request(`/credits/${saleId}/history`),
  createCreditPayment: (saleId, amount) =>
    request(`/credits/${saleId}/payments`, { method: 'POST', body: JSON.stringify({ amount }) }),
  exportReport: async (params) => {
    const qs = new URLSearchParams(params).toString();
    const response = await request(`/dashboard/export?${qs}`);
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="(.+)"/);
    const filename = match?.[1] || `RCLPG_Report.${params.format === 'pdf' ? 'pdf' : 'xlsx'}`;
    return { blob, filename };
  },
};

export function saveSession({ token, expiresAt, admin }) {
  localStorage.setItem('rclpg_token', token);
  localStorage.setItem('rclpg_expires_at', expiresAt);
  localStorage.setItem('rclpg_admin', JSON.stringify(admin));
}

export function getStoredAdmin() {
  const raw = localStorage.getItem('rclpg_admin');
  return raw ? JSON.parse(raw) : null;
}

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);
