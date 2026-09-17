// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Pro Organization Admin API Service
// ═══════════════════════════════════════════════════════════════

export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

function getToken() {
  return localStorage.getItem('etherx_token');
}

export function getStoredUser() {
  try {
    const user = JSON.parse(localStorage.getItem('etherx_user') || 'null') || {};
    const email = String(user.email || '').toLowerCase();
    if (!user.role && (email === 'biswalpadmaja411@gmail.com' || email === 'demo@etherx.com')) {
      user.role = 'Owner';
    }
    return user;
  } catch {
    return {};
  }
}

async function adminFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = { message: await res.text() };
  }

  if (!res.ok) {
    const error = new Error(data?.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.code = data?.code;
    throw error;
  }

  return data;
}

export const adminApi = {
  // Overview
  getOverview: () => adminFetch('/admin/overview'),

  // Users & Members
  getUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return adminFetch(`/admin/users${qs ? `?${qs}` : ''}`);
  },
  inviteUser: (data) => adminFetch('/admin/users/invite', { method: 'POST', body: data }),
  updateUserRole: (id, role) => adminFetch(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
  updateUserStatus: (id, status) => adminFetch(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
  removeUser: (id) => adminFetch(`/admin/users/${id}`, { method: 'DELETE' }),
  getTeams: () => adminFetch('/admin/teams'),

  // Subscription
  getSubscription: () => adminFetch('/admin/subscription'),
  updateSubscription: (data) => adminFetch('/admin/subscription', { method: 'PATCH', body: data }),
  sendRenewalReminder: () => adminFetch('/admin/subscription/send-renewal-reminder', { method: 'POST' }),

  // Usage & Analytics
  getAnalytics: (days = 30) => adminFetch(`/admin/usage/analytics?days=${days}`),

  // Documents & Sharing
  getDocuments: () => adminFetch('/admin/documents'),
  updateDocumentSharing: (id, shareLinkEnabled) =>
    adminFetch(`/admin/documents/${id}/sharing`, { method: 'PATCH', body: { shareLinkEnabled } }),
  updateSharingPolicy: (allowExternalSharing) =>
    adminFetch('/admin/settings/sharing', { method: 'PATCH', body: { allowExternalSharing } }),

  // Security & Audit Logs
  getAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return adminFetch(`/admin/security/audit-logs${qs ? `?${qs}` : ''}`);
  },
  getSecuritySettings: () => adminFetch('/admin/security/settings'),
  updateSecuritySettings: (data) => adminFetch('/admin/security/settings', { method: 'PATCH', body: data }),
};
