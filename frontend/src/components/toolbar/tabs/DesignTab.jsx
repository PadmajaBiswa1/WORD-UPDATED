import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { Modal, Button, Label, Stack, Input } from '@/components/ui';
import { runImageTextCapture, runSmartSuggestions } from '@/utils/smartFeatures';
import { RibbonGroup } from '../RibbonGroup';

const CARET = String.fromCharCode(9662);
const DESIGN_DEFAULT_KEY = 'etherx-design-default';
const THEME_INDEX_KEY = 'etherx-design-theme-index';

// 10 Curated Document Style Presets (matching MS Word Design themes)
const THEMES = [
  { name: 'Modern Blue', font: 'Inter', headingFont: 'Segoe UI', bodyFont: 'Inter', accent: '#2563eb', heading: '#1d4ed8', subtle: '#3b82f6', spacing: '1.5', pageColor: '#ffffff', effect: 'none' },
  { name: 'Editorial Crimson', font: 'Merriweather', headingFont: 'Playfair Display', bodyFont: 'Merriweather', accent: '#be123c', heading: '#9f1239', subtle: '#881337', spacing: '1.65', pageColor: '#fffafa', effect: 'soft' },
  { name: 'Royal Gold', font: 'Crimson Pro', headingFont: 'Cinzel', bodyFont: 'Crimson Pro', accent: '#d4af37', heading: '#c9a84c', subtle: '#6e561c', spacing: '1.7', pageColor: '#fdfbf7', effect: 'soft' },
  { name: 'Emerald Forest', font: 'Roboto', headingFont: 'Georgia', bodyFont: 'Roboto', accent: '#059669', heading: '#047857', subtle: '#064e3b', spacing: '1.5', pageColor: '#f8faf8', effect: 'none' },
  { name: 'Executive Slate', font: 'Arial', headingFont: 'Segoe UI', bodyFont: 'Arial', accent: '#475569', heading: '#1e293b', subtle: '#334155', spacing: '1.5', pageColor: '#f8fafc', effect: 'none' },
  { name: 'Amethyst Creative', font: 'Lato', headingFont: 'Playfair Display', bodyFont: 'Lato', accent: '#7c3aed', heading: '#6d28d9', subtle: '#4c1d95', spacing: '1.6', pageColor: '#fcfaff', effect: 'soft' },
  { name: 'Warm Amber', font: 'Georgia', headingFont: 'Georgia', bodyFont: 'Georgia', accent: '#d97706', heading: '#b45309', subtle: '#78350f', spacing: '1.7', pageColor: '#fffdfa', effect: 'soft' },
  { name: 'Celestial Teal', font: 'Inter', headingFont: 'Inter', bodyFont: 'Inter', accent: '#0d9488', heading: '#0f766e', subtle: '#115e59', spacing: '1.5', pageColor: '#f0fdfa', effect: 'none' },
  { name: 'Classic Serif', font: 'Times New Roman', headingFont: 'Times New Roman', bodyFont: 'Times New Roman', accent: '#374151', heading: '#111827', subtle: '#4b5563', spacing: '1.6', pageColor: '#ffffff', effect: 'none' },
  { name: 'Obsidian Prestige', font: 'Cinzel', headingFont: 'Cinzel', bodyFont: 'Crimson Pro', accent: '#e0c36f', heading: '#e0c36f', subtle: '#a89454', spacing: '1.8', pageColor: '#18181b', effect: 'strong' },
];

const COLOR_PALETTES = [
  { id: 'office-gold', name: 'Office Gold', accent: '#c9a84c', heading: '#c9a84c', subtle: '#5c4a1a', swatches: ['#c9a84c', '#d4af37', '#b8941e', '#e0c36f'] },
  { id: 'royal-gold', name: 'Royal Gold', accent: '#d4af37', heading: '#d4af37', subtle: '#6e561c', swatches: ['#d4af37', '#b8941e', '#a67c1f', '#fcd34d'] },
  { id: 'ocean-blue', name: 'Ocean Blue', accent: '#2563eb', heading: '#1d4ed8', subtle: '#1e3a8a', swatches: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'] },
  { id: 'forest-emerald', name: 'Forest Emerald', accent: '#059669', heading: '#047857', subtle: '#064e3b', swatches: ['#059669', '#10b981', '#34d399', '#6ee7b7'] },
  { id: 'crimson-ruby', name: 'Crimson Ruby', accent: '#e11d48', heading: '#be123c', subtle: '#881337', swatches: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af'] },
  { id: 'amethyst-violet', name: 'Amethyst Violet', accent: '#7c3aed', heading: '#6d28d9', subtle: '#4c1d95', swatches: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'] },
  { id: 'amber-bronze', name: 'Amber Bronze', accent: '#d97706', heading: '#b45309', subtle: '#78350f', swatches: ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d'] },
  { id: 'slate-graphite', name: 'Slate Graphite', accent: '#475569', heading: '#334155', subtle: '#1e293b', swatches: ['#475569', '#64748b', '#94a3b8', '#cbd5e1'] },
];

const FONT_PAIRINGS = [
  { name: 'Crimson Pro', headingFont: 'Crimson Pro', bodyFont: 'Crimson Pro', preview: 'Crimson Pro + Crimson Pro' },
  { name: 'Georgia', headingFont: 'Georgia', bodyFont: 'Georgia', preview: 'Georgia + Georgia' },
  { name: 'Times New Roman', headingFont: 'Times New Roman', bodyFont: 'Times New Roman', preview: 'Times New Roman' },
  { name: 'Merriweather', headingFont: 'Merriweather', bodyFont: 'Merriweather', preview: 'Merriweather + Merriweather' },
  { name: 'Inter + Roboto', headingFont: 'Inter', bodyFont: 'Roboto', preview: 'Inter + Roboto' },
  { name: 'Playfair + Lato', headingFont: 'Playfair Display', bodyFont: 'Lato', preview: 'Playfair Display + Lato' },
];

const SPACING_PRESETS = [
  { label: 'Compact (1.15)', value: '1.15', desc: 'Tight 1.15 line spacing' },
  { label: 'Normal (1.5)', value: '1.5', desc: 'Standard 1.5 line spacing' },
  { label: 'Relaxed (1.7)', value: '1.7', desc: 'Comfortable 1.7 line spacing' },
  { label: 'Double (2.0)', value: '2.0', desc: 'Formal 2.0 double spacing' },
];

const EFFECT_PRESETS = [
  { label: 'None', value: 'none', desc: 'Clean flat page' },
  { label: 'Soft Depth', value: 'soft', desc: 'Subtle shadow & contrast' },
  { label: 'Strong Depth', value: 'strong', desc: 'Rich elevation & depth' },
];

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

const STANDARD_COLORS = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];
const BORDER_STYLES = ['none', 'solid', 'double', 'dashed'];
const BORDER_WIDTHS = [1, 2, 3, 4, 6];
const BORDER_COLORS = ['#6f5320', '#c9a84c', '#8b6b1a', '#4a4a4a', '#8f3d3d', '#2f5d62', '#2563eb', '#059669'];

const TABLE_STYLES = [
  {
    id: 'grid',
    name: 'Grid Table 1 Light',
    className: 'table-theme-grid',
    headerBg: 'rgba(255,255,255,0.14)',
    headerColor: '#ffffff',
    border: '1px solid #777777',
    stripeBg: 'transparent',
  },
  {
    id: 'accent',
    name: 'Grid Table 2 Accent 1',
    className: 'table-theme-accent',
    headerBg: 'var(--gold, #c9a84c)',
    headerColor: '#000000',
    border: '1px solid var(--gold, #c9a84c)',
    stripeBg: 'rgba(201,168,76,0.12)',
  },
  {
    id: 'dark-header',
    name: 'Dark Header Shaded',
    className: 'table-theme-dark-header',
    headerBg: '#18181b',
    headerColor: '#ffffff',
    border: '1px solid #333333',
    stripeBg: 'rgba(255,255,255,0.06)',
  },
  {
    id: 'striped',
    name: 'Striped Rows',
    className: 'table-theme-striped',
    headerBg: 'rgba(201,168,76,0.18)',
    headerColor: 'var(--gold, #c9a84c)',
    border: '1px solid var(--border)',
    stripeBg: 'rgba(255,255,255,0.06)',
  },
  {
    id: 'minimalist',
    name: 'Elegant Minimalist',
    className: 'table-theme-minimalist',
    headerBg: 'transparent',
    headerColor: 'var(--text-primary)',
    border: '1px solid rgba(255,255,255,0.1)',
    stripeBg: 'transparent',
  },
];

function HeroBtn({ icon, label, onClick, title, active, disabled, triggerName }) {
  return (
    <button
      data-design-trigger={triggerName ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      title={title || label}
      style={{
        border: active ? '1px solid var(--border-gold, #c9a84c)' : '1px solid transparent',
        background: active ? 'var(--bg-hover, rgba(212,175,55,0.1))' : 'transparent',
        borderRadius: 3,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: active ? 'var(--text-gold, #c9a84c)' : 'var(--text-primary)',
        minWidth: 58,
        height: 74,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '4px 6px',
        fontFamily: 'var(--font-ui)',
        fontSize: 11,
        transition: 'background 0.1s, border-color 0.1s',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.45 : 1,
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
      <div style={{ fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <span style={{ fontSize: 11, lineHeight: 1.1, textAlign: 'center' }}>{label}</span>
    </button>
  );
}

function MiniAction({ icon, text, onClick, title, active, disabled, triggerName }) {
  return (
    <button
      data-design-trigger={triggerName ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      title={title || text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 22,
        padding: '0 6px',
        fontSize: 11,
        fontFamily: 'var(--font-ui)',
        border: active ? '1px solid var(--border-gold, #c9a84c)' : '1px solid transparent',
        borderRadius: 2,
        background: active ? 'var(--bg-hover)' : 'transparent',
        color: active ? 'var(--text-gold, #c9a84c)' : 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.1s, border-color 0.1s',
        opacity: disabled ? 0.45 : 1,
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
      {icon && <span style={{ fontSize: 12, lineHeight: 1 }}>{icon}</span>}
      <span>{text}</span>
    </button>
  );
}

export function DesignTab() {
  const { toast, watermarkText, setWatermarkText, setActiveTab, openDialog } = useUIStore();
  const { editor } = useEditorStore();
  const { design, setDesign } = useDocumentStore();

  const [activePopover, setActivePopover] = useState(null); // 'colors' | 'fonts' | 'spacing' | 'effects' | 'watermark' | 'pageColor'
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const [borderModalOpen, setBorderModalOpen] = useState(false);
  const [tempBorderSetting, setTempBorderSetting] = useState(design.borderSetting || 'box');
  const [tempBorderStyle, setTempBorderStyle] = useState(design.borderStyle || 'solid');
  const [tempBorderColor, setTempBorderColor] = useState(design.borderColor || '#6f5320');
  const [tempBorderWidth, setTempBorderWidth] = useState(design.borderWidth || 2);
  const [customWatermarkInput, setCustomWatermarkInput] = useState(design.watermark || watermarkText || '');

  const tempBorderSettingRef = useRef(design.borderSetting || 'box');
  const tempBorderStyleRef = useRef(design.borderStyle || 'solid');
  const tempBorderColorRef = useRef(design.borderColor || '#6f5320');
  const tempBorderWidthRef = useRef(design.borderWidth || 2);

  const [isDictating, setIsDictating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (!e.target.closest('[data-design-popover="true"]') && !e.target.closest('[data-design-trigger="true"]')) {
        setActivePopover(null);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, []);

  const openPopover = (name, e) => {
    e.stopPropagation();
    if (activePopover === name) {
      setActivePopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverPos({ top: rect.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - 300, rect.left)) });
    setActivePopover(name);
  };

  const handleApplyTheme = (theme) => {
    setDesign({
      headingFont: theme.headingFont || theme.font,
      bodyFont: theme.bodyFont || theme.font,
      font: theme.bodyFont || theme.font,
      accent: theme.accent,
      heading: theme.heading,
      subtle: theme.subtle,
      spacing: theme.spacing,
      pageColor: theme.pageColor,
      effect: theme.effect,
      pageColorMode: 'custom',
    });
    toast(`Theme "${theme.name}" applied`, 'success');
  };

  const handleSetAsDefault = () => {
    try {
      localStorage.setItem(DESIGN_DEFAULT_KEY, JSON.stringify(design));
      toast('Current formatting set as default for new documents', 'success');
    } catch {
      toast('Could not save default design', 'warning');
    }
  };

  const toggleVoiceTyping = () => {
    if (isDictating) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsDictating(false);
      toast('Voice typing stopped', 'info');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast('Voice Typing is not supported in this browser', 'warning');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onstart = () => {
        setIsDictating(true);
        toast('🎤 Listening... speak into your microphone', 'success');
      };
      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
        }
        if (finalTranscript && editor) {
          editor.chain().focus().insertContent(finalTranscript).run();
        }
      };
      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') toast('Microphone permission denied', 'error');
        setIsDictating(false);
      };
      recognition.onend = () => setIsDictating(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      toast('Voice typing failed: ' + err.message, 'error');
      setIsDictating(false);
    }
  };

  const toggleReadAloud = () => {
    if (!window.speechSynthesis) {
      toast('Text-to-speech is not supported in this browser', 'warning');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      toast('Speech stopped', 'info');
      return;
    }
    let textToRead = '';
    if (editor) {
      const { from, to } = editor.state.selection;
      if (from !== to) textToRead = editor.state.doc.textBetween(from, to, ' ').trim();
      else textToRead = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ').trim();
    }
    if (!textToRead) {
      toast('Document is empty', 'info');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 1.0;
    utterance.onstart = () => {
      setIsSpeaking(true);
      toast('🔊 Reading aloud...', 'success');
    };
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleStopRead = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    toast('Read aloud stopped', 'info');
  };

  const handleWatermarkPreset = (text) => {
    setDesign({ watermark: text });
    setWatermarkText(text);
    setActivePopover(null);
    toast(text ? `Watermark "${text}" added` : 'Watermark removed', 'success');
  };

  const applyTableTheme = (theme) => {
    if (!editor) return;
    editor.view.focus();

    const { state, view } = editor;
    const { $from } = state.selection;
    let foundTableDepth = -1;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') {
        foundTableDepth = d;
        break;
      }
    }

    if (foundTableDepth > 0) {
      const tablePos = $from.before(foundTableDepth);
      const tableNode = $from.node(foundTableDepth);
      const tr = state.tr.setNodeMarkup(tablePos, undefined, {
        ...tableNode.attrs,
        class: theme.className,
        theme: theme.className,
      });
      view.dispatch(tr);
      toast(`Applied table theme: "${theme.name}"`, 'success');
      return;
    }

    let firstTablePos = null;
    let firstTableNode = null;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'table' && firstTablePos === null) {
        firstTablePos = pos;
        firstTableNode = node;
        return false;
      }
    });

    if (firstTablePos !== null) {
      const tr = state.tr.setNodeMarkup(firstTablePos, undefined, {
        ...firstTableNode.attrs,
        class: theme.className,
        theme: theme.className,
      });
      view.dispatch(tr);
      toast(`Applied "${theme.name}" to document table`, 'success');
    } else {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      setTimeout(() => {
        const { state: newState, view: newView } = editor;
        const { $from: newFrom } = newState.selection;
        for (let d = newFrom.depth; d > 0; d--) {
          if (newFrom.node(d).type.name === 'table') {
            const tPos = newFrom.before(d);
            const tNode = newFrom.node(d);
            newView.dispatch(newState.tr.setNodeMarkup(tPos, undefined, {
              ...tNode.attrs,
              class: theme.className,
              theme: theme.className,
            }));
            break;
          }
        }
      }, 50);
      toast(`Inserted sample table with "${theme.name}"`, 'success');
    }
  };

  return (
    <>
      {/* ── Group 1: Document Formatting (Themes) ── */}
      <RibbonGroup label="Document Formatting">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <button
            onClick={() => {
              const next = ((THEMES.findIndex(t => t.accent === design.accent) + 1) % THEMES.length);
              handleApplyTheme(THEMES[next]);
            }}
            title="Themes: Pick a coordinated set of fonts, colors, and effects"
            style={{
              width: 58,
              height: 74,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              padding: '4px 6px',
              borderRadius: 3,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                border: '1px solid var(--border)',
                background: '#fff',
                color: '#000',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 2,
              }}
            >
              Aa
            </div>
            <span style={{ fontSize: 11 }}>Themes</span>
          </button>

          {/* Theme Preview Cards Gallery — spreads generously across desktop */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              minWidth: 540,
              maxWidth: 720,
              flex: '1 1 auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              padding: '1px 0',
            }}
          >
            {THEMES.map((theme, idx) => {
              const active = design.accent === theme.accent && (design.headingFont === theme.font || design.font === theme.font);
              return (
                <button
                  key={`${theme.name}-${idx}`}
                  onClick={() => handleApplyTheme(theme)}
                  title={`Apply theme: ${theme.name}`}
                  style={{
                    width: 82,
                    minWidth: 82,
                    height: 66,
                    border: active ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                    background: '#ffffff',
                    cursor: 'pointer',
                    padding: 0,
                    textAlign: 'left',
                    borderRadius: 3,
                    boxShadow: active ? '0 0 8px rgba(212,175,55,0.3)' : 'none',
                    flexShrink: 0,
                    transition: 'transform 0.1s',
                  }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid #d2d2d2',
                      padding: '4px 5px 2px 5px',
                      fontFamily: `${theme.font}, serif`,
                      fontSize: 10,
                      color: theme.accent,
                      lineHeight: 1.1,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {theme.name}
                  </div>
                  <div style={{ padding: '3px 5px 0 5px', fontSize: 7, color: '#4d4d4d', lineHeight: 1.15 }}>
                    <div style={{ color: theme.heading, fontWeight: 700, marginBottom: 1 }}>HEADING 1</div>
                    <div style={{ opacity: 0.85, fontSize: 6.5 }}>Document style</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </RibbonGroup>

      {/* ── Group 2: Style Elements ── */}
      <RibbonGroup label="Styles">
        <div style={{ display: 'flex', gap: 6, height: 74, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
            <MiniAction
              triggerName="colors"
              icon={
                <div style={{ width: 12, height: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ background: design.accent || '#c9a84c' }} />
                  <div style={{ background: design.heading || '#d4af37' }} />
                  <div style={{ background: '#b8941e' }} />
                  <div style={{ background: '#e0c36f' }} />
                </div>
              }
              text="Colors ▾"
              title="Color Palette"
              onClick={(e) => openPopover('colors', e)}
            />
            <MiniAction
              triggerName="fonts"
              icon={<span style={{ fontWeight: 700, fontSize: 11 }}>A</span>}
              text="Fonts ▾"
              title="Font Pairings"
              onClick={(e) => openPopover('fonts', e)}
            />
            <MiniAction
              triggerName="spacing"
              icon="⇕"
              text="Spacing ▾"
              title="Paragraph Spacing"
              onClick={(e) => openPopover('spacing', e)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
            <MiniAction
              triggerName="effects"
              icon="✨"
              text="Effects ▾"
              title="Theme Effects"
              onClick={(e) => openPopover('effects', e)}
            />
            <MiniAction
              icon="✓"
              text="Set Default"
              title="Set as Default for New Documents"
              onClick={handleSetAsDefault}
            />
          </div>
        </div>
      </RibbonGroup>

      {/* ── Group 3: Table Styles Gallery ── */}
      <RibbonGroup label="Table Styles">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              minWidth: 310,
              maxWidth: 340,
              flex: '0 1 auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              padding: '1px 0',
            }}
          >
            {TABLE_STYLES.map((ts) => (
              <button
                key={ts.id}
                onClick={() => applyTableTheme(ts)}
                title={`Apply ${ts.name} to active table`}
                style={{
                  width: 72,
                  minWidth: 72,
                  height: 64,
                  flexShrink: 0,
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  background: 'var(--bg-elevated, #18181b)',
                  cursor: 'pointer',
                  padding: '3px 3px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 38,
                    borderRadius: 2,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    border: ts.border,
                  }}
                >
                  <div style={{ height: 12, background: ts.headerBg, display: 'flex', borderBottom: ts.border }}>
                    <div style={{ flex: 1, borderRight: ts.border }} />
                    <div style={{ flex: 1 }} />
                  </div>
                  <div style={{ height: 12, display: 'flex', borderBottom: ts.border }}>
                    <div style={{ flex: 1, borderRight: ts.border }} />
                    <div style={{ flex: 1 }} />
                  </div>
                  <div style={{ height: 12, display: 'flex', background: ts.stripeBg }}>
                    <div style={{ flex: 1, borderRight: ts.border }} />
                    <div style={{ flex: 1 }} />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                >
                  {ts.name.replace('Grid Table ', 'Grid ').replace('Light', '')}
                </div>
              </button>
            ))}
          </div>
        </div>
      </RibbonGroup>

      {/* ── Group 4: Page Background (MS Word Standard: 3 Hero Buttons) ── */}
      <RibbonGroup label="Page Background">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn
            triggerName="watermark"
            icon="💧"
            label="Watermark"
            title="Add ghosted text or watermark behind content"
            onClick={(e) => openPopover('watermark', e)}
          />
          <HeroBtn
            triggerName="pageColor"
            icon={
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: '1.5px solid var(--border)',
                  background: design.pageColor || '#ffffff',
                  borderRadius: 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              />
            }
            label="Page Color"
            title="Choose a color for the background of the page"
            onClick={(e) => openPopover('pageColor', e)}
          />
          <HeroBtn
            icon="🔲"
            label="Page Borders"
            title="Add or change the border around the page"
            onClick={() => setBorderModalOpen(true)}
          />
        </div>
      </RibbonGroup>

      {/* ── Group 5: Smart Tools ── */}
      <RibbonGroup label="Smart Tools">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn
            icon={isDictating ? '🔴' : '🎤'}
            label={isDictating ? 'Listening...' : 'Voice Typing'}
            title="Dictate with voice typing"
            active={isDictating}
            onClick={toggleVoiceTyping}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon="🔊" text={isSpeaking ? 'Reading...' : 'Read Aloud'} title="Text to Speech" onClick={toggleReadAloud} active={isSpeaking} />
            <MiniAction icon="✍" text="Handwriting" title="Switch to Inking" onClick={() => { setActiveTab('draw'); toast('Switched to Draw / Inking tab', 'info'); }} />
            <MiniAction icon="✨" text="Suggestions" title="Smart Content Suggestions" onClick={() => runSmartSuggestions({ editor, toast })} />
          </div>
        </div>
      </RibbonGroup>

      {/* ── Group 6: Document Protection ── */}
      <RibbonGroup label="Protection">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon="📑" label="Master Doc" title="Master Document & Subdocuments" onClick={() => openDialog('masterDoc')} />
          <HeroBtn icon="🔒" label="Security" title="Document Password & Encryption" onClick={() => openDialog('security')} />
        </div>
      </RibbonGroup>

      {/* ── PORTAL: REAL POPOVERS ── */}
      {activePopover && createPortal(
        <div
          data-design-popover="true"
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            zIndex: 3000,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 10,
            boxShadow: '0 12px 28px rgba(0,0,0,0.5)',
            minWidth: 220,
            fontFamily: 'var(--font-ui)',
            color: 'var(--text-primary)',
          }}
        >
          {/* Colors Popover */}
          {activePopover === 'colors' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 8, textTransform: 'uppercase' }}>Color Palettes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                {COLOR_PALETTES.map((pal) => (
                  <button
                    key={pal.id}
                    onClick={() => {
                      setDesign({ accent: pal.accent, heading: pal.heading, subtle: pal.subtle });
                      setActivePopover(null);
                      toast(`Applied palette: ${pal.name}`, 'success');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: design.accent === pal.accent ? 'var(--bg-hover)' : 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span style={{ fontSize: 11 }}>{pal.name}</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {pal.swatches.map((c) => (
                        <span key={c} style={{ width: 10, height: 10, background: c, borderRadius: 1 }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fonts Popover */}
          {activePopover === 'fonts' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 8, textTransform: 'uppercase' }}>Font Pairings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FONT_PAIRINGS.map((fp) => (
                  <button
                    key={fp.name}
                    onClick={() => {
                      setDesign({ headingFont: fp.headingFont, bodyFont: fp.bodyFont, font: fp.bodyFont });
                      setActivePopover(null);
                      toast(`Font pairing "${fp.name}" applied`, 'success');
                    }}
                    style={{
                      background: (design.headingFont === fp.headingFont && design.bodyFont === fp.bodyFont) ? 'var(--bg-hover)' : 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '6px 8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, fontFamily: `${fp.headingFont}, serif` }}>{fp.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fp.preview}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Paragraph Spacing Popover */}
          {activePopover === 'spacing' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 8, textTransform: 'uppercase' }}>Paragraph Spacing</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SPACING_PRESETS.map((sp) => (
                  <button
                    key={sp.value}
                    onClick={() => {
                      setDesign({ spacing: sp.value });
                      setActivePopover(null);
                      toast(`Spacing set to ${sp.label}`, 'success');
                    }}
                    style={{
                      background: design.spacing === sp.value ? 'var(--bg-hover)' : 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '5px 8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{sp.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sp.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Effects Popover */}
          {activePopover === 'effects' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 8, textTransform: 'uppercase' }}>Visual Effects</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {EFFECT_PRESETS.map((ef) => (
                  <button
                    key={ef.value}
                    onClick={() => {
                      setDesign({ effect: ef.value });
                      setActivePopover(null);
                      toast(`Effect "${ef.label}" applied`, 'success');
                    }}
                    style={{
                      background: design.effect === ef.value ? 'var(--bg-hover)' : 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '5px 8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{ef.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ef.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Watermark Popover */}
          {activePopover === 'watermark' && (
            <div style={{ width: 230 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 8, textTransform: 'uppercase' }}>Watermark</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {['DRAFT', 'CONFIDENTIAL', 'URGENT', 'DO NOT COPY'].map((txt) => (
                  <button
                    key={txt}
                    onClick={() => handleWatermarkPreset(txt)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      padding: '4px 6px',
                      fontSize: 11,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {txt}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Custom watermark..."
                  value={customWatermarkInput}
                  onChange={(e) => setCustomWatermarkInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: 11,
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                  }}
                />
                <button
                  onClick={() => handleWatermarkPreset(customWatermarkInput.trim())}
                  style={{
                    background: 'var(--gold)',
                    color: 'var(--text-on-gold)',
                    border: 'none',
                    borderRadius: 3,
                    padding: '4px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Set
                </button>
              </div>
              <button
                onClick={() => handleWatermarkPreset('')}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  borderRadius: 3,
                  padding: '4px',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                Remove Watermark
              </button>
            </div>
          )}

          {/* Page Color Popover */}
          {activePopover === 'pageColor' && (
            <div style={{ width: 260 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 6, textTransform: 'uppercase' }}>Theme Colors</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2, marginBottom: 8 }}>
                {THEME_COLOR_COLUMNS.map((col, cIdx) => (
                  <div key={cIdx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {col.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          setDesign({ pageColor: color, pageColorMode: 'custom' });
                          setActivePopover(null);
                          toast(`Page color applied: ${color}`, 'success');
                        }}
                        title={color}
                        style={{
                          width: '100%',
                          height: 14,
                          background: color,
                          border: color === '#ffffff' ? '1px solid #777' : '1px solid rgba(0,0,0,0.2)',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 6, textTransform: 'uppercase' }}>Standard Colors</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2, marginBottom: 8 }}>
                {STANDARD_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setDesign({ pageColor: c, pageColorMode: 'custom' });
                      setActivePopover(null);
                      toast(`Page color applied: ${c}`, 'success');
                    }}
                    title={c}
                    style={{ width: '100%', height: 14, background: c, border: '1px solid rgba(0,0,0,0.2)', padding: 0, cursor: 'pointer' }}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => {
                    setDesign({ pageColor: '#1a1a1a', pageColorMode: 'theme' });
                    setActivePopover(null);
                    toast('Page color reset to theme default', 'success');
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '4px',
                    fontSize: 10,
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                >
                  No Color (Default)
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* ── BORDER MODAL ── */}
      {borderModalOpen && (
        <Modal title="Borders and Shading" onClose={() => setBorderModalOpen(false)} width={540}>
          <Stack gap={12}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16 }}>
              {/* Setting */}
              <div>
                <Label>Setting</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['none', 'box', 'shadow', '3d', 'custom'].map((st) => (
                    <Button
                      key={st}
                      type="button"
                      variant={tempBorderSetting === st ? 'primary' : 'subtle'}
                      onClick={() => {
                        setTempBorderSetting(st);
                        tempBorderSettingRef.current = st;
                      }}
                      style={{ justifyContent: 'flex-start', fontSize: 11 }}
                    >
                      {st === 'none' ? 'None' : st === '3d' ? '3-D' : st[0].toUpperCase() + st.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Style, Color, Width */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <Label>Style</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {BORDER_STYLES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setTempBorderStyle(st);
                          tempBorderStyleRef.current = st;
                        }}
                        style={{
                          background: tempBorderStyle === st ? 'var(--bg-hover)' : 'transparent',
                          border: tempBorderStyle === st ? '1px solid var(--gold)' : '1px solid var(--border)',
                          borderRadius: 3,
                          padding: '4px 6px',
                          fontSize: 11,
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                          textAlign: 'left',
                        }}
                      >
                        {st[0].toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Color</Label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {BORDER_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setTempBorderColor(c);
                          tempBorderColorRef.current = c;
                        }}
                        style={{
                          width: 20,
                          height: 20,
                          background: c,
                          borderRadius: '50%',
                          border: tempBorderColor === c ? '2px solid var(--gold)' : '1px solid rgba(0,0,0,0.3)',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Width</Label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {BORDER_WIDTHS.map((w) => (
                      <Button
                        key={w}
                        type="button"
                        variant={tempBorderWidth === w ? 'primary' : 'subtle'}
                        onClick={() => {
                          setTempBorderWidth(w);
                          tempBorderWidthRef.current = w;
                        }}
                        style={{ padding: '2px 8px', fontSize: 11 }}
                      >
                        {w}pt
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
              <Button variant="subtle" onClick={() => setBorderModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const setting = tempBorderSettingRef.current;
                  const style = setting === 'none' ? 'none' : tempBorderStyleRef.current;
                  const color = tempBorderColorRef.current;
                  const width = tempBorderWidthRef.current;
                  setDesign({
                    borderSetting: setting,
                    borderStyle: style,
                    borderColor: color,
                    borderWidth: width,
                  });
                  setBorderModalOpen(false);
                  toast('Page borders updated', 'success');
                }}
              >
                OK
              </Button>
            </div>
          </Stack>
        </Modal>
      )}
    </>
  );
}
