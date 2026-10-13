import { useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid, RotateCw, Maximize2, Columns2, WrapText, Layers,
  BringToFront, SendToBack, ZoomIn, ZoomOut, Trash2,
  Hash, Minus, Scissors, Check
} from 'lucide-react';
import { useDocumentStore, useEditorStore, useUIStore } from '@/store';
import { PAGE_SIZES, MARGIN_MAP, getLayoutMetrics } from '@/utils/pageLayout';
import { RibbonGroup } from '../RibbonGroup';
import { groupSelectedImages, ungroupSelectedImage } from '@/utils/imageGroup';

const INDENT_CM = [0, 0.5, 1, 1.5, 2, 2.5, 3];
const SPACING_PT = [0, 3, 6, 8, 10, 12, 18, 24, 30];

const BREAK_OPTIONS = [
  { value: '', label: 'Breaks' },
  { value: 'page', label: 'Page Break' },
  { value: 'section-next', label: 'Section Break (Next Page)' },
  { value: 'section-continuous', label: 'Section Break (Continuous)' },
];

const parseCssStyle = (style = '') => {
  const out = {};
  style.split(';').forEach((pair) => {
    const [k, v] = pair.split(':').map((s) => s?.trim());
    if (k && v) out[k] = v;
  });
  return out;
};

const toCssStyle = (obj) => Object.entries(obj)
  .filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([k, v]) => `${k}:${v}`)
  .join(';');

const pxToCm = (px = 0) => Number((px / 37.795).toFixed(1));
const cmToPx = (cm = 0) => Math.round(cm * 37.795);

function selectedImageElement() {
  return document.querySelector('.ProseMirror img.ProseMirror-selectednode') || document.querySelector('.ProseMirror .ProseMirror-selectednode img');
}

function Group({ title, children }) {
  return (
    <RibbonGroup label={title}>
      {children}
    </RibbonGroup>
  );
}

function IconTextButton({ icon, text, onClick, active, disabled }) {
  return (
    <button
      disabled={disabled}
      onMouseDown={(e) => {
        if (!disabled) e.preventDefault();
      }}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 24,
        padding: '0 7px',
        fontSize: 11,
        fontFamily: 'var(--font-ui)',
        border: active ? '1px solid var(--border-gold)' : '1px solid transparent',
        borderRadius: 2,
        background: active ? 'var(--bg-hover)' : 'transparent',
        color: active ? 'var(--text-gold)' : 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
        transition: 'background 0.1s, border-color 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 11 }}>{text}</span>
    </button>
  );
}

function TinyAction({ text, onClick, disabled }) {
  return (
    <button
      onMouseDown={(e) => {
        if (!disabled) e.preventDefault();
      }}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 6px',
        fontSize: 11,
        fontFamily: 'var(--font-ui)',
        border: '1px solid var(--border)',
        borderRadius: 2,
        background: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.borderColor = 'var(--border-gold)';
          e.currentTarget.style.color = 'var(--gold)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {text}
    </button>
  );
}

function OptionPicker({ label, value, options, onChange, width = 84, icon }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      height: 24,
      fontSize: 11,
      fontFamily: 'var(--font-ui)',
      whiteSpace: 'nowrap',
    }}>
      {icon && <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>}
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 42 }}>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 22,
          padding: '0 4px',
          fontSize: 11,
          fontFamily: 'var(--font-ui)',
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 2,
          width,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {options.map((opt) => (
          <option key={`${label}-${opt.value || 'blank'}`} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function PageSetupControl({ icon, label, value, options, onChange, width = 94 }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 5,
        padding: '5px 8px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        height: 74,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10.5,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1, color: 'var(--gold, #c9a84c)' }}>{icon}</span>
        <span>{label}</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 25,
          width,
          padding: '0 6px',
          fontSize: 11,
          fontFamily: 'var(--font-ui)',
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {options.map((opt) => (
          <option key={`${label}-${opt.value || 'blank'}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const metricSelectStyle = {
  height: 22,
  width: 74,
  padding: '0 4px',
  fontSize: 11,
  fontFamily: 'var(--font-ui)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  cursor: 'pointer',
  outline: 'none',
};

export function LayoutTab({ renderRibbon } = {}) {
  const { editor } = useEditorStore();
  const pageCount = useDocumentStore((s) => s.pageCount);
  const layout = useDocumentStore((s) => s.layout);
  const setLayout = useDocumentStore((s) => s.setLayout);
  const {
    pageMargin,
    pageSize,
    pageOrientation,
    pageColumns,
    sidebarOpen,
    toggleSidebar,
    toast,
    openDialog,
  } = useUIStore();

  const [lineNumbersOn, setLineNumbersOn] = useState(Boolean(layout?.lineNumbers));
  const [hyphenationOn, setHyphenationOn] = useState(Boolean(layout?.hyphenation));
  const [indentLeftCm, setIndentLeftCm] = useState(0);
  const [indentRightCm, setIndentRightCm] = useState(0);
  const [spacingBeforePt, setSpacingBeforePt] = useState(0);
  const [spacingAfterPt, setSpacingAfterPt] = useState(8);
  const [breakAction, setBreakAction] = useState('');
  const [menu, setMenu] = useState(null);

  const activeMargin = layout?.pageMargin || pageMargin || 'normal';
  const activeOrientation = layout?.pageOrientation || pageOrientation || 'portrait';
  const activeSize = layout?.pageSize || pageSize || 'a4';
  const activeColumns = layout?.pageColumns !== undefined ? layout.pageColumns : (pageColumns || 1);

  const sizeLabel = useMemo(() => (PAGE_SIZES[activeSize] || PAGE_SIZES.a4).label, [activeSize]);

  useEffect(() => {
    setLineNumbersOn(Boolean(layout?.lineNumbers));
    setHyphenationOn(Boolean(layout?.hyphenation));
  }, [layout?.lineNumbers, layout?.hyphenation]);

  const applyParagraphLayout = (patch = {}) => {
    if (!editor) return toast('Editor is not ready yet', 'info');

    // Try to get attributes from current block selection (paragraph, heading or blockquote)
    const attrs = editor.getAttributes('paragraph')?.style ? editor.getAttributes('paragraph') : 
                  editor.getAttributes('heading')?.style ? editor.getAttributes('heading') : 
                  editor.getAttributes('blockquote');
    const base = attrs?.style || '';
    const css = parseCssStyle(base);

    const nextLeft = Number.isFinite(Number(patch.indentLeftCm)) ? Number(patch.indentLeftCm) : indentLeftCm;
    const nextRight = Number.isFinite(Number(patch.indentRightCm)) ? Number(patch.indentRightCm) : indentRightCm;
    const nextBefore = Number.isFinite(Number(patch.spacingBeforePt)) ? Number(patch.spacingBeforePt) : spacingBeforePt;
    const nextAfter = Number.isFinite(Number(patch.spacingAfterPt)) ? Number(patch.spacingAfterPt) : spacingAfterPt;

    css['margin-left'] = `${cmToPx(nextLeft)}px`;
    css['margin-right'] = `${cmToPx(nextRight)}px`;
    css['margin-top'] = `${Math.round(nextBefore * 1.333)}px`;
    css['margin-bottom'] = `${Math.round(nextAfter * 1.333)}px`;

    const style = toCssStyle(css);
    editor.chain().focus()
      .updateAttributes('paragraph', { style })
      .updateAttributes('heading', { style })
      .updateAttributes('blockquote', { style })
      .run();
  };

  const withSelectedImage = (action) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    if (!editor.isActive('image')) {
      toast('Select an image first', 'info');
      return;
    }
    const attrs = editor.getAttributes('image') || {};
    const css = parseCssStyle(attrs.style || '');
    action(attrs, css);
  };

  const updateImageAttrs = (attrsPatch = {}, cssPatch = {}) => {
    const attrs = editor.getAttributes('image') || {};
    const css = parseCssStyle(attrs.style || '');
    Object.entries(cssPatch).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') delete css[k];
      else css[k] = v;
    });
    editor.chain().focus().updateAttributes('image', {
      ...attrsPatch,
      style: toCssStyle(css),
    }).run();
  };

  useEffect(() => {
    if (!editor) return;
    const syncFromSelection = () => {
      // Check for style attributes in any of the block types
      const attrs = editor.getAttributes('paragraph')?.style ? editor.getAttributes('paragraph') : 
                    editor.getAttributes('heading')?.style ? editor.getAttributes('heading') : 
                    editor.getAttributes('blockquote');
      const style = attrs?.style || '';
      const css = parseCssStyle(style);
      const leftPx = parseInt((css['margin-left'] || '0').replace('px', ''), 10) || 0;
      const rightPx = parseInt((css['margin-right'] || '0').replace('px', ''), 10) || 0;
      const beforePx = parseInt((css['margin-top'] || '0').replace('px', ''), 10) || 0;
      const afterPx = parseFloat((css['margin-bottom'] || '10.6667').replace('px', '')) || 0;
      setIndentLeftCm(pxToCm(leftPx));
      setIndentRightCm(pxToCm(rightPx));
      setSpacingBeforePt(Math.round(beforePx * 0.75));
      setSpacingAfterPt(Math.round(afterPx * 0.75));
    };

    syncFromSelection();
    editor.on('selectionUpdate', syncFromSelection);
    return () => editor.off('selectionUpdate', syncFromSelection);
  }, [editor]);

  const insertBreak = () => {
    if (!editor) return toast('Editor is not ready yet', 'info');
    editor.chain().focus().insertPageBreak().run();
    toast('Page break inserted', 'success');
  };

  const insertSelectedBreak = (value) => {
    setBreakAction(value);
    if (!value) return;

    if (!editor) {
      toast('Editor is not ready yet', 'info');
      setBreakAction('');
      return;
    }

    if (value === 'page') {
      insertBreak();
      setBreakAction('');
      return;
    }

    editor.chain().focus().insertPageBreak().run();
    toast('Section break is limited in this editor. Inserted page break instead.', 'info');
    setBreakAction('');
  };

  const toggleLineNumbers = () => {
    const next = !lineNumbersOn;
    setLineNumbersOn(next);
    setLayout({ lineNumbers: next });
    toast(next ? 'Line numbers on' : 'Line numbers off', 'info');
  };

  const toggleHyphenation = () => {
    const next = !hyphenationOn;
    setHyphenationOn(next);
    setLayout({ hyphenation: next });
    toast(next ? 'Hyphenation on' : 'Hyphenation off', 'info');
  };

  const alignImage = (where) => {
    withSelectedImage(() => {
      if (where === 'left') {
        updateImageAttrs({}, { display: 'block', float: null, margin: '12px auto 12px 0' });
      } else if (where === 'center') {
        updateImageAttrs({}, { display: 'block', float: null, margin: '12px auto' });
      } else {
        updateImageAttrs({}, { display: 'block', float: null, margin: '12px 0 12px auto' });
      }
      toast(`Aligned ${where}`, 'success');
    });
  };

  const rotateImage = () => {
    withSelectedImage((attrs, css) => {
      const current = parseInt(String(attrs.rotate || css.transform?.match(/rotate\(([-\d]+)deg\)/)?.[1] || '0'), 10) || 0;
      const next = (current + 15) % 360;
      updateImageAttrs({ rotate: String(next) }, { transform: `rotate(${next}deg)` });
      toast('Rotated 15 degrees', 'success');
    });
  };

  const layerImage = (direction) => {
    withSelectedImage((attrs, css) => {
      const current = parseInt(String(css['z-index'] || attrs.zIndex || '1'), 10) || 1;
      const forward = direction === 'up' || direction === 'forward';
      const next = forward ? current + 1 : Math.max(0, current - 1);
      updateImageAttrs({ zIndex: String(next) }, { position: 'relative', 'z-index': String(next) });
      toast(forward ? 'Brought forward' : 'Sent backward', 'success');
    });
  };

  const wrapText = () => {
    withSelectedImage((attrs, css) => {
      const mode = attrs['data-wrap'] || (css.float === 'left' ? 'left' : css.float === 'right' ? 'right' : 'inline');
      const next = mode === 'inline' ? 'left' : mode === 'left' ? 'right' : 'inline';
      if (next === 'inline') {
        updateImageAttrs({ 'data-wrap': next }, { float: null, display: 'block', margin: '12px auto' });
      } else if (next === 'left') {
        updateImageAttrs({ 'data-wrap': next }, { float: 'left', display: null, margin: '8px 16px 8px 0' });
      } else {
        updateImageAttrs({ 'data-wrap': next }, { float: 'right', display: null, margin: '8px 0 8px 16px' });
      }
      toast(`Wrap text: ${next}`, 'success');
    });
  };

  const resizeSelectedImage = (direction) => {
    withSelectedImage((attrs) => {
      const selected = selectedImageElement();
      const domWidth = selected?.getBoundingClientRect?.().width || 0;
      const baseWidth = parseInt(String(attrs.width || ''), 10) || Math.round(domWidth) || 240;
      const nextWidth = Math.max(40, Math.min(1400, baseWidth + (direction === 'up' ? 30 : -30)));
      editor.chain().focus().updateAttributes('image', { width: String(nextWidth) }).run();
      toast(`Image width: ${nextWidth}px`, 'success');
    });
  };

  const removeSelectedImage = () => {
    withSelectedImage(() => {
      editor.chain().focus().deleteSelection().run();
      toast('Image removed', 'success');
    });
  };

  // Word's Orientation, Breaks, Line Numbers and Hyphenation buttons open menus.
  const openMenu = (event, items) => setMenu({ rect: event.currentTarget.getBoundingClientRect(), items });
  const menus = {
    Orientation: (event) => openMenu(event, [
      { label: 'Portrait', checked: activeOrientation === 'portrait', run: () => setLayout({ pageOrientation: 'portrait' }) },
      { label: 'Landscape', checked: activeOrientation === 'landscape', run: () => setLayout({ pageOrientation: 'landscape' }) },
    ]),
    Breaks: (event) => openMenu(event, [
      { label: 'Page', hint: 'Ctrl+Enter', run: insertBreak },
      { label: 'Text Wrapping', hint: 'Shift+Enter', run: () => editor?.chain().focus().setHardBreak().run() },
    ]),
    'Line Numbers': (event) => openMenu(event, [
      { label: 'None', checked: !lineNumbersOn, run: () => lineNumbersOn && toggleLineNumbers() },
      { label: 'Continuous', checked: lineNumbersOn, run: () => !lineNumbersOn && toggleLineNumbers() },
    ]),
    // Picture position and alignment keep the picture's size (styles are merged).
    Position: (event) => openMenu(event, [
      { label: 'In Line with Text', run: () => withSelectedImage(() => { updateImageAttrs({}, { display: null, float: null, margin: null }); toast('In line with text', 'success'); }) },
      { label: 'Left, Text Wraps Right', run: () => withSelectedImage(() => { updateImageAttrs({}, { display: null, float: 'left', margin: '8px 16px 8px 0' }); toast('Positioned left', 'success'); }) },
      { label: 'Center', run: () => alignImage('center') },
      { label: 'Right, Text Wraps Left', run: () => withSelectedImage(() => { updateImageAttrs({}, { display: null, float: 'right', margin: '8px 0 8px 16px' }); toast('Positioned right', 'success'); }) },
    ]),
    Align: (event) => openMenu(event, [
      { label: 'Align Left', run: () => alignImage('left') },
      { label: 'Align Center', run: () => alignImage('center') },
      { label: 'Align Right', run: () => alignImage('right') },
    ]),
    Group: (event) => openMenu(event, [
      { label: 'Group', run: async () => {
        if (!editor) return;
        try {
          const res = await groupSelectedImages(editor);
          toast(res.error || `Grouped ${res.count} pictures`, res.error ? 'info' : 'success');
        } catch (err) { toast(`Could not group these pictures: ${err.message}`, 'error'); }
      } },
      { label: 'Ungroup', run: () => {
        if (!editor) return;
        const res = ungroupSelectedImage(editor);
        toast(res.error || `Ungrouped ${res.count} pictures`, res.error ? 'info' : 'success');
      } },
    ]),
    Hyphenation: (event) => openMenu(event, [
      { label: 'None', checked: !hyphenationOn, run: () => hyphenationOn && toggleHyphenation() },
      { label: 'Automatic', checked: hyphenationOn, run: () => !hyphenationOn && toggleHyphenation() },
    ]),
  };

  if (renderRibbon) return <>{renderRibbon({
    ...menus,
    'Bring Forward': () => layerImage('forward'), 'Send Backward': () => layerImage('backward'),
    'Wrap Text': wrapText, Rotate: rotateImage,
  }, {
    Left: { value: indentLeftCm, change: (value) => { setIndentLeftCm(value); applyParagraphLayout({ indentLeftCm: value }); } },
    Right: { value: indentRightCm, change: (value) => { setIndentRightCm(value); applyParagraphLayout({ indentRightCm: value }); } },
    Before: { value: spacingBeforePt, change: (value) => { setSpacingBeforePt(value); applyParagraphLayout({ spacingBeforePt: value }); } },
    After: { value: spacingAfterPt, change: (value) => { setSpacingAfterPt(value); applyParagraphLayout({ spacingAfterPt: value }); } },
  })}{menu && <RibbonMenu {...menu} onClose={() => setMenu(null)} />}</>;
  return (
    <>
      <Group title="Page Setup">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <PageSetupControl
            icon={<LayoutGrid size={13} strokeWidth={1.75} />}
            label="Margins"
            value={activeMargin}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'narrow', label: 'Narrow' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'wide', label: 'Wide' },
            ]}
            onChange={(next) => {
              setLayout({ pageMargin: next });
              toast(`Margins: ${next}`, 'success');
            }}
            width={94}
          />
          <PageSetupControl
            icon={<RotateCw size={13} strokeWidth={1.75} />}
            label="Orientation"
            value={activeOrientation}
            options={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
            onChange={(next) => {
              setLayout({ pageOrientation: next });
              toast(`Orientation: ${next}`, 'success');
            }}
            width={94}
          />
          <PageSetupControl
            icon={<Maximize2 size={13} strokeWidth={1.75} />}
            label="Size"
            value={activeSize}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
              { value: 'legal', label: 'Legal' },
              { value: 'a3', label: 'A3' },
            ]}
            onChange={(next) => {
              setLayout({ pageSize: next });
              toast(`Size: ${(PAGE_SIZES[next] || PAGE_SIZES.a4).label}`, 'success');
            }}
            width={88}
          />
          <PageSetupControl
            icon={<Columns2 size={13} strokeWidth={1.75} />}
            label="Columns"
            value={String(activeColumns)}
            options={[
              { value: '1', label: 'One' },
              { value: '2', label: 'Two' },
              { value: '3', label: 'Three' },
            ]}
            onChange={(next) => {
              const c = Number(next);
              setLayout({ pageColumns: c });
              toast(`Columns: ${c}`, 'success');
            }}
            width={80}
          />

          {/* Stacked Breaks, Line Numbers, Hyphenation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--gold, #c9a84c)', display: 'inline-flex', alignItems: 'center' }}><Scissors size={13} strokeWidth={1.75} /></span>
              <select
                value={breakAction}
                onChange={(e) => insertSelectedBreak(e.target.value)}
                style={{
                  height: 22,
                  width: 96,
                  padding: '0 4px',
                  fontSize: 11,
                  fontFamily: 'var(--font-ui)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {BREAK_OPTIONS.map((opt) => (
                  <option key={`break-${opt.value || 'empty'}`} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={toggleLineNumbers}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 22,
                padding: '0 6px',
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                border: lineNumbersOn ? '1px solid var(--border-gold)' : '1px solid var(--border)',
                background: lineNumbersOn ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                color: lineNumbersOn ? 'var(--gold)' : 'var(--text-secondary)',
                borderRadius: 3,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Hash size={12} strokeWidth={1.75} />
              <span>Line Numbers</span>
              {lineNumbersOn ? <Check size={11} strokeWidth={2} /> : <span style={{ fontSize: 9 }}>▾</span>}
            </button>
            <button
              onClick={toggleHyphenation}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 22,
                padding: '0 6px',
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                border: hyphenationOn ? '1px solid var(--border-gold)' : '1px solid var(--border)',
                background: hyphenationOn ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                color: hyphenationOn ? 'var(--gold)' : 'var(--text-secondary)',
                borderRadius: 3,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Minus size={12} strokeWidth={1.75} />
              <span>Hyphenation</span>
              {hyphenationOn ? <Check size={11} strokeWidth={2} /> : <span style={{ fontSize: 9 }}>▾</span>}
            </button>
          </div>
        </div>
      </Group>

      <Group title="Paragraph">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 74 }}>
          {/* Indent Box */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 5,
              padding: '5px 10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              height: 74,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1, color: 'var(--gold, #c9a84c)' }}>⇤</span>
              <span>Indent</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)', width: 38 }}>Left:</span>
              <select
                value={String(indentLeftCm)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setIndentLeftCm(n);
                  applyParagraphLayout({ indentLeftCm: n });
                }}
                style={metricSelectStyle}
              >
                {INDENT_CM.map((v) => <option key={`left-${v}`} value={String(v)}>{v} cm</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)', width: 38 }}>Right:</span>
              <select
                value={String(indentRightCm)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setIndentRightCm(n);
                  applyParagraphLayout({ indentRightCm: n });
                }}
                style={metricSelectStyle}
              >
                {INDENT_CM.map((v) => <option key={`right-${v}`} value={String(v)}>{v} cm</option>)}
              </select>
            </div>
          </div>

          {/* Spacing Box */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 5,
              padding: '5px 10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              height: 74,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1, color: 'var(--gold, #c9a84c)' }}>⇕</span>
              <span>Spacing</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)', width: 44 }}>Before:</span>
              <select
                value={String(spacingBeforePt)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSpacingBeforePt(n);
                  applyParagraphLayout({ spacingBeforePt: n });
                }}
                style={metricSelectStyle}
              >
                {SPACING_PT.map((v) => <option key={`before-${v}`} value={String(v)}>{v} pt</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)', width: 44 }}>After:</span>
              <select
                value={String(spacingAfterPt)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSpacingAfterPt(n);
                  applyParagraphLayout({ spacingAfterPt: n });
                }}
                style={metricSelectStyle}
              >
                {SPACING_PT.map((v) => <option key={`after-${v}`} value={String(v)}>{v} pt</option>)}
              </select>
            </div>
          </div>
        </div>
      </Group>

      <Group title="Arrange">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 74 }}>
          {/* Col 1: Placement */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <IconTextButton icon={<LayoutGrid size={13} strokeWidth={1.75} />} text="Position" onClick={() => alignImage('center')} />
            <IconTextButton icon={<WrapText size={13} strokeWidth={1.75} />} text="Wrap Text" onClick={wrapText} />
            <IconTextButton icon={<Layers size={13} strokeWidth={1.75} />} text="Selection Pane" onClick={toggleSidebar} active={sidebarOpen} />
          </div>

          {/* Col 2: Layering & Align */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <IconTextButton icon={<BringToFront size={13} strokeWidth={1.75} />} text="Bring Forward" onClick={() => layerImage('up')} />
            <IconTextButton icon={<SendToBack size={13} strokeWidth={1.75} />} text="Send Backward" onClick={() => layerImage('down')} />
            <TinyAction text="Align Left ▾" onClick={() => alignImage('left')} />
          </div>

          {/* Col 3: Transform & Remove */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <TinyAction text="Rotate 15° ▾" onClick={rotateImage} />
            <div style={{ display: 'flex', gap: 3 }}>
              <IconTextButton icon={<ZoomIn size={13} strokeWidth={1.75} />} text="Size +" onClick={() => resizeSelectedImage('up')} />
              <IconTextButton icon={<ZoomOut size={13} strokeWidth={1.75} />} text="Size -" onClick={() => resizeSelectedImage('down')} />
            </div>
            <IconTextButton icon={<Trash2 size={13} strokeWidth={1.75} />} text="Remove Image" onClick={removeSelectedImage} />
          </div>
        </div>
      </Group>
    </>
  );
}

const styles = {
  root: {
    display: 'flex',
    alignItems: 'stretch',
    height: '100%',
    minWidth: 1240,
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    borderTop: 'none',
  },
  group: {
    borderRight: '1px solid var(--border)',
    padding: '4px 8px 2px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  groupBody: {
    display: 'flex',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 68,
  },
  groupTitle: {
    textAlign: 'center',
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1,
    paddingBottom: 2,
  },
  iconTextBtn: {
    width: 62,
    height: 56,
    border: '1px solid transparent',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    padding: 0,
  },
  iconTextBtnActive: {
    borderColor: 'var(--border-gold)',
    background: 'var(--bg-hover)',
    color: 'var(--text-gold)',
  },
  iconTextBtnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  icon: {
    fontSize: 22,
    lineHeight: 1,
  },
  label: {
    fontSize: 12,
    lineHeight: 1.1,
    textAlign: 'center',
  },
  tinyAction: {
    height: 22,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    padding: '0 6px',
    textAlign: 'left',
  },
  optionPickerWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 88,
    justifyContent: 'center',
    padding: '2px 0',
  },
  optionPickerLabel: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-ui)',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    lineHeight: 1,
  },
  optionPickerSelect: {
    height: 24,
    border: '1px solid var(--border-gold)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    borderRadius: 4,
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    padding: '0 6px',
  },
  metricCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 160,
  },
  metricLabel: {
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    marginBottom: 2,
  },
  metricRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  metricText: {
    width: 50,
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-ui)',
  },
  metricSelect: {
    width: 86,
    height: 26,
    border: '1px solid var(--border-gold)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    borderRadius: 4,
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
  },
};

// A ribbon dropdown menu anchored under its button; closes on choice, outside
// click or Escape.
function RibbonMenu({ rect, items, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e) => { if (!e.target.closest?.('[data-ribbon-menu]')) onClose(); };
    // Capture phase: the editor and dialogs handle Escape themselves.
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('mousedown', onDown); };
  }, [onClose]);
  return (
    <div data-ribbon-menu role="menu" style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 3000, minWidth: 180, padding: 4, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
      {items.map((item) => (
        <button key={item.label} type="button" role="menuitemradio" aria-checked={Boolean(item.checked)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { item.run(); onClose(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 10px', border: 0, borderRadius: 6, background: 'transparent', color: 'var(--text-primary)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 14, color: 'var(--gold)' }}>{item.checked ? <Check size={12} strokeWidth={2} /> : null}</span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.hint}</span>}
        </button>
      ))}
    </div>
  );
}

