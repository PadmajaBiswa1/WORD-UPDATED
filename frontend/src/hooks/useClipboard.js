import { useEffect } from 'react';
import { useEditorStore, useUIStore } from '@/store';
import ClipboardService from '@/services/clipboard';

export function useClipboard() {
  const { editor } = useEditorStore();
  const { toast } = useUIStore();

  useEffect(() => {
    if (!editor) return;

    // Handle drag-and-drop
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = async (e) => {
      ClipboardService.handleDropEvent(e, editor);
    };

    const editorDom = editor.view?.dom;
    if (editorDom) {
      editorDom.addEventListener('dragover', handleDragOver);
      editorDom.addEventListener('drop', handleDrop);
    }

    return () => {
      if (editorDom) {
        editorDom.removeEventListener('dragover', handleDragOver);
        editorDom.removeEventListener('drop', handleDrop);
      }
    };
  }, [editor]);

  const copy = async () => {
    const success = await ClipboardService.copyToClipboard(editor, 'html');
    if (success) {
      toast('Copied with formatting', 'success');
    } else {
      toast('Copy failed', 'error');
    }
  };

  const paste = async () => {
    const success = await ClipboardService.pasteFromClipboard(editor, {
      preserveFormatting: true,
    });
    if (success) {
      toast('Pasted with formatting', 'success');
    } else {
      toast('Paste failed', 'error');
    }
  };

  const cut = async () => {
    const success = await ClipboardService.copyToClipboard(editor, 'html');
    if (success && !editor.state.selection.empty) {
      editor.chain().focus().deleteSelection().run();
      toast('Cut', 'success');
    } else {
      toast('Cut failed', 'error');
    }
  };

  return { copy, paste, cut };
}
