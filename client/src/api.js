const TOKEN_KEY = 'adiong_admin_token';
const USER_KEY = 'adiong_admin_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};
export const getSavedUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
};
export const setSavedUser = (u) => {
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
  else localStorage.removeItem(USER_KEY);
};

async function req(path, { method = 'GET', body, auth = false, form = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? (form ? body : JSON.stringify(body)) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const api = {
  site: () => req('/api/public/site'),
  articles: (params = '') => req(`/api/public/articles${params}`),
  article: (slug) => req(`/api/public/articles/${slug}`),
  causes: () => req('/api/public/causes'),
  cause: (slug) => req(`/api/public/causes/${slug}`),
  campaigns: () => req('/api/public/campaigns'),
  campaign: (slug) => req(`/api/public/campaigns/${slug}`),
  contact: (body) => req('/api/contact', { method: 'POST', body }),
  donate: (body) => req('/api/donate', { method: 'POST', body }),
  login: (body) => req('/api/auth/login', { method: 'POST', body }),
  password: (body) => req('/api/auth/password', { method: 'POST', body, auth: true }),
  dashboard: () => req('/api/admin/dashboard', { auth: true }),
  adminArticles: {
    list: () => req('/api/admin/articles', { auth: true }),
    create: (b) => req('/api/admin/articles', { method: 'POST', body: b, auth: true }),
    update: (id, b) => req(`/api/admin/articles/${id}`, { method: 'PUT', body: b, auth: true }),
    remove: (id) => req(`/api/admin/articles/${id}`, { method: 'DELETE', auth: true })
  },
  adminCauses: {
    list: () => req('/api/admin/causes', { auth: true }),
    create: (b) => req('/api/admin/causes', { method: 'POST', body: b, auth: true }),
    update: (id, b) => req(`/api/admin/causes/${id}`, { method: 'PUT', body: b, auth: true }),
    remove: (id) => req(`/api/admin/causes/${id}`, { method: 'DELETE', auth: true })
  },
  adminCampaigns: {
    list: () => req('/api/admin/campaigns', { auth: true }),
    create: (b) => req('/api/admin/campaigns', { method: 'POST', body: b, auth: true }),
    update: (id, b) => req(`/api/admin/campaigns/${id}`, { method: 'PUT', body: b, auth: true }),
    remove: (id) => req(`/api/admin/campaigns/${id}`, { method: 'DELETE', auth: true })
  },
  adminDonations: {
    list: () => req('/api/admin/donations', { auth: true }),
    update: (id, b) => req(`/api/admin/donations/${id}`, { method: 'PUT', body: b, auth: true }),
    remove: (id) => req(`/api/admin/donations/${id}`, { method: 'DELETE', auth: true })
  },
  adminMessages: {
    list: () => req('/api/admin/messages', { auth: true }),
    markRead: (id) => req(`/api/admin/messages/${id}`, { method: 'PUT', body: {}, auth: true }),
    remove: (id) => req(`/api/admin/messages/${id}`, { method: 'DELETE', auth: true })
  },
  adminSettings: {
    get: () => req('/api/admin/settings', { auth: true }),
    update: (b) => req('/api/admin/settings', { method: 'PUT', body: b, auth: true })
  },
  media: {
    list: (q = '') => req(`/api/admin/media${q ? `?q=${encodeURIComponent(q)}` : ''}`, { auth: true }),
    upload: async (file, alt = '') => {
      const fd = new FormData();
      fd.append('image', file);
      if (alt) fd.append('alt', alt);
      const headers = {};
      const t = getToken();
      if (t) headers['Authorization'] = `Bearer ${t}`;
      const res = await fetch('/api/admin/media', { method: 'POST', headers, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      return data;
    },
    update: (id, b) => req(`/api/admin/media/${id}`, { method: 'PATCH', body: b, auth: true }),
    remove: (id) => req(`/api/admin/media/${id}`, { method: 'DELETE', auth: true })
  },
  adminUsers: {
    list: () => req('/api/admin/users', { auth: true }),
    create: (b) => req('/api/admin/users', { method: 'POST', body: b, auth: true }),
    update: (id, b) => req(`/api/admin/users/${id}`, { method: 'PUT', body: b, auth: true }),
    remove: (id) => req(`/api/admin/users/${id}`, { method: 'DELETE', auth: true })
  },
  async upload(file) {
    const fd = new FormData();
    fd.append('image', file);
    return req('/api/admin/upload', { method: 'POST', body: fd, auth: true, form: true });
  }
};

export const fmtMoney = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
