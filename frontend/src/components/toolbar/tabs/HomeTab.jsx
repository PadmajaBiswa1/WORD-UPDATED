import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Clipboard, Scissors, Copy, Paintbrush, History,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Pilcrow,
  List, ListOrdered, ListTodo, Quote, Outdent, Indent, MoveVertical,
  Search, Undo2, Redo2, MousePointerClick, HelpCircle
} from 'lucide-react';
import { useEditorStore, useUIStore } from '@/store';
import { Button, Divider, Tooltip, Select, ColorSwatch } from '@/components/ui';
import { RibbonGroup } from '../RibbonGroup';
import { FONT_SIZE_OPTIONS, FontFormattingControls, useFontFormattingControls } from '../fontFormatting.jsx';

const QUICK_STYLES = [
  {
    id: 'normal',
    label: 'Normal',
    desc: 'Default body paragraph',
    preview: { fontSize: 11, fontWeight: 400, color: 'var(--text-primary)' },
  },
  {
    id: 'heading-1',
    label: 'Heading 1',
    desc: 'Top-level section heading',
    preview: { fontSize: 13, fontWeight: 700, color: 'var(--gold)' },
  },
  {
    id: 'heading-2',
    label: 'Heading 2',
    desc: 'Sub-section heading',
    preview: { fontSize: 12, fontWeight: 600, color: 'var(--gold)' },
  },
  {
    id: 'heading-3',
    label: 'Heading 3',
    desc: 'Topic heading',
    preview: { fontSize: 11, fontWeight: 600, color: 'var(--gold)' },
  },
  {
    id: 'heading-4',
    label: 'Heading 4',
    desc: 'Sub-topic heading',
    preview: { fontSize: 11, fontWeight: 600, fontStyle: 'italic', color: 'var(--text-secondary)' },
  },
  {
    id: 'title',
    label: 'Title',
    desc: 'Document title',
    preview: { fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)' },
  },
  {
    id: 'subtitle',
    label: 'Subtitle',
    desc: 'Document subtitle',
    preview: { fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' },
  },
  {
    id: 'subtle-emphasis',
    label: 'Subtle Emphasis',
    desc: 'Subtle italic emphasis',
    preview: { fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' },
  },
  {
    id: 'emphasis',
    label: 'Emphasis',
    desc: 'Italic emphasis',
    preview: { fontSize: 11, fontStyle: 'italic', color: 'var(--text-primary)' },
  },
  {
    id: 'intense-emphasis',
    label: 'Intense Emphasis',
    desc: 'Bold italic gold emphasis',
    preview: { fontSize: 11, fontWeight: 700, fontStyle: 'italic', color: 'var(--gold)' },
  },
  {
    id: 'strong',
    label: 'Strong',
    desc: 'Bold importance',
    preview: { fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' },
  },
  {
    id: 'quote',
    label: 'Quote',
    desc: 'Block quotation',
    preview: { fontSize: 11, fontStyle: 'italic', color: 'var(--text-secondary)' },
  },
  {
    id: 'intense-quote',
    label: 'Intense Quote',
    desc: 'Centered gold quote',
    preview: { fontSize: 11, fontStyle: 'italic', fontWeight: 600, color: 'var(--gold)' },
  },
  {
    id: 'code',
    label: 'Code',
    desc: 'Inline monospaced code',
    preview: { fontSize: 11, fontFamily: 'monospace', color: '#93c5fd' },
  },
];

const MULTILEVEL_FORMATS = [
  {
    id: 'numeric',
    label: '1. -> 1.1 -> 1.1.1',
    desc: 'Hierarchical numeric outline',
    icon: '1.1',
    className: 'multilevel-numeric',
  },
  {
    id: 'alpha',
    label: '1. -> a. -> i.',
    desc: 'Standard alpha-numeric outline',
    icon: '1.a',
    className: 'multilevel-alpha',
  },
  {
    id: 'legal',
    label: '§ 1. -> § 1.01',
    desc: 'Legal section numbering',
    icon: '§ 1',
    className: 'multilevel-legal',
  },
  {
    id: 'standard',
    label: 'Standard Numbering (1, 2, 3)',
    desc: 'Simple sequential list',
    icon: '1.',
    className: null,
  },
];

const TEXT_COLORS = [
  '#000000', '#333333', '#666666', '#999999', '#ffffff', '#ff4d4f',
  '#fa8c16', '#fadb14', '#52c41a', '#13c2c2', '#1677ff', '#722ed1',
  '#ff7a45', '#ff85c0', '#f759ab', '#c41d7f', '#ad6800', '#5cdbd3',
  '#0050b3', '#1890ff', '#b37feb', '#531dab',
];

const HIGHLIGHT_COLORS = [
  '#fff200', '#c8f79a', '#8fe7ff', '#ffc4de', '#ffd591', '#d9f7be',
  '#fff7e6', '#ffec8f', '#ffe58f', '#ffbb96', '#ffa940', '#ff9c6e',
  '#ffd666', '#bae637', '#95de64', '#69c0ff', '#85a5ff', '#d48806',
];

export function HomeTab() {
  const {
    editor,
    fontFamily,
    fontSize,
    formatPainterMarks,
    setFormatPainterMarks,
  } = useEditorStore();
  const { openDialog, toast, openPragna, showFormattingMarks, toggleFormattingMarks } = useUIStore();
  const { applyFontSize } = useFontFormattingControls(editor);
  const painterActive = useRef(false);
  const [showTextColors, setShowTextColors] = useState(false);
  const [showHighlightColors, setShowHighlightColors] = useState(false);
  const [textPalettePos, setTextPalettePos] = useState({ top: 0, left: 0 });
  const [highlightPalettePos, setHighlightPalettePos] = useState({ top: 0, left: 0 });
  const [showMultilevelPicker, setShowMultilevelPicker] = useState(false);
  const [multilevelPickerPos, setMultilevelPickerPos] = useState({ top: 0, left: 0 });
  const [showStylesDropdown, setShowStylesDropdown] = useState(false);
  const [stylesDropdownPos, setStylesDropdownPos] = useState({ top: 0, left: 0 });
  const stylesStripRef = useRef(null);

  const activeTextColor = editor?.getAttributes('textStyle')?.color || '#d4af37';
  const activeHighlight = editor?.getAttributes('highlight')?.color || '#ffe08a';

  const handlePragnaClick = () => {
    if (!editor) {
      openPragna('ask');
      return;
    }
    const { from, to } = editor.state.selection;
    if (from !== to) {
      openPragna('edit');
    } else {
      openPragna('ask');
    }
  };

  const savedSelectionRef = useRef(null);

  const snapshotSelection = () => {
    if (!editor) return;
    const { selection } = editor.state;
    if (!selection.empty) {
      savedSelectionRef.current = { from: selection.from, to: selection.to };
    }
  };

  const run = (fn) => {
    if (!editor) return;
    editor.view.focus();
    fn();
  };

  const getSheetTop = () => {
    const sheet = document.getElementById('editor-scroll-area');
    return sheet?.getBoundingClientRect().top ?? 0;
  };

  const openTextPalette = (event) => {
    snapshotSelection();
    const rect = event.currentTarget?.getBoundingClientRect();
    if (!rect) return;
    const top = Math.max(rect.bottom + 8, getSheetTop() + 8);
    setTextPalettePos({ top, left: rect.left });
    setShowTextColors((v) => !v);
    setShowHighlightColors(false);
    setShowMultilevelPicker(false);
    setShowStylesDropdown(false);
  };

  const openHighlightPalette = (event) => {
    snapshotSelection();
    const rect = event.currentTarget?.getBoundingClientRect();
    if (!rect) return;
    const top = Math.max(rect.bottom + 8, getSheetTop() + 8);
    setHighlightPalettePos({ top, left: rect.left });
    setShowHighlightColors((v) => !v);
    setShowTextColors(false);
    setShowMultilevelPicker(false);
    setShowStylesDropdown(false);
  };

  const openMultilevelPicker = (event) => {
    snapshotSelection();
    const rect = event.currentTarget?.getBoundingClientRect();
    if (!rect) return;
    const top = Math.max(rect.bottom + 8, getSheetTop() + 8);
    setMultilevelPickerPos({ top, left: Math.min(rect.left, window.innerWidth - 260) });
    setShowMultilevelPicker((v) => !v);
    setShowStylesDropdown(false);
    setShowTextColors(false);
    setShowHighlightColors(false);
  };

  const openStylesDropdown = (event) => {
    snapshotSelection();
    const rect = event.currentTarget?.getBoundingClientRect();
    if (!rect) return;
    const top = Math.max(rect.bottom + 8, getSheetTop() + 8);
    setStylesDropdownPos({ top, left: Math.max(10, Math.min(rect.right - 360, window.innerWidth - 380)) });
    setShowStylesDropdown((v) => !v);
    setShowMultilevelPicker(false);
    setShowTextColors(false);
    setShowHighlightColors(false);
  };

  const scrollStyles = (direction) => {
    if (!stylesStripRef.current) return;
    const delta = direction === 'left' ? -180 : 180;
    stylesStripRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (event.target.closest('[data-home-color-trigger="true"]')) return;
      if (event.target.closest('[data-home-color-palette="true"]')) return;
      if (event.target.closest('[data-multilevel-trigger="true"]')) return;
      if (event.target.closest('[data-multilevel-palette="true"]')) return;
      if (event.target.closest('[data-styles-trigger="true"]')) return;
      if (event.target.closest('[data-styles-palette="true"]')) return;
      setShowTextColors(false);
      setShowHighlightColors(false);
      setShowMultilevelPicker(false);
      setShowStylesDropdown(false);
    };

    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

  if (!editor) return null;

  const parseStyle = (style = '') => {
    const out = {};
    String(style).split(';').forEach((pair) => {
      const [k, v] = pair.split(':').map((s) => s?.trim());
      if (k && v) out[k] = v;
    });
    return out;
  };

  const toStyle = (obj) => Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

  const updateParagraphStyle = (patch = {}) => {
    const base = editor.getAttributes('paragraph')?.style || '';
    const css = parseStyle(base);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') delete css[k];
      else css[k] = v;
    });
    run(() => editor.chain().updateAttributes('paragraph', { style: toStyle(css) }).run());
  };

  const growFont = () => {
    const numeric = parseInt(String(fontSize), 10);
    const fallbackIdx = FONT_SIZE_OPTIONS.findIndex((s) => parseInt(s.value, 10) > numeric);
    const idx = FONT_SIZE_OPTIONS.findIndex((s) => s.value === fontSize);
    const nextIdx = idx >= 0 ? idx + 1 : fallbackIdx;
    if (nextIdx >= 0 && nextIdx < FONT_SIZE_OPTIONS.length) applyFontSize(FONT_SIZE_OPTIONS[nextIdx].value);
  };

  const shrinkFont = () => {
    const numeric = parseInt(String(fontSize), 10);
    const idx = FONT_SIZE_OPTIONS.findIndex((s) => s.value === fontSize);
    if (idx > 0) {
      applyFontSize(FONT_SIZE_OPTIONS[idx - 1].value);
      return;
    }
    const smaller = FONT_SIZE_OPTIONS.map((s) => parseInt(s.value, 10)).filter((v) => v < numeric);
    if (!smaller.length) return;
    const next = Math.max(...smaller);
    applyFontSize(String(next));
  };

  const handleFormatPainter = () => {
    // If already active, deactivate it
    if (painterActive.current) {
      painterActive.current = false;
      setFormatPainterMarks(null);
      toast('Format Painter cancelled', 'info');
      return;
    }
    
    const { from, to } = editor.state.selection;
    if (from === to) {
      toast('Select text to copy format from', 'warning');
      return;
    }
    
    // Get all marks from the first character of selection
    const $from = editor.state.doc.resolve(from);
    const marksAtPos = $from.marks();
    
    // Get node attributes
    const node = $from.parent;
    const nodeAttrs = { ...node.attrs };
    
    // Store format data
    const formatData = {
      marks: marksAtPos.map(m => ({ type: m.type.name, attrs: m.attrs })),
      nodeAttrs: nodeAttrs,
    };
    
    setFormatPainterMarks(formatData);
    painterActive.current = true;
    
    const marksInfo = marksAtPos.length > 0 ? marksAtPos.map(m => m.type.name).join(', ') : 'base';
    toast(`Format Painter active: ${marksInfo}`, 'info');

    const applyOnce = () => {
      if (!painterActive.current) return;
      painterActive.current = false;
      
      const sel = editor.state.selection;
      if (sel.from === sel.to) {
        toast('Select text to apply format to', 'warning');
        setFormatPainterMarks(null);
        editor.off('selectionUpdate', applyOnce);
        return;
      }
      
      try {
        const chain = editor.chain().focus();
        
        // Remove existing marks first
        chain.unsetAllMarks();
        
        // Apply captured marks
        if (formatData.marks && formatData.marks.length > 0) {
          formatData.marks.forEach(({ type, attrs }) => {
            chain.setMark(type, attrs);
          });
        }
        
        chain.run();
        setFormatPainterMarks(null);
        toast('Format applied successfully', 'success');
      } catch (err) {
        console.error('Format Painter error:', err);
        toast('Error applying format', 'error');
      }
      editor.off('selectionUpdate', applyOnce);
    };

    editor.on('selectionUpdate', applyOnce);
  };

  const handleCopy = async () => {
    try {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');
      if (!text) return;
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    } catch {
      toast('Copy failed', 'error');
    }
  };

  const handleCut = async () => {
    try {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');
      if (!text) return;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        run(() => editor.chain().deleteSelection().run());
      }
    } catch {
      toast('Cut failed', 'error');
    }
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        run(() => editor.chain().insertContent(text).run());
      }
    } catch {
      toast('Paste blocked by browser permissions', 'warning');
    }
  };

  const indent = () => {
    if (editor.isActive('listItem')) {
      run(() => editor.chain().sinkListItem('listItem').run());
    } else {
      // Get the paragraph attributes properly
      const paraAttrs = editor.getAttributes('paragraph');
      const styleStr = paraAttrs.style || '';
      const match = styleStr.match(/margin-left:\s*(\d+)px/);
      const cur = parseInt(match ? match[1] : '0', 10);
      updateParagraphStyle({ 'margin-left': `${cur + 40}px` });
    }
  };

  const outdent = () => {
    if (editor.isActive('listItem')) {
      run(() => editor.chain().liftListItem('listItem').run());
    } else {
      // Get the paragraph attributes properly
      const paraAttrs = editor.getAttributes('paragraph');
      const styleStr = paraAttrs.style || '';
      const match = styleStr.match(/margin-left:\s*(\d+)px/);
      const cur = parseInt(match ? match[1] : '0', 10);
      const newMargin = cur > 0 ? Math.max(0, cur - 40) : 0;
      updateParagraphStyle({ 'margin-left': newMargin > 0 ? `${newMargin}px` : null });
    }
  };

  const changeCase = () => {
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to);
    const next = text === text.toUpperCase() ? text.toLowerCase() : text.toUpperCase();
    run(() => editor.chain().insertContentAt({ from, to }, next).run());
  };

  const cycleLineSpacing = () => {
    const spacings = ['1', '1.15', '1.5', '2'];
    const current = editor.getAttributes('paragraph')?.style || '';
    const m = current.match(/line-height:\s*([0-9.]+)/i);
    const cur = m ? m[1] : '1';
    const idx = spacings.indexOf(cur);
    const next = spacings[(idx + 1) % spacings.length];
    updateParagraphStyle({ 'line-height': next });
    toast(`Line spacing: ${next}`, 'success');
  };

  const activeStyle = () => {
    if (!editor) return 'normal';
    if (editor.isActive('code')) return 'code';
    if (editor.isActive('heading', { level: 1 })) {
      const size = editor.getAttributes('textStyle')?.fontSize;
      if (size === '24pt' || size === '26pt' || size === '2.4em') return 'title';
      return 'heading-1';
    }
    if (editor.isActive('heading', { level: 2 })) return 'heading-2';
    if (editor.isActive('heading', { level: 3 })) return 'heading-3';
    if (editor.isActive('heading', { level: 4 })) return 'heading-4';
    if (editor.isActive('blockquote')) {
      if (editor.isActive({ textAlign: 'center' })) return 'intense-quote';
      return 'quote';
    }
    if (editor.isActive('bold') && editor.isActive('italic')) return 'intense-emphasis';
    if (editor.isActive('bold')) return 'strong';
    if (editor.isActive('italic')) {
      const color = editor.getAttributes('textStyle')?.color;
      if (color === '#9a8a6a' || color === 'var(--text-muted)') return 'subtle-emphasis';
      return 'emphasis';
    }
    const color = editor.getAttributes('textStyle')?.color;
    const size = editor.getAttributes('textStyle')?.fontSize;
    if (size === '14pt' && (color === '#9a8a6a' || color === 'var(--text-muted)')) return 'subtitle';
    return 'normal';
  };

  const applyStyle = (id) => {
    if (!editor) return;
    editor.view.focus();

    switch (id) {
      case 'normal':
        run(() => {
          editor.chain().setParagraph().unsetAllMarks().run();
          editor.commands.unsetFontSize?.();
          editor.commands.unsetColor?.();
        });
        toast('Applied Normal style', 'info');
        break;

      case 'heading-1':
        run(() => editor.chain().setHeading({ level: 1 }).run());
        toast('Applied Heading 1', 'info');
        break;

      case 'heading-2':
        run(() => editor.chain().setHeading({ level: 2 }).run());
        toast('Applied Heading 2', 'info');
        break;

      case 'heading-3':
        run(() => editor.chain().setHeading({ level: 3 }).run());
        toast('Applied Heading 3', 'info');
        break;

      case 'heading-4':
        run(() => editor.chain().setHeading({ level: 4 }).run());
        toast('Applied Heading 4', 'info');
        break;

      case 'title':
        run(() => editor.chain().setHeading({ level: 1 }).setFontSize('24pt').run());
        toast('Applied Title style', 'info');
        break;

      case 'subtitle':
        run(() => editor.chain().setParagraph().setFontSize('14pt').setColor('#9a8a6a').run());
        toast('Applied Subtitle style', 'info');
        break;

      case 'subtle-emphasis':
        run(() => editor.chain().setItalic().setColor('#9a8a6a').run());
        toast('Applied Subtle Emphasis', 'info');
        break;

      case 'emphasis':
        run(() => editor.chain().setItalic().run());
        toast('Applied Emphasis', 'info');
        break;

      case 'intense-emphasis':
        run(() => editor.chain().setBold().setItalic().setColor('#c9a84c').run());
        toast('Applied Intense Emphasis', 'info');
        break;

      case 'strong':
        run(() => editor.chain().setBold().run());
        toast('Applied Strong style', 'info');
        break;

      case 'quote':
        run(() => editor.chain().setBlockquote().run());
        toast('Applied Quote style', 'info');
        break;

      case 'intense-quote':
        run(() => editor.chain().setBlockquote().setTextAlign('center').setColor('#c9a84c').setItalic().run());
        toast('Applied Intense Quote', 'info');
        break;

      case 'code':
        run(() => editor.chain().toggleCode().run());
        toast('Applied Code style', 'info');
        break;

      default:
        run(() => editor.chain().setParagraph().run());
        break;
    }
  };

  const applyMultilevelList = (format) => {
    if (!editor) return;
    editor.view.focus();
    if (!editor.isActive('orderedList')) {
      editor.chain().focus().toggleOrderedList().run();
    }
    if (format.className) {
      editor.chain().focus().updateAttributes('orderedList', { class: format.className }).run();
    } else {
      editor.chain().focus().updateAttributes('orderedList', { class: null }).run();
    }
    setShowMultilevelPicker(false);
    toast(`Multilevel list: ${format.label}`, 'success');
  };

  const toolBtn = {
    width: 24,
    height: 24,
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 2,
    fontSize: 12,
    padding: 0,
  };

  return (
    <>
      <RibbonGroup label="Clipboard">
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip text="Paste" shortcut="Ctrl+V">
            <Button
              onClick={handlePaste}
              style={{
                width: 48,
                height: 78,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                fontSize: 11,
              }}
            >
              <Clipboard size={20} strokeWidth={1.75} />
              <span>Paste</span>
            </Button>
          </Tooltip>
          <div data-stacked="true" style={{ display: 'flex', flexDirection: 'column', gap: 2, height: 78, justifyContent: 'space-between' }}>
            <Tooltip text="Cut" shortcut="Ctrl+X">
              <Button style={{ ...toolBtn, width: 80, height: 24, justifyContent: 'flex-start', padding: '0 6px', gap: 5 }} onClick={handleCut}><Scissors size={13} strokeWidth={1.75} /> Cut</Button>
            </Tooltip>
            <Tooltip text="Copy" shortcut="Ctrl+C">
              <Button style={{ ...toolBtn, width: 80, height: 24, justifyContent: 'flex-start', padding: '0 6px', gap: 5 }} onClick={handleCopy}><Copy size={13} strokeWidth={1.75} /> Copy</Button>
            </Tooltip>
            <Tooltip text="Format Painter">
              <Button
                style={{ ...toolBtn, width: 80, height: 24, justifyContent: 'flex-start', padding: '0 6px', gap: 5, color: formatPainterMarks ? 'var(--text-gold)' : 'var(--text-primary)' }}
                active={!!formatPainterMarks}
                onClick={handleFormatPainter}
              >
                <Paintbrush size={13} strokeWidth={1.75} /> Paint
              </Button>
            </Tooltip>
          </div>
          <Tooltip text="Clipboard History">
            <Button
              onClick={() => openDialog('clipboardHistory')}
              style={{
                width: 46,
                height: 78,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                fontSize: 11,
              }}
            >
              <History size={18} strokeWidth={1.75} />
              <span>History</span>
            </Button>
          </Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Font">
        <div data-stacked="true" style={{ display: 'flex', flexDirection: 'column', gap: 2, height: 78, justifyContent: 'space-between' }}>
          {/* Row 1: Font picker, Size, Grow, Shrink */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
            <FontFormattingControls
              editor={editor}
              fontFamily={fontFamily}
              fontSize={fontSize}
              familyWidth={116}
              sizeWidth={42}
            />
            <Tooltip text="Increase Font Size" shortcut="Ctrl+Shift+>"><Button style={{ ...toolBtn, width: 22 }} onClick={growFont}>A^</Button></Tooltip>
            <Tooltip text="Decrease Font Size" shortcut="Ctrl+Shift+<"><Button style={{ ...toolBtn, width: 22 }} onClick={shrinkFont}>Av</Button></Tooltip>
          </div>
          {/* Row 2: Basic formatting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
            <Tooltip text="Bold" shortcut="Ctrl+B"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive('bold')} onClick={() => run(() => editor.chain().toggleBold().run())}><b style={{ fontFamily: 'serif' }}>B</b></Button></Tooltip>
            <Tooltip text="Italic" shortcut="Ctrl+I"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive('italic')} onClick={() => run(() => editor.chain().toggleItalic().run())}><i style={{ fontFamily: 'serif' }}>I</i></Button></Tooltip>
            <Tooltip text="Underline" shortcut="Ctrl+U"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive('underline')} onClick={() => run(() => editor.chain().toggleUnderline().run())}><u>U</u></Button></Tooltip>
            <Tooltip text="Strikethrough"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive('strike')} onClick={() => run(() => editor.chain().toggleStrike().run())}>ab</Button></Tooltip>
            <Tooltip text="Subscript" shortcut="Ctrl+="><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive('subscript')} onClick={() => run(() => editor.chain().toggleSubscript().run())}>x2</Button></Tooltip>
            <Tooltip text="Superscript" shortcut="Ctrl+Shift+="><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive('superscript')} onClick={() => run(() => editor.chain().toggleSuperscript().run())}>x2</Button></Tooltip>
          </div>
          {/* Row 3: Colors & Special formatting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
            <Tooltip text="Change Case"><Button style={{ ...toolBtn, width: 24 }} onClick={changeCase}>Aa</Button></Tooltip>
            <Tooltip text="Clear Formatting" shortcut="Ctrl+Space"><Button style={{ ...toolBtn, width: 24 }} onClick={() => run(() => editor.chain().clearNodes().unsetAllMarks().run())}>A</Button></Tooltip>
            <Divider vertical />
            <Tooltip text="Text Highlight Color">
              <div data-home-color-trigger="true">
                <Button
                  style={{ ...toolBtn, width: 30, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '2px 0' }}
                  onClick={openHighlightPalette}
                  title="Text Highlight Color"
                >
                  <span style={{ fontSize: 10, lineHeight: 1 }}>ab</span>
                  <span style={{ width: 14, height: 2.5, borderRadius: 1, background: activeHighlight, border: '0.5px solid rgba(255,255,255,0.25)' }} />
                </Button>
              </div>
            </Tooltip>
            <Divider vertical />
            <Tooltip text="Text Color">
              <div data-home-color-trigger="true">
                <Button
                  style={{ ...toolBtn, width: 28, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '2px 0' }}
                  onClick={openTextPalette}
                  title="Text Color"
                >
                  <span style={{ fontSize: 11, lineHeight: 1 }}>A</span>
                  <span style={{ width: 14, height: 2.5, borderRadius: 1, background: activeTextColor, border: '0.5px solid rgba(255,255,255,0.25)' }} />
                </Button>
              </div>
            </Tooltip>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Paragraph">
        <div data-stacked="true" style={{ display: 'flex', flexDirection: 'column', gap: 2, height: 78, justifyContent: 'space-between' }}>
          {/* Row 1: Alignment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
            <Tooltip text="Align Left" shortcut="Ctrl+L"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive({ textAlign: 'left' })} onClick={() => run(() => editor.chain().setTextAlign('left').run())}><AlignLeft size={14} strokeWidth={1.75} /></Button></Tooltip>
            <Tooltip text="Center" shortcut="Ctrl+E"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive({ textAlign: 'center' })} onClick={() => run(() => editor.chain().setTextAlign('center').run())}><AlignCenter size={14} strokeWidth={1.75} /></Button></Tooltip>
            <Tooltip text="Align Right" shortcut="Ctrl+R"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive({ textAlign: 'right' })} onClick={() => run(() => editor.chain().setTextAlign('right').run())}><AlignRight size={14} strokeWidth={1.75} /></Button></Tooltip>
            <Tooltip text="Justify" shortcut="Ctrl+J"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive({ textAlign: 'justify' })} onClick={() => run(() => editor.chain().setTextAlign('justify').run())}><AlignJustify size={14} strokeWidth={1.75} /></Button></Tooltip>
            <Tooltip text="Show Formatting Marks" shortcut="Ctrl+Shift+8"><Button style={{ ...toolBtn, width: 24 }} active={showFormattingMarks} onClick={toggleFormattingMarks}><Pilcrow size={14} strokeWidth={1.75} /></Button></Tooltip>
          </div>
          {/* Row 2: Lists */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
            <Tooltip text="Bullet List" shortcut="Ctrl+Shift+L"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive('bulletList')} onClick={() => run(() => editor.chain().toggleBulletList().run())}><List size={14} strokeWidth={1.75} /></Button></Tooltip>
            <Tooltip text="Ordered List"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive('orderedList')} onClick={() => run(() => editor.chain().toggleOrderedList().run())}><ListOrdered size={14} strokeWidth={1.75} /></Button></Tooltip>
            <Tooltip text="Multilevel Numbering">
              <div data-multilevel-trigger="true" style={{ display: 'inline-block' }}>
                <Button
                  style={{ ...toolBtn, width: 28, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}
                  active={Boolean(editor.isActive('orderedList') && editor.getAttributes('orderedList')?.class?.startsWith('multilevel'))}
                  onClick={openMultilevelPicker}
                >
                  <span>1.a</span>
                  <span style={{ fontSize: 7 }}>▼</span>
                </Button>
              </div>
            </Tooltip>
            <Tooltip text="Task List"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive('taskList')} onClick={() => run(() => editor.chain().toggleTaskList().run())}><ListTodo size={14} strokeWidth={1.75} /></Button></Tooltip>
            <Tooltip text="Blockquote" shortcut="Ctrl+Shift+B"><Button style={{ ...toolBtn, width: 24 }} active={editor.isActive('blockquote')} onClick={() => run(() => editor.chain().toggleBlockquote().run())}><Quote size={14} strokeWidth={1.75} /></Button></Tooltip>
          </div>
          {/* Row 3: Indents & Spacing */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
            <Tooltip text="Decrease Indent"><Button style={{ ...toolBtn, width: 24 }} onClick={outdent}><Outdent size={14} strokeWidth={1.75} /></Button></Tooltip>
            <Tooltip text="Increase Indent"><Button style={{ ...toolBtn, width: 24 }} onClick={indent}><Indent size={14} strokeWidth={1.75} /></Button></Tooltip>
            <Tooltip text="Line Spacing"><Button style={{ ...toolBtn, width: 24 }} onClick={cycleLineSpacing}><MoveVertical size={14} strokeWidth={1.75} /></Button></Tooltip>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Styles">
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* Scroll Left Button */}
          <Button
            style={{ ...toolBtn, width: 16, height: 62, padding: 0, fontSize: 10, borderRadius: 2 }}
            onClick={() => scrollStyles('left')}
            title="Scroll styles left"
          >
            ◀
          </Button>

          {/* Horizontally Scrollable Styles Strip — spreads out on desktop */}
          <div
            ref={stylesStripRef}
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              maxWidth: 'min(880px, 48vw)',
              minWidth: 172,
              flex: '1 1 auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              padding: '1px 0',
            }}
          >
            {QUICK_STYLES.map((s) => {
              const isActive = activeStyle() === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => applyStyle(s.id)}
                  title={`${s.label}: ${s.desc}`}
                  style={{
                    minWidth: 78,
                    width: 78,
                    height: 62,
                    border: `1px solid ${isActive ? 'var(--border-gold)' : 'var(--border)'}`,
                    borderRadius: 2,
                    background: isActive ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                    cursor: 'pointer',
                    padding: '3px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    fontFamily: 'var(--font-ui)',
                    boxShadow: isActive ? '0 0 6px rgba(212,175,55,0.35)' : 'none',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 72,
                      fontFamily: s.id.startsWith('heading') ? 'Cinzel, serif' : s.preview.fontFamily || 'var(--font-ui)',
                      ...s.preview,
                    }}
                  >
                    {s.label}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>
                    {s.id.startsWith('heading') ? 'Heading' : s.id === 'normal' ? 'Normal' : 'Style'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <Button
            style={{ ...toolBtn, width: 16, height: 62, padding: 0, fontSize: 10, borderRadius: 2 }}
            onClick={() => scrollStyles('right')}
            title="Scroll styles right"
          >
            ▶
          </Button>

          {/* More Styles Dropdown Button */}
          <div data-styles-trigger="true" style={{ display: 'flex', flexDirection: 'column', height: 62 }}>
            <Tooltip text="More Styles Gallery">
              <button
                onClick={openStylesDropdown}
                style={{
                  width: 20,
                  height: 62,
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  background: 'var(--bg-elevated)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: 9,
                }}
              >
                ▼
              </button>
            </Tooltip>
          </div>

          {/* Style Inspector Button */}
          <Tooltip text="Style Inspector & Styles Pane">
            <button
              onClick={() => openDialog('styleInspector')}
              style={{
                width: 60,
                height: 62,
                border: '1px solid var(--border)',
                borderRadius: 2,
                background: 'var(--bg-elevated)',
                cursor: 'pointer',
                padding: '4px 2px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                fontFamily: 'var(--font-ui)',
                color: 'var(--text-secondary)',
                gap: 2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--gold)';
                e.currentTarget.style.color = 'var(--gold)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <Search size={16} strokeWidth={1.75} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>Inspector</span>
            </button>
          </Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Editing">
        <div data-stacked="true" style={{ display: 'flex', flexDirection: 'column', gap: 2, height: 78, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 2, height: 24 }}>
            <Tooltip text="Undo" shortcut="Ctrl+Z"><Button style={{ ...toolBtn, width: 34 }} disabled={!editor.can().undo()} onClick={() => run(() => editor.chain().undo().run())}><Undo2 size={14} strokeWidth={1.75} /></Button></Tooltip>
            <Tooltip text="Redo" shortcut="Ctrl+Y"><Button style={{ ...toolBtn, width: 34 }} disabled={!editor.can().redo()} onClick={() => run(() => editor.chain().redo().run())}><Redo2 size={14} strokeWidth={1.75} /></Button></Tooltip>
          </div>
          <Tooltip text="Find & Replace" shortcut="Ctrl+H"><Button style={{ ...toolBtn, width: 70, height: 24, fontSize: 11, justifyContent: 'flex-start', padding: '0 6px', gap: 4 }} onClick={() => openDialog('findReplace')}><Search size={13} strokeWidth={1.75} /> Find</Button></Tooltip>
          <Tooltip text="Select All" shortcut="Ctrl+A"><Button style={{ ...toolBtn, width: 70, height: 24, fontSize: 11, justifyContent: 'flex-start', padding: '0 6px', gap: 4 }} onClick={() => run(() => editor.chain().selectAll().run())}><MousePointerClick size={13} strokeWidth={1.75} /> Select</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Pragna">
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Tooltip text="Open Pragna Writing Copilot (Alt+I)">
            <button
              onClick={handlePragnaClick}
              style={{
                width: 58,
                height: 78,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: '4px 6px',
                background: 'rgba(212,175,55,0.08)',
                border: '1px solid rgba(212,175,55,0.3)',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(212,175,55,0.18)';
                e.currentTarget.style.borderColor = 'var(--gold)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(212,175,55,0.08)';
                e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="pragnaGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fae084" />
                    <stop offset="50%" stopColor="#d4af37" />
                    <stop offset="100%" stopColor="#aa8420" />
                  </linearGradient>
                </defs>
                <path d="M12 2L14.6 8.4L21 11L14.6 13.6L12 20L9.4 13.6L3 11L9.4 8.4L12 2Z" fill="url(#pragnaGoldGrad)" />
                <path d="M19 14L20.2 16.8L23 18L20.2 19.2L19 22L17.8 19.2L15 18L17.8 16.8L19 14Z" fill="url(#pragnaGoldGrad)" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.2px', lineHeight: 1 }}>Pragna</span>
            </button>
          </Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Tools">
        <Tooltip text="Get Help">
          <Button
            style={{
              width: 52,
              height: 78,
              flexDirection: 'column',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              fontSize: 11,
              gap: 2,
            }}
            onClick={() => openDialog('help')}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
            <span>Help</span>
          </Button>
        </Tooltip>
      </RibbonGroup>

      {createPortal(
        <>
          {showHighlightColors && (
            <div
              data-home-color-palette="true"
              style={{
                position: 'fixed',
                top: highlightPalettePos.top,
                left: highlightPalettePos.left,
                zIndex: 2000,
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                borderRadius: 4,
                padding: 6,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 4,
                minWidth: 70,
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  title={`Highlight: ${c}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const chain = editor.chain().focus();
                    if (editor.state.selection.empty && savedSelectionRef.current) {
                      const { from, to } = savedSelectionRef.current;
                      const maxPos = editor.state.doc.content.size;
                      if (from <= maxPos && to <= maxPos) {
                        chain.setTextSelection({ from, to });
                      }
                    }
                    chain.toggleHighlight({ color: c }).run();
                    setShowHighlightColors(false);
                  }}
                  style={{ width: 14, height: 14, background: c, border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', padding: 0 }}
                />
              ))}
            </div>
          )}

          {showTextColors && (
            <div
              data-home-color-palette="true"
              style={{
                position: 'fixed',
                top: textPalettePos.top,
                left: textPalettePos.left,
                zIndex: 2000,
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                borderRadius: 4,
                padding: 6,
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 4,
                minWidth: 92,
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {TEXT_COLORS.map((c) => (
                <ColorSwatch
                  key={c}
                  color={c}
                  size={12}
                  onSelect={(v) => {
                    const chain = editor.chain().focus();
                    if (editor.state.selection.empty && savedSelectionRef.current) {
                      const { from, to } = savedSelectionRef.current;
                      const maxPos = editor.state.doc.content.size;
                      if (from <= maxPos && to <= maxPos) {
                        chain.setTextSelection({ from, to });
                      }
                    }
                    chain.setColor(v).run();
                    setShowTextColors(false);
                  }}
                />
              ))}
            </div>
          )}

          {showMultilevelPicker && (
            <div
              data-multilevel-palette="true"
              style={{
                position: 'fixed',
                top: multilevelPickerPos.top,
                left: multilevelPickerPos.left,
                zIndex: 2000,
                border: '1px solid var(--border-gold)',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                padding: 8,
                width: 240,
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                Multilevel List Library
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {MULTILEVEL_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => applyMultilevelList(f)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-ui)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--gold)';
                      e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--bg-app)';
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', minWidth: 26 }}>
                      {f.icon}
                    </span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{f.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showStylesDropdown && (
            <div
              data-styles-palette="true"
              style={{
                position: 'fixed',
                top: stylesDropdownPos.top,
                left: stylesDropdownPos.left,
                zIndex: 2000,
                border: '1px solid var(--border-gold)',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                padding: 10,
                width: 360,
                maxHeight: 380,
                overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>Quick Styles Gallery</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>14 Styles</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {QUICK_STYLES.map((s) => {
                  const isActive = activeStyle() === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        applyStyle(s.id);
                        setShowStylesDropdown(false);
                      }}
                      style={{
                        padding: '6px 8px',
                        border: `1px solid ${isActive ? 'var(--border-gold)' : 'var(--border)'}`,
                        borderRadius: 3,
                        background: isActive ? 'var(--bg-hover)' : 'var(--bg-app)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-ui)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--gold)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isActive ? 'var(--border-gold)' : 'var(--border)';
                      }}
                    >
                      <div style={{ ...s.preview, marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
