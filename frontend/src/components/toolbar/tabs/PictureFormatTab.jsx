import { useEffect, useMemo, useState } from 'react';
import { Crop, Sparkles, Waves, BoxSelect } from 'lucide-react';
import { useEditorStore, useUIStore } from '@/store';
import { Button, Divider, Tooltip, Select } from '@/components/ui';
import { getSelectedImageElement, isImageSelection } from '@/utils/imageSelection';
import { isShapeSrc, parseShapeInfo, generateShapeDataUrl, SHAPE_PRESETS } from '@/utils/shapeUtils';

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

function WrapModeDiagram({ mode, active, onClick }) {
  const diagrams = {
    inline: (
      <svg width="28" height="24" viewBox="0 0 28 24" fill="none">
        <line x1="2" y1="5" x2="26" y2="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 1.5" />
        <rect x="8" y="9" width="12" height="10" rx="1" fill="#2563eb" fillOpacity="0.8" stroke="#1d4ed8" strokeWidth="1" />
        <line x1="2" y1="14" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <line x1="22" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="22" x2="26" y2="22" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 1.5" />
      </svg>
    ),
    left: (
      <svg width="28" height="24" viewBox="0 0 28 24" fill="none">
        <rect x="2" y="4" width="11" height="13" rx="1" fill="#2563eb" fillOpacity="0.8" stroke="#1d4ed8" strokeWidth="1" />
        <line x1="16" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth="1.5" />
        <line x1="16" y1="10" x2="26" y2="10" stroke="currentColor" strokeWidth="1.5" />
        <line x1="16" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="20" x2="26" y2="20" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    right: (
      <svg width="28" height="24" viewBox="0 0 28 24" fill="none">
        <rect x="15" y="4" width="11" height="13" rx="1" fill="#2563eb" fillOpacity="0.8" stroke="#1d4ed8" strokeWidth="1" />
        <line x1="2" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="10" x2="12" y2="10" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="14" x2="12" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="20" x2="26" y2="20" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    behindText: (
      <svg width="28" height="24" viewBox="0 0 28 24" fill="none">
        <rect x="6" y="3" width="16" height="16" rx="1" fill="#2563eb" fillOpacity="0.25" stroke="#1d4ed8" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="11" x2="26" y2="11" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="16" x2="26" y2="16" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="21" x2="26" y2="21" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    inFrontOfText: (
      <svg width="28" height="24" viewBox="0 0 28 24" fill="none">
        <line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
        <line x1="2" y1="11" x2="26" y2="11" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
        <line x1="2" y1="16" x2="26" y2="16" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
        <rect x="6" y="5" width="16" height="14" rx="1" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1" />
      </svg>
    ),
  };

  const labels = {
    inline: 'In Line',
    left: 'Square Left',
    right: 'Square Right',
    behindText: 'Behind Text',
    inFrontOfText: 'In Front of Text',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={labels[mode] || mode}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 38,
        height: 34,
        padding: '3px 2px',
        borderRadius: 4,
        border: active ? '1.5px solid #2563eb' : '1px solid var(--border)',
        background: active ? 'rgba(37,99,235,0.15)' : 'var(--bg-elevated)',
        color: active ? '#2563eb' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.12s ease',
      }}
    >
      {diagrams[mode] || mode}
    </button>
  );
}

export function PictureFormatTab({ mode = 'auto' }) {
  const isRibbon = mode === 'ribbon';
  const { editor } = useEditorStore();
  const { toast } = useUIStore();
  const [imgWidth, setImgWidth] = useState(240);
  const [imgHeight, setImgHeight] = useState(180);
  const [draftWidth, setDraftWidth] = useState('240');
  const [draftHeight, setDraftHeight] = useState('180');
  const [borderColor, setBorderColor] = useState('#000000');
  const [borderThickness, setBorderThickness] = useState('1');
  const [borderStyle, setBorderStyle] = useState('solid');
  const [customRotation, setCustomRotation] = useState(0);
  const [transparency, setTransparency] = useState(0);
  const [wrapMode, setWrapMode] = useState('inline');

  // Live filter adjustments
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [blur, setBlur] = useState(0);

  // Shape detection
  const [isShape, setIsShape] = useState(false);
  const [shapeInfo, setShapeInfo] = useState(null);
  const [shapeDraftText, setShapeDraftText] = useState('');

  useEffect(() => {
    if (!editor) return;
    const updateFromSelection = () => {
      const attrs = editor.getAttributes('image') || {};
      const css = parseCssStyle(attrs.style || '');

      const isShapeDetected = isShapeSrc(attrs.src);
      setIsShape(isShapeDetected);
      if (isShapeDetected) {
        const parsed = parseShapeInfo(attrs.src);
        setShapeInfo(parsed);
        setShapeDraftText(parsed.text || '');
      } else {
        setShapeInfo(null);
      }

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

      const filterVal = css.filter || '';
      const bMatch = filterVal.match(/brightness\((\d+)%\)/);
      const cMatch = filterVal.match(/contrast\((\d+)%\)/);
      const gMatch = filterVal.match(/grayscale\((\d+)%\)/);
      const blMatch = filterVal.match(/blur\((\d+)px\)/);
      setBrightness(bMatch ? parseInt(bMatch[1], 10) : 100);
      setContrast(cMatch ? parseInt(cMatch[1], 10) : 100);
      setGrayscale(gMatch ? parseInt(gMatch[1], 10) : 0);
      setBlur(blMatch ? parseInt(blMatch[1], 10) : 0);

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
    withSelectedImage(() => {
      const img = getSelectedImageElement(editor);
      if (img) {
        window.dispatchEvent(new CustomEvent('open-image-crop-modal', { detail: { img } }));
      }
    });
  };

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
    });
  };

  const commitWidth = () => {
    const trimmed = draftWidth.trim();
    const parsed = parseInt(trimmed, 10);
    if (trimmed === '' || Number.isNaN(parsed)) {
      setDraftWidth(String(imgWidth));
      return;
    }
    resizeImage('width', trimmed);
  };

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

  // Live filter preview updates
  const applyLiveFilter = (b, c, g, bl) => {
    withSelectedImage(() => {
      const parts = [];
      if (b !== 100) parts.push(`brightness(${b}%)`);
      if (c !== 100) parts.push(`contrast(${c}%)`);
      if (g > 0) parts.push(`grayscale(${g}%)`);
      if (bl > 0) parts.push(`blur(${bl}px)`);
      const filterStr = parts.join(' ') || null;
      updateImageAttrs({}, { filter: filterStr });
    });
  };

  const handleBrightnessChange = (val) => {
    const num = Number(val);
    setBrightness(num);
    applyLiveFilter(num, contrast, grayscale, blur);
  };

  const handleContrastChange = (val) => {
    const num = Number(val);
    setContrast(num);
    applyLiveFilter(brightness, num, grayscale, blur);
  };

  const handleGrayscaleChange = (val) => {
    const num = Number(val);
    setGrayscale(num);
    applyLiveFilter(brightness, contrast, num, blur);
  };

  const handleBlurChange = (val) => {
    const num = Number(val);
    setBlur(num);
    applyLiveFilter(brightness, contrast, grayscale, num);
  };

  const resetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setGrayscale(0);
    setBlur(0);
    updateImageAttrs({}, { filter: null });
    toast('Filters reset', 'success');
  };

  // Shape style update
  const updateShapeProperty = (patch) => {
    withSelectedImage((attrs) => {
      if (!shapeInfo) return;
      const nextInfo = { ...shapeInfo, ...patch };
      setShapeInfo(nextInfo);
      const newSrc = generateShapeDataUrl(nextInfo.shapeType, nextInfo);
      editor.chain().focus().updateAttributes('image', { src: newSrc }).run();
    });
  };

  const handleShapeTextChange = (text) => {
    setShapeDraftText(text);
    updateShapeProperty({ text });
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
    withSelectedImage(() => {
      setWrapMode(mode);
      if (mode === 'inline') {
        updateImageAttrs({ wrap: mode }, { float: null, display: 'block', margin: '12px auto', position: 'static' });
      } else if (mode === 'left') {
        updateImageAttrs({ wrap: mode }, { float: 'left', margin: '8px 16px 8px 0', position: 'static' });
      } else if (mode === 'right') {
        updateImageAttrs({ wrap: mode }, { float: 'right', margin: '8px 0 8px 16px', position: 'static' });
      } else if (mode === 'topAndBottom') {
        updateImageAttrs({ wrap: mode }, { display: 'block', margin: '24px auto', float: null, position: 'static' });
      } else if (mode === 'behindText') {
        updateImageAttrs({ wrap: mode }, { position: 'relative', 'z-index': '0', opacity: '0.85' });
      } else if (mode === 'inFrontOfText') {
        updateImageAttrs({ wrap: mode }, { position: 'relative', 'z-index': '10' });
      } else if (mode === 'through') {
        updateImageAttrs({ wrap: mode }, { float: 'left', margin: '4px 8px' });
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
      setBrightness(100);
      setContrast(100);
      setGrayscale(0);
      setBlur(0);

      toast('Formatting reset', 'success');
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
    borderRadius: 4,
    fontSize: 12,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };

  const controlSections = useMemo(() => {
    const sections = [];

    if (isShape && shapeInfo) {
      sections.push({
        title: 'Shape Styling & Presets',
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <span style={miniLabel}>Presets</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {SHAPE_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => updateShapeProperty({
                    fill: p.fill,
                    stroke: p.stroke,
                    strokeWidth: p.strokeWidth,
                    textColor: p.textColor,
                  })}
                  style={{
                    padding: '4px 6px',
                    borderRadius: 4,
                    fontSize: 11,
                    background: p.fill === 'none' ? 'transparent' : p.fill,
                    color: p.textColor,
                    border: `1px solid ${p.stroke}`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'center' }}>
              <div>
                <span style={miniLabel}>Fill Color</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <input
                    type="color"
                    value={shapeInfo.fill === 'none' ? '#ffffff' : shapeInfo.fill}
                    onChange={(e) => updateShapeProperty({ fill: e.target.value })}
                    style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => updateShapeProperty({ fill: shapeInfo.fill === 'none' ? '#2563eb' : 'none' })}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: shapeInfo.fill === 'none' ? '#2563eb' : 'var(--bg-surface)',
                      color: shapeInfo.fill === 'none' ? '#fff' : 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {shapeInfo.fill === 'none' ? 'No Fill ✓' : 'No Fill'}
                  </button>
                </div>
              </div>

              <div>
                <span style={miniLabel}>Outline Color</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <input
                    type="color"
                    value={shapeInfo.stroke}
                    onChange={(e) => updateShapeProperty({ stroke: e.target.value })}
                    style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                  />
                  <select
                    value={shapeInfo.strokeWidth}
                    onChange={(e) => updateShapeProperty({ strokeWidth: Number(e.target.value) })}
                    style={{ ...numberInputStyle, width: 50, height: 24, padding: '0 4px', fontSize: 11 }}
                  >
                    {[1, 2, 3, 4, 6, 8].map((w) => (
                      <option key={w} value={w}>{w}px</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={miniLabel}>Text inside Shape</span>
              <input
                type="text"
                value={shapeDraftText}
                onChange={(e) => handleShapeTextChange(e.target.value)}
                placeholder="Type text in shape..."
                style={numberInputStyle}
              />
            </div>
          </div>
        ),
      });
    }

    sections.push({
      title: 'Size & Crop',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!isShape && (
              <button
                type="button"
                onClick={cropImage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <Crop size={14} style={{ marginRight: 4 }} /> Crop Image
              </button>
            )}
            <button
              type="button"
              onClick={resetFormatting}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
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
              <span style={miniLabel}>Rotation</span>
              <input
                type="number"
                value={customRotation}
                onChange={(e) => setCustomRotation(parseInt(e.target.value, 10) || 0)}
                style={numberInputStyle}
                min={-360}
                max={360}
              />
            </div>
            <Button style={{ ...toolBtn, width: 30, height: 26 }} onClick={applyCustomRotation}>Apply</Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip text="Rotate 90° Left"><Button style={toolBtn} onClick={rotateLeft}>↷</Button></Tooltip>
            <Tooltip text="Rotate 90° Right"><Button style={toolBtn} onClick={rotateRight}>↻</Button></Tooltip>
          </div>
        </div>
      ),
    });

    if (!isShape) {
      sections.push({
        title: 'Adjustments (Live Preview)',
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span style={miniLabel}>Brightness</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="180"
                value={brightness}
                onChange={(e) => handleBrightnessChange(e.target.value)}
                style={{ width: '100%', height: 4, cursor: 'pointer' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span style={miniLabel}>Contrast</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{contrast}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                value={contrast}
                onChange={(e) => handleContrastChange(e.target.value)}
                style={{ width: '100%', height: 4, cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span style={miniLabel}>Grayscale</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{grayscale}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={grayscale}
                  onChange={(e) => handleGrayscaleChange(e.target.value)}
                  style={{ width: '100%', height: 4, cursor: 'pointer' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span style={miniLabel}>Blur</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={blur}
                  onChange={(e) => handleBlurChange(e.target.value)}
                  style={{ width: '100%', height: 4, cursor: 'pointer' }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              style={{
                marginTop: 2,
                padding: '3px 8px',
                fontSize: 10,
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Reset Adjustments
            </button>
          </div>
        ),
      });

      sections.push({
        title: 'Picture Effects & Border',
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Tooltip text="Shadow"><Button style={toolBtn} onClick={addShadow}><BoxSelect size={14} /></Button></Tooltip>
              <Tooltip text="Glow"><Button style={toolBtn} onClick={addGlow}><Sparkles size={14} /></Button></Tooltip>
              <Tooltip text="Reflection"><Button style={toolBtn} onClick={addReflection}><Waves size={14} /></Button></Tooltip>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={miniLabel}>Opacity</span>
                <Select
                  value={String(transparency)}
                  onChange={(v) => applyTransparency(v)}
                  options={TRANSPARENCY_OPTIONS}
                  width={68}
                  title="Transparency"
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={miniLabel}>Border</span>
              <Select
                value={borderThickness}
                onChange={setBorderThickness}
                options={[1, 2, 3, 4, 5].map(v => ({ value: String(v), label: `${v}px` }))}
                width={56}
                title="Thickness"
              />
              <Select
                value={borderStyle}
                onChange={setBorderStyle}
                options={BORDER_STYLES}
                width={78}
                title="Style"
              />
              <Button style={{ ...toolBtn, width: 48 }} onClick={applyBorder}>Apply</Button>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
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
          </div>
        ),
      });
    }

    sections.push({
      title: 'Text Wrapping & Layout',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <div>
            <span style={miniLabel}>Wrap Mode (Visual)</span>
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              {['inline', 'left', 'right', 'behindText', 'inFrontOfText'].map((mode) => (
                <WrapModeDiagram
                  key={mode}
                  mode={mode}
                  active={wrapMode === mode}
                  onClick={() => setWrap(mode)}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={miniLabel}>Align</span>
            <Tooltip text="Align Left"><Button style={toolBtn} onClick={() => alignImage('left')}>⇤</Button></Tooltip>
            <Tooltip text="Align Center"><Button style={toolBtn} onClick={() => alignImage('center')}>⟨⟩</Button></Tooltip>
            <Tooltip text="Align Right"><Button style={toolBtn} onClick={() => alignImage('right')}>⇥</Button></Tooltip>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={miniLabel}>Z-Order</span>
            <Tooltip text="Bring Forward"><Button style={{ ...toolBtn, width: 'auto', padding: '0 8px' }} onClick={bringForward}>↑ Forward</Button></Tooltip>
            <Tooltip text="Send Backward"><Button style={{ ...toolBtn, width: 'auto', padding: '0 8px' }} onClick={sendBackward}>↓ Backward</Button></Tooltip>
          </div>
        </div>
      ),
    });

    return sections;
  }, [
    isShape,
    shapeInfo,
    shapeDraftText,
    draftWidth,
    draftHeight,
    imgWidth,
    imgHeight,
    customRotation,
    brightness,
    contrast,
    grayscale,
    blur,
    transparency,
    borderThickness,
    borderStyle,
    borderColor,
    wrapMode,
  ]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isRibbon ? 'row' : 'column',
        alignItems: isRibbon ? 'stretch' : 'normal',
        gap: 8,
        minWidth: 0,
        height: isRibbon ? '100%' : 'auto',
        width: isRibbon ? 'max-content' : '100%',
      }}
    >
      {controlSections.map((section) => (
        <div
          key={section.title}
          style={{
            ...sectionShell,
            width: isRibbon ? 'auto' : '100%',
            height: isRibbon ? '100%' : 'auto',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: isRibbon ? 'space-between' : 'flex-start',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>{section.title}</span>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {section.content}
          </div>
        </div>
      ))}
    </div>
  );
}