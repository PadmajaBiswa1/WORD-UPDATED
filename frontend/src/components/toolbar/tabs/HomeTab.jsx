import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useEditorStore, useUIStore } from '@/store';
import { Button, Divider, Tooltip, Select, ColorSwatch } from '@/components/ui';
import { RibbonGroup } from '../RibbonGroup';
import { FONT_SIZE_OPTIONS, FontFormattingControls, useFontFormattingControls } from '../fontFormatting.jsx';

const PARA_STYLES = [
  { value: 'p', label: 'Normal' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'title', label: 'Title' },
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
  const { openDialog, toast } = useUIStore();
  const { applyFontSize } = useFontFormattingControls(editor);
  const painterActive = useRef(false);
  const [showTextColors, setShowTextColors] = useState(false);
  const [showHighlightColors, setShowHighlightColors] = useState(false);
  const [showFormattingMarks, setShowFormattingMarks] = useState(false);
  const [textPalettePos, setTextPalettePos] = useState({ top: 0, left: 0 });
  const [highlightPalettePos, setHighlightPalettePos] = useState({ top: 0, left: 0 });

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
  };

  const openHighlightPalette = (event) => {
    snapshotSelection();
    const rect = event.currentTarget?.getBoundingClientRect();
    if (!rect) return;
    const top = Math.max(rect.bottom + 8, getSheetTop() + 8);
    setHighlightPalettePos({ top, left: rect.left });
    setShowHighlightColors((v) => !v);
    setShowTextColors(false);
  };

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (event.target.closest('[data-home-color-trigger="true"]')) return;
      if (event.target.closest('[data-home-color-palette="true"]')) return;
      setShowTextColors(false);
      setShowHighlightColors(false);
    };

    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

  useEffect(() => {
    if (!editor?.view?.dom) return;
    editor.view.dom.classList.toggle('etherx-show-formatting', showFormattingMarks);
    return () => editor.view.dom.classList.remove('etherx-show-formatting');
  }, [editor, showFormattingMarks]);

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

  const toggleFormattingMarks = () => {
    setShowFormattingMarks((v) => !v);
  };

  const activeStyle = () => {
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    return 'p';
  };

  const applyStyle = (val) => {
    if (val === 'p') {
      run(() => editor.chain().setParagraph().run());
    } else if (val === 'title') {
      run(() => editor.chain().setHeading({ level: 1 }).setFontSize('2.4em').run());
    } else {
      run(() => editor.chain().setHeading({ level: parseInt(val[1]) }).run());
    }
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
                width: 52,
                height: 60,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                fontSize: 11,
              }}
            >
              <span style={{ fontSize: 20 }}>📋</span>
              <span>Paste</span>
            </Button>
          </Tooltip>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Tooltip text="Cut" shortcut="Ctrl+X">
              <Button style={{ ...toolBtn, width: 84, justifyContent: 'flex-start', padding: '0 6px' }} onClick={handleCut}>✂ Cut</Button>
            </Tooltip>
            <Tooltip text="Copy" shortcut="Ctrl+C">
              <Button style={{ ...toolBtn, width: 84, justifyContent: 'flex-start', padding: '0 6px' }} onClick={handleCopy}>📄 Copy</Button>
            </Tooltip>
            <Tooltip text="Format Painter">
              <Button
                style={{ ...toolBtn, width: 110, justifyContent: 'flex-start', padding: '0 6px', color: formatPainterMarks ? 'var(--text-gold)' : 'var(--text-primary)' }}
                active={!!formatPainterMarks}
                onClick={handleFormatPainter}
              >
                🖌 Format Painter
              </Button>
            </Tooltip>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Font">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <FontFormattingControls
              editor={editor}
              fontFamily={fontFamily}
              fontSize={fontSize}
              familyWidth={138}
              sizeWidth={52}
            />
            <Tooltip text="Grow Font (Ctrl+])"><Button style={toolBtn} onClick={growFont}>A^</Button></Tooltip>
            <Tooltip text="Shrink Font (Ctrl+[)"><Button style={toolBtn} onClick={shrinkFont}>Av</Button></Tooltip>
            <Tooltip text="Change Case"><Button style={{ ...toolBtn, width: 30 }} onClick={changeCase}>Aa</Button></Tooltip>
            <Tooltip text="Clear Formatting"><Button style={{ ...toolBtn, width: 30 }} onClick={() => run(() => editor.chain().clearNodes().unsetAllMarks().run())}>A</Button></Tooltip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Tooltip text="Bold" shortcut="Ctrl+B"><Button style={toolBtn} active={editor.isActive('bold')} onClick={() => run(() => editor.chain().toggleBold().run())}><b style={{ fontFamily: 'serif' }}>B</b></Button></Tooltip>
            <Tooltip text="Italic" shortcut="Ctrl+I"><Button style={toolBtn} active={editor.isActive('italic')} onClick={() => run(() => editor.chain().toggleItalic().run())}><i style={{ fontFamily: 'serif' }}>I</i></Button></Tooltip>
            <Tooltip text="Underline" shortcut="Ctrl+U"><Button style={toolBtn} active={editor.isActive('underline')} onClick={() => run(() => editor.chain().toggleUnderline().run())}><u>U</u></Button></Tooltip>
            <Tooltip text="Strikethrough"><Button style={toolBtn} active={editor.isActive('strike')} onClick={() => run(() => editor.chain().toggleStrike().run())}>ab</Button></Tooltip>
            <Tooltip text="Subscript"><Button style={toolBtn} active={editor.isActive('subscript')} onClick={() => run(() => editor.chain().toggleSubscript().run())}>x2</Button></Tooltip>
            <Tooltip text="Superscript"><Button style={toolBtn} active={editor.isActive('superscript')} onClick={() => run(() => editor.chain().toggleSuperscript().run())}>x2</Button></Tooltip>
            <Divider vertical />
            <Tooltip text="Highlight Color">
              <div>
                <Button
                  data-home-color-trigger="true"
                  style={{ ...toolBtn, width: 36, fontWeight: 700 }}
                  onClick={openHighlightPalette}
                >
                  ab
                </Button>
              </div>
            </Tooltip>
            <Divider vertical />
            <Tooltip text="Text Color">
              <div>
                <Button
                  data-home-color-trigger="true"
                  style={{ ...toolBtn, width: 34, fontWeight: 700 }}
                  onClick={openTextPalette}
                >
                  A
                </Button>
              </div>
            </Tooltip>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Paragraph">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: 128 }}>
          <Tooltip text="Align Left" shortcut="Ctrl+L"><Button style={toolBtn} active={editor.isActive({ textAlign: 'left' })} onClick={() => run(() => editor.chain().setTextAlign('left').run())}>≡</Button></Tooltip>
          <Tooltip text="Center" shortcut="Ctrl+E"><Button style={toolBtn} active={editor.isActive({ textAlign: 'center' })} onClick={() => run(() => editor.chain().setTextAlign('center').run())}>≣</Button></Tooltip>
          <Tooltip text="Align Right" shortcut="Ctrl+R"><Button style={toolBtn} active={editor.isActive({ textAlign: 'right' })} onClick={() => run(() => editor.chain().setTextAlign('right').run())}>≡</Button></Tooltip>
          <Tooltip text="Justify"><Button style={toolBtn} active={editor.isActive({ textAlign: 'justify' })} onClick={() => run(() => editor.chain().setTextAlign('justify').run())}>☰</Button></Tooltip>
          <Tooltip text="Bullet List"><Button style={toolBtn} active={editor.isActive('bulletList')} onClick={() => run(() => editor.chain().toggleBulletList().run())}>•≡</Button></Tooltip>
          <Tooltip text="Ordered List"><Button style={toolBtn} active={editor.isActive('orderedList')} onClick={() => run(() => editor.chain().toggleOrderedList().run())}>1≡</Button></Tooltip>
          <Tooltip text="Task List"><Button style={toolBtn} active={editor.isActive('taskList')} onClick={() => run(() => editor.chain().toggleTaskList().run())}>☑</Button></Tooltip>
          <Tooltip text="Blockquote" shortcut="Ctrl+Shift+B"><Button style={toolBtn} active={editor.isActive('blockquote')} onClick={() => run(() => editor.chain().toggleBlockquote().run())}>"</Button></Tooltip>
          <Tooltip text="Increase Indent"><Button style={toolBtn} onClick={indent}>→</Button></Tooltip>
          <Tooltip text="Decrease Indent"><Button style={toolBtn} onClick={outdent}>←</Button></Tooltip>
          <Tooltip text="Line Spacing"><Button style={toolBtn} onClick={cycleLineSpacing}>↕</Button></Tooltip>
          <Tooltip text="Show Formatting Marks"><Button style={toolBtn} active={showFormattingMarks} onClick={toggleFormattingMarks}>¶</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Styles">
        <div style={{ display: 'flex', gap: 4 }}>
          {PARA_STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => applyStyle(s.value)}
              style={{
                width: 80,
                height: 62,
                border: `1px solid ${activeStyle() === s.value ? 'var(--border-gold)' : 'var(--border)'}`,
                borderRadius: 2,
                background: activeStyle() === s.value ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                fontFamily: 'var(--font-ui)',
                color: activeStyle() === s.value ? 'var(--text-gold)' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: s.value.startsWith('h') || s.value === 'title' ? 600 : 400,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </RibbonGroup>

      <RibbonGroup label="Editing">
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip text="Undo" shortcut="Ctrl+Z"><Button style={{ ...toolBtn, width: 28 }} disabled={!editor.can().undo()} onClick={() => run(() => editor.chain().undo().run())}>↩</Button></Tooltip>
          <Tooltip text="Redo" shortcut="Ctrl+Y"><Button style={{ ...toolBtn, width: 28 }} disabled={!editor.can().redo()} onClick={() => run(() => editor.chain().redo().run())}>↪</Button></Tooltip>
          <Divider vertical />
          <Tooltip text="Find & Replace" shortcut="Ctrl+H"><Button style={{ ...toolBtn, width: 68 }} onClick={() => openDialog('findReplace')}>Find</Button></Tooltip>
          <Tooltip text="Select All" shortcut="Ctrl+A"><Button style={{ ...toolBtn, width: 68 }} onClick={() => run(() => editor.chain().selectAll().run())}>Select</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Tools">
        <Tooltip text="Get Help">
          <Button
            style={{
              width: 72,
              height: 52,
              flexDirection: 'column',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              fontSize: 11,
            }}
            onClick={() => openDialog('help')}
          >
            <span style={{ fontSize: 18 }}>❓</span>
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
        </>,
        document.body,
      )}
    </>
  );
}
