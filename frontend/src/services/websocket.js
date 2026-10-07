// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Live Collaboration Transport
//  Uses EventSource + HTTP publish so it works without extra
//  backend WebSocket dependencies.
// ═══════════════════════════════════════════════════════════════
import { API_BASE, getStoredUser } from '@/services/api';

function randomId(prefix = 'session') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function currentUser() {
  const stored = getStoredUser();
  let guestId = '';
  let guestName = '';
  if (typeof window !== 'undefined') {
    try {
      guestId = window.sessionStorage?.getItem('etherx_guest_id');
      if (!guestId) {
        guestId = `guest-${Math.random().toString(36).slice(2, 8)}`;
        window.sessionStorage?.setItem('etherx_guest_id', guestId);
      }
      guestName = window.sessionStorage?.getItem('etherx_guest_name');
      if (!guestName) {
        guestName = `Guest ${Math.floor(Math.random() * 900 + 100)}`;
        window.sessionStorage?.setItem('etherx_guest_name', guestName);
      }
    } catch {}
  }
  const name = stored.name || stored.email || guestName || 'Guest User';
  const email = stored.email || '';
  const id = stored.id || email || guestId || 'guest-user';
  return { id, name, email, role: 'editor' };
}

async function publish(docId, body) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('etherx_token') : null;
  const headers = {
    'Content-Type': 'application/json',
    'X-EtherX-User-Id': body.user?.id || '',
    'X-EtherX-User-Name': body.user?.name || '',
    'X-EtherX-User-Email': body.user?.email || '',
    'X-Session-Id': body.sessionId || '',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(docId)}/collaboration/publish`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    keepalive: body.type === 'leave',
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    const error = new Error(payload?.message || `Collaboration request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export class CollabSocket {
  constructor(docId, user = currentUser()) {
    this.docId = docId;
    this.user = user;
    this.sessionId = randomId();
    this.source = null;
    this.handlers = {};
    this.connected = false;
  }

  connect() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('etherx_token') : null;
    const params = new URLSearchParams({
      sessionId: this.sessionId,
      id: this.user.id || '',
      name: this.user.name,
      email: this.user.email || '',
      role: this.user.role || 'editor',
    });
    if (token) {
      params.set('token', token);
    }
    this.source = new EventSource(`${API_BASE}/documents/${encodeURIComponent(this.docId)}/collaboration/stream?${params.toString()}`);

    this.source.onopen = () => {
      this.connected = true;
      this._emit('connected', { sessionId: this.sessionId, user: this.user });
      this.broadcastPresence({ status: 'active' });
    };

    this.source.onerror = (error) => {
      this.connected = false;
      this._emit('disconnected', error);
    };

    ['snapshot', 'change', 'presence', 'comment', 'ready'].forEach((eventName) => {
      this.source.addEventListener(eventName, (event) => {
        try {
          this._emit(eventName, JSON.parse(event.data));
        } catch {
          this._emit('error', new Error(`Invalid collaboration payload for ${eventName}`));
        }
      });
    });
  }

  async send(type, payload) {
    try {
      const result = await publish(this.docId, {
        type,
        payload,
        sessionId: this.sessionId,
        user: this.user,
      });
      this._emit('ack', { type, result });
      return result;
    } catch (error) {
      if (error?.status === 409) {
        this._emit('conflict', {
          type,
          message: error?.payload?.message || 'Revision conflict',
          document: error?.payload?.document || null,
          expectedRevision: error?.payload?.expectedRevision,
        });
        return null;
      }
      this._emit('error', error);
      return null;
    }
  }

  broadcastChange(delta)    { return this.send('change',   { ...delta, uid: this.user.id }); }
  broadcastPresence(cursor) { return this.send('presence', { ...cursor, uid: this.user.id }); }
  broadcastComment(comment) { return this.send('comment',  { ...comment, uid: this.user.id }); }

  on(event, fn)  { (this.handlers[event] ??= []).push(fn); return () => this.off(event, fn); }
  off(event, fn) { this.handlers[event] = (this.handlers[event] || []).filter((h) => h !== fn); }
  _emit(event, data) { (this.handlers[event] || []).forEach((fn) => fn(data)); }

  disconnect() {
    this.send('leave', {}).catch(() => {});
    this.source?.close();
    this.connected = false;
    this.handlers = {};
  }
}

let _instance = null;
export const initCollab = (docId) => {
  _instance?.disconnect();
  _instance = new CollabSocket(docId);
  if (typeof window !== 'undefined') {
    window.__ETHERX_COLLAB__ = _instance;
  }
  _instance.connect();
  return _instance;
};
export const getCollab = () => _instance;
