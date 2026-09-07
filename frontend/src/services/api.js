export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

class ApiError extends Error {
  constructor(msg, status, { routeMissing = false } = {}) {
    super(msg);
    this.status = status;
    this.routeMissing = routeMissing;
    this.name = 'ApiError';
  }
}

function getToken() { return localStorage.getItem('etherx_token'); }
export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('etherx_user') || 'null') || {};
  } catch {
    return {};
  }
}

function sanitizeHeader(val = '') {
  return String(val).replace(/[^\x00-\xFF]/g, '');
}

function getUserHeaders() {
  const user = getStoredUser();
  const name = sanitizeHeader(user.name || user.email || 'Guest User');
  const email = sanitizeHeader(user.email || '');
  const id = sanitizeHeader(user.id || email || name.toLowerCase().replace(/\s+/g, '-'));
  return {
    'X-EtherX-User-Id': id,
    'X-EtherX-User-Name': name,
    'X-EtherX-User-Email': email,
  };
}

async function req(path, opts = {}) {
  const rawToken = getToken();
  const token = sanitizeHeader(rawToken);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...getUserHeaders(),
      ...opts.headers,
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.message || parsed.error || msg;
    } catch {
      msg = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || msg;
    }
    const routeMissing = res.status === 404
      && /^(?:api\s+)?route not found\b|^cannot (get|post|put|delete|patch)\s/i.test(msg);
    if (routeMissing) {
      msg = `API route not found: ${res.url}. Make sure the EtherX backend is running on the configured API port.`;
    }
    throw new ApiError(msg, res.status, { routeMissing });
  }
  return res.json();
}

export const authApi = {
  signup:          (data)  => req('/auth/signup',           { method: 'POST', body: data }),
  verifyOtp:       (data)  => req('/auth/verify-otp',       { method: 'POST', body: data }),
  resendOtp:       (data)  => req('/auth/resend-otp',       { method: 'POST', body: data }),
  signin:          (data)  => req('/auth/signin',           { method: 'POST', body: data }),
  forgotPassword:  (data)  => req('/auth/forgot-password',  { method: 'POST', body: data }),
  verifyResetOtp:  (data)  => req('/auth/verify-reset-otp', { method: 'POST', body: data }),
  resetPassword:   (data)  => req('/auth/reset-password',   { method: 'POST', body: data }),
  me:              ()      => req('/auth/me'),
};

export const documentApi = {
  list:           ()          => req('/documents'),
  get:            (id)        => req(`/documents/${id}`),
  create:         (data)      => req('/documents',       { method: 'POST',   body: data }),
  save:           (id, data)  => req(`/documents/${id}`, { method: 'PUT',    body: data }),
  delete:         (id)        => req(`/documents/${id}`, { method: 'DELETE' }),
  getVersions:    (id)        => req(`/documents/${id}/versions`),
  restoreVersion: (id, vid)   => req(`/documents/${id}/versions/${vid}/restore`, { method: 'POST' }),
  share:          (id, opts)  => req(`/documents/${id}/share`, { method: 'POST', body: opts }),
  invite:         (id, opts)  => req(`/documents/${id}/invite`, { method: 'POST', body: opts }),
  // IPFS Operations
  pinToIPFS:      (id)        => req(`/documents/${id}/pin`, { method: 'POST', body: {} }),
  unpinFromIPFS:  (id)        => req(`/documents/${id}/unpin`, { method: 'POST', body: {} }),
  getIPFSInfo:    (id)        => req(`/documents/${id}/ipfs-info`),
  testIPFSStatus: ()          => req('/documents/test/ipfs-status'),
};

export const uploadApi = {
  image: async (file) => {
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(`${API_BASE}/upload/image`, { method: 'POST', body: fd });
    if (!res.ok) throw new ApiError('Upload failed', res.status);
    const data = await res.json();
    return {
      ...data,
      url: resolveUploadUrl(data.url),
    };
  },
  file: async (file) => {
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(`${API_BASE}/upload/file`, { method: 'POST', body: fd });
    if (!res.ok) throw new ApiError('Upload failed', res.status);
    const data = await res.json();
    return {
      ...data,
      url: resolveUploadUrl(data.url),
    };
  },
};

function resolveUploadUrl(url) {
  if (!url || /^(?:https?:|data:|blob:)/i.test(url)) return url;
  if (/^https?:\/\//i.test(API_BASE) && url.startsWith('/')) {
    return new URL(url, API_BASE.replace(/\/api\/?$/, '/')).toString();
  }
  return url;
}

export const exportApi = {
  pdf:  (id) => fetch(`${API_BASE}/export/${id}/pdf`).then((r) => r.blob()),
  docx: (id) => fetch(`${API_BASE}/export/${id}/docx`).then((r) => r.blob()),
  html: (id) => fetch(`${API_BASE}/export/${id}/html`).then((r) => r.blob()),
};

export const templateApi = {
  list: () => req('/templates'),
  get:  (id) => req(`/templates/${id}`),
  createDocument: (id, data = {}) => req(`/templates/${id}/documents`, { method: 'POST', body: data }),
};

export const aiApi = {
  action:          (payload) => req('/ai/action',           { method: 'POST', body: payload }),
  chat:            (payload) => req('/ai/chat',             { method: 'POST', body: payload }),
  status:          ()        => req('/ai/status'),
  webSearch:       (payload) => req('/ai/web/search',       { method: 'POST', body: payload }),
  webFetch:        (payload) => req('/ai/web/fetch',        { method: 'POST', body: payload }),
  webResearch:     (payload) => req('/ai/web/research',     { method: 'POST', body: payload }),
  webSummarizeUrl: (payload) => req('/ai/web/summarize-url', { method: 'POST', body: payload }),
};
