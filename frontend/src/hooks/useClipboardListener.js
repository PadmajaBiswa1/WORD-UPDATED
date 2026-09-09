// ═══════════════════════════════════════════════════════════════
//  useClipboardListener — Global Copy & Cut Clipboard History
// ═══════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { useProductivityStore, useEditorStore } from '@/store';

export function useClipboardListener() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleClipboardCapture = () => {
      // Allow the default copy/cut event to populate the clipboard first
      setTimeout(() => {
        try {
          let text = '';
          let html = '';

          // 1. Try TipTap editor selection
          const editor = useEditorStore.getState().editor;
          if (editor && !editor.state.selection.empty) {
            const { from, to } = editor.state.selection;
            text = editor.state.doc.textBetween(from, to, ' ').trim();
            try {
              const slice = editor.state.doc.slice(from, to);
              const serializer =
                editor.schema.cached.domSerializer ||
                editor.view.someProp('clipboardSerializer', (s) => s);
              if (serializer) {
                const div = document.createElement('div');
                div.appendChild(serializer.serializeFragment(slice.content));
                html = div.innerHTML;
              }
            } catch {
              html = `<p>${text}</p>`;
            }
          }

          // 2. Fallback to window selection
          if (!text) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
              text = sel.toString().trim();
              try {
                const container = document.createElement('div');
                for (let i = 0; i < sel.rangeCount; i++) {
                  container.appendChild(sel.getRangeAt(i).cloneContents());
                }
                html = container.innerHTML;
              } catch {
                html = `<p>${text}</p>`;
              }
            }
          }

          // 3. Fallback to navigator.clipboard if available
          if (!text && navigator.clipboard?.readText) {
            navigator.clipboard.readText().then((clipText) => {
              const trimmed = (clipText || '').trim();
              if (trimmed) {
                useProductivityStore.getState().addClipboardItem({
                  text: trimmed,
                  html: `<p>${trimmed}</p>`,
                  copiedAt: new Date().toISOString(),
                });
              }
            }).catch(() => {});
            return;
          }

          if (text && text.trim()) {
            useProductivityStore.getState().addClipboardItem({
              text: text.trim(),
              html: html || `<p>${text.trim()}</p>`,
              copiedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn('Clipboard listener capture warning:', err);
        }
      }, 30);
    };

    window.addEventListener('copy', handleClipboardCapture, true);
    window.addEventListener('cut', handleClipboardCapture, true);

    return () => {
      window.removeEventListener('copy', handleClipboardCapture, true);
      window.removeEventListener('cut', handleClipboardCapture, true);
    };
  }, []);
}
