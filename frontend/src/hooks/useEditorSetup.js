// ═══════════════════════════════════════════════════════════════
//  useEditorSetup — Tiptap editor initialisation
//  FontSize is implemented as a custom inline Extension so no
//  extra npm package is required.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useEditor as useTiptap } from '@tiptap/react';
import { Extension, Mark } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Focus from '@tiptap/extension-focus';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import FontFamily from '@tiptap/extension-font-family';
import Blockquote from '@tiptap/extension-blockquote';
import { PageBreak } from '@/components/editor/PageBreak';
import { useEditorStore, useDocumentStore, useUIStore } from '@/store';

const LANGUAGE_KEY = 'etherx-language';

const RTL_LANGS = new Set(['ar-SA', 'he-IL', 'ur-PK', 'fa-IR']);

const FONT_STACK_BY_FAMILY = {
  'Crimson Pro': '"Crimson Pro", "Noto Serif", "Noto Sans", "Segoe UI", "Nirmala UI", "Microsoft YaHei", "Malgun Gothic", serif',
  Calibri: 'Calibri, "Segoe UI", "Nirmala UI", "Microsoft YaHei", "Malgun Gothic", "Meiryo", sans-serif',
  Arial: 'Arial, "Segoe UI", "Nirmala UI", "Microsoft YaHei", "Malgun Gothic", "Meiryo", sans-serif',
  'Times New Roman': '"Times New Roman", "Noto Serif", "Noto Naskh Arabic", "Noto Sans Devanagari", serif',
  'Nirmala UI': '"Nirmala UI", "Noto Sans Devanagari", "Segoe UI", sans-serif',
  'Microsoft YaHei': '"Microsoft YaHei", "Noto Sans CJK SC", "Segoe UI", sans-serif',
  'Malgun Gothic': '"Malgun Gothic", "Noto Sans CJK KR", "Segoe UI", sans-serif',
  Meiryo: 'Meiryo, "Yu Gothic UI", "Noto Sans CJK JP", sans-serif',
  'Noto Sans Devanagari': '"Noto Sans Devanagari", "Nirmala UI", "Segoe UI", sans-serif',
  'Noto Naskh Arabic': '"Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif',
};

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width') || element.style.width || null;
          return width ? String(width).replace('px', '') : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          const w = String(attributes.width).replace('px', '');
          return { width: w };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element.getAttribute('height') || element.style.height || null;
          return height ? String(height).replace('px', '') : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.height) return {};
          const h = String(attributes.height).replace('px', '');
          return { height: h };
        },
      },
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute('style') || null,
        renderHTML: (attributes) => (attributes.style ? { style: attributes.style } : {}),
      },
      pictureEffects: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-picture-effects') || '',
        renderHTML: (attributes) => (attributes.pictureEffects
          ? { 'data-picture-effects': attributes.pictureEffects }
          : {}),
      },
      rotate: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-rotate') || null,
        renderHTML: (attributes) => (attributes.rotate ? { 'data-rotate': attributes.rotate } : {}),
      },
      wrap: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-wrap') || null,
        renderHTML: (attributes) => (attributes.wrap ? { 'data-wrap': attributes.wrap } : {}),
      },
      zIndex: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-z') || null,
        renderHTML: (attributes) => (attributes.zIndex ? { 'data-z': attributes.zIndex } : {}),
      },
    };
  },
});

// ── FontSize extension ────────────────────────────────────────
// Stores font-size as a textStyle attribute so it survives
// serialisation to/from HTML and works with setFontSize() command.
const FontSize = Extension.create({
  name: 'fontSize',

  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize || null,
          renderHTML: (attributes) =>
            attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
        },
      },
    }];
  },

  addCommands() {
    return {
      // editor.chain().setFontSize('14pt').run()
      setFontSize: (size) => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: size }).run(),

      // editor.chain().unsetFontSize().run()
      unsetFontSize: () => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// ── BlockStyle extension ─────────────────────────────────────
// Allows paragraph, heading, and blockquote nodes to store and 
// render inline style attributes (used for indentation and spacing).
const BlockStyle = Extension.create({
  name: 'blockStyle',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote'],
        attributes: {
          style: {
            default: null,
            parseHTML: (element) => element.getAttribute('style'),
            renderHTML: (attributes) =>
              attributes.style ? { style: attributes.style } : {},
          },
        },
      },
    ];
  },
});

// ── Track Changes marks ─────────────────────────────────────
const Insertion = Mark.create({
  name: 'insertion',
  addOptions() {
    return {
      HTMLAttributes: {
        class: 'etherx-insertion',
        'data-mark': 'insertion',
      },
    };
  },
  parseHTML() {
    return [{ tag: 'ins' }, { tag: 'span[data-mark="insertion"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

const Deletion = Mark.create({
  name: 'deletion',
  addOptions() {
    return {
      HTMLAttributes: {
        class: 'etherx-deletion',
        'data-mark': 'deletion',
      },
    };
  },
  parseHTML() {
    return [{ tag: 'del' }, { tag: 'span[data-mark="deletion"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

// ── Hook ─────────────────────────────────────────────────────
export function useEditorSetup() {
  const { setEditor, fontFamily, fontSize, spellCheck, beginProgrammaticChange } = useEditorStore();
  const { content } = useDocumentStore();
  const { pageColumns } = useUIStore();
  const isLocalChange = useRef(false);

  const syncToolbarFormattingState = useCallback((instance) => {
    const attrs = instance.getAttributes('textStyle') || {};
    const currentStore = useEditorStore.getState();
    const nextFamily = attrs.fontFamily || currentStore.fontFamily;
    const rawSize = attrs.fontSize;
    const parsedSize = rawSize ? parseInt(String(rawSize), 10) : NaN;
    const nextSize = Number.isFinite(parsedSize)
      ? String(parsedSize)
      : currentStore.fontSize;

    if (currentStore.fontFamily !== nextFamily) currentStore.setFontFamily(nextFamily);
    if (currentStore.fontSize !== nextSize) currentStore.setFontSize(nextSize);
  }, []);

  const extensions = useMemo(() => [
    StarterKit.configure({
      history: { depth: 100 },
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      blockquote: false,
    }),
    Blockquote.configure({
      HTMLAttributes: {
        class: 'etherx-blockquote',
      },
    }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph', 'blockquote'] }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
    ResizableImage.configure({ allowBase64: true }),
    Table.configure({ resizable: true }),
    TableRow, TableCell, TableHeader,
    TaskList,
    TaskItem.configure({ nested: true }),
    CharacterCount,
    Placeholder.configure({ placeholder: 'Begin your document…' }),
    Typography,
    Focus.configure({ className: 'has-focus', mode: 'all' }),
    Subscript,
    Superscript,
    PageBreak,
    BlockStyle,
    Insertion,
    Deletion,
  ], []);

  const editor = useTiptap({
    extensions,
    content: content || '<p></p>',
    autofocus: true,
    editorProps: {
      attributes: {
        spellcheck: String(spellCheck),
      },
    },
    onUpdate: ({ editor }) => {
      const { isProgrammaticChange, programmaticContent, endProgrammaticChange } = useEditorStore.getState();
      const html = editor.getHTML();
      
      if (isProgrammaticChange && (programmaticContent === null || programmaticContent === html)) {
        endProgrammaticChange();
        useDocumentStore.getState().applyRemoteUpdate({ content: html });
        return;
      }
      
      if (isProgrammaticChange) endProgrammaticChange();
      
      // Mark this as a local change to prevent the sync-back effect from resetting the editor
      isLocalChange.current = true;
      useDocumentStore.getState().setContent(html);
      syncToolbarFormattingState(editor);
      
      // Clear the local change flag after the state has had a chance to update
      requestAnimationFrame(() => {
        isLocalChange.current = false;
      });
    },
    onSelectionUpdate: ({ editor }) => {
      syncToolbarFormattingState(editor);
    },
  }, [extensions]);


  // Sync layout columns
  useEffect(() => {
    if (!editor) return;
    editor.view.dom.style.setProperty('column-count', pageColumns > 1 ? String(pageColumns) : 'auto');
    editor.view.dom.style.setProperty('column-gap', pageColumns > 1 ? '40px' : 'normal');
  }, [editor, pageColumns]);

  useEffect(() => {
    if (!editor?.view?.dom || typeof window === 'undefined') return;
    const selectedLanguage = window.localStorage?.getItem(LANGUAGE_KEY) || 'en-US';
    editor.view.dom.setAttribute('lang', selectedLanguage);
    editor.view.dom.setAttribute('dir', RTL_LANGS.has(selectedLanguage) ? 'rtl' : 'ltr');
  }, [editor]);

  // Sync spellcheck
  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute('spellcheck', String(spellCheck));
  }, [editor, spellCheck]);

  // When document content is loaded externally (open file/doc), apply it to editor.
  useEffect(() => {
    if (!editor || typeof content !== 'string') return;
    
    // Crucial: Skip if this content update originated from this editor instance
    if (isLocalChange.current) return;
    
    // Skip if content is already in sync
    if (editor.getHTML() === content) return;
    
    beginProgrammaticChange(content);
    editor.commands.setContent(content || '<p></p>', false);
  }, [editor, content, beginProgrammaticChange]);

  useEffect(() => {
    if (editor) setEditor(editor);
    return () => { if (editor) setEditor(null); };
  }, [editor, setEditor]);

  // Handle Track Changes state toggle
  const trackChanges = useDocumentStore((s) => s.trackChanges);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (trackChanges) {
      editor.chain().focus().setMark('insertion').run();
    } else {
      editor.chain().focus().unsetMark('insertion').run();
    }
  }, [editor, trackChanges]);

  return editor;
}
