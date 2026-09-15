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
  window.dispatchEvent(new Event('adiong-user'));
};

async function req(path, { method = 'GET', body, auth = false, form = false } = {}) {
  const headers = {};
  const isForm = form || (typeof FormData !== 'undefined' && body instanceof FormData);
  // Let the browser set multipart/form-data + boundary for FormData.
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  if (auth) {
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      if (!res.ok) throw new Error(httpErrorMessage(res, null, raw));
      throw new Error(`Réponse invalide (${res.status})`);
    }
  }
  if (!res.ok) throw new Error(httpErrorMessage(res, data, raw));
  return data;
}

function httpErrorMessage(res, data, raw) {
  if (data && typeof data === 'object' && !Array.isArray(data) && data.error) {
    return String(data.error);
  }
  const snippet = String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return snippet || `Erreur ${res.status}`;
}

export const api = {
  site: () => req('/api/public/site'),
  articles: (params = '') => req(`/api/public/articles${params}`),
  article: (slug) => req(`/api/public/articles/${slug}`),
  causes: () => req('/api/public/causes'),
  cause: (slug) => req(`/api/public/causes/${slug}`),
  campaigns: () => req('/api/public/campaigns'),
  campaign: (slug) => req(`/api/public/campaigns/${slug}`),
  partners: () => req('/api/public/partners'),
  contact: (body) => req('/api/contact', { method: 'POST', body }),
  donate: (body) => req('/api/donate', { method: 'POST', body }),
  login: (body) => req('/api/auth/login', { method: 'POST', body }),
  logout: () => req('/api/auth/logout', { method: 'POST', body: {}, auth: true }),
  me: {
    get: () => req('/api/auth/me', { auth: true }),
    update: (b) => req('/api/auth/me', { method: 'PUT', body: b, auth: true })
  },
  member: (code) => req(`/api/public/member/${encodeURIComponent(code)}`),
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
  adminPartners: {
    list: () => req('/api/admin/partners', { auth: true }),
    create: (b) => req('/api/admin/partners', { method: 'POST', body: b, auth: true }),
    update: (id, b) => req(`/api/admin/partners/${id}`, { method: 'PUT', body: b, auth: true }),
    remove: (id) => req(`/api/admin/partners/${id}`, { method: 'DELETE', auth: true })
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
    list: (q = '', type = '') => {
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (type) p.set('type', type);
      const qs = p.toString();
      return req(`/api/admin/media${qs ? `?${qs}` : ''}`, { auth: true });
    },
    upload: async (file, alt = '') => {
      const fd = new FormData();
      fd.append('image', file);
      if (alt) fd.append('alt', alt);
      return req('/api/admin/media', { method: 'POST', body: fd, auth: true });
    },
    update: (id, b) => req(`/api/admin/media/${id}`, { method: 'PATCH', body: b, auth: true }),
    remove: (id) => req(`/api/admin/media/${id}`, { method: 'DELETE', auth: true })
  },
  adminUsers: {
    list: () => req('/api/admin/users', { auth: true }),
    create: (b) => req('/api/admin/users', { method: 'POST', body: b, auth: true }),
    update: (id, b) => req(`/api/admin/users/${id}`, { method: 'PUT', body: b, auth: true }),
    regenerateCode: (id) => req(`/api/admin/users/${id}/code`, { method: 'POST', body: {}, auth: true }),
    remove: (id) => req(`/api/admin/users/${id}`, { method: 'DELETE', auth: true })
  },
  modules: {
    get: () => req('/api/admin/modules', { auth: true }),
    update: (b) => req('/api/admin/modules', { method: 'PUT', body: b, auth: true })
  },
  adminSecurity: {
    events: () => req('/api/admin/security', { auth: true })
  },
  invites: {
    list: () => req('/api/admin/invites', { auth: true }),
    create: (b) => req('/api/admin/invites', { method: 'POST', body: b, auth: true }),
    remove: (id) => req(`/api/admin/invites/${id}`, { method: 'DELETE', auth: true })
  },
  register: {
    validate: (token) => req(`/api/register/validate?token=${encodeURIComponent(token)}`),
    submit: (b) => req('/api/register', { method: 'POST', body: b })
  },
  grh: {
    overview: () => req('/api/admin/grh/overview', { auth: true }),
    departments: {
      list: () => req('/api/admin/grh/departments', { auth: true }),
      create: (b) => req('/api/admin/grh/departments', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/grh/departments/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/grh/departments/${id}`, { method: 'DELETE', auth: true })
    },
    employees: {
      list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.q) q.set('q', params.q);
        if (params.department) q.set('department', params.department);
        if (params.status) q.set('status', params.status);
        const s = q.toString();
        return req(`/api/admin/grh/employees${s ? `?${s}` : ''}`, { auth: true });
      },
      create: (b) => req('/api/admin/grh/employees', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/grh/employees/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/grh/employees/${id}`, { method: 'DELETE', auth: true })
    },
    leaves: {
      list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.status) q.set('status', params.status);
        if (params.employee_id) q.set('employee_id', params.employee_id);
        const s = q.toString();
        return req(`/api/admin/grh/leaves${s ? `?${s}` : ''}`, { auth: true });
      },
      create: (b) => req('/api/admin/grh/leaves', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/grh/leaves/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/grh/leaves/${id}`, { method: 'DELETE', auth: true })
    }
  },
  async upload(file) {
    const fd = new FormData();
    fd.append('image', file);
    return req('/api/admin/upload', { method: 'POST', body: fd, auth: true });
  }
};

export const fmtMoney = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
