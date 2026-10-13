import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCollaboration } from '../useCollaboration';
import { useCollaborationStore, useDocumentStore, useEditorStore } from '@/store';

let socket;
let root;
vi.mock('@/services/websocket', () => ({
  initCollab: () => { socket.closed = false; return socket; },
  getCollab: () => socket.closed ? null : socket,
}));
function Harness() { useCollaboration('collab-test'); return null; }
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const handlers = new Map();
  socket = {
    sessionId: 'local-tab', user: { id: 'local', name: 'Local' }, closed: false,
    on: (event, fn) => { handlers.set(event, fn); return () => handlers.delete(event); },
    emit: (event, data) => handlers.get(event)?.(data),
    disconnect: () => { socket.closed = true; },
    broadcastChange: vi.fn(), broadcastComment: vi.fn(), broadcastPresence: vi.fn(),
  };
  useDocumentStore.getState().reset();
  useDocumentStore.setState({ id: 'collab-test', title: 'Original', content: '<p>Content</p>', revision: 1, isDirty: false });
  useEditorStore.setState({ editor: null });
  useCollaborationStore.setState({ collaborationEnabled: true });
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(React.createElement(Harness)));
  await act(async () => vi.advanceTimersByTimeAsync(600));
  socket.broadcastChange.mockClear();
  socket.broadcastComment.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('broadcasts title-only edits without publishing pagination-only changes', async () => {
  await act(async () => useDocumentStore.getState().setTitle('Renamed'));
  await act(async () => vi.advanceTimersByTimeAsync(600));
  expect(socket.broadcastChange).toHaveBeenCalledTimes(1);
  expect(socket.broadcastChange.mock.calls[0][0].title).toBe('Renamed');
  socket.broadcastChange.mockClear();
  await act(async () => useDocumentStore.getState().setContent('<p>Content</p><div data-page-break="true" data-etherx-auto-break="true"></div>'));
  await act(async () => vi.advanceTimersByTimeAsync(600));
  expect(socket.broadcastChange).not.toHaveBeenCalled();
});

it('applies remote title and theme changes when document text stays the same', async () => {
  await act(async () => socket.emit('change', { sessionId: 'remote', user: { id: 'remote' }, payload: { revision: 2, content: '<p>Content</p>', title: 'Remote title', design: { pageColor: '#ffffff' } } }));
  expect(useDocumentStore.getState()).toMatchObject({ title: 'Remote title', design: { pageColor: '#ffffff' }, revision: 2 });
  await act(async () => vi.advanceTimersByTimeAsync(600));
  expect(socket.broadcastChange).not.toHaveBeenCalled();
});

it('broadcasts comment replies', async () => {
  await act(async () => useDocumentStore.setState({ comments: [{ id: 'c1', text: 'Review', resolved: false, replies: [] }] }));
  await act(async () => vi.advanceTimersByTimeAsync(300));
  socket.broadcastComment.mockClear();
  await act(async () => useDocumentStore.getState().replyComment('c1', { text: 'Reply' }));
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(socket.broadcastComment).toHaveBeenCalledTimes(1);
  expect(socket.broadcastComment.mock.calls[0][0].comments[0].replies).toEqual([{ text: 'Reply' }]);
});

it('expired typing entries cannot reappear when another collaborator types', async () => {
  await act(async () => socket.emit('presence', { sessionId: 'alice-tab', user: { id: 'alice', name: 'Alice' } }));
  expect(useCollaborationStore.getState().typingUsers).toEqual([{ sessionId: 'alice-tab', name: 'Alice' }]);
  await act(async () => vi.advanceTimersByTimeAsync(1300));
  expect(useCollaborationStore.getState().typingUsers).toEqual([]);
  await act(async () => socket.emit('presence', { sessionId: 'bob-tab', user: { id: 'bob', name: 'Bob' } }));
  expect(useCollaborationStore.getState().typingUsers).toEqual([{ sessionId: 'bob-tab', name: 'Bob' }]);
});

it('remote comments and initial snapshots cannot discard unsaved local edits', async () => {
  await act(async () => useDocumentStore.getState().setContent('<p>Unsaved edit</p>'));
  await act(async () => {
    socket.emit('change', { sessionId: 'remote', payload: { revision: 2, content: '<p>Old</p>', comments: [] } });
    socket.emit('comment', { sessionId: 'remote', payload: { revision: 3, comments: [] } });
    socket.emit('snapshot', { document: { revision: 4, content: '<p>Older snapshot</p>', comments: [] } });
  });
  expect(useDocumentStore.getState()).toMatchObject({ content: '<p>Unsaved edit</p>', isDirty: true });
});
