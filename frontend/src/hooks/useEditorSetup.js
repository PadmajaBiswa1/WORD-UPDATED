// ═══════════════════════════════════════════════════════════════
//  useEditorSetup — Tiptap editor initialisation
//  FontSize is implemented as a custom inline Extension so no
//  extra npm package is required.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useCallback, useMemo } from 'react';
import { useEditor as useTiptap } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import { StyledTableView } from '@/components/editor/StyledTableView';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import { Insertion, Deletion } from '@/services/trackedChanges';
import Typography from '@tiptap/extension-typography';
import Focus from '@tiptap/extension-focus';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import FontFamily from '@tiptap/extension-font-family';
import Blockquote from '@tiptap/extension-blockquote';
import { PageBreak, supportsColumnFlow, isAutoPaginationTransaction } from '@/components/editor/PageBreak';
import { getLayoutMetrics, PAGE_GAP, PAGE_BORDER_WIDTH } from '@/utils/pageLayout';
import { MediaEmbed } from '@/components/editor/MediaEmbed';
import { TrailingNode } from '@/components/editor/TrailingNode';
import { ProductivityExtension } from '@/services/productivityExtension';
import { useEditorStore, useDocumentStore, useUIStore } from '@/store';
import { normalizeFontFamily } from '@/components/toolbar/fontFormatting.jsx';
import { focusBelowBlockOrDocEnd } from '@/utils/editorCursorPlacement';
import { SuggestInsert, SuggestDelete, CommentAnchor, Suggestions } from '@/ai/suggestions';

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
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute('id'),
            renderHTML: (attributes) => attributes.id ? { id: attributes.id } : {},
          },
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

// Word's paragraph alignment shortcuts. Higher priority than the Code mark, which
// binds Mod-e to inline code by default.
const WordAlignKeymap = Extension.create({
  name: 'wordAlignKeymap',
  priority: 1000,
  addKeyboardShortcuts() {
    const align = (value) => ({ editor }) => editor.commands.setTextAlign(value);
    // The Shift variants are bound so ProseMirror does not fall back to Mod-e etc.:
    // Ctrl+Shift+L is Word's bullet list; Ctrl+Shift+E/R/J belong to app shortcuts.
    const appShortcut = () => true;
    return {
      'Mod-l': align('left'), 'Mod-e': align('center'), 'Mod-r': align('right'), 'Mod-j': align('justify'),
      'Mod-Shift-l': ({ editor }) => editor.commands.toggleBulletList(),
      'Mod-Shift-e': appShortcut, 'Mod-Shift-r': appShortcut, 'Mod-Shift-j': appShortcut,
    };
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
  const { pageColumns, pageSize, pageOrientation, pageMargin } = useUIStore();

  const syncToolbarFormattingState = useCallback((instance) => {
    const attrs = instance.getAttributes('textStyle') || {};
    const currentStore = useEditorStore.getState();
    const currentDesign = useDocumentStore.getState().design || {};
    const rawFamily = attrs.fontFamily;
    const nextFamily = rawFamily ? (normalizeFontFamily(rawFamily) || rawFamily) : currentDesign.bodyFont || currentDesign.font || 'Lora';
    const rawSize = attrs.fontSize;
    const parsedSize = rawSize ? parseInt(String(rawSize), 10) : NaN;
    const nextSize = Number.isFinite(parsedSize)
      ? String(parsedSize)
      : String(currentDesign.fontSize || '12');

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
      // WordAlignKeymap binds Word's Ctrl+L/E/R/J; Tiptap's Ctrl+Shift+L/E/R/J
      // would shadow Word shortcuts such as Ctrl+Shift+E (Track Changes).
      addKeyboardShortcuts() { return {}; },
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
    MediaEmbed,
    SuggestInsert, SuggestDelete, CommentAnchor, Suggestions,
    Table.configure({ resizable: true, View: StyledTableView }),
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
    WordAlignKeymap,
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
    onUpdate: ({ editor, transaction }) => {
      const html = editor.getHTML();
      // Page spacers are view bookkeeping, not edits. They must not trigger
      // autosave, collaboration writes, or change the user's undo ordering.
      if (isAutoPaginationTransaction(transaction)) {
        useDocumentStore.setState({ content: html });
        return;
      }
      useEditorStore.getState().recordEditorChange();
      const { isProgrammaticChange, programmaticContent, endProgrammaticChange } = useEditorStore.getState();
      
      if (isProgrammaticChange && (programmaticContent === null || programmaticContent === html)) {
        endProgrammaticChange();
        useDocumentStore.getState().applyRemoteUpdate({ content: html });
        return;
      }
      
      if (isProgrammaticChange) endProgrammaticChange();
      
      useDocumentStore.getState().setContent(html);
      syncToolbarFormattingState(editor);
      
    },
    onSelectionUpdate: ({ editor }) => {
      syncToolbarFormattingState(editor);
    },
  }, [extensions]);


  // Layout columns, as in Word: text fills each page's first column, then the
  // next, then continues on the next page. Each page is one row of columns as tall
  // as the page's text area (column-height + column-wrap); the row gap spans the
  // bottom margin, the gap between pages and the next top margin. Without
  // column-wrap support the columns fall back to running across the whole document.
  useEffect(() => {
    if (!editor) return;
    const style = editor.view.dom.style;
    const columns = pageColumns > 1;
    const flow = columns && supportsColumnFlow();
    const metrics = getLayoutMetrics({ size: pageSize, orientation: pageOrientation, margin: pageMargin });
    const columnHeight = Math.max(1, metrics.contentHeight - PAGE_BORDER_WIDTH * 2);
    style.setProperty('column-count', columns ? String(pageColumns) : 'auto');
    style.setProperty('column-gap', columns ? '40px' : 'normal');
    style.setProperty('column-fill', flow ? 'auto' : '');
    style.setProperty('column-height', flow ? `${columnHeight}px` : '');
    style.setProperty('column-wrap', flow ? 'wrap' : '');
    style.setProperty('row-gap', flow ? `${metrics.pageHeight + PAGE_GAP - columnHeight}px` : '');
    editor.view.dom.classList.toggle('etherx-column-flow', flow);
  }, [editor, pageColumns, pageSize, pageOrientation, pageMargin]);

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
    
    // Local updates already match. Always apply differing remote content,
    // including updates arriving in the same frame as a local transaction.
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

  return editor;
}
