import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { useAutoSave } from '../useAutoSave';
import { useClipboardListener } from '../useClipboardListener';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import * as cryptoService from '@/services/crypto';
import { useDocumentStore, useUIStore, useEditorStore, useProductivityStore } from '@/store';
import { documentApi } from '@/services/api';
import { DEFAULT_COMMANDS } from '@/components/toolbar/defaultCommands';
import { createTestEditor } from '@/ai/__tests__/testEditor';
import { readCachedRecentDocs } from '@/utils/recentDocsCache';
import { readLocalDraft } from '@/utils/draftStorage';

let root;
let editor;
let save;
function Harness() {
  save = useAutoSave().save;
  useClipboardListener();
  useKeyboardShortcuts();
  return null;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const storage = new Map();
  const local = { clear: () => storage.clear(), getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
  vi.stubGlobal('localStorage', local);
  Object.defineProperty(window, 'localStorage', { value: local, configurable: true });
  useDocumentStore.getState().reset();
  useUIStore.setState({ autoSaveEnabled: false, toasts: [] });
  useProductivityStore.setState({ clipboardHistory: [], customShortcuts: {} });
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => { useDocumentStore.setState({ isDirty: false }); root.unmount(); });
  editor?.destroy();
  editor = null;
  useEditorStore.setState({ editor: null });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('saves full document settings, emits dashboard refresh, and preserves page count in cache', async () => {
  const snapshot = {
    id: 'save-test', title: 'Full document', content: '<p><strong>Formatted</strong></p>',
    layout: { pageSize: 'letter', pageOrientation: 'landscape', pageMargin: 'narrow' },
    pageCount: 3, design: { pageColor: '#dfeaea', pageColorMode: 'custom' },
    headerFooter: { headerText: 'Header', footerText: 'Footer' },
    signatures: [{ id: 'signature' }], documentParts: [{ id: 'part' }],
    references: { sources: [{ id: 'source', author: 'Jane Smith', title: 'Book', year: '2026' }], citations: [{ id: 'citation' }], captions: [], indexEntries: [] },
    comments: [{ id: 'comment', text: 'Review' }], trackChanges: true,
    styles: [{ id: 'style' }], accessPolicy: { allowDownload: false },
    updatedAt: new Date(), isDirty: true,
  };
  useDocumentStore.setState(snapshot);
  const apiSave = vi.spyOn(documentApi, 'save').mockImplementation(async (id, payload) => ({ ...payload, id, revision: 2, updatedAt: new Date().toISOString() }));
  const refresh = vi.fn();
  window.addEventListener('etherx:recent-docs-change', refresh);
  await act(async () => root.render(React.createElement(Harness)));
  await act(async () => save({ manual: true }));
  const payload = apiSave.mock.calls[0][1];
  for (const key of ['title', 'content', 'layout', 'pageCount', 'design', 'headerFooter', 'signatures', 'documentParts', 'references', 'comments', 'trackChanges', 'styles', 'accessPolicy']) {
    expect(payload[key], key).toEqual(snapshot[key]);
  }
  expect(useDocumentStore.getState().isDirty).toBe(false);
  expect(readCachedRecentDocs()[0]).toMatchObject({ id: snapshot.id, title: snapshot.title, pageCount: 3, layout: snapshot.layout });
  expect(readLocalDraft(snapshot.id)).toMatchObject({ signatures: snapshot.signatures, comments: snapshot.comments, layout: snapshot.layout });
  expect(refresh).toHaveBeenCalled();
  window.removeEventListener('etherx:recent-docs-change', refresh);
});

it('includes layout and pages in pagehide save', async () => {
  useDocumentStore.setState({ id: 'unload-test', content: '<p>Test</p>', layout: { pageMargin: 'narrow' }, pageCount: 4, isDirty: true });
  const fetch = vi.fn().mockResolvedValue({});
  vi.stubGlobal('fetch', fetch);
  await act(async () => root.render(React.createElement(Harness)));
  window.dispatchEvent(new Event('pagehide'));
  const payload = JSON.parse(fetch.mock.calls[0][1].body);
  expect(payload.layout).toEqual({ pageMargin: 'narrow' });
  expect(payload.pageCount).toBe(4);
});

it('beforeunload and pagehide publish only one exit save', async () => {
  useDocumentStore.setState({ id: 'exit-test', content: '<p>Unsaved</p>', isDirty: true });
  const fetch = vi.fn().mockResolvedValue({});
  vi.stubGlobal('fetch', fetch);
  await act(async () => root.render(React.createElement(Harness)));
  window.dispatchEvent(new Event('beforeunload'));
  expect(readLocalDraft('exit-test').content).toBe('<p>Unsaved</p>');
  expect(fetch).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('pagehide'));
  expect(fetch).toHaveBeenCalledTimes(1);
});

for (const [label, modifiers, customShortcuts] of [
  ['default Save', { ctrlKey: true }, {}],
  ['remapped Save', { ctrlKey: true, altKey: true }, { 'cmd-save': 'Ctrl+Alt+S' }],
]) {
  it(`${label} dispatches exactly one save`, async () => {
    useDocumentStore.setState({ id: 'shortcut-save', isDirty: true });
    useProductivityStore.setState({ customShortcuts });
    const apiSave = vi.spyOn(documentApi, 'save').mockResolvedValue({ revision: 1 });
    await act(async () => root.render(React.createElement(Harness)));
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ...modifiers, cancelable: true })));
    expect(apiSave).toHaveBeenCalledTimes(1);
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

it('an old save response cannot change the newly opened document revision or save state', async () => {
  const request = deferred();
  vi.spyOn(documentApi, 'save').mockReturnValue(request.promise);
  useDocumentStore.setState({ id: 'old', content: '<p>Old</p>', isDirty: true });
  await act(async () => root.render(React.createElement(Harness)));
  let saving;
  await act(async () => { saving = save({ manual: true }); });
  await act(async () => useDocumentStore.setState({ id: 'new', content: '<p>New</p>', revision: 7, isSaving: true, isDirty: false }));
  await act(async () => { request.resolve({ revision: 99 }); await saving; });
  expect(useDocumentStore.getState()).toMatchObject({ id: 'new', revision: 7, content: '<p>New</p>', isSaving: true, isDirty: false });
  expect(readLocalDraft('old')).toMatchObject({ content: '<p>Old</p>', isDirty: false });
});

it('a failed old save preserves its draft instead of copying another document into it', async () => {
  const request = deferred();
  vi.spyOn(documentApi, 'save').mockReturnValue(request.promise);
  useDocumentStore.setState({ id: 'old-fail', content: '<p>Old draft</p>', isDirty: true });
  await act(async () => root.render(React.createElement(Harness)));
  let saving;
  await act(async () => { saving = save({ manual: true }); });
  await act(async () => useDocumentStore.setState({ id: 'new-open', content: '<p>Different document</p>', isDirty: false }));
  await act(async () => { request.reject(new Error('Offline')); await saving; });
  expect(readLocalDraft('old-fail')).toMatchObject({ content: '<p>Old draft</p>', isDirty: true });
  expect(useDocumentStore.getState().content).toBe('<p>Different document</p>');
});

it('a completed old save preserves newer unsaved edits in its local draft', async () => {
  const request = deferred();
  vi.spyOn(documentApi, 'save').mockReturnValue(request.promise);
  useDocumentStore.setState({ id: 'old-edit', content: '<p>Saved snapshot</p>', isDirty: true });
  await act(async () => root.render(React.createElement(Harness)));
  let saving;
  await act(async () => { saving = save({ manual: true }); });
  await act(async () => useDocumentStore.getState().setContent('<p>Newer draft</p>'));
  await act(async () => useDocumentStore.setState({ id: 'other', content: '<p>Other</p>', isDirty: false }));
  await act(async () => { request.resolve({ revision: 2 }); await saving; });
  expect(readLocalDraft('old-edit')).toMatchObject({ content: '<p>Newer draft</p>', isDirty: true });
});

it('encrypted save metadata does not trigger another save', async () => {
  const envelope = { encryptedPayload: 'encrypted', salt: 'salt', nonce: 'nonce', authTag: 'tag' };
  vi.spyOn(cryptoService, 'encryptDocument').mockResolvedValue(envelope);
  const apiSave = vi.spyOn(documentApi, 'save').mockResolvedValue({ revision: 1 });
  useDocumentStore.setState({ id: 'protected', content: '<p>Secret</p>', security: { protected: true }, cryptoKey: 'test-passphrase', isDirty: true });
  await act(async () => root.render(React.createElement(Harness)));
  await act(async () => save({ manual: true }));
  expect(apiSave).toHaveBeenCalledTimes(1);
  expect(apiSave.mock.calls[0][1]).toMatchObject({ content: '', contentJson: null, security: envelope });
  expect(useDocumentStore.getState()).toMatchObject({ isDirty: false, security: envelope });
});

it('encryption failure does not publish a stale encrypted payload as a successful save', async () => {
  vi.spyOn(cryptoService, 'encryptDocument').mockRejectedValue(new Error('Encryption failed'));
  const apiSave = vi.spyOn(documentApi, 'save').mockResolvedValue({});
  useDocumentStore.setState({ id: 'protected-fail', content: '<p>Keep edits</p>', security: { protected: true, encryptedPayload: 'stale' }, cryptoKey: 'test-passphrase', isDirty: true });
  await act(async () => root.render(React.createElement(Harness)));
  await act(async () => save({ manual: true }));
  expect(apiSave).not.toHaveBeenCalled();
  expect(useDocumentStore.getState().isDirty).toBe(true);
});

it('replaces previous notification and does not dismiss newest with old timer', () => {
  const ui = useUIStore.getState();
  ui.toast('Old');
  const oldId = useUIStore.getState().toasts[0].id;
  ui.toast('New');
  ui.removeToast(oldId);
  expect(useUIStore.getState().toasts.map((toast) => toast.message)).toEqual(['New']);
});

it('copies only selection with rich formatting, updates history, and pastes marks', async () => {
  editor = createTestEditor('<p>Before <strong><em><u>Styled</u></em></strong> after</p><p>Target</p>');
  editor.commands.setTextSelection({ from: 8, to: 14 });
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('ClipboardItem', class { constructor(data) { this.data = data; this.types = Object.keys(data); } getType(type) { return Promise.resolve(this.data[type]); } });
  const write = vi.fn().mockResolvedValue();
  const clipboard = { write, read: vi.fn(async () => write.mock.calls[0][0]) };
  vi.stubGlobal('navigator', new Proxy(navigator, { get: (target, key) => key === 'clipboard' ? clipboard : Reflect.get(target, key, target) }));
  await DEFAULT_COMMANDS.find((command) => command.id === 'home-copy').run({ editor, toast: vi.fn() });
  expect(await write.mock.calls[0][0][0].getType('text/plain').then((blob) => blob.text())).toBe('Styled');
  const item = useProductivityStore.getState().clipboardHistory[0];
  expect(item.text).toBe('Styled');
  expect(item.html).toContain('<strong>');
  expect(item.html).toContain('<em>');
  expect(item.html).toContain('<u>');
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  await DEFAULT_COMMANDS.find((command) => command.id === 'home-paste').run({ editor, toast: vi.fn() });
  let copied;
  editor.state.doc.descendants((node) => { if (node.text?.includes('Styled') && node.marks.length) copied = node; });
  expect(copied.marks.map((mark) => mark.type.name)).toEqual(expect.arrayContaining(['bold', 'italic', 'underline']));
  expect(editor.getText().match(/Styled/g)).toHaveLength(2);
});

it('captures native cut before selection disappears and preserves formatted history', async () => {
  editor = createTestEditor('<p><strong>Cut text</strong></p>');
  editor.commands.selectAll();
  useEditorStore.setState({ editor });
  document.body.appendChild(editor.view.dom);
  await act(async () => root.render(React.createElement(Harness)));
  editor.view.dom.dispatchEvent(new Event('cut', { bubbles: true }));
  editor.commands.deleteSelection();
  expect(useProductivityStore.getState().clipboardHistory[0]).toMatchObject({ text: 'Cut text' });
  expect(useProductivityStore.getState().clipboardHistory[0].html).toContain('<strong>');
  editor.view.dom.remove();
});
