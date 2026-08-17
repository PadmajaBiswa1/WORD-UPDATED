import { useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Label, Stack } from '@/components/ui';
import { runDictation, runImageTextCapture, runReadAloud, runSmartSuggestions } from '@/utils/smartFeatures';

const THEMES = [
  { name: 'Title', accent: '#c9a84c', heading: '#c9a84c', font: 'Crimson Pro', spacing: '1.7', pageColor: '#ffffff', effect: 'soft' },
  { name: 'TITLE', accent: '#b8941e', heading: '#b8941e', font: 'Georgia', spacing: '1.7', pageColor: '#fdfbf7', effect: 'none' },
  { name: 'Title', accent: '#9f7b17', heading: '#9f7b17', font: 'Times New Roman', spacing: '1.7', pageColor: '#ffffff', effect: 'none' },
  { name: 'Title', accent: '#aa8a2b', heading: '#aa8a2b', font: 'Merriweather', spacing: '1.7', pageColor: '#f5f5f5', effect: 'soft' },
  { name: 'Title', accent: '#d4af37', heading: '#d4af37', font: 'Crimson Pro', spacing: '1.8', pageColor: '#fff8e8', effect: 'soft' },
  { name: 'TITLE', accent: '#8e6d12', heading: '#8e6d12', font: 'Georgia', spacing: '1.6', pageColor: '#ffffff', effect: 'none' },
  { name: 'Title', accent: '#c2a252', heading: '#c2a252', font: 'Times New Roman', spacing: '1.6', pageColor: '#fdfbf7', effect: 'none' },
  { name: 'Title', accent: '#d9bb67', heading: '#d9bb67', font: 'Merriweather', spacing: '1.8', pageColor: '#fff8e8', effect: 'soft' },
  { name: 'Title', accent: '#a58324', heading: '#a58324', font: 'Crimson Pro', spacing: '1.7', pageColor: '#f5f5f5', effect: 'none' },
  { name: 'Title', accent: '#e0c36f', heading: '#e0c36f', font: 'Georgia', spacing: '1.8', pageColor: '#ffffff', effect: 'strong' },
];

const DESIGN_DEFAULT_KEY = 'etherx-design-default';
const THEME_INDEX_KEY = 'etherx-design-theme-index';

const COLOR_SETS = [
  { id: 'office-gold', name: 'Office Gold', accent: '#c9a84c', heading: '#c9a84c', subtle: '#5c4a1a' },
  { id: 'royal-gold', name: 'Royal Gold', accent: '#d4af37', heading: '#d4af37', subtle: '#6e561c' },
  { id: 'antique-gold', name: 'Antique Gold', accent: '#b8941e', heading: '#b8941e', subtle: '#5e4a17' },
  { id: 'bronze-gold', name: 'Bronze Gold', accent: '#a67c1f', heading: '#a67c1f', subtle: '#58431a' },
  { id: 'champagne-gold', name: 'Champagne Gold', accent: '#e0c36f', heading: '#e0c36f', subtle: '#675628' },
];

const FONT_SETS = ['Crimson Pro', 'Georgia', 'Times New Roman', 'Merriweather'];
const SPACING_SETS = ['1.15', '1.5', '1.7', '2.0'];
const EFFECT_SETS = ['none', 'soft', 'strong'];

const CARET = String.fromCharCode(9662);

const PAGE_COLORS = ['#ffffff', '#fdfbf7', '#fff4d8', '#f2f8ff', '#f5f5f5', '#e8f5e9', '#fff1f1', '#1a1a1a', '#0d0d0d', '#2a2a2a'];
const BORDER_STYLES = ['none', 'solid', 'double', 'dashed'];
const BORDER_WIDTHS = [1, 2, 3, 4, 6];
const BORDER_COLORS = ['#6f5320', '#c9a84c', '#8b6b1a', '#4a4a4a', '#8f3d3d', '#2f5d62'];

const THEME_COLOR_COLUMNS = [
  ['#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#7f7f7f'],
  ['#000000', '#1f1f1f', '#404040', '#606060', '#808080'],
  ['#dbe2ea', '#c0cad7', '#9eacbf', '#73839b', '#4d5b6f'],
  ['#dbe6f7', '#b8ccf0', '#7fa3db', '#4f78c4', '#30508e'],
  ['#e1efff', '#b9d4ff', '#7fb1ff', '#4b8cf0', '#2a63c7'],
  ['#fff0e2', '#ffd1a8', '#ffaf66', '#f38a1e', '#b65b06'],
  ['#eeeeee', '#bfbfbf', '#8d8d8d', '#666666', '#3a3a3a'],
  ['#fff4cf', '#ffe48a', '#ffd000', '#f0b400', '#a67600'],
  ['#e8f2ff', '#c4dcff', '#8cbaff', '#5695e6', '#3465ad'],
  ['#e8f4df', '#c7e4ae', '#95cf6b', '#5fad37', '#3a7a1f'],
];

// Detect if a color is dark (luminance < 128)
function isDarkColor(hexColor) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance < 128;
}

// Adjust editor text color based on page background
function adjustTextColorForPageBackground(pageColor) {
  const root = document.documentElement;
  if (!root) return;
  
  const dark = isDarkColor(pageColor);
  if (dark) {
    // Use light text for dark pages
    root.style.setProperty('--text-doc', '#e8d98a');
  } else {
    // Use dark text for light pages
    root.style.setProperty('--text-doc', '#1a1a1a');
  }
}

const STANDARD_COLORS = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];

function getPageElement() {
  return document.getElementById('document-page-0');
}

// getPageElement() actually returns the big transparent multi-page WRAPPER
// (id="document-page-0" is set on the container that spans every page
// stacked together -- see EditorCanvas.jsx). That's fine for bookkeeping
// (dataset attrs) and for things like export/thumbnails that want the whole
// content container, but it is NOT the element the user actually sees as
// "the page": that's the absolutely-positioned `[data-etherx-page-frame]`
// div rendered on top of it, which paints the white/cream page background,
// its shadow, and its rounded corners. Page borders need to be drawn on
// THAT visible rectangle, or they end up hugging the wrapper's raw edge
// instead of looking inset within the paper.
// There is one `[data-etherx-page-frame]` per rendered page (see
// EditorCanvas.jsx), not just the first. Returning only the first one is
// what caused page borders to show up on page 1 and nowhere else.
function getPageFrameElements() {
  return Array.from(document.querySelectorAll('[data-etherx-page-frame]'));
}

// A flat "-10px" outline-offset barely reads as an inset once the page is
// rendered at its actual on-screen size (and disappears further at higher
// zoom, since the page grows but the offset doesn't). Scale the inset with
// the current zoom level so it stays proportional, roughly matching a
// 24pt margin from the paper's edge at 100% zoom -- similar to how Word's
// own page borders sit noticeably inside the sheet rather than flush
// against it.
function getScaledBorderInset() {
  const zoom = useUIStore.getState().zoom || 100;
  const scale = zoom / 100;
  return Math.round(32 * scale);
}

function getEditorElement() {
  return document.querySelector('.ProseMirror');
}

function setPageColor(color) {
  const page = getPageElement();
  if (!page) return false;
  page.dataset.pageColor = color;
  page.style.backgroundColor = color;
  adjustTextColorForPageBackground(color);
  return true;
}

function clearPageColor() {
  const page = getPageElement();
  if (!page) return false;
  delete page.dataset.pageColor;
  page.style.backgroundColor = '';
  // Reset to theme-based text color
  adjustTextColorForPageBackground('#ffffff');
  return true;
}

function cyclePageColor() {
  const page = getPageElement();
  if (!page) return null;
  const current = page.dataset.pageColor || '#fdfbf7';
  const idx = PAGE_COLORS.indexOf(current);
  const next = PAGE_COLORS[(idx + 1 + PAGE_COLORS.length) % PAGE_COLORS.length];
  setPageColor(next);
  return next;
}

function applyPageBorder(style, color = '#6f5320', width = 2) {
  const page = getPageElement();
  const frames = getPageFrameElements();
  if (!page) return false;
  // Dataset bookkeeping stays on the wrapper (other code reads it from
  // there); the actual outline is painted on every visible page frame.
  if (style === 'none') {
    frames.forEach((frame) => {
      frame.style.outline = 'none';
      frame.style.outlineOffset = '0';
    });
    page.dataset.pageBorder = 'none';
    return true;
  }
  frames.forEach((frame) => {
    frame.style.outline = `${width}px ${style} ${color}`;
    frame.style.outlineOffset = `-${getScaledBorderInset()}px`;
  });
  page.dataset.pageBorder = `${style}|${color}|${width}`;
  return true;
}

function applyPageBorderPreset({ setting, style, color, width, applyTo }) {
  const page = getPageElement();
  const frames = getPageFrameElements();
  if (!page) return false;
  const nextSetting = setting || 'box';
  const nextStyle = style || 'solid';
  const nextColor = color || '#6f5320';
  const nextWidth = Number(width || 2);
  const nextApplyTo = applyTo || page.dataset.pageBorderApplyTo || 'whole-document';

  page.dataset.pageBorderSetting = nextSetting;
  page.dataset.pageBorderStyle = nextStyle;
  page.dataset.pageBorderColor = nextColor;
  page.dataset.pageBorderWidth = String(nextWidth);

  if (!frames.length) return true;

  // "This section" isn't modeled separately from "whole document" in this
  // editor (there's no section-break tracking), so it falls back to
  // applying everywhere too. "First page only" targets just the first
  // frame and explicitly clears any border left on the rest.
  const targetFrames = nextApplyTo === 'first-page' ? frames.slice(0, 1) : frames;
  const clearedFrames = nextApplyTo === 'first-page' ? frames.slice(1) : [];

  clearedFrames.forEach((frame) => {
    frame.style.outline = 'none';
    frame.style.outlineOffset = '0';
    frame.style.boxShadow = 'var(--shadow-page)';
  });

  if (nextSetting === 'none') {
    targetFrames.forEach((frame) => {
      frame.style.outline = 'none';
      frame.style.outlineOffset = '0';
      frame.style.boxShadow = 'var(--shadow-page)';
    });
    return true;
  }

  // "custom" gets a slightly deeper inset than the standard presets.
  const inset = getScaledBorderInset() * (nextSetting === 'custom' ? 1.4 : 1);
  const outline = `${nextWidth}px ${nextStyle} ${nextColor}`;
  const boxShadow = nextSetting === 'shadow'
    ? '0 10px 24px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.5)'
    : nextSetting === '3d'
      ? '0 0 0 1px rgba(255,255,255,0.55), inset 0 0 0 1px rgba(0,0,0,0.18), var(--shadow-page)'
      : 'var(--shadow-page)';

  targetFrames.forEach((frame) => {
    frame.style.outline = outline;
    frame.style.outlineOffset = `-${Math.round(inset)}px`;
    frame.style.boxShadow = boxShadow;
  });
  return true;
}

function readPagePreset() {
  const page = getPageElement();
  if (!page) return null;
  const pageColor = page.dataset.pageColor || page.style.backgroundColor || '#fdfbf7';
  const borderParts = (page.dataset.pageBorder || '').split('|');
  return {
    pageColor,
    borderStyle: borderParts[0] || 'none',
    borderColor: borderParts[1] || '#6f5320',
    borderWidth: Number(borderParts[2] || 2),
  };
}

function cyclePageBorder() {
  const page = getPageElement();
  if (!page) return null;
  const current = page.dataset.pageBorder?.split('|')?.[0] || 'none';
  const idx = BORDER_STYLES.indexOf(current);
  const next = BORDER_STYLES[(idx + 1 + BORDER_STYLES.length) % BORDER_STYLES.length];
  applyPageBorder(next);
  return next;
}

function toggleWatermark(text = 'DRAFT') {
  const page = getPageElement();
  if (!page) return false;
  let mark = page.querySelector('[data-etherx-watermark]');
  if (mark) {
    mark.remove();
    return 'removed';
  }
  mark = document.createElement('div');
  mark.setAttribute('data-etherx-watermark', 'true');
  mark.textContent = text;
  mark.style.position = 'absolute';
  mark.style.top = '45%';
  mark.style.left = '50%';
  mark.style.transform = 'translate(-50%, -50%) rotate(-28deg)';
  mark.style.fontSize = '78px';
  mark.style.fontWeight = '700';
  mark.style.letterSpacing = '0.08em';
  mark.style.opacity = '0.11';
  mark.style.color = '#6f5320';
  mark.style.pointerEvents = 'none';
  mark.style.userSelect = 'none';
  mark.style.whiteSpace = 'nowrap';
  mark.style.zIndex = '0';
  page.appendChild(mark);
  return 'added';
}

function applyThemeAccent(accent) {
  const root = document.documentElement;
  if (!root || !accent) return false;
  root.style.setProperty('--gold', accent);
  return true;
}

function applyHeadingColor(color) {
  const root = document.documentElement;
  if (!root || !color) return false;
  root.style.setProperty('--design-heading', color);
  return true;
}

function applySubtleTextColor(color) {
  const root = document.documentElement;
  if (!root || !color) return false;
  root.style.setProperty('--design-subtle', color);
  return true;
}

function cycleDocFont() {
  const fonts = ['Crimson Pro', 'Georgia', 'Times New Roman', 'Merriweather'];
  const pm = getEditorElement();
  if (!pm) return null;
  const current = pm.dataset.designFont || fonts[0];
  const idx = fonts.indexOf(current);
  const next = fonts[(idx + 1 + fonts.length) % fonts.length];
  pm.dataset.designFont = next;
  pm.style.fontFamily = `'${next}', serif`;
  return next;
}

function cycleParagraphSpacing() {
  const steps = ['1.4', '1.7', '2.0'];
  const pm = getEditorElement();
  if (!pm) return null;
  const current = pm.dataset.designSpacing || '1.7';
  const idx = steps.indexOf(current);
  const next = steps[(idx + 1 + steps.length) % steps.length];
  pm.dataset.designSpacing = next;
  pm.style.lineHeight = next;
  return next;
}

function cycleDocEffects() {
  const page = getPageElement();
  if (!page) return null;
  const effects = ['none', 'soft', 'strong'];
  const current = page.dataset.designEffects || 'none';
  const idx = effects.indexOf(current);
  const next = effects[(idx + 1 + effects.length) % effects.length];
  page.dataset.designEffects = next;
  if (next === 'none') page.style.filter = '';
  if (next === 'soft') page.style.filter = 'contrast(1.02) saturate(1.03)';
  if (next === 'strong') page.style.filter = 'contrast(1.08) saturate(1.1)';
  return next;
}

function applyDocFont(font) {
  const pm = getEditorElement();
  if (!pm || !font) return false;
  pm.dataset.designFont = font;
  pm.style.fontFamily = `'${font}', serif`;
  document.documentElement.style.setProperty('--design-heading-font', `'${font}', serif`);
  return true;
}

function applyParagraphSpacing(spacing) {
  const pm = getEditorElement();
  if (!pm || !spacing) return false;
  const value = Number(spacing);
  if (!Number.isFinite(value)) return false;

  pm.dataset.designSpacing = String(value);
  pm.style.lineHeight = String(value);

  const paragraphGap = Math.max(0.35, (value - 1) * 0.62);
  pm.style.setProperty('--design-paragraph-gap', `${paragraphGap.toFixed(2)}em`);
  pm.querySelectorAll('p,li,blockquote').forEach((el) => {
    el.style.marginBottom = `${paragraphGap.toFixed(2)}em`;
  });
  return true;
}

function applyDocEffects(effect) {
  const page = getPageElement();
  if (!page || !effect) return false;
  page.dataset.designEffects = effect;
  if (effect === 'none') {
    page.style.filter = '';
    page.style.boxShadow = 'var(--shadow-page)';
    page.style.transform = '';
  }
  if (effect === 'soft') {
    page.style.filter = 'contrast(1.02) saturate(1.03)';
    page.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
    page.style.transform = 'translateZ(0)';
  }
  if (effect === 'strong') {
    page.style.filter = 'contrast(1.08) saturate(1.10)';
    page.style.boxShadow = '0 12px 30px rgba(0,0,0,0.18)';
    page.style.transform = 'translateZ(0)';
  }
  return true;
}

function applyThemePreset(theme) {
  if (!theme) return false;
  applyThemeAccent(theme.accent);
  applyHeadingColor(theme.heading || theme.accent);
  applySubtleTextColor(theme.subtle || '#444444');
  applyDocFont(theme.font || 'Crimson Pro');
  applyParagraphSpacing(theme.spacing || '1.7');
  applyDocEffects(theme.effect || 'none');
  if (theme.pageColor) {
    setPageColor(theme.pageColor);
  }
  return true;
}

function saveCurrentAsDefault() {
  if (typeof window === 'undefined') return false;
  const root = document.documentElement;
  const page = getPageElement();
  const pm = getEditorElement();
  const computed = getComputedStyle(root);

  const payload = {
    accent: root.style.getPropertyValue('--gold')?.trim() || computed.getPropertyValue('--gold')?.trim() || '#c9a84c',
    heading: root.style.getPropertyValue('--design-heading')?.trim() || '#c9a84c',
    subtle: root.style.getPropertyValue('--design-subtle')?.trim() || '#444444',
    font: pm?.dataset?.designFont || 'Crimson Pro',
    spacing: pm?.dataset?.designSpacing || '1.7',
    effect: page?.dataset?.designEffects || 'none',
    pageColor: page?.dataset?.pageColor || '#ffffff',
  };

  window.localStorage.setItem(DESIGN_DEFAULT_KEY, JSON.stringify(payload));
  return true;
}

function applySavedDefault() {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(DESIGN_DEFAULT_KEY);
  if (!raw) return false;
  try {
    const defaults = JSON.parse(raw);
    applyThemeAccent(defaults.accent);
    applyHeadingColor(defaults.heading || defaults.accent);
    applySubtleTextColor(defaults.subtle || '#444444');
    applyDocFont(defaults.font);
    applyParagraphSpacing(defaults.spacing);
    applyDocEffects(defaults.effect || 'none');
    if (defaults.pageColor) {
      setPageColor(defaults.pageColor);
    }
    return true;
  } catch {
    return false;
  }
}

function nextThemeIndex() {
  if (typeof window === 'undefined') return 0;
  const current = Number(window.localStorage.getItem(THEME_INDEX_KEY) || 0);
  const next = (current + 1) % THEMES.length;
  window.localStorage.setItem(THEME_INDEX_KEY, String(next));
  return next;
}

function setThemeIndex(index) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_INDEX_KEY, String(index));
}

export function DesignTab() {
  const { toast } = useUIStore();
  const editor = useEditorStore((s) => s.editor);
  const pageColorButtonRef = useRef(null);
  const initialPreset = useMemo(() => readPagePreset(), []);
  
  // Use the fixed dark page color when no custom document color is set.
  const getInitialPageColor = () => {
    const preset = initialPreset?.pageColor;
    if (preset && preset !== '#fdfbf7') return preset;
    return '#1a1a1a';
  };
  
  const [pageColor, setPageColorState] = useState(getInitialPageColor());
  const [borderStyle, setBorderStyle] = useState(initialPreset?.borderStyle || 'none');
  const [borderColor, setBorderColor] = useState(initialPreset?.borderColor || '#6f5320');
  const [borderWidth, setBorderWidth] = useState(initialPreset?.borderWidth || 2);
  const [pageColorOpen, setPageColorOpen] = useState(false);
  const [pageColorPanelStyle, setPageColorPanelStyle] = useState({});
  const [pageBorderOpen, setPageBorderOpen] = useState(false);
  const [borderSetting, setBorderSetting] = useState('box');
  const [borderApplyTo, setBorderApplyTo] = useState('whole-document');
  const [borderArt, setBorderArt] = useState('(none)');

  useEffect(() => {
    const page = getPageElement();
    if (!page) return;
    const setting = page.dataset.pageBorderSetting || 'box';
    setBorderSetting(setting);
    setBorderApplyTo(page.dataset.pageBorderApplyTo || 'whole-document');
    setBorderArt(page.dataset.pageBorderArt || '(none)');
  }, []);

  // Auto-apply the dark page color when no custom document color is set.
  useEffect(() => {
    if (!editor) return;
    const timer = setTimeout(() => {
      applySavedDefault();
      const page = getPageElement();
      if (page && (!page.dataset.pageColor || page.dataset.pageColor === '#fdfbf7')) {
        setPageColorState('#1a1a1a');
        setPageColor('#1a1a1a');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [editor]);

  useEffect(() => {
    const page = getPageElement();
    if (!page) return;
    page.dataset.pageColor = pageColor;
    page.style.backgroundColor = pageColor;
  }, [pageColor]);

  const openPageColorPanel = () => {
    const rect = pageColorButtonRef.current?.getBoundingClientRect?.();
    const panelWidth = 380;
    const left = rect ? Math.max(8, Math.min(window.innerWidth - panelWidth - 8, rect.right - panelWidth)) : 8;
    const top = rect ? Math.min(window.innerHeight - 24, rect.bottom + 8) : 120;
    setPageColorPanelStyle({ position: 'fixed', left, top, width: panelWidth, maxHeight: 'calc(100vh - 140px)' });
    setPageColorOpen(true);
  };

  const commitPageBorder = (next = {}) => {
    const payload = {
      setting: next.setting || borderSetting,
      style: next.style || borderStyle,
      color: next.color || borderColor,
      width: Number(next.width || borderWidth),
      applyTo: next.applyTo || borderApplyTo,
    };
    const page = getPageElement();
    if (!page) return false;
    page.dataset.pageBorderSetting = payload.setting;
    page.dataset.pageBorderStyle = payload.style;
    page.dataset.pageBorderColor = payload.color;
    page.dataset.pageBorderWidth = String(payload.width);
    page.dataset.pageBorderApplyTo = next.applyTo || borderApplyTo;
    page.dataset.pageBorderArt = next.art || borderArt;
    const ok = applyPageBorderPreset(payload);
    if (ok) {
      setBorderSetting(payload.setting);
      setBorderStyle(payload.style);
      setBorderColor(payload.color);
      setBorderWidth(payload.width);
      if (next.applyTo) setBorderApplyTo(next.applyTo);
      if (next.art) setBorderArt(next.art);
    }
    return ok;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: '100%',
        width: '100%',
        minWidth: 1220,
        background: 'var(--ribbon-surface)',
        border: '1px solid var(--ribbon-divider)',
        borderTop: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 8,
          borderRight: '1px solid var(--ribbon-divider)',
          padding: '5px 8px 0 8px',
        }}
      >
        <button
          onClick={() => {
            const idx = nextThemeIndex();
            const theme = THEMES[idx];
            if (!applyThemePreset(theme)) return toast('Page is not ready yet', 'info');
            toast(`Theme "${theme.name}" applied`, 'success');
          }}
          style={{
            width: 50,
            height: 70,
            border: '1px solid var(--ribbon-divider)',
            background: 'var(--ribbon-surface-2)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            color: 'var(--ribbon-ink)',
            fontFamily: 'var(--font-ui)',
            padding: 0,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              border: '1px solid var(--ribbon-divider)',
              background: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 9,
              fontWeight: 700,
            }}
          >
            Aa
          </div>
          <span style={{ fontSize: 11 }}>Themes</span>
          <span style={{ fontSize: 9, marginTop: -4 }}>{CARET}</span>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            {THEMES.map((theme, idx) => (
              <button
                key={`${theme.name}-${idx}`}
                onClick={() => {
                  if (!applyThemePreset(theme)) return toast('Page is not ready yet', 'info');
                  setThemeIndex(idx);
                  toast(`Theme "${theme.name}" applied`, 'success');
                }}
                style={{
                  width: 80,
                  height: 66,
                  border: '1px solid var(--ribbon-divider)',
                  background: '#ffffff',
                  cursor: 'pointer',
                  padding: 0,
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    borderBottom: '1px solid #d2d2d2',
                    padding: '4px 4px 2px 4px',
                    fontFamily: 'Georgia, serif',
                    fontSize: 12,
                    color: theme.accent,
                    lineHeight: 1,
                    fontWeight: 400,
                  }}
                >
                  {theme.name}
                </div>
                <div style={{ padding: '3px 4px 0 4px', fontSize: 7, color: '#4d4d4d', lineHeight: 1.12 }}>
                  <div style={{ marginBottom: 1.5 }}>HEADING 1</div>
                  <div style={{ opacity: 0.9 }}>On the insert tab, the galleries include items</div>
                  <div style={{ opacity: 0.9 }}>that are designed to coordinate with the</div>
                </div>
              </button>
            ))}

            <button
              onClick={() => {
                const palette = ['#c9a84c', '#d4af37', '#b8941e', '#a67c1f', '#e0c36f'];
                const current = document.documentElement.style.getPropertyValue('--gold') || '#c9a84c';
                const idx = palette.indexOf(current.trim());
                const next = palette[(idx + 1 + palette.length) % palette.length];
                applyThemeAccent(next);
                toast(`Theme accent changed: ${next}`, 'success');
              }}
              title="More themes"
              style={{
                width: 18,
                height: 66,
                border: '1px solid var(--ribbon-divider)',
                background: 'var(--ribbon-surface-2)',
                color: 'var(--ribbon-ink)',
                cursor: 'pointer',
                fontSize: 11,
                padding: 0,
              }}
            >
              {CARET}
            </button>
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--ribbon-ink)',
              fontFamily: 'var(--font-ui)',
              marginTop: 2,
            }}
          >
            Document Formatting
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid var(--ribbon-divider)',
          padding: '5px 10px 3px 10px',
          minWidth: 340,
        }}
      >
        <div style={{ display: 'flex', gap: 18 }}>
          <button
            onClick={() => {
              const options = COLOR_SETS.map((set, idx) => `${idx + 1}. ${set.name}`).join('\n');
              const pick = window.prompt(`Color Sets:\n${options}\n\nChoose number:`, '1');
              if (!pick) return;
              const choice = Number(pick) - 1;
              const selected = COLOR_SETS[choice];
              if (!selected) return toast('Invalid color set', 'warning');
              applyThemeAccent(selected.accent);
              applyHeadingColor(selected.heading);
              applySubtleTextColor(selected.subtle);
              toast(`Colors applied: ${selected.name}`, 'success');
            }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                border: '1px solid var(--ribbon-divider)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: '#fff',
              }}
            >
              <div style={{ background: '#c9a84c' }} />
              <div style={{ background: '#d4af37' }} />
              <div style={{ background: '#b8941e' }} />
              <div style={{ background: '#e0c36f' }} />
            </div>
            <div style={{ fontSize: 11, marginTop: 1 }}>Colors {CARET}</div>
          </button>

          <button
            onClick={() => {
              const options = FONT_SETS.map((font, idx) => `${idx + 1}. ${font}`).join('\n');
              const pick = window.prompt(`Font Sets:\n${options}\n\nChoose number:`, '1');
              if (!pick) return;
              const choice = Number(pick) - 1;
              const selected = FONT_SETS[choice];
              if (!selected) return toast('Invalid font selection', 'warning');
              if (!applyDocFont(selected)) return toast('Page is not ready yet', 'info');
              toast(`Document font: ${selected}`, 'success');
            }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                border: '1px solid var(--ribbon-divider)',
                display: 'grid',
                placeItems: 'center',
                background: '#fff',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>A</span>
            </div>
            <div style={{ fontSize: 11, marginTop: 1 }}>Fonts {CARET}</div>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 1 }}>
            <button
              onClick={() => {
                const options = SPACING_SETS.map((spacing, idx) => `${idx + 1}. ${spacing}`).join('\n');
                const pick = window.prompt(`Paragraph Spacing:\n${options}\n\nChoose number:`, '3');
                if (!pick) return;
                const choice = Number(pick) - 1;
                const selected = SPACING_SETS[choice];
                if (!selected) return toast('Invalid spacing selection', 'warning');
                if (!applyParagraphSpacing(selected)) return toast('Page is not ready yet', 'info');
                toast(`Paragraph spacing: ${selected}`, 'success');
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--ribbon-ink)',
                padding: 0,
              }}
            >
              <span style={{ fontSize: 19, marginRight: 5 }}>|||</span>
              <span style={{ fontSize: 11, verticalAlign: 'middle' }}>Paragraph Spacing {CARET}</span>
            </button>

            <button
              onClick={() => {
                const options = EFFECT_SETS.map((effect, idx) => `${idx + 1}. ${effect}`).join('\n');
                const pick = window.prompt(`Effects:\n${options}\n\nChoose number:`, '2');
                if (!pick) return;
                const choice = Number(pick) - 1;
                const selected = EFFECT_SETS[choice];
                if (!selected) return toast('Invalid effect selection', 'warning');
                if (!applyDocEffects(selected)) return toast('Page is not ready yet', 'info');
                toast(`Effects: ${selected}`, 'success');
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--ribbon-ink)',
                padding: 0,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 17,
                  height: 17,
                  border: '2px solid #c9a84c',
                  borderRadius: '50%',
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              />
              <span style={{ fontSize: 11, verticalAlign: 'middle' }}>Effects {CARET}</span>
            </button>

            <button
              onClick={() => {
                if (!saveCurrentAsDefault()) return toast('Could not save defaults', 'warning');
                toast('Set as default formatting', 'success');
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
                color: 'var(--ribbon-ink)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  border: '2px solid #d4af37',
                  borderRadius: '50%',
                  color: '#d4af37',
                  fontSize: 12,
                  fontWeight: 700,
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              >
                ✓
              </span>
              <span style={{ fontSize: 11, marginLeft: 8, verticalAlign: 'middle' }}>Set as Default</span>
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ribbon-ink)', fontFamily: 'var(--font-ui)' }}>Design</div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid var(--ribbon-divider)',
          padding: '5px 10px 3px 10px',
          minWidth: 210,
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button
            onClick={() => runDictation({ editor, toast })}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div style={{ fontSize: 20, lineHeight: 1 }}>🎤</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>Voice Typing</div>
          </button>

          <button
            onClick={() => runReadAloud({ editor, toast })}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div style={{ fontSize: 20, lineHeight: 1 }}>🔊</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>Text-to-Speech</div>
          </button>

          <button
            onClick={() => runImageTextCapture({ editor, toast, mode: 'ocr' })}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div style={{ fontSize: 20, lineHeight: 1 }}>🧾</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>OCR</div>
          </button>

          <button
            onClick={() => runImageTextCapture({ editor, toast, mode: 'handwriting' })}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div style={{ fontSize: 20, lineHeight: 1 }}>✍</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>Handwriting</div>
          </button>

          <button
            onClick={() => runSmartSuggestions({ editor, toast })}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div style={{ fontSize: 20, lineHeight: 1 }}>✨</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>Suggestions</div>
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ribbon-ink)', fontFamily: 'var(--font-ui)' }}>Smart Features</div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '5px 12px 3px 12px',
          minWidth: 190,
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => {
              const input = window.prompt('Watermark text (leave blank for DRAFT):', 'DRAFT');
              const result = toggleWatermark((input || 'DRAFT').trim() || 'DRAFT');
              if (!result) return toast('Page is not ready yet', 'info');
              toast(result === 'added' ? 'Watermark added' : 'Watermark removed', 'success');
            }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div
              style={{
                width: 24,
                height: 28,
                border: '2px solid #8f3d3d',
                borderTop: '1px solid #8f3d3d',
                background: '#ffffff',
                transform: 'skew(-8deg)',
                margin: '0 auto',
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', top: 8, left: 1, right: 1, height: 2, background: '#dca0a0' }} />
            </div>
            <div style={{ fontSize: 11, marginTop: 3 }}>Watermark</div>
            <div style={{ fontSize: 10 }}>{CARET}</div>
          </button>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 150 }}>
            <button
              ref={pageColorButtonRef}
              onClick={() => {
                if (pageColorOpen) setPageColorOpen(false);
                else openPageColorPanel();
                setPageBorderOpen(false);
              }}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--ribbon-ink)',
                borderRadius: 8,
                padding: '4px 10px',
                cursor: 'pointer',
                minWidth: 120,
              }}
            >
              Page Color {CARET}
            </button>
            <div style={{ fontSize: 10, marginTop: 4, color: 'var(--text-muted)' }}>{pageColor}</div>
            {pageColorOpen && (
              <div style={{ ...pageColorPanelStyle, zIndex: 5000, padding: 10, border: '1px solid #d4af37', borderRadius: 8, background: 'linear-gradient(180deg, #151515 0%, #0b0b0b 100%)', color: '#f6e7b0', boxShadow: '0 14px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,175,55,0.18) inset', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#f6e7b0', fontFamily: 'var(--font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Page Color</span>
                  <button
                    onClick={() => setPageColorOpen(false)}
                    style={{ border: '1px solid rgba(212,175,55,0.35)', background: '#090909', color: '#d4af37', cursor: 'pointer', fontSize: 12, borderRadius: 999, padding: '2px 10px' }}
                  >
                    Close
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '6px 8px', borderRadius: 6, background: '#1e1a10', border: '1px solid rgba(212,175,55,0.28)' }}>
                  <span style={{ fontSize: 12, color: '#f2dc93' }}>High-contrast only</span>
                  <button
                    onClick={() => toast('High-contrast only is not required for page colors', 'info')}
                    style={{ border: '1px solid rgba(212,175,55,0.4)', background: '#000', color: '#d4af37', borderRadius: 999, padding: '2px 10px', cursor: 'pointer', fontSize: 11 }}
                  >
                    Off
                  </button>
                </div>

                <div style={{ fontSize: 11, color: '#d4af37', marginBottom: 6, fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.03em' }}>Theme Colors</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3, marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid rgba(212,175,55,0.25)' }}>
                  {THEME_COLOR_COLUMNS.map((column, columnIndex) => (
                    <div key={`theme-col-${columnIndex}`} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {column.map((color, shadeIndex) => (
                        <button
                          key={`${columnIndex}-${shadeIndex}-${color}`}
                          onClick={() => {
                            setPageColorState(color);
                            setPageColorOpen(false);
                            if (!setPageColor(color)) return toast('Page is not ready yet', 'info');
                            toast(`Page color applied: ${color}`, 'success');
                          }}
                          title={color}
                          style={{
                            width: '100%',
                            height: shadeIndex === 0 ? 20 : 18,
                            border: color === '#ffffff' ? '1px solid #7e7e7e' : '1px solid rgba(0,0,0,0.32)',
                            background: color,
                            cursor: 'pointer',
                            padding: 0,
                            boxShadow: pageColor === color ? '0 0 0 2px var(--gold)' : color === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.12)' : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 11, color: '#d4af37', marginBottom: 6, fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.03em' }}>Standard Colors</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(212,175,55,0.25)' }}>
                  {STANDARD_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setPageColorState(color);
                        setPageColorOpen(false);
                        if (!setPageColor(color)) return toast('Page is not ready yet', 'info');
                        toast(`Page color applied: ${color}`, 'success');
                      }}
                      title={color}
                      style={{
                        width: '100%',
                        height: 18,
                        border: '1px solid rgba(0,0,0,0.28)',
                        background: color,
                        cursor: 'pointer',
                        padding: 0,
                        boxShadow: pageColor === color ? '0 0 0 2px var(--gold)' : 'none',
                      }}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={() => {
                      setPageColorState('#ffffff');
                      setPageColorOpen(false);
                      if (!clearPageColor()) return toast('Page is not ready yet', 'info');
                      toast('Page color cleared', 'success');
                    }}
                    style={{
                      width: '100%',
                      border: '1px solid #d4af37',
                      background: 'linear-gradient(180deg, #1b1b1b 0%, #090909 100%)',
                      color: '#f6e7b0',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    No Color
                  </button>
                  <button
                    onClick={() => {
                      const input = window.prompt('Enter page color HEX (#RRGGBB):', pageColor || '#fdfbf7');
                      if (!input) return;
                      const next = input.trim();
                      if (!/^#[0-9a-fA-F]{6}$/.test(next)) {
                        toast('Invalid color format', 'warning');
                        return;
                      }
                      setPageColorState(next);
                      setPageColorOpen(false);
                      if (!setPageColor(next)) return toast('Page is not ready yet', 'info');
                      toast(`Page color applied: ${next}`, 'success');
                    }}
                    style={{
                      width: '100%',
                      border: '1px solid #d4af37',
                      background: 'linear-gradient(180deg, #1b1b1b 0%, #090909 100%)',
                      color: '#f6e7b0',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    More Colors...
                  </button>
                  <button
                    onClick={() => {
                      const pick = window.prompt('Fill Effects: 1) none  2) soft  3) strong', '1');
                      const index = Number(pick) - 1;
                      const selected = ['none', 'soft', 'strong'][index];
                      if (!selected) return;
                      const page = getPageElement();
                      if (!page) return toast('Page is not ready yet', 'info');
                      if (selected === 'none') page.style.backgroundImage = '';
                      if (selected === 'soft') page.style.backgroundImage = 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(242,242,242,0.96))';
                      if (selected === 'strong') page.style.backgroundImage = 'linear-gradient(135deg, rgba(255,248,232,0.98), rgba(255,255,255,0.92))';
                      setPageColorOpen(false);
                      toast(`Fill effect: ${selected}`, 'success');
                    }}
                    style={{
                      width: '100%',
                      border: '1px solid #d4af37',
                      background: 'linear-gradient(180deg, #1b1b1b 0%, #090909 100%)',
                      color: '#f6e7b0',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    Fill Effects...
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 170 }}>
            <button
              onClick={() => {
                setPageBorderOpen(true);
                setPageColorOpen(false);
              }}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--ribbon-ink)',
                borderRadius: 8,
                padding: '4px 10px',
                cursor: 'pointer',
                minWidth: 120,
              }}
            >
              Page Border {CARET}
            </button>
            <div style={{ fontSize: 10, marginTop: 4, color: 'var(--text-muted)' }}>{borderSetting} / {borderStyle} / {borderWidth}px</div>
          </div>

          {pageBorderOpen && (
            <Modal title="Borders and Shading" onClose={() => setPageBorderOpen(false)} width={820}>
              <Stack gap={0} style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
                  {['Borders', 'Page Border', 'Shading'].map((tab) => (
                    <Button
                      key={tab}
                      variant={tab === 'Page Border' ? 'primary' : 'subtle'}
                      onClick={() => {}}
                      style={{ minWidth: 100, justifyContent: 'center' }}
                    >
                      {tab}
                    </Button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 320px', gap: 16 }}>
                  <div>
                    <Label>Setting</Label>
                    <Stack gap={8}>
                      {['none', 'box', 'shadow', '3d', 'custom'].map((setting) => {
                        const active = borderSetting === setting;
                        return (
                          <Button
                            key={setting}
                            variant={active ? 'primary' : 'subtle'}
                            onClick={() => {
                              setBorderSetting(setting);
                              commitPageBorder({ setting });
                            }}
                            style={{ justifyContent: 'flex-start', gap: 10 }}
                          >
                            <span style={{ width: 36, height: 26, border: '1px solid currentColor', borderRadius: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ width: 18, height: 14, border: '2px solid currentColor', borderStyle: setting === 'none' ? 'dotted' : 'solid', borderRadius: 1 }} />
                            </span>
                            <span>{setting === 'none' ? 'None' : setting === '3d' ? '3-D' : setting[0].toUpperCase() + setting.slice(1)}</span>
                          </Button>
                        );
                      })}
                    </Stack>
                  </div>

                  <div>
                    <Label>Style</Label>
                    <div style={{ display: 'grid', gap: 8, maxHeight: 170, overflowY: 'auto', paddingRight: 4 }}>
                      {BORDER_STYLES.map((style) => (
                        <button
                          key={style}
                          onClick={() => commitPageBorder({ style })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: borderStyle === style ? '1px solid var(--gold)' : '1px solid var(--border)',
                            background: borderStyle === style ? 'var(--bg-hover)' : 'var(--bg-surface)',
                            color: 'var(--ribbon-ink)',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ width: 34, height: 16, display: 'inline-flex', alignItems: 'center' }}>
                            <span style={{ width: '100%', borderTop: `2px ${style === 'double' ? 'double' : style} currentColor` }} />
                          </span>
                          <span>{style === 'none' ? 'None' : style[0].toUpperCase() + style.slice(1)}</span>
                        </button>
                      ))}
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <Label>Width</Label>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {BORDER_WIDTHS.map((width) => (
                          <button
                            key={width}
                            onClick={() => commitPageBorder({ width })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: borderWidth === width ? '1px solid var(--gold)' : '1px solid var(--border)',
                              background: borderWidth === width ? 'var(--bg-hover)' : 'var(--bg-surface)',
                              color: 'var(--ribbon-ink)',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ width: 38, borderTop: `${width}px solid currentColor` }} />
                            <span>{width} pt</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Color</Label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 250, overflowY: 'auto', paddingRight: 4 }}>
                      {BORDER_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => commitPageBorder({ color })}
                          title={color}
                          style={{
                            minHeight: 34,
                            borderRadius: 6,
                            border: borderColor === color ? '2px solid var(--gold)' : '1px solid var(--border)',
                            background: 'var(--bg-surface)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '5px 8px',
                          }}
                        >
                          <span style={{ width: 16, height: 16, borderRadius: 999, background: color, border: '1px solid rgba(0,0,0,0.22)', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{color}</span>
                        </button>
                      ))}
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <Label>Art</Label>
                      <select
                        value={borderArt}
                        onChange={(e) => {
                          const next = e.target.value;
                          setBorderArt(next);
                          commitPageBorder({ art: next });
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="(none)">(none)</option>
                        <option value="dots">Dots</option>
                        <option value="waves">Waves</option>
                        <option value="stars">Stars</option>
                      </select>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <Label>Apply to</Label>
                      <select
                        value={borderApplyTo}
                        onChange={(e) => {
                          const next = e.target.value;
                          setBorderApplyTo(next);
                          const page = getPageElement();
                          if (page) page.dataset.pageBorderApplyTo = next;
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="whole-document">Whole document</option>
                        <option value="this-section">This section</option>
                        <option value="first-page">First page only</option>
                      </select>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <Label>Preview</Label>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, minHeight: 180, background: 'var(--bg-surface)', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 18, border: `${borderWidth}px ${borderStyle} ${borderColor}`, outlineOffset: -10, opacity: borderSetting === 'none' ? 0 : 1, boxShadow: borderSetting === 'shadow' ? '0 4px 14px rgba(0,0,0,0.18)' : 'none' }} />
                        <div style={{ position: 'relative', zIndex: 1, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          <div style={{ width: '70%', height: 6, background: '#bdbdbd', marginBottom: 8 }} />
                          <div style={{ width: '82%', height: 6, background: '#c9c9c9', marginBottom: 8 }} />
                          <div style={{ width: '64%', height: 6, background: '#d2d2d2', marginBottom: 8 }} />
                          <div style={{ width: '78%', height: 6, background: '#c0c0c0', marginBottom: 8 }} />
                          <div style={{ width: '56%', height: 6, background: '#d8d8d8' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <Button variant="subtle" onClick={() => setPageBorderOpen(false)}>Cancel</Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      commitPageBorder();
                      setPageBorderOpen(false);
                      toast('Page border applied', 'success');
                    }}
                  >
                    OK
                  </Button>
                </div>
              </Stack>
            </Modal>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ribbon-ink)', fontFamily: 'var(--font-ui)' }}>Page Background</div>
      </div>
    </div>
  );
}