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
  modules: () => req('/api/public/modules'),
  shop: () => req('/api/public/shop'),
  shopOrder: (b) => req('/api/public/shop/orders', { method: 'POST', body: b }),
  contact: (body) => req('/api/contact', { method: 'POST', body }),
  donate: (body) => req('/api/donate', { method: 'POST', body }),
  login: (body) => req('/api/auth/login', { method: 'POST', body }),
  logout: () => req('/api/auth/logout', { method: 'POST', body: {}, auth: true }),
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
      remove: (id) => req(`/api/admin/grh/employees/${id}`, { method: 'DELETE', auth: true }),
      get: (id) => req(`/api/admin/grh/employees/${id}`, { auth: true }),
      uploadDocument: (id, file, name, category) => {
        const fd = new FormData();
        fd.append('file', file);
        if (name) fd.append('name', name);
        fd.append('category', category || 'autre');
        return req(`/api/admin/grh/employees/${id}/documents`, { method: 'POST', body: fd, auth: true });
      },
      removeDocument: (id) => req(`/api/admin/grh/documents/${id}`, { method: 'DELETE', auth: true }),
      downloadDocument: async (id, filename) => {
        const t = getToken();
        const res = await fetch(`/api/admin/grh/documents/${id}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
        if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `document-${id}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    },
    orgchart: () => req('/api/admin/grh/orgchart', { auth: true }),
    jobs: {
      list: () => req('/api/admin/grh/jobs', { auth: true }),
      create: (b) => req('/api/admin/grh/jobs', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/grh/jobs/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/grh/jobs/${id}`, { method: 'DELETE', auth: true })
    },
    candidates: {
      list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.job_id) q.set('job_id', params.job_id);
        if (params.stage) q.set('stage', params.stage);
        const s = q.toString();
        return req(`/api/admin/grh/candidates${s ? `?${s}` : ''}`, { auth: true });
      },
      create: (fd) => req('/api/admin/grh/candidates', { method: 'POST', body: fd, auth: true }),
      update: (id, b) => req(`/api/admin/grh/candidates/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/grh/candidates/${id}`, { method: 'DELETE', auth: true }),
      hire: (id) => req(`/api/admin/grh/candidates/${id}/hire`, { method: 'POST', body: {}, auth: true }),
      downloadCv: async (id, filename) => {
        const t = getToken();
        const res = await fetch(`/api/admin/grh/candidates/${id}/cv`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
        if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `cv-${id}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    },
    evaluations: {
      list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.employee_id) q.set('employee_id', params.employee_id);
        const s = q.toString();
        return req(`/api/admin/grh/evaluations${s ? `?${s}` : ''}`, { auth: true });
      },
      create: (b) => req('/api/admin/grh/evaluations', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/grh/evaluations/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/grh/evaluations/${id}`, { method: 'DELETE', auth: true })
    },
    trainings: {
      list: () => req('/api/admin/grh/trainings', { auth: true }),
      create: (b) => req('/api/admin/grh/trainings', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/grh/trainings/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/grh/trainings/${id}`, { method: 'DELETE', auth: true }),
      addAttendee: (id, employee_id) => req(`/api/admin/grh/trainings/${id}/attendees`, { method: 'POST', body: { employee_id }, auth: true }),
      updateAttendee: (aid, b) => req(`/api/admin/grh/trainings/attendees/${aid}`, { method: 'PUT', body: b, auth: true }),
      removeAttendee: (aid) => req(`/api/admin/grh/trainings/attendees/${aid}`, { method: 'DELETE', auth: true })
    },
    announcements: {
      list: () => req('/api/admin/grh/announcements', { auth: true }),
      create: (b) => req('/api/admin/grh/announcements', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/grh/announcements/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/grh/announcements/${id}`, { method: 'DELETE', auth: true })
    },
    certificate: {
      download: async (employeeId, { type = 'emploi', end_date = '' } = {}, filename) => {
        const t = getToken();
        const q = new URLSearchParams();
        q.set('type', type);
        if (end_date) q.set('end_date', end_date);
        const res = await fetch(`/api/admin/grh/employees/${employeeId}/certificate?${q}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
        if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `certificat-${employeeId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    },
    payroll: {
      list: (month) => req(`/api/admin/grh/payroll?month=${month}`, { auth: true }),
      create: (b) => req('/api/admin/grh/payroll', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/grh/payroll/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/grh/payroll/${id}`, { method: 'DELETE', auth: true }),
      generate: (month) => req('/api/admin/grh/payroll/generate', { method: 'POST', body: { month }, auth: true }),
      downloadPdf: async (id, filename) => {
        const t = getToken();
        const res = await fetch(`/api/admin/grh/payroll/${id}/pdf`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
        if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `bulletin-${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      },
      exportCsv: async (month) => {
        const t = getToken();
        const res = await fetch(`/api/admin/grh/payroll/export?month=${month}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
        if (!res.ok) throw new Error(`Export impossible (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paie-${month}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    },
    leaves: {
      list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.status) q.set('status', params.status);
        if (params.employee_id) q.set('employee_id', params.employee_id);
        if (params.month) q.set('month', params.month);
        const s = q.toString();
        return req(`/api/admin/grh/leaves${s ? `?${s}` : ''}`, { auth: true });
      },
      create: (b) => req('/api/admin/grh/leaves', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/grh/leaves/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/grh/leaves/${id}`, { method: 'DELETE', auth: true })
    }
  },
  pos: {
    categories: {
      list: () => req('/api/admin/pos/categories', { auth: true }),
      create: (b) => req('/api/admin/pos/categories', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/pos/categories/${id}`, { method: 'PUT', body: b, auth: true }),
      remove: (id) => req(`/api/admin/pos/categories/${id}`, { method: 'DELETE', auth: true })
    },
    products: {
      list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.search) q.set('search', params.search);
        if (params.category_id) q.set('category_id', params.category_id);
        if (params.active != null) q.set('active', params.active);
        const s = q.toString();
        return req(`/api/admin/pos/products${s ? `?${s}` : ''}`, { auth: true });
      },
      create: (b) => req('/api/admin/pos/products', { method: 'POST', body: b, auth: true }),
      update: (id, b) => req(`/api/admin/pos/products/${id}`, { method: 'PUT', body: b, auth: true }),
      get: (id) => req(`/api/admin/pos/products/${id}`, { auth: true }),
      remove: (id) => req(`/api/admin/pos/products/${id}`, { method: 'DELETE', auth: true }),
      movement: (id, b) => req(`/api/admin/pos/products/${id}/movements`, { method: 'POST', body: b, auth: true }),
      byBarcode: (code) => req(`/api/admin/pos/products/by-barcode/${encodeURIComponent(code)}`, { auth: true })
    },
    orders: {
      list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.status) q.set('status', params.status);
        const s = q.toString();
        return req(`/api/admin/pos/orders${s ? `?${s}` : ''}`, { auth: true });
      },
      setStatus: (id, status) => req(`/api/admin/pos/orders/${id}`, { method: 'PATCH', body: { status }, auth: true })
    },
    movements: {
      list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.product_id) q.set('product_id', params.product_id);
        if (params.type) q.set('type', params.type);
        const s = q.toString();
        return req(`/api/admin/pos/movements${s ? `?${s}` : ''}`, { auth: true });
      }
    },
    sales: {
      list: (params = {}) => {
        const q = new URLSearchParams();
        for (const k of ['from', 'to', 'payment', 'q']) if (params[k]) q.set(k, params[k]);
        const s = q.toString();
        return req(`/api/admin/pos/sales${s ? `?${s}` : ''}`, { auth: true });
      },
      get: (id) => req(`/api/admin/pos/sales/${id}`, { auth: true }),
      create: (b) => req('/api/admin/pos/sales', { method: 'POST', body: b, auth: true }),
      remove: (id) => req(`/api/admin/pos/sales/${id}`, { method: 'DELETE', auth: true }),
      returnSale: (id, b) => req(`/api/admin/pos/sales/${id}/return`, { method: 'POST', body: b, auth: true }),
      downloadPdf: async (id, filename) => {
        const t = getToken();
        const res = await fetch(`/api/admin/pos/sales/${id}/pdf`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
        if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `ticket-${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      },
      downloadInvoice: async (id, filename) => {
        const t = getToken();
        const res = await fetch(`/api/admin/pos/sales/${id}/invoice`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
        if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `facture-${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    },
    report: {
      daily: (date) => req(`/api/admin/pos/reports/daily?date=${encodeURIComponent(date)}`, { auth: true })
    },
    stats: () => req('/api/admin/pos/stats', { auth: true })
  },
  me: {
    get: () => req('/api/auth/me', { auth: true }),
    update: (b) => req('/api/auth/me', { method: 'PUT', body: b, auth: true }),
    employee: {
      get: () => req('/api/me/employee', { auth: true }),
      leaves: () => req('/api/me/employee/leaves', { auth: true }),
      announcements: () => req('/api/me/employee/announcements', { auth: true }),
      request: (b) => req('/api/me/employee/leaves', { method: 'POST', body: b, auth: true }),
      remove: (id) => req(`/api/me/employee/leaves/${id}`, { method: 'DELETE', auth: true })
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
