// ═══════════════════════════════════════════════════════════════
//  useKeyboardShortcuts — Centralized Shortcut & Wheel Zoom Hook
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { dispatchShortcutEvent, handleWheelZoom } from '@/services/shortcutManager';

export function useKeyboardShortcuts(options = {}) {
  const uiStore = useUIStore();
  const editorStore = useEditorStore();
  const documentStore = useDocumentStore();

  const { zoom, setZoom, showFormattingMarks } = uiStore;
  const { editor } = editorStore;

  // Stable reference for context to avoid re-attaching listeners on every render
  const contextRef = useRef({});
  contextRef.current = {
    uiStore,
    editorStore,
    documentStore,
    editor,
    onSave: options.onSave,
  };

  // 1. Sync showFormattingMarks DOM class on editor
  useEffect(() => {
    if (!editor?.view?.dom) return;
    editor.view.dom.classList.toggle('etherx-show-formatting', Boolean(showFormattingMarks));
  }, [editor, showFormattingMarks]);

  // 2. Global Keydown Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      dispatchShortcutEvent(e, contextRef.current);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 3. Ctrl + Mouse Wheel Zoom Listener (passive: false to prevent browser native zoom)
  useEffect(() => {
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        handleWheelZoom(e, { zoom, setZoom });
      }
    };

    // Attach to window and the editor scroll area with passive: false
    window.addEventListener('wheel', onWheel, { passive: false });
    const scrollEl = document.getElementById('editor-scroll-area');
    if (scrollEl) {
      scrollEl.addEventListener('wheel', onWheel, { passive: false });
    }

    return () => {
      window.removeEventListener('wheel', onWheel);
      if (scrollEl) {
        scrollEl.removeEventListener('wheel', onWheel);
      }
    };
  }, [zoom, setZoom]);
}
