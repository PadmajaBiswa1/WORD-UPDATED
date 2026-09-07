import { useEffect } from 'react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';

export function useKeyboardShortcuts() {
  const openDialog = useUIStore((s) => s.openDialog);
  const openPragna = useUIStore((s) => s.openPragna);
  const setZoom = useUIStore((s) => s.setZoom);
  const zoom = useUIStore((s) => s.zoom);
  const toggleFullscreen = useUIStore((s) => s.toggleFullscreen);
  const toast = useUIStore((s) => s.toast);
  const toggleSpellCheck = useEditorStore((s) => s.toggleSpellCheck);
  const editor = useEditorStore((s) => s.editor);
  const toggleTrackChanges = useDocumentStore((s) => s.toggleTrackChanges);
  const addComment = useDocumentStore((s) => s.addComment);

  useEffect(() => {
    const h = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Pragna Copilot shortcut (Word standard Alt+I)
      if (e.altKey && key === 'i' && !mod) {
        e.preventDefault();
        const hasSelection = editor && !editor.state.selection.empty;
        openPragna(hasSelection ? 'edit' : 'ask');
        return;
      }

      // Ignore non-shortcut keydowns in form controls, but still allow modified shortcuts.
      const tag = (e.target?.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (!mod && !e.altKey && inField) return;

      if (mod && key === 'f')             { e.preventDefault(); openDialog('findReplace'); }
      if (mod && key === 'h')             { e.preventDefault(); openDialog('findReplace'); }
      if (mod && key === '/')             { e.preventDefault(); openDialog('commandMap'); }
      if (mod && (key === '=' || key === '+')) { e.preventDefault(); setZoom(zoom + 10); }
      if (mod && key === '-')             { e.preventDefault(); setZoom(zoom - 10); }
      if (mod && key === '0')             { e.preventDefault(); setZoom(100); }
      if (mod && key === 'p')             { e.preventDefault(); window.print(); }

      // Review shortcuts
      if (e.key === 'F7')                 { e.preventDefault(); toggleSpellCheck(); toast('Spelling toggle changed', 'info'); }
      if (mod && e.altKey && key === 'm' && editor) {
        e.preventDefault();
        const { from, to } = editor.state.selection;
        if (from === to) {
          toast('Select text to add comment', 'info');
        } else {
          const text = editor.state.doc.textBetween(from, to, ' ');
          addComment({ text: `Comment on: ${text.slice(0, 80)}` });
          editor.chain().focus().setTextSelection({ from, to }).toggleHighlight({ color: '#fff59d' }).run();
          openDialog('comments');
          toast('Comment added', 'success');
        }
      }
      if (mod && e.shiftKey && key === 't') {
        e.preventDefault();
        toggleTrackChanges();
        toast('Track Changes toggled', 'info');
      }
      if (mod && e.altKey && key === 'l') { e.preventDefault(); openDialog('language'); }
      if (mod && e.altKey && key === 'w') { e.preventDefault(); openDialog('wordCount'); }
      if (mod && e.altKey && key === 'a') { e.preventDefault(); openDialog('accessibility'); }

      // Mailings shortcuts
      if (mod && e.shiftKey && key === 'm') { e.preventDefault(); openDialog('mailMerge'); }
      if (mod && e.shiftKey && key === 'e') { e.preventDefault(); openDialog('selectRecipients'); }
      if (mod && e.shiftKey && key === 'f') { e.preventDefault(); openDialog('insertMergeField'); }

      // References shortcuts
      if (mod && e.shiftKey && key === 'r') { e.preventDefault(); openDialog('tableOfContents'); }
      if (mod && e.shiftKey && key === 'b') { e.preventDefault(); openDialog('bibliography'); }
      if (mod && e.altKey && key === 'f' && editor) {
        e.preventDefault();
        editor.chain().focus().insertContent('<sup data-etherx-footnote="true">[1]</sup><div data-etherx-footnote-text="true" style="margin-top:8px;font-size:12px;color:#666;">1. Footnote text</div>').run();
        toast('Footnote inserted', 'success');
      }
      if (mod && e.altKey && key === 'd' && editor) {
        e.preventDefault();
        editor.chain().focus().insertContent('<sup data-etherx-endnote="true">[a]</sup><div data-etherx-endnote-text="true" style="margin-top:8px;font-size:12px;color:#666;">Endnote text</div>').run();
        toast('Endnote inserted', 'success');
      }

      if (mod && key === 'b' && editor)   { e.preventDefault(); editor.chain().focus().toggleBold().run(); }
      if (mod && key === 'i' && editor)   { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }
      if (mod && key === 'u' && editor)   { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }
      if (mod && key === 'z' && editor) {
        e.preventDefault();
        if (e.shiftKey) editor.chain().focus().redo().run();
        else editor.chain().focus().undo().run();
      }
      if (mod && key === 'y' && editor)   { e.preventDefault(); editor.chain().focus().redo().run(); }

      if ((e.key === 'Delete' || e.key === 'Backspace') && editor?.isActive('image')) {
        e.preventDefault();
        editor.chain().focus().deleteSelection().run();
      }

      if (e.key === 'F11')                { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [zoom, openDialog, setZoom, toggleFullscreen, editor, toggleSpellCheck, toast, toggleTrackChanges, addComment]);
}
