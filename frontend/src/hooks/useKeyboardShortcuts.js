import { useEffect } from 'react';
import { useUIStore, useEditorStore, useDocumentStore, useProductivityStore } from '@/store';
import { normalizeKeyEvent, executeShortcutCommand } from '@/services/productivityExtension';
import { insertNote } from '@/utils/notes';
import { addCommentAtSelection } from '@/utils/comments';
import { applyCase, nextCase, selectionText } from '@/utils/textCase';
import { runCommand } from '@/components/toolbar/commandRegistry';

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
      // 1. Check Custom Shortcuts from useProductivityStore first
      const { customShortcuts = {} } = useProductivityStore.getState();
      if (customShortcuts && Object.keys(customShortcuts).length > 0) {
        const currentCombo = normalizeKeyEvent(e);
        const matchedEntry = Object.entries(customShortcuts).find(([, shortcut]) => {
          return shortcut && shortcut.toLowerCase() === currentCombo.toLowerCase();
        });

        if (matchedEntry) {
          e.preventDefault();
          e.stopPropagation();
          executeShortcutCommand(matchedEntry[0], {
            editor,
            uiStore: { openDialog, openPragna, toast },
            documentStore: { addComment, toggleTrackChanges },
          });
          return;
        }
      }

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Pragna Copilot shortcut (Word standard Alt+I)
      if (e.altKey && key === 'i' && !mod) {
        e.preventDefault();
        const hasSelection = editor && !editor.state.selection.empty;
        openPragna(hasSelection ? 'edit' : 'ask');
        return;
      }

      // Ignore typing in form controls and the editor, but still allow modified
      // shortcuts and function keys (F7, Shift+F3, F11).
      const tag = (e.target?.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (!mod && !e.altKey && inField && !/^F\d+$/.test(e.key)) return;

      if (mod && !e.altKey && key === 'f') { e.preventDefault(); openDialog('findReplace'); }
      if (mod && !e.altKey && key === 'h') { e.preventDefault(); openDialog('findReplace'); }
      if (mod && key === '/')             { e.preventDefault(); openDialog('commandMap'); }
      if (mod && key === 'k')             { e.preventDefault(); openDialog('insertLink'); }
      if (mod && key === '-')             { e.preventDefault(); setZoom(zoom - 10); }
      if (mod && key === '0')             { e.preventDefault(); setZoom(100); }
      if (mod && key === 'p')             { e.preventDefault(); window.print(); }

      // Font shortcuts, as in Word: Ctrl+= subscript, Ctrl+Shift+= superscript,
      // Ctrl+Shift+> / < step the font size, Ctrl+] / [ change it by 1 pt.
      if (mod && !e.altKey && editor && (key === '=' || key === '+')) {
        e.preventDefault();
        if (e.shiftKey || key === '+') editor.chain().focus().toggleSuperscript().run();
        else editor.chain().focus().toggleSubscript().run();
      }
      if (mod && (key === '>' || key === '<')) { e.preventDefault(); runCommand(key === '>' ? 'home-growfont' : 'home-shrinkfont'); }
      if (mod && !e.shiftKey && editor && (key === ']' || key === '[')) {
        e.preventDefault();
        const size = parseInt(editor.getAttributes('textStyle')?.fontSize || '12', 10);
        editor.chain().focus().setFontSize(`${Math.max(1, size + (key === ']' ? 1 : -1))}pt`).run();
      }
      if (e.shiftKey && !mod && !e.altKey && e.key === 'F3' && editor) {
        e.preventDefault();
        if (!applyCase(editor, nextCase(selectionText(editor)))) toast('Select text to change case', 'info');
      }

      // Review shortcuts
      if (e.key === 'F7')                 { e.preventDefault(); toggleSpellCheck(); toast('Spelling toggle changed', 'info'); }
      if (mod && e.altKey && key === 'm' && editor) {
        e.preventDefault();
        if (editor.state.selection.empty) {
          toast('Select text to add comment', 'info');
        } else {
          addCommentAtSelection(editor);
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
      // Ctrl+Shift+E is Word's Track Changes toggle.
      if (mod && e.shiftKey && key === 'e') { e.preventDefault(); toggleTrackChanges(); toast('Track Changes toggled', 'info'); }
      if (mod && e.shiftKey && key === 'f') { e.preventDefault(); openDialog('insertMergeField'); }

      // References shortcuts
      if (mod && e.shiftKey && key === 'r') { e.preventDefault(); openDialog('tableOfContents'); }
      if (mod && e.shiftKey && key === 'b') { e.preventDefault(); openDialog('bibliography'); }
      if (mod && e.altKey && key === 'f' && editor) {
        e.preventDefault();
        insertNote(editor, 'footnote');
        toast('Footnote inserted', 'success');
      }
      if (mod && e.altKey && key === 'd' && editor) {
        e.preventDefault();
        insertNote(editor, 'endnote');
        toast('Endnote inserted', 'success');
      }

      // Bold, italic and underline belong to the editor keymap; toggling here too undid them.
      if ((e.key === 'Delete' || e.key === 'Backspace') && editor?.isActive('image')) {
        e.preventDefault();
        editor.chain().focus().deleteSelection().run();
      }

      if (e.key === 'F11')                { e.preventDefault(); toggleFullscreen(); }
    };
    // Undo/redo run in the capture phase and stop the event, so ProseMirror's own
    // history keymap does not undo a second step (undoDocumentAction already picks
    // between editor history and app-level actions).
    const undoRedo = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key?.toLowerCase();
      const tag = e.target?.tagName?.toLowerCase();
      // If user is inside a native form input/textarea, preserve native browser undo/redo
      const isFormInput = tag === 'input' || tag === 'textarea';
      const isZ = key === 'z' || e.code === 'KeyZ';
      const isY = key === 'y' || e.code === 'KeyY';

      if (isFormInput && mod && (isZ || isY)) {
        return;
      }

      // If Drawing canvas dialog is open, let DrawingDialog handle stroke undo/redo
      if (useUIStore.getState().dialogs?.drawing && mod && (isZ || isY)) {
        return;
      }

      // Universal Undo: Ctrl+Z
      if (mod && !e.altKey && !e.shiftKey && isZ) {
        e.preventDefault();
        useDocumentStore.getState().undoDocumentAction();
        e.stopPropagation();
        return;
      }

      // Universal Redo: Ctrl+Y or Ctrl+Shift+Z
      if (mod && !e.altKey && (isY || (e.shiftKey && isZ))) {
        e.preventDefault();
        e.stopPropagation();
        useDocumentStore.getState().redoDocumentAction();
        return;
      }

    };
    window.addEventListener('keydown', undoRedo, true);
    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('keydown', undoRedo, true);
      window.removeEventListener('keydown', h);
    };
  }, [zoom, openDialog, setZoom, toggleFullscreen, editor, toggleSpellCheck, toast, toggleTrackChanges, addComment]);
}
