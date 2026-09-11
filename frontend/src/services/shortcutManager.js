// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Centralized Keyboard Shortcut & Scroll Manager
//  Replicates standard MS Word shortcuts with platform awareness.
// ═══════════════════════════════════════════════════════════════

import { TextSelection } from '@tiptap/pm/state';
import {
  useUIStore,
  useEditorStore,
  useDocumentStore,
  useProductivityStore,
} from '../store/index.js';
import { normalizeKeyEvent, executeShortcutCommand } from './productivityExtension.js';
import { printDocument } from '@/utils/printUtils';

// ── Platform Detection ───────────────────────────────────────
export const isMac = typeof navigator !== 'undefined' && (
  /Mac|iPod|iPhone|iPad/.test(navigator.platform || '') ||
  /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent || '') ||
  navigator.userAgentData?.platform === 'macOS'
);

export const modKeyName = isMac ? 'Cmd' : 'Ctrl';

/**
 * Transforms shortcut text for current platform (e.g. 'Ctrl+B' -> 'Cmd+B' on Mac)
 */
export function formatShortcut(shortcut = '') {
  if (!shortcut) return '';
  const raw = String(shortcut).replace(/^\(|\)$/g, '').trim();
  if (isMac) {
    return raw
      .replace(/Ctrl\+/gi, 'Cmd+')
      .replace(/Alt\+/gi, 'Option+');
  }
  return raw;
}

// ── Target Scope Helpers ─────────────────────────────────────
export function isFormInput(target) {
  if (!target) return false;
  const tag = (target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  // ContentEditable outside ProseMirror (e.g. chat input or search widget)
  if (target.isContentEditable && !target.closest('.ProseMirror')) return true;
  return false;
}

export function isEditorTarget(target) {
  if (!target) return false;
  return Boolean(target.closest && target.closest('.ProseMirror'));
}

// ── Navigation & Text Helpers ────────────────────────────────
export function findPrevParagraphPos(state) {
  const { $from } = state.selection;
  if ($from.parentOffset > 0) {
    return $from.start($from.depth);
  }
  let pos = $from.before($from.depth);
  while (pos > 0) {
    pos -= 1;
    const $pos = state.doc.resolve(pos);
    if ($pos.parent && $pos.parent.isTextblock) {
      return $pos.start($pos.depth);
    }
  }
  return 0;
}

export function findNextParagraphPos(state) {
  const { $from } = state.selection;
  let pos = $from.after($from.depth);
  const docSize = state.doc.content.size;
  while (pos < docSize) {
    pos += 1;
    const $pos = state.doc.resolve(pos);
    if ($pos.parent && $pos.parent.isTextblock) {
      return $pos.start($pos.depth);
    }
  }
  return docSize;
}

const FONT_SIZE_STEPS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

export function stepFontSize(editor, direction) {
  if (!editor) return;
  const attrs = editor.getAttributes('textStyle') || {};
  const currentStore = useEditorStore.getState();
  const raw = attrs.fontSize || currentStore.fontSize || '12';
  const current = parseInt(String(raw), 10) || 12;

  let next;
  if (direction > 0) {
    next = FONT_SIZE_STEPS.find((s) => s > current) || (current + 2);
  } else {
    const reversed = [...FONT_SIZE_STEPS].reverse();
    next = reversed.find((s) => s < current) || Math.max(1, current - 2);
  }

  currentStore.setFontSize(String(next));
  editor.chain().focus().setFontSize(`${next}pt`).run();
}

export async function pastePlainText(editor) {
  if (!editor) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text) {
        editor.chain().focus().insertContent(text).run();
      }
    }
  } catch (err) {
    console.warn('Clipboard readText failed:', err);
  }
}

// ── Global Actions ───────────────────────────────────────────
function handleNewDocument() {
  const { isDirty } = useDocumentStore.getState();
  if (isDirty) {
    const proceed = window.confirm('You have unsaved changes. Create a new blank document without saving?');
    if (!proceed) return;
  }
  window.location.href = '/doc/new';
}

function handleCloseDocument() {
  const { isDirty } = useDocumentStore.getState();
  if (isDirty) {
    const proceed = window.confirm('You have unsaved changes. Close document and return to Home without saving?');
    if (!proceed) return;
  }
  window.location.href = '/';
}

// ── Central Shortcut Registry ────────────────────────────────
export const SHORTCUT_REGISTRY = [
  // 1. NAVIGATION
  {
    id: 'nav-doc-start',
    category: 'Navigation',
    label: 'Go to Start of Document',
    key: 'Ctrl+Home',
    description: 'Moves cursor to beginning of document',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && (e.key === 'Home' || e.code === 'Home'),
    action: ({ editor }) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection(0).scrollIntoView().run();
      const scrollEl = document.getElementById('editor-scroll-area');
      if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    },
  },
  {
    id: 'nav-doc-end',
    category: 'Navigation',
    label: 'Go to End of Document',
    key: 'Ctrl+End',
    description: 'Moves cursor to end of document',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && (e.key === 'End' || e.code === 'End'),
    action: ({ editor }) => {
      if (!editor) return;
      const endPos = editor.state.doc.content.size;
      editor.chain().focus().setTextSelection(endPos).scrollIntoView().run();
      const scrollEl = document.getElementById('editor-scroll-area');
      if (scrollEl) scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
    },
  },
  {
    id: 'nav-para-up',
    category: 'Navigation',
    label: 'Previous Paragraph',
    key: 'Ctrl+Up',
    description: 'Moves cursor to start of current or previous paragraph',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && (e.key === 'ArrowUp' || e.key === 'Up'),
    action: ({ editor }) => {
      if (!editor) return;
      const targetPos = findPrevParagraphPos(editor.state);
      editor.chain().focus().setTextSelection(targetPos).scrollIntoView().run();
    },
  },
  {
    id: 'nav-para-down',
    category: 'Navigation',
    label: 'Next Paragraph',
    key: 'Ctrl+Down',
    description: 'Moves cursor to start of next paragraph',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && (e.key === 'ArrowDown' || e.key === 'Down'),
    action: ({ editor }) => {
      if (!editor) return;
      const targetPos = findNextParagraphPos(editor.state);
      editor.chain().focus().setTextSelection(targetPos).scrollIntoView().run();
    },
  },
  {
    id: 'nav-page-up',
    category: 'Navigation',
    label: 'Scroll Page Up',
    key: 'PageUp',
    description: 'Scrolls view up by one screen',
    scope: 'document',
    match: (e) => !e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'PageUp',
    action: () => {
      const scrollEl = document.getElementById('editor-scroll-area');
      if (scrollEl) {
        scrollEl.scrollBy({ top: -scrollEl.clientHeight * 0.85, behavior: 'smooth' });
      }
    },
  },
  {
    id: 'nav-page-down',
    category: 'Navigation',
    label: 'Scroll Page Down',
    key: 'PageDown',
    description: 'Scrolls view down by one screen',
    scope: 'document',
    match: (e) => !e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'PageDown',
    action: () => {
      const scrollEl = document.getElementById('editor-scroll-area');
      if (scrollEl) {
        scrollEl.scrollBy({ top: scrollEl.clientHeight * 0.85, behavior: 'smooth' });
      }
    },
  },

  // 2. SELECTION
  {
    id: 'sel-all',
    category: 'Selection',
    label: 'Select All',
    key: 'Ctrl+A',
    description: 'Selects the entire document',
    scope: 'editor_only_if_input',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a',
    action: ({ editor }) => {
      editor?.chain().focus().selectAll().run();
    },
  },
  {
    id: 'sel-doc-start',
    category: 'Selection',
    label: 'Select to Document Start',
    key: 'Ctrl+Shift+Home',
    description: 'Extends selection to document start',
    scope: 'editor',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && (e.key === 'Home' || e.code === 'Home'),
    action: ({ editor }) => {
      if (!editor) return;
      const { anchor } = editor.state.selection;
      const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, anchor, 0));
      editor.view.dispatch(tr);
      editor.view.focus();
      const scrollEl = document.getElementById('editor-scroll-area');
      if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    },
  },
  {
    id: 'sel-doc-end',
    category: 'Selection',
    label: 'Select to Document End',
    key: 'Ctrl+Shift+End',
    description: 'Extends selection to document end',
    scope: 'editor',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && (e.key === 'End' || e.code === 'End'),
    action: ({ editor }) => {
      if (!editor) return;
      const { anchor } = editor.state.selection;
      const endPos = editor.state.doc.content.size;
      const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, anchor, endPos));
      editor.view.dispatch(tr);
      editor.view.focus();
      const scrollEl = document.getElementById('editor-scroll-area');
      if (scrollEl) scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
    },
  },
  {
    id: 'sel-para-up',
    category: 'Selection',
    label: 'Select Paragraph Up',
    key: 'Ctrl+Shift+Up',
    description: 'Extends selection up by paragraph',
    scope: 'editor',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && (e.key === 'ArrowUp' || e.key === 'Up'),
    action: ({ editor }) => {
      if (!editor) return;
      const { anchor } = editor.state.selection;
      const target = findPrevParagraphPos(editor.state);
      const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, anchor, target));
      editor.view.dispatch(tr);
      editor.view.focus();
    },
  },
  {
    id: 'sel-para-down',
    category: 'Selection',
    label: 'Select Paragraph Down',
    key: 'Ctrl+Shift+Down',
    description: 'Extends selection down by paragraph',
    scope: 'editor',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && (e.key === 'ArrowDown' || e.key === 'Down'),
    action: ({ editor }) => {
      if (!editor) return;
      const { anchor } = editor.state.selection;
      const target = findNextParagraphPos(editor.state);
      const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, anchor, target));
      editor.view.dispatch(tr);
      editor.view.focus();
    },
  },

  // 3. EDITING
  {
    id: 'edit-paste-plain',
    category: 'Editing',
    label: 'Paste as Plain Text',
    key: 'Ctrl+Shift+V',
    description: 'Pastes unformatted plain text',
    scope: 'editor',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v',
    action: ({ editor }) => {
      pastePlainText(editor);
    },
  },
  {
    id: 'edit-undo',
    category: 'Editing',
    label: 'Undo',
    key: 'Ctrl+Z',
    description: 'Undoes last change',
    scope: 'editor_only_if_input',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z',
    action: ({ editor }) => {
      editor?.chain().focus().undo().run();
    },
  },
  {
    id: 'edit-redo',
    category: 'Editing',
    label: 'Redo',
    key: 'Ctrl+Y',
    description: 'Redoes last undone change',
    scope: 'editor_only_if_input',
    match: (e, mod) => (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'y') ||
                       (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z'),
    action: ({ editor }) => {
      editor?.chain().focus().redo().run();
    },
  },
  {
    id: 'edit-find',
    category: 'Editing',
    label: 'Find',
    key: 'Ctrl+F',
    description: 'Opens Find dialog',
    scope: 'global',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f',
    action: ({ uiStore }) => {
      uiStore.openDialog('findReplace');
    },
  },
  {
    id: 'edit-replace',
    category: 'Editing',
    label: 'Find & Replace',
    key: 'Ctrl+H',
    description: 'Opens Find and Replace dialog',
    scope: 'global',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h',
    action: ({ uiStore }) => {
      uiStore.openDialog('findReplace');
    },
  },
  {
    id: 'edit-goto',
    category: 'Editing',
    label: 'Go To',
    key: 'Ctrl+G',
    description: 'Jump to page or line/paragraph',
    scope: 'global',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g',
    action: ({ uiStore }) => {
      uiStore.openDialog('goTo');
    },
  },

  // 4. FORMATTING
  {
    id: 'fmt-bold',
    category: 'Formatting',
    label: 'Bold',
    key: 'Ctrl+B',
    description: 'Toggles bold styling',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b',
    action: ({ editor }) => {
      editor?.chain().focus().toggleBold().run();
    },
  },
  {
    id: 'fmt-italic',
    category: 'Formatting',
    label: 'Italic',
    key: 'Ctrl+I',
    description: 'Toggles italic styling',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'i',
    action: ({ editor }) => {
      editor?.chain().focus().toggleItalic().run();
    },
  },
  {
    id: 'fmt-underline',
    category: 'Formatting',
    label: 'Underline',
    key: 'Ctrl+U',
    description: 'Toggles underline styling',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'u',
    action: ({ editor }) => {
      editor?.chain().focus().toggleUnderline().run();
    },
  },
  {
    id: 'fmt-align-left',
    category: 'Formatting',
    label: 'Align Left',
    key: 'Ctrl+L',
    description: 'Aligns text left',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l',
    action: ({ editor }) => {
      editor?.chain().focus().setTextAlign('left').run();
    },
  },
  {
    id: 'fmt-align-center',
    category: 'Formatting',
    label: 'Center Align',
    key: 'Ctrl+E',
    description: 'Centers text horizontally',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e',
    action: ({ editor }) => {
      editor?.chain().focus().setTextAlign('center').run();
    },
  },
  {
    id: 'fmt-align-right',
    category: 'Formatting',
    label: 'Align Right',
    key: 'Ctrl+R',
    description: 'Aligns text right',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'r',
    action: ({ editor }) => {
      editor?.chain().focus().setTextAlign('right').run();
    },
  },
  {
    id: 'fmt-align-justify',
    category: 'Formatting',
    label: 'Justify',
    key: 'Ctrl+J',
    description: 'Justifies text evenly',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j',
    action: ({ editor }) => {
      editor?.chain().focus().setTextAlign('justify').run();
    },
  },
  {
    id: 'fmt-font-increase',
    category: 'Formatting',
    label: 'Increase Font Size',
    key: 'Ctrl+Shift+>',
    description: 'Steps font size up',
    scope: 'editor',
    match: (e, mod) => (mod && e.shiftKey && (e.key === '>' || e.key === '.')) ||
                       (mod && !e.shiftKey && (e.key === ']' || e.code === 'BracketRight')),
    action: ({ editor }) => {
      stepFontSize(editor, 1);
    },
  },
  {
    id: 'fmt-font-decrease',
    category: 'Formatting',
    label: 'Decrease Font Size',
    key: 'Ctrl+Shift+<',
    description: 'Steps font size down',
    scope: 'editor',
    match: (e, mod) => (mod && e.shiftKey && (e.key === '<' || e.key === ',')) ||
                       (mod && !e.shiftKey && (e.key === '[' || e.code === 'BracketLeft')),
    action: ({ editor }) => {
      stepFontSize(editor, -1);
    },
  },
  {
    id: 'fmt-clear',
    category: 'Formatting',
    label: 'Clear Formatting',
    key: 'Ctrl+Space',
    description: 'Clears character formatting back to style defaults',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && (e.key === ' ' || e.code === 'Space'),
    action: ({ editor }) => {
      editor?.chain().focus().unsetAllMarks().run();
    },
  },
  {
    id: 'fmt-superscript',
    category: 'Formatting',
    label: 'Superscript',
    key: 'Ctrl+Shift+=',
    description: 'Toggles superscript on selection',
    scope: 'editor',
    match: (e, mod) => mod && e.shiftKey && (e.key === '+' || e.key === '='),
    action: ({ editor }) => {
      editor?.chain().focus().toggleSuperscript().run();
    },
  },
  {
    id: 'fmt-subscript',
    category: 'Formatting',
    label: 'Subscript',
    key: 'Ctrl+=',
    description: 'Toggles subscript on selection',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && (e.key === '=' || e.code === 'Equal'),
    action: ({ editor }) => {
      editor?.chain().focus().toggleSubscript().run();
    },
  },
  {
    id: 'fmt-bullet-list',
    category: 'Formatting',
    label: 'Bullet List',
    key: 'Ctrl+Shift+L',
    description: 'Toggles bullet list styling',
    scope: 'editor',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l',
    action: ({ editor }) => {
      editor?.chain().focus().toggleBulletList().run();
    },
  },
  {
    id: 'fmt-page-break',
    category: 'Formatting',
    label: 'Page Break',
    key: 'Ctrl+Enter',
    description: 'Inserts hard page break at cursor',
    scope: 'editor',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key === 'Enter',
    action: ({ editor }) => {
      editor?.chain().focus().insertPageBreak().run();
    },
  },

  // 5. FILE / DOCUMENT
  {
    id: 'file-new',
    category: 'File',
    label: 'New Document',
    key: 'Ctrl+N',
    description: 'Creates a new blank document',
    scope: 'global',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n',
    action: () => {
      handleNewDocument();
    },
  },
  {
    id: 'file-open',
    category: 'File',
    label: 'Open Document',
    key: 'Ctrl+O',
    description: 'Opens file import dialog',
    scope: 'global',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o',
    action: ({ uiStore }) => {
      uiStore.openDialog('importDocx');
    },
  },
  {
    id: 'file-save',
    category: 'File',
    label: 'Save Document',
    key: 'Ctrl+S',
    description: 'Saves current document',
    scope: 'global',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's',
    action: ({ onSave, uiStore }) => {
      if (typeof onSave === 'function') {
        onSave();
      } else {
        uiStore.toast('Saving document…', 'info');
      }
    },
  },
  {
    id: 'file-print',
    category: 'File',
    label: 'Print',
    key: 'Ctrl+P',
    description: 'Opens print dialog',
    scope: 'global',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p',
    action: () => {
      printDocument();
    },
  },
  {
    id: 'file-close',
    category: 'File',
    label: 'Close Document',
    key: 'Ctrl+W',
    description: 'Closes current document',
    scope: 'global',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w',
    action: () => {
      handleCloseDocument();
    },
  },

  // 6. VIEW / MISC
  {
    id: 'view-formatting-marks',
    category: 'View',
    label: 'Toggle Formatting Marks',
    key: 'Ctrl+Shift+8',
    description: 'Toggles paragraph marks and spaces',
    scope: 'global',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && (e.key === '8' || e.key === '*' || e.code === 'Digit8'),
    action: ({ uiStore }) => {
      uiStore.toggleFormattingMarks();
      const nextState = !uiStore.showFormattingMarks;
      uiStore.toast(nextState ? 'Formatting marks shown (¶)' : 'Formatting marks hidden', 'info');
    },
  },
  {
    id: 'insert-comment',
    category: 'Review',
    label: 'New Comment',
    key: 'Ctrl+Alt+M',
    description: 'Inserts comment on selected text',
    scope: 'editor',
    match: (e, mod) => mod && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'm',
    action: ({ editor, documentStore, uiStore }) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      if (from === to) {
        uiStore.toast('Select text to add comment', 'info');
        uiStore.openDialog('comments');
      } else {
        const text = editor.state.doc.textBetween(from, to, ' ');
        documentStore.addComment({ text: `Comment on: ${text.slice(0, 80)}` });
        editor.chain().focus().setTextSelection({ from, to }).toggleHighlight({ color: '#fff59d' }).run();
        uiStore.openDialog('comments');
        uiStore.toast('Comment added', 'success');
      }
    },
  },
  {
    id: 'view-track-changes',
    category: 'Review',
    label: 'Toggle Track Changes',
    key: 'Ctrl+Shift+E',
    description: 'Toggles track changes mode',
    scope: 'global',
    match: (e, mod) => (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') ||
                       (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 't'), // backward compat alias
    action: ({ documentStore, uiStore }) => {
      documentStore.toggleTrackChanges();
      const current = documentStore.trackChanges;
      uiStore.toast(current ? 'Track Changes turned OFF' : 'Track Changes turned ON', 'info');
    },
  },
  {
    id: 'tool-spellcheck',
    category: 'Review',
    label: 'Spell Check',
    key: 'F7',
    description: 'Runs spell check',
    scope: 'global',
    match: (e) => e.key === 'F7',
    action: ({ editorStore, uiStore }) => {
      editorStore.toggleSpellCheck();
      uiStore.toast('Spell check toggled', 'info');
    },
  },
  {
    id: 'tool-commandmap',
    category: 'Help',
    label: 'Keyboard Shortcuts Map',
    key: 'Ctrl+/',
    description: 'Opens keyboard shortcuts guide',
    scope: 'global',
    match: (e, mod) => mod && !e.shiftKey && !e.altKey && (e.key === '/' || e.code === 'Slash'),
    action: ({ uiStore }) => {
      uiStore.openDialog('commandMap');
    },
  },
  {
    id: 'tool-fullscreen',
    category: 'View',
    label: 'Toggle Fullscreen',
    key: 'F11',
    description: 'Toggles fullscreen mode',
    scope: 'global',
    match: (e) => e.key === 'F11',
    action: ({ uiStore }) => {
      uiStore.toggleFullscreen();
    },
  },
  {
    id: 'tool-copilot',
    category: 'AI',
    label: 'Pragna AI Copilot',
    key: 'Alt+I',
    description: 'Opens Pragna AI Writing Copilot',
    scope: 'global',
    match: (e, mod) => !mod && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'i',
    action: ({ editor, uiStore }) => {
      const hasSelection = editor && !editor.state.selection.empty;
      uiStore.openPragna(hasSelection ? 'edit' : 'ask');
    },
  },

  // Reference & Review Dialogs Shortcuts
  {
    id: 'ref-footnote',
    category: 'References',
    label: 'Insert Footnote',
    key: 'Ctrl+Alt+F',
    description: 'Inserts footnote mark',
    scope: 'editor',
    match: (e, mod) => mod && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f',
    action: ({ editor, uiStore }) => {
      if (!editor) return;
      editor.chain().focus().insertContent('<sup data-etherx-footnote="true">[1]</sup><div data-etherx-footnote-text="true" style="margin-top:8px;font-size:12px;color:#666;">1. Footnote text</div>').run();
      uiStore.toast('Footnote inserted', 'success');
    },
  },
  {
    id: 'ref-endnote',
    category: 'References',
    label: 'Insert Endnote',
    key: 'Ctrl+Alt+D',
    description: 'Inserts endnote mark',
    scope: 'editor',
    match: (e, mod) => mod && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'd',
    action: ({ editor, uiStore }) => {
      if (!editor) return;
      editor.chain().focus().insertContent('<sup data-etherx-endnote="true">[a]</sup><div data-etherx-endnote-text="true" style="margin-top:8px;font-size:12px;color:#666;">Endnote text</div>').run();
      uiStore.toast('Endnote inserted', 'success');
    },
  },
  {
    id: 'ref-toc',
    category: 'References',
    label: 'Table of Contents',
    key: 'Ctrl+Shift+R',
    description: 'Opens Table of Contents dialog',
    scope: 'global',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'r',
    action: ({ uiStore }) => {
      uiStore.openDialog('tableOfContents');
    },
  },
  {
    id: 'ref-biblio',
    category: 'References',
    label: 'Bibliography',
    key: 'Ctrl+Shift+B',
    description: 'Opens Bibliography dialog',
    scope: 'global',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b',
    action: ({ uiStore }) => {
      uiStore.openDialog('bibliography');
    },
  },
  {
    id: 'mail-merge',
    category: 'Mailings',
    label: 'Mail Merge',
    key: 'Ctrl+Shift+M',
    description: 'Opens Mail Merge wizard',
    scope: 'global',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm',
    action: ({ uiStore }) => {
      uiStore.openDialog('mailMerge');
    },
  },
  {
    id: 'mail-field',
    category: 'Mailings',
    label: 'Insert Merge Field',
    key: 'Ctrl+Shift+F',
    description: 'Opens Insert Merge Field dialog',
    scope: 'global',
    match: (e, mod) => mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f',
    action: ({ uiStore }) => {
      uiStore.openDialog('insertMergeField');
    },
  },
  {
    id: 'rev-language',
    category: 'Review',
    label: 'Language Dialog',
    key: 'Ctrl+Alt+L',
    description: 'Opens Language configuration dialog',
    scope: 'global',
    match: (e, mod) => mod && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'l',
    action: ({ uiStore }) => {
      uiStore.openDialog('language');
    },
  },
  {
    id: 'rev-wordcount',
    category: 'Review',
    label: 'Word Count Dialog',
    key: 'Ctrl+Alt+W',
    description: 'Opens Word Count statistics dialog',
    scope: 'global',
    match: (e, mod) => mod && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'w',
    action: ({ uiStore }) => {
      uiStore.openDialog('wordCount');
    },
  },
  {
    id: 'rev-accessibility',
    category: 'Review',
    label: 'Accessibility Checker',
    key: 'Ctrl+Alt+A',
    description: 'Opens Accessibility checker dialog',
    scope: 'global',
    match: (e, mod) => mod && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'a',
    action: ({ uiStore }) => {
      uiStore.openDialog('accessibility');
    },
  },
];

/**
 * Dispatches a keydown event against custom user shortcuts and built-in registry
 */
export function dispatchShortcutEvent(event, context = {}) {
  const mod = event.ctrlKey || event.metaKey;
  const inFormInput = isFormInput(event.target);
  const inEditor = isEditorTarget(event.target);

  // 1. Check custom user overrides from useProductivityStore
  const { customShortcuts = {} } = useProductivityStore.getState();
  if (customShortcuts && Object.keys(customShortcuts).length > 0) {
    const currentCombo = normalizeKeyEvent(event);
    const matchedEntry = Object.entries(customShortcuts).find(([, shortcut]) => {
      return shortcut && shortcut.toLowerCase() === currentCombo.toLowerCase();
    });

    if (matchedEntry) {
      if (inFormInput && ['cmd-bold', 'cmd-italic', 'cmd-underline', 'cmd-undo', 'cmd-redo', 'cmd-selectall'].includes(matchedEntry[0])) {
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      executeShortcutCommand(matchedEntry[0], context);
      return true;
    }
  }

  // 2. Scan built-in registry
  for (const shortcut of SHORTCUT_REGISTRY) {
    if (shortcut.match(event, mod)) {
      if (shortcut.scope === 'editor' && inFormInput) {
        return false;
      }
      if (shortcut.scope === 'editor_only_if_input' && inFormInput) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();

      shortcut.action(context);
      return true;
    }
  }

  // 3. Fallback: Image selection Backspace/Delete handling
  if ((event.key === 'Delete' || event.key === 'Backspace') && inEditor && context.editor?.isActive('image')) {
    event.preventDefault();
    context.editor.chain().focus().deleteSelection().run();
    return true;
  }

  return false;
}

/**
 * Handles Ctrl + Mouse Wheel zoom with preventDefault to override browser zoom
 */
export function handleWheelZoom(event, { zoom, setZoom }) {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 10 : -10;
    const currentZoom = Number.isFinite(zoom) ? zoom : useUIStore.getState().zoom;
    const nextZoom = Math.min(200, Math.max(25, currentZoom + delta));
    setZoom(nextZoom);
  }
}
