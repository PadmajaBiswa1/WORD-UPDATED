import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CollabSocket, getCollab, initCollab } from '../websocket';

let sources;
beforeEach(() => {
  sources = [];
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({}) }));
  vi.stubGlobal('EventSource', class {
    constructor() { sources.push(this); }
    addEventListener() {}
    close = vi.fn();
  });
});
afterEach(() => { getCollab()?.disconnect(); vi.unstubAllGlobals(); });

it('connect and disconnect are idempotent', async () => {
  const socket = new CollabSocket('test', { id: 'user', name: 'Test' });
  socket.connect();
  socket.connect();
  expect(sources).toHaveLength(1);
  socket.disconnect();
  socket.disconnect();
  await socket.broadcastChange({ content: 'closed' });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1].body).type).toBe('leave');
  expect(sources[0].close).toHaveBeenCalledTimes(1);
});

it('replacing a closed collaboration session does not send another leave', () => {
  const first = initCollab('first');
  first.disconnect();
  expect(getCollab()).toBeNull();
  initCollab('second');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(sources).toHaveLength(2);
});
