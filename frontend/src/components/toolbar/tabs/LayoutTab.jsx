import { useEffect, useMemo, useState } from 'react';
import { useDocumentStore, useEditorStore, useUIStore } from '@/store';
import { PAGE_SIZES, MARGIN_MAP, getLayoutMetrics } from '@/utils/pageLayout';

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

function Group({ title, children, width }) {
  return (
    <div style={{ ...styles.group, maxWidth: width, minWidth: 0 }}>
      <div style={styles.groupBody}>{children}</div>
      <div style={styles.groupTitle}>{title}</div>
    </div>
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
        ...styles.iconTextBtn,
        ...(active ? styles.iconTextBtnActive : null),
        ...(disabled ? styles.iconTextBtnDisabled : null),
      }}
    >
      <div style={styles.icon}>{icon}</div>
      <div style={styles.label}>{text}</div>
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
      style={{ ...styles.tinyAction, ...(disabled ? styles.iconTextBtnDisabled : null) }}
    >
      {text}
    </button>
  );
}

function OptionPicker({ label, value, options, onChange, width = 122 }) {
  return (
    <div style={styles.optionPickerWrap}>
      <span style={styles.optionPickerLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...styles.optionPickerSelect, width }}>
        {options.map((opt) => (
          <option key={`${label}-${opt.value || 'blank'}`} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function LayoutTab() {
  const { editor } = useEditorStore();
  const pageCount = useDocumentStore((s) => s.pageCount);
  const {
    pageMargin,
    setPageMargin,
    pageSize,
    setPageSize,
    pageOrientation,
    setPageOrientation,
    pageColumns,
    setPageColumns,
    sidebarOpen,
    toggleSidebar,
    toast,
    openDialog,
  } = useUIStore();

  const [lineNumbersOn, setLineNumbersOn] = useState(false);
  const [hyphenationOn, setHyphenationOn] = useState(false);
  const [indentLeftCm, setIndentLeftCm] = useState(0);
  const [indentRightCm, setIndentRightCm] = useState(0);
  const [spacingBeforePt, setSpacingBeforePt] = useState(0);
  const [spacingAfterPt, setSpacingAfterPt] = useState(8);
  const [breakAction, setBreakAction] = useState('');

  const sizeLabel = useMemo(() => (PAGE_SIZES[pageSize] || PAGE_SIZES.a4).label, [pageSize]);

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
      const afterPx = parseInt((css['margin-bottom'] || '0').replace('px', ''), 10) || 0;
      setIndentLeftCm(pxToCm(leftPx));
      setIndentRightCm(pxToCm(rightPx));
      setSpacingBeforePt(Math.round(beforePx * 0.75));
      setSpacingAfterPt(Math.round(afterPx * 0.75));
    };

    syncFromSelection();
    editor.on('selectionUpdate', syncFromSelection);
    return () => editor.off('selectionUpdate', syncFromSelection);
  }, [editor]);

  useEffect(() => {
    const pm = document.querySelector('.ProseMirror');
    if (!pm) return;
    setLineNumbersOn(pm.classList.contains('etherx-line-numbers'));
    setHyphenationOn(pm.style.hyphens === 'auto');
  }, []);

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
    const pm = document.querySelector('.ProseMirror');
    if (!pm) return;
    const next = !lineNumbersOn;
    setLineNumbersOn(next);
    pm.classList.toggle('etherx-line-numbers', next);
    toast(next ? 'Line numbers on' : 'Line numbers off', 'info');
  };

  const toggleHyphenation = () => {
    const pm = document.querySelector('.ProseMirror');
    if (!pm) return;
    const next = !hyphenationOn;
    setHyphenationOn(next);
    pm.style.hyphens = next ? 'auto' : 'manual';
    pm.lang = next ? 'en' : '';
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
      const next = direction === 'up' ? current + 1 : Math.max(0, current - 1);
      updateImageAttrs({ zIndex: String(next) }, { position: 'relative', 'z-index': String(next) });
      toast(direction === 'up' ? 'Brought forward' : 'Sent backward', 'success');
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

  return (
    <>
      <Group title="Page Setup" width={430}>
        <OptionPicker
          label="Margins"
          value={pageMargin}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'narrow', label: 'Narrow' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'wide', label: 'Wide' },
          ]}
          onChange={(next) => {
            setPageMargin(next);
            toast(`Margins: ${next}`, 'success');
          }}
          width={98}
        />
        <IconTextButton icon="▯" text="Orientation" onClick={() => {
          const next = pageOrientation === 'portrait' ? 'landscape' : 'portrait';
          setPageOrientation(next);
        }} active={pageOrientation === 'landscape'} />
        <OptionPicker
          label="Size"
          value={pageSize}
          options={[
            { value: 'a4', label: 'A4' },
            { value: 'letter', label: 'Letter' },
            { value: 'legal', label: 'Legal' },
            { value: 'a3', label: 'A3' },
          ]}
          onChange={(next) => {
            setPageSize(next);
            toast(`Size: ${(PAGE_SIZES[next] || PAGE_SIZES.a4).label}`, 'success');
          }}
          width={92}
        />
        <OptionPicker
          label="Columns"
          value={String(pageColumns)}
          options={[
            { value: '1', label: 'One' },
            { value: '2', label: 'Two' },
            { value: '3', label: 'Three' },
          ]}
          onChange={(next) => {
            const c = Number(next);
            setPageColumns(c);
            toast(`Columns: ${c}`, 'success');
          }}
          width={96}
        />
        <OptionPicker
          label="Breaks"
          value={breakAction}
          options={BREAK_OPTIONS}
          onChange={insertSelectedBreak}
          width={178}
        />
        <TinyAction text="Line Numbers ▼" onClick={toggleLineNumbers} />
        <TinyAction text="Hyphenation ▼" onClick={toggleHyphenation} />
      </Group>

      <Group title="Paragraph" width={360}>
        <div style={styles.metricCol}>
          <div style={styles.metricLabel}>Indent</div>
          <div style={styles.metricRow}>
            <span style={styles.metricText}>Left:</span>
            <select value={String(indentLeftCm)} onChange={(e) => {
              const n = Number(e.target.value);
              setIndentLeftCm(n);
              applyParagraphLayout({ indentLeftCm: n });
            }} style={styles.metricSelect}>
              {INDENT_CM.map((v) => <option key={`left-${v}`} value={String(v)}>{v} cm</option>)}
            </select>
          </div>
          <div style={styles.metricRow}>
            <span style={styles.metricText}>Right:</span>
            <select value={String(indentRightCm)} onChange={(e) => {
              const n = Number(e.target.value);
              setIndentRightCm(n);
              applyParagraphLayout({ indentRightCm: n });
            }} style={styles.metricSelect}>
              {INDENT_CM.map((v) => <option key={`right-${v}`} value={String(v)}>{v} cm</option>)}
            </select>
          </div>
        </div>

        <div style={styles.metricCol}>
          <div style={styles.metricLabel}>Spacing</div>
          <div style={styles.metricRow}>
            <span style={styles.metricText}>Before:</span>
            <select value={String(spacingBeforePt)} onChange={(e) => {
              const n = Number(e.target.value);
              setSpacingBeforePt(n);
              applyParagraphLayout({ spacingBeforePt: n });
            }} style={styles.metricSelect}>
              {SPACING_PT.map((v) => <option key={`before-${v}`} value={String(v)}>{v} pt</option>)}
            </select>
          </div>
          <div style={styles.metricRow}>
            <span style={styles.metricText}>After:</span>
            <select value={String(spacingAfterPt)} onChange={(e) => {
              const n = Number(e.target.value);
              setSpacingAfterPt(n);
              applyParagraphLayout({ spacingAfterPt: n });
            }} style={styles.metricSelect}>
              {SPACING_PT.map((v) => <option key={`after-${v}`} value={String(v)}>{v} pt</option>)}
            </select>
          </div>
        </div>
      </Group>

      <Group title="Arrange" width={470}>
        <IconTextButton icon="▧" text="Position" onClick={() => alignImage('center')} />
        <IconTextButton icon="≋" text="Wrap Text" onClick={wrapText} />
        <IconTextButton icon="＋" text="Size Up" onClick={() => resizeSelectedImage('up')} />
        <IconTextButton icon="－" text="Size Down" onClick={() => resizeSelectedImage('down')} />
        <IconTextButton icon="🗑" text="Remove" onClick={removeSelectedImage} />
        <IconTextButton icon="▰" text="Bring Forward" onClick={() => layerImage('up')} />
        <IconTextButton icon="▱" text="Send Backward" onClick={() => layerImage('down')} />
        <IconTextButton icon="⌖" text="Selection Pane" onClick={toggleSidebar} active={sidebarOpen} />
        <TinyAction text="Align ▼" onClick={() => alignImage('left')} />
        <TinyAction text="Group ▼" onClick={() => toast('Grouping is limited in this editor', 'info')} />
        <TinyAction text="Rotate ▼" onClick={rotateImage} />
      </Group>

      <Group title="Structure & Security" width={210}>
        <IconTextButton icon="📑" text="Master Doc" onClick={() => openDialog('masterDoc')} />
        <IconTextButton icon="🔒" text="Security" onClick={() => openDialog('security')} />
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
