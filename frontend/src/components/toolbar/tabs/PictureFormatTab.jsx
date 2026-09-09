import { useEffect, useMemo, useState } from 'react';
import { useEditorStore, useUIStore } from '@/store';
import { Button, Divider, Tooltip, Select } from '@/components/ui';
import { getSelectedImageElement, isImageSelection } from '@/utils/imageSelection';

const BORDER_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'double', label: 'Double' },
];

const WRAP_MODES = [
  { value: 'inline', label: 'In Line' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'topAndBottom', label: 'Top and Bottom' },
  { value: 'behindText', label: 'Behind Text' },
  { value: 'inFrontOfText', label: 'In Front of Text' },
  { value: 'through', label: 'Through' },
];

const TRANSPARENCY_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => ({ value: String(v), label: `${v}%` }));

const ROTATION_OPTIONS = [90, 180, 270, -90, -180, -270].map(v => ({ value: String(v), label: `${v}°` }));

const BG_COLORS = [
  '#000000', '#ffffff', '#ff4d4f', '#fa8c16', '#fadb14',
  '#52c41a', '#13c2c2', '#1677ff', '#722ed1', '#ff7a45',
];

const PICTURE_EFFECT_FILTERS = {
  shadow: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))',
  glow: 'drop-shadow(0 0 8px rgba(255,255,0,0.7))',
};

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

export function PictureFormatTab() {
  const { editor } = useEditorStore();
  const { toast } = useUIStore();
  const [imgWidth, setImgWidth] = useState(240);
  const [imgHeight, setImgHeight] = useState(180);
  // Draft text for the width/height inputs — lets the user freely type/clear
  // digits without every keystroke being committed to the actual image.
  const [draftWidth, setDraftWidth] = useState('240');
  const [draftHeight, setDraftHeight] = useState('180');
  const [borderColor, setBorderColor] = useState('#000000');
  const [borderThickness, setBorderThickness] = useState('1');
  const [borderStyle, setBorderStyle] = useState('solid');
  const [customRotation, setCustomRotation] = useState(0);
  const [transparency, setTransparency] = useState(0);
  const [wrapMode, setWrapMode] = useState('inline');

  useEffect(() => {
    if (!editor) return;
    const updateFromSelection = () => {
      const attrs = editor.getAttributes('image') || {};
      const css = parseCssStyle(attrs.style || '');
      
      const width = parseInt(String(attrs.width || css.width || '240'), 10) || 240;
      const height = parseInt(String(attrs.height || css.height || '180'), 10) || 180;
      
      setImgWidth(width);
      setImgHeight(height);
      setDraftWidth(String(width));
      setDraftHeight(String(height));
      setBorderColor(css.borderColor || '#000000');
      setBorderThickness(String(parseInt(css.borderWidth, 10) || 1));
      setBorderStyle(css.borderStyle || 'solid');
      setCustomRotation(parseInt(String(attrs.rotate || css.transform?.match(/rotate\(([^)]+)\)/)?.[1] || 0), 10) || 0);
      const opacity = Number.parseFloat(css.opacity);
      setTransparency(Number.isFinite(opacity) ? Math.round((1 - Math.max(0, Math.min(1, opacity))) * 100) : 0);
      
      const img = getSelectedImageElement(editor);
      if (img) {
        const wrap = img.dataset.wrap || (css.float === 'left' ? 'left' : css.float === 'right' ? 'right' : 'inline');
        setWrapMode(wrap);
      }
    };

    const handleLiveResize = (e) => {
      const { width, height } = e.detail || {};
      if (typeof width === 'number') {
        setImgWidth(width);
        setDraftWidth(String(width));
      }
      if (typeof height === 'number') {
        setImgHeight(height);
        setDraftHeight(String(height));
      }
    };

    updateFromSelection();
    editor.on('selectionUpdate', updateFromSelection);
    window.addEventListener('image-resize-live', handleLiveResize);
    return () => {
      editor.off('selectionUpdate', updateFromSelection);
      window.removeEventListener('image-resize-live', handleLiveResize);
    };
  }, [editor]);

  const withSelectedImage = (action) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    if (!isImageSelection(editor)) {
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

  const cropImage = () => {
    withSelectedImage((attrs, css) => {
      const img = getSelectedImageElement(editor);
      if (!img) return;
      
      const rect = img.getBoundingClientRect();
      const crop = window.confirm('Crop image to square aspect ratio? This will resize proportionally.');
      if (!crop) return;
      
      const minDim = Math.round(Math.min(rect.width, rect.height));
      const newWidth = minDim;
      const newHeight = minDim;
      
      updateImageAttrs({ width: String(newWidth), height: String(newHeight) });
      setImgWidth(newWidth);
      setImgHeight(newHeight);
      setDraftWidth(String(newWidth));
      setDraftHeight(String(newHeight));
      toast('Image cropped', 'success');
    });
  };

  // Commits a width/height value to the actual image. Only called once the
  // user has finished entering a value (blur / Enter) — never on every keystroke —
  // so a temporarily empty or partial field never shrinks/hides the image.
  const resizeImage = (dimension, value) => {
    withSelectedImage(() => {
      const numValue = parseInt(value, 10) || 0;
      const clamped = Math.max(20, Math.min(2000, numValue));
      if (dimension === 'width') {
        updateImageAttrs({ width: String(clamped) }, { width: `${clamped}px` });
        setImgWidth(clamped);
        setDraftWidth(String(clamped));
      } else {
        updateImageAttrs({ height: String(clamped) }, { height: `${clamped}px` });
        setImgHeight(clamped);
        setDraftHeight(String(clamped));
      }
      window.dispatchEvent(new CustomEvent('image-reposition-handles'));
      toast(`Image ${dimension}: ${clamped}px`, 'success');
    });
  };

  // Called on blur/Enter for the width input. If the field is empty or not a
  // valid number, revert the displayed text without touching the image at all.
  const commitWidth = () => {
    const trimmed = draftWidth.trim();
    const parsed = parseInt(trimmed, 10);
    if (trimmed === '' || Number.isNaN(parsed)) {
      setDraftWidth(String(imgWidth));
      return;
    }
    resizeImage('width', trimmed);
  };

  // Same as commitWidth, for the height input.
  const commitHeight = () => {
    const trimmed = draftHeight.trim();
    const parsed = parseInt(trimmed, 10);
    if (trimmed === '' || Number.isNaN(parsed)) {
      setDraftHeight(String(imgHeight));
      return;
    }
    resizeImage('height', trimmed);
  };

  const rotateLeft = () => {
    withSelectedImage((attrs, css) => {
      const current = parseInt(String(attrs.rotate || css.transform?.match(/rotate\(([^)]+)\)/)?.[1] || 0), 10) || 0;
      const next = (current - 90 + 360) % 360;
      updateImageAttrs({ rotate: String(next) }, { transform: next ? `rotate(${next}deg)` : null });
      setCustomRotation(next);
      toast('Rotated left', 'success');
    });
  };

  const rotateRight = () => {
    withSelectedImage((attrs, css) => {
      const current = parseInt(String(attrs.rotate || css.transform?.match(/rotate\(([^)]+)\)/)?.[1] || 0), 10) || 0;
      const next = (current + 90) % 360;
      updateImageAttrs({ rotate: String(next) }, { transform: next ? `rotate(${next}deg)` : null });
      setCustomRotation(next);
      toast('Rotated right', 'success');
    });
  };

  const applyCustomRotation = () => {
    withSelectedImage(() => {
      const normalized = ((Number(customRotation) % 360) + 360) % 360;
      updateImageAttrs(
        { rotate: String(normalized) },
        { transform: normalized ? `rotate(${normalized}deg)` : null },
      );
      setCustomRotation(normalized);
      toast(`Rotation: ${normalized}°`, 'success');
    });
  };

  const applyTransparency = (nextTransparency = transparency) => {
    withSelectedImage(() => {
      const normalized = Math.max(0, Math.min(100, Number(nextTransparency) || 0));
      const opacity = 1 - (normalized / 100);
      updateImageAttrs({}, { opacity: String(opacity) });
      setTransparency(normalized);
      toast(`Transparency: ${normalized}%`, 'success');
    });
  };

  const applyPictureEffect = (effect, filter, label) => {
    withSelectedImage(() => {
      updateImageAttrs(
        { pictureEffects: effect },
        {
          filter: filter || null,
          '-webkit-box-reflect': effect === 'reflection'
            ? 'below 6px linear-gradient(transparent, rgba(0,0,0,0.28))'
            : null,
        },
      );
      toast(`${label} applied`, 'success');
    });
  };

  const addShadow = () => {
    applyPictureEffect('shadow', PICTURE_EFFECT_FILTERS.shadow, 'Shadow');
  };

  const addGlow = () => {
    applyPictureEffect('glow', PICTURE_EFFECT_FILTERS.glow, 'Glow');
  };

  const addReflection = () => {
    applyPictureEffect('reflection', null, 'Reflection');
  };

  const applyBorder = (nextColor = borderColor, nextThickness = borderThickness, nextStyle = borderStyle) => {
    withSelectedImage(() => {
      const thickness = Math.max(1, Math.min(5, Number(nextThickness) || 1));
      updateImageAttrs({}, {
        border: `${thickness}px ${nextStyle} ${nextColor}`,
        borderColor: nextColor,
        borderWidth: `${thickness}px`,
        borderStyle: nextStyle,
      });
      toast('Border applied', 'success');
    });
  };

  const alignImage = (where) => {
    withSelectedImage(() => {
      const margin = where === 'left'
        ? '12px auto 12px 0'
        : where === 'right'
          ? '12px 0 12px auto'
          : '12px auto';
      updateImageAttrs({}, { display: 'block', float: null, margin });
      toast(`Aligned ${where}`, 'success');
    });
  };

  const setWrap = (mode) => {
    withSelectedImage((attrs, css) => {
      if (!editor) return;
      
      if (!getSelectedImageElement(editor)) return;
      
      setWrapMode(mode);
      
      if (mode === 'inline') {
        updateImageAttrs({ wrap: mode }, { float: null, display: 'block', margin: '12px auto' });
      } else if (mode === 'left') {
        updateImageAttrs({ wrap: mode }, { float: 'left', margin: '8px 16px 8px 0' });
      } else if (mode === 'right') {
        updateImageAttrs({ wrap: mode }, { float: 'right', margin: '8px 0 8px 16px' });
      } else if (mode === 'topAndBottom' || mode === 'behindText') {
        updateImageAttrs({ wrap: mode }, { display: 'block', margin: '24px auto', position: 'relative' });
      } else if (mode === 'inFrontOfText') {
        updateImageAttrs({ wrap: mode }, { position: 'absolute', margin: '12px auto' });
      } else if (mode === 'through') {
        updateImageAttrs({ wrap: mode }, { position: 'absolute', margin: '12px auto' });
      }
      toast(`Wrap: ${mode}`, 'success');
    });
  };

  const bringForward = () => {
    withSelectedImage((attrs, css) => {
      const current = parseInt(String(css['z-index'] || attrs.zIndex || '1'), 10) || 1;
      const next = current + 1;
      updateImageAttrs({ zIndex: String(next) }, { position: 'relative', 'z-index': String(next) });
      toast('Brought forward', 'success');
    });
  };

  const sendBackward = () => {
    withSelectedImage((attrs, css) => {
      const current = parseInt(String(css['z-index'] || attrs.zIndex || '1'), 10) || 1;
      const next = Math.max(0, current - 1);
      updateImageAttrs({ zIndex: String(next) }, { position: 'relative', 'z-index': String(next) });
      toast('Sent backward', 'success');
    });
  };

  const resetFormatting = () => {
    withSelectedImage((attrs) => {
      const src = attrs.src;
      editor.chain().focus().updateAttributes('image', {
        src,
        width: null,
        height: null,
        style: null,
        pictureEffects: '',
        rotate: null,
        wrap: null,
        zIndex: null,
      }).run();

      setImgWidth(240);
      setImgHeight(180);
      setDraftWidth('240');
      setDraftHeight('180');
      setBorderColor('#000000');
      setBorderThickness('1');
      setBorderStyle('solid');
      setCustomRotation(0);
      setTransparency(0);
      setWrapMode('inline');

      toast('Image formatting reset', 'success');
    });
  };

  const sectionShell = {
    flex: '0 0 auto',
    minWidth: 0,
    padding: '8px 10px 10px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-elevated)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  };

  const miniLabel = {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-ui)',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    lineHeight: 1,
  };

  const numberInputStyle = {
    width: '100%',
    height: 26,
    boxSizing: 'border-box',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '0 8px',
    fontSize: 12,
    fontFamily: 'var(--font-ui)',
    outline: 'none',
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

  const controlSections = useMemo(() => [
    {
      title: 'Adjust',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Tooltip text="Crop"><Button style={toolBtn} onClick={cropImage}>✂</Button></Tooltip>
            <Tooltip text="Reset Picture Formatting"><Button style={{ ...toolBtn, width: 80 }} onClick={resetFormatting}>Reset</Button></Tooltip>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={miniLabel}>Width</span>
              <input
                type="number"
                value={draftWidth}
                onChange={(e) => setDraftWidth(e.target.value)}
                onBlur={commitWidth}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { setDraftWidth(String(imgWidth)); e.currentTarget.blur(); }
                }}
                style={numberInputStyle}
                min={20}
                max={2000}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={miniLabel}>Height</span>
              <input
                type="number"
                value={draftHeight}
                onChange={(e) => setDraftHeight(e.target.value)}
                onBlur={commitHeight}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { setDraftHeight(String(imgHeight)); e.currentTarget.blur(); }
                }}
                style={numberInputStyle}
                min={20}
                max={2000}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={miniLabel}>Custom Rotate</span>
              <input
                type="number"
                value={customRotation}
                onChange={(e) => setCustomRotation(parseInt(e.target.value) || 0)}
                style={numberInputStyle}
                min={-360}
                max={360}
              />
            </div>
            <Button style={{ ...toolBtn, width: 30, height: 26 }} onClick={applyCustomRotation}>°</Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Tooltip text="Rotate Left"><Button style={toolBtn} onClick={rotateLeft}>↷</Button></Tooltip>
            <Tooltip text="Rotate Right"><Button style={toolBtn} onClick={rotateRight}>↻</Button></Tooltip>
          </div>
        </div>
      ),
    },
    {
      title: 'Picture Effects',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Tooltip text="Shadow"><Button style={toolBtn} onClick={addShadow}>⬤</Button></Tooltip>
            <Tooltip text="Glow"><Button style={toolBtn} onClick={addGlow}>✨</Button></Tooltip>
            <Tooltip text="Reflection"><Button style={toolBtn} onClick={addReflection}>〰</Button></Tooltip>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={miniLabel}>Transparency</span>
              <Select
                value={String(transparency)}
                onChange={(v) => applyTransparency(v)}
                options={TRANSPARENCY_OPTIONS}
                width={78}
                title="Transparency"
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={miniLabel}>Border</span>
            <Select
              value={borderThickness}
              onChange={setBorderThickness}
              options={[1, 2, 3, 4, 5].map(v => ({ value: String(v), label: `${v}px` }))}
              width={60}
              title="Border thickness"
              style={{ fontSize: 12 }}
            />
            <Select
              value={borderStyle}
              onChange={setBorderStyle}
              options={BORDER_STYLES}
              width={82}
              title="Border style"
              style={{ fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setBorderColor(c); applyBorder(c, borderThickness, borderStyle); }}
                  style={{
                    width: 16,
                    height: 16,
                    background: c,
                    border: `1px solid ${c === '#ffffff' ? 'var(--border)' : 'transparent'}`,
                    borderRadius: 2,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title={`Border color: ${c}`}
                />
              ))}
            </div>
            <Button style={{ ...toolBtn, width: 60 }} onClick={applyBorder}>Apply</Button>
          </div>
        </div>
      ),
    },
    {
      title: 'Layout',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={miniLabel}>Align</span>
            <Tooltip text="Align Left"><Button style={toolBtn} onClick={() => alignImage('left')}>⇤</Button></Tooltip>
            <Tooltip text="Align Center"><Button style={toolBtn} onClick={() => alignImage('center')}>⟨⟩</Button></Tooltip>
            <Tooltip text="Align Right"><Button style={toolBtn} onClick={() => alignImage('right')}>⇥</Button></Tooltip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={miniLabel}>Wrap Text</span>
            <Select
              value={wrapMode}
              onChange={setWrap}
              options={WRAP_MODES}
              width={136}
              title="Text wrapping"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={miniLabel}>Arrange</span>
            <Tooltip text="Bring Forward"><Button style={toolBtn} onClick={bringForward}>↑</Button></Tooltip>
            <Tooltip text="Send Backward"><Button style={toolBtn} onClick={sendBackward}>↓</Button></Tooltip>
          </div>
        </div>
      ),
    },
  ], [
    addGlow,
    addReflection,
    addShadow,
    alignImage,
    applyBorder,
    applyCustomRotation,
    applyTransparency,
    borderStyle,
    borderThickness,
    commitHeight,
    commitWidth,
    cropImage,
    customRotation,
    draftHeight,
    draftWidth,
    imgHeight,
    imgWidth,
    resetFormatting,
    rotateLeft,
    rotateRight,
    sendBackward,
    setBorderColor,
    setBorderStyle,
    setBorderThickness,
    setCustomRotation,
    setImgHeight,
    setImgWidth,
    setTransparency,
    setWrap,
    transparency,
    wrapMode,
  ]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
          width: '100%',
        }}
      >
        {controlSections.map((section) => (
          <div key={section.title} style={{ ...sectionShell, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{section.title}</span>
            </div>
            {section.content}
          </div>
        ))}
      </div>
    </>
  );
}