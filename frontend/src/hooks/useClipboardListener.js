// Record native copy/cut before selection changes, and capture formatted paste data.
import { useEffect } from 'react';
import { useEditorStore } from '@/store';
import { recordClipboardData, selectionClipboardData } from '@/services/clipboard';

export function useClipboardListener() {
  useEffect(() => {
    const captureSelection = (event) => {
      const editor = useEditorStore.getState().editor;
      if (editor?.view.dom.contains(event.target)) {
        recordClipboardData(selectionClipboardData(editor));
        return;
      }
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || selection.isCollapsed) return;
      const container = document.createElement('div');
      for (let i = 0; i < selection.rangeCount; i += 1) {
        container.appendChild(selection.getRangeAt(i).cloneContents());
      }
      recordClipboardData({ text: selection.toString(), html: container.innerHTML });
    };
    const capturePaste = (event) => {
      if (!event.clipboardData) return;
      recordClipboardData({ text: event.clipboardData.getData('text/plain'), html: event.clipboardData.getData('text/html') });
    };
    window.addEventListener('copy', captureSelection, true);
    window.addEventListener('cut', captureSelection, true);
    window.addEventListener('paste', capturePaste, true);
    return () => {
      window.removeEventListener('copy', captureSelection, true);
      window.removeEventListener('cut', captureSelection, true);
      window.removeEventListener('paste', capturePaste, true);
    };
  }, []);
}
