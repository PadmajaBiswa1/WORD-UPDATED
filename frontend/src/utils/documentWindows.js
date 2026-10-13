import { useDocumentStore, useEditorStore } from '@/store';
import { writeLocalDraft } from './draftStorage';

function windowRegistry() {
  let host = window;
  try { if (window.opener?.location.origin === window.location.origin) host = window.opener; } catch { /* use this window */ }
  if (!host.__ETHERX_DOCUMENT_WINDOWS__) host.__ETHERX_DOCUMENT_WINDOWS__ = [];
  return host.__ETHERX_DOCUMENT_WINDOWS__;
}

export function documentWindows() {
  return windowRegistry().filter((entry) => !entry.window.closed);
}

export function openDocumentWindow() {
  const document = useDocumentStore.getState();
  const editor = useEditorStore.getState().editor;
  if (document.id) writeLocalDraft(document.id, { ...document, content: editor?.getHTML() || document.content });
  const url = new URL(document.id ? `/doc/${encodeURIComponent(document.id)}` : window.location.pathname, window.location.origin);
  url.searchParams.set('window', String(Date.now()));
  const popup = window.open(url.href, '_blank', 'popup=yes,width=1000,height=800,resizable=yes,scrollbars=yes');
  if (popup) windowRegistry().push({ window: popup, title: document.title || 'Untitled Document', id: document.id });
  return popup;
}

export function arrangeDocumentWindows(layout) {
  let entries = documentWindows();
  if (!entries.length) return false;
  // Include the current document in a movable app window; browser tabs cannot be tiled with resizeTo.
  if (!window.opener) {
    const popup = openDocumentWindow();
    if (!popup) return false;
    entries = documentWindows();
  }
  const left = window.screen.availLeft || 0;
  const top = window.screen.availTop || 0;
  const width = window.screen.availWidth;
  const height = window.screen.availHeight;
  const columns = layout === 'horizontal' ? 1 : layout === 'vertical' ? entries.length : Math.ceil(Math.sqrt(entries.length));
  const rows = Math.ceil(entries.length / columns);
  entries.forEach((entry, index) => {
    entry.window.resizeTo(Math.floor(width / columns), Math.floor(height / rows));
    entry.window.moveTo(left + (index % columns) * width / columns, top + Math.floor(index / columns) * height / rows);
  });
  entries[0].window.focus();
  return true;
}
