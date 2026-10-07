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
import { TrailingNode } from '@/components/editor/TrailingNode';
import { ProductivityExtension } from '@/services/productivityExtension';
import { useEditorStore, useDocumentStore, useUIStore } from '@/store';
import { normalizeFontFamily } from '@/components/toolbar/fontFormatting.jsx';
import { focusBelowBlockOrDocEnd } from '@/utils/editorCursorPlacement';

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
      'data-drawing': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-drawing') || null,
        renderHTML: (attributes) => (attributes['data-drawing'] ? { 'data-drawing': attributes['data-drawing'] } : {}),
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
        types: ['paragraph', 'heading', 'blockquote', 'table', 'tableCell', 'tableHeader', 'tableRow'],
        attributes: {
          style: {
            default: null,
            parseHTML: (element) => element.getAttribute('style'),
            renderHTML: (attributes) =>
              attributes.style ? { style: attributes.style } : {},
          },
        },
      },
      {
        types: ['table'],
        attributes: {
          align: {
            default: null,
            parseHTML: (element) => {
              const alignAttr = element.getAttribute('align') || element.getAttribute('data-align');
              if (alignAttr) return alignAttr.toLowerCase();
              const style = element.style;
              if (style?.marginLeft === 'auto' && style?.marginRight === 'auto') return 'center';
              if (style?.marginLeft === 'auto' && (style?.marginRight === '0' || style?.marginRight === '0px')) return 'right';
              if ((style?.marginLeft === '0' || style?.marginLeft === '0px') && style?.marginRight === 'auto') return 'left';
              return null;
            },
            renderHTML: (attributes) => {
              if (!attributes.align) return {};
              return {
                align: attributes.align,
                'data-align': attributes.align,
              };
            },
          },
          width: {
            default: null,
            parseHTML: (element) => element.getAttribute('width') || element.style?.width || null,
            renderHTML: (attributes) => {
              if (!attributes.width) return {};
              return { width: attributes.width };
            },
          },
        },
      },
      {
        types: ['table', 'orderedList', 'bulletList', 'paragraph', 'heading'],
        attributes: {
          class: {
            default: null,
            parseHTML: (element) => element.getAttribute('class'),
            renderHTML: (attributes) =>
              attributes.class ? { class: attributes.class } : {},
          },
          theme: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-theme') || null,
            renderHTML: (attributes) =>
              attributes.theme ? { 'data-theme': attributes.theme } : {},
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

const TableExitKeymap = Extension.create({
  name: 'tableExitKeymap',

  addKeyboardShortcuts() {
    return {
      ArrowDown: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;

        if (selection.node && selection.node.type.name === 'image') {
          const afterPos = selection.to;
          const nextNode = state.doc.nodeAt(afterPos);
          if (nextNode && nextNode.type.name === 'paragraph') {
            return editor.chain().focus().setTextSelection(afterPos + 1).run();
          }
          return editor
            .chain()
            .focus()
            .insertContentAt(afterPos, { type: 'paragraph' })
            .setTextSelection(afterPos + 1)
            .run();
        }

        let tableDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'table') {
            tableDepth = d;
            break;
          }
        }

        if (tableDepth === -1) {
          return false;
        }

        const tableNode = $from.node(tableDepth);
        const rowIndex = $from.index(tableDepth);
        const isLastRow = rowIndex === tableNode.childCount - 1;

        if (!isLastRow) {
          return false;
        }

        const tableAfterPos = $from.after(tableDepth);
        const nextNode = state.doc.nodeAt(tableAfterPos);

        if (nextNode && nextNode.type.name === 'paragraph') {
          return editor.chain().focus().setTextSelection(tableAfterPos + 1).run();
        }

        return editor
          .chain()
          .focus()
          .insertContentAt(tableAfterPos, { type: 'paragraph' })
          .setTextSelection(tableAfterPos + 1)
          .run();
      },
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;

        if (selection.node && selection.node.type.name === 'image') {
          const afterPos = selection.to;
          const nextNode = state.doc.nodeAt(afterPos);
          if (nextNode && nextNode.type.name === 'paragraph') {
            return editor.chain().focus().setTextSelection(afterPos + 1).run();
          }
          return editor
            .chain()
            .focus()
            .insertContentAt(afterPos, { type: 'paragraph' })
            .setTextSelection(afterPos + 1)
            .run();
        }

        return false;
      },
    };
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
    const rawFamily = attrs.fontFamily;
    const nextFamily = rawFamily ? (normalizeFontFamily(rawFamily) || rawFamily) : currentStore.fontFamily;
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
    TextAlign.extend({
      addGlobalAttributes() {
        return [
          {
            types: this.options.types,
            attributes: {
              textAlign: {
                default: this.options.defaultAlignment,
                parseHTML: (element) => {
                  if (element.style?.textAlign) return element.style.textAlign;
                  if (element.getAttribute?.('align')) return element.getAttribute('align');
                  const parentAlign = element.closest?.('[style*="text-align"]')?.style?.textAlign;
                  if (parentAlign) return parentAlign;
                  const parentAttr = element.closest?.('[align]')?.getAttribute?.('align');
                  if (parentAttr) return parentAttr;
                  return null;
                },
                renderHTML: (attributes) => {
                  if (!attributes.textAlign || attributes.textAlign === this.options.defaultAlignment) {
                    return {};
                  }
                  return { style: `text-align: ${attributes.textAlign}` };
                },
              },
            },
          },
        ];
      },
    }).configure({ types: ['heading', 'paragraph', 'blockquote', 'tableCell', 'tableHeader'] }),
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
    ProductivityExtension,
    TrailingNode,
    TableExitKeymap,
  ], []);

  const editor = useTiptap({
    extensions,
    content: content || '<p></p>',
    autofocus: true,
    editorProps: {
      attributes: {
        spellcheck: String(spellCheck),
      },
      handleClick: (view, pos, event) => {
        if (event.target.tagName === 'IMG' || event.target.closest('td, th')) {
          return false;
        }
        const textBlock = event.target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
        if (textBlock && textBlock.textContent.trim().length > 0) {
          return false;
        }
        return focusBelowBlockOrDocEnd(view, event.clientX, event.clientY);
      },
    },
    onUpdate: ({ editor }) => {
      useEditorStore.getState().recordEditorChange();
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

  // When document content is loaded externally (open file/doc/collab update), apply it to editor.
  useEffect(() => {
    if (!editor || typeof content !== 'string') return;
    
    // Crucial: Skip if this content update originated from this editor instance
    if (isLocalChange.current) return;
    
    // Skip if content is already in sync
    if (editor.getHTML() === content) return;
    
    const { from, to } = editor.state.selection;
    beginProgrammaticChange(content);
    editor.commands.setContent(content || '<p></p>', false);
    try {
      const docSize = editor.state.doc.content.size;
      const safeFrom = Math.min(Math.max(0, from), docSize);
      const safeTo = Math.min(Math.max(0, to), docSize);
      editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
    } catch {}
  }, [editor, content, beginProgrammaticChange]);

  useEffect(() => {
    if (editor) {
      setEditor(editor);
      if (typeof window !== 'undefined') window.__ETHERX_EDITOR__ = editor;
    }
    return () => {
      if (editor) setEditor(null);
      if (typeof window !== 'undefined') window.__ETHERX_EDITOR__ = null;
    };
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
