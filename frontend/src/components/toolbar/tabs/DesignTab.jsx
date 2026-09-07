import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { Modal, Button, Label, Stack, Input } from '@/components/ui';
import { runImageTextCapture, runSmartSuggestions } from '@/utils/smartFeatures';

const CARET = String.fromCharCode(9662);
const DESIGN_DEFAULT_KEY = 'etherx-design-default';
const THEME_INDEX_KEY = 'etherx-design-theme-index';

// 10 Curated Document Style Presets (matching MS Word Design themes)
const THEMES = [
  { name: 'Title', font: 'Crimson Pro', headingFont: 'Crimson Pro', bodyFont: 'Crimson Pro', accent: '#c9a84c', heading: '#c9a84c', subtle: '#5c4a1a', spacing: '1.7', pageColor: '#ffffff', effect: 'soft' },
  { name: 'TITLE', font: 'Georgia', headingFont: 'Georgia', bodyFont: 'Georgia', accent: '#b8941e', heading: '#b8941e', subtle: '#5e4a17', spacing: '1.7', pageColor: '#fdfbf7', effect: 'none' },
  { name: 'Title', font: 'Times New Roman', headingFont: 'Times New Roman', bodyFont: 'Times New Roman', accent: '#9f7b17', heading: '#9f7b17', subtle: '#4b5563', spacing: '1.7', pageColor: '#ffffff', effect: 'none' },
  { name: 'Title', font: 'Merriweather', headingFont: 'Merriweather', bodyFont: 'Merriweather', accent: '#aa8a2b', heading: '#aa8a2b', subtle: '#5c4a1a', spacing: '1.7', pageColor: '#f5f5f5', effect: 'soft' },
  { name: 'Title', font: 'Crimson Pro', headingFont: 'Crimson Pro', bodyFont: 'Crimson Pro', accent: '#d4af37', heading: '#d4af37', subtle: '#6e561c', spacing: '1.8', pageColor: '#fff8e8', effect: 'soft' },
  { name: 'TITLE', font: 'Georgia', headingFont: 'Georgia', bodyFont: 'Georgia', accent: '#8e6d12', heading: '#8e6d12', subtle: '#444444', spacing: '1.6', pageColor: '#ffffff', effect: 'none' },
  { name: 'Title', font: 'Times New Roman', headingFont: 'Times New Roman', bodyFont: 'Times New Roman', accent: '#c2a252', heading: '#c2a252', subtle: '#5e4a17', spacing: '1.6', pageColor: '#fdfbf7', effect: 'none' },
  { name: 'Title', font: 'Merriweather', headingFont: 'Merriweather', bodyFont: 'Merriweather', accent: '#d9bb67', heading: '#d9bb67', subtle: '#675628', spacing: '1.8', pageColor: '#fff8e8', effect: 'soft' },
  { name: 'Title', font: 'Crimson Pro', headingFont: 'Crimson Pro', bodyFont: 'Crimson Pro', accent: '#a58324', heading: '#a58324', subtle: '#58431a', spacing: '1.7', pageColor: '#f5f5f5', effect: 'none' },
  { name: 'Title', font: 'Georgia', headingFont: 'Georgia', bodyFont: 'Georgia', accent: '#e0c36f', heading: '#e0c36f', subtle: '#675628', spacing: '1.8', pageColor: '#ffffff', effect: 'strong' },
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

export function DesignTab() {
  const { toast, watermarkText, setWatermarkText, setActiveTab } = useUIStore();
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
      pageColorMode: theme.pageColor === '#ffffff' || theme.pageColor === '#1a1a1a' ? 'theme' : 'custom',
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
        userSelect: 'none',
      }}
    >
      {/* ── Group 1: Document Formatting (Themes) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 8,
          borderRight: '1px solid var(--ribbon-divider)',
          padding: '5px 8px 0 8px',
        }}
      >
        {/* Themes Button */}
        <button
          onClick={() => {
            const next = ((THEMES.findIndex(t => t.accent === design.accent) + 1) % THEMES.length);
            handleApplyTheme(THEMES[next]);
          }}
          style={{
            width: 50,
            height: 68,
            border: '1px solid var(--ribbon-divider)',
            background: 'var(--ribbon-surface-2)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            color: 'var(--ribbon-ink)',
            fontFamily: 'var(--font-ui)',
            padding: 0,
            borderRadius: 2,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              border: '1px solid var(--ribbon-divider)',
              background: '#fff',
              color: '#000',
              display: 'grid',
              placeItems: 'center',
              fontSize: 9,
              fontWeight: 700,
              borderRadius: 2,
            }}
          >
            Aa
          </div>
          <span style={{ fontSize: 11 }}>Themes</span>
          <span style={{ fontSize: 9, marginTop: -4 }}>{CARET}</span>
        </button>

        {/* 10 Theme Preview Cards Strip */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            {THEMES.map((theme, idx) => {
              const active = design.accent === theme.accent && (design.headingFont === theme.font || design.font === theme.font);
              return (
                <button
                  key={`${theme.name}-${idx}`}
                  onClick={() => handleApplyTheme(theme)}
                  style={{
                    width: 80,
                    height: 66,
                    border: active ? '1.5px solid var(--gold)' : '1px solid var(--ribbon-divider)',
                    background: '#ffffff',
                    cursor: 'pointer',
                    padding: 0,
                    textAlign: 'left',
                    borderRadius: 2,
                    boxShadow: active ? '0 0 8px rgba(212,175,55,0.3)' : 'none',
                  }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid #d2d2d2',
                      padding: '4px 4px 2px 4px',
                      fontFamily: `${theme.font}, serif`,
                      fontSize: 12,
                      color: theme.accent,
                      lineHeight: 1,
                      fontWeight: 400,
                    }}
                  >
                    {theme.name}
                  </div>
                  <div style={{ padding: '3px 4px 0 4px', fontSize: 7, color: '#4d4d4d', lineHeight: 1.12 }}>
                    <div style={{ color: theme.heading, fontWeight: 700, marginBottom: 1.5 }}>HEADING 1</div>
                    <div style={{ opacity: 0.9 }}>On the insert tab, the galleries include items</div>
                    <div style={{ opacity: 0.9 }}>that are designed to coordinate with the</div>
                  </div>
                </button>
              );
            })}

            <button
              onClick={() => {
                const palette = ['#c9a84c', '#d4af37', '#b8941e', '#a67c1f', '#e0c36f'];
                const current = design.accent || '#c9a84c';
                const idx = palette.indexOf(current);
                const next = palette[(idx + 1 + palette.length) % palette.length];
                setDesign({ accent: next, heading: next });
                toast(`Theme accent: ${next}`, 'success');
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
                borderRadius: 2,
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

      {/* ── Group 2: Design Controls ── */}
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
          {/* Colors Dropdown */}
          <button
            data-design-trigger="true"
            onClick={(e) => openPopover('colors', e)}
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
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div style={{ background: design.accent || '#c9a84c' }} />
              <div style={{ background: design.heading || '#d4af37' }} />
              <div style={{ background: '#b8941e' }} />
              <div style={{ background: '#e0c36f' }} />
            </div>
            <div style={{ fontSize: 11, marginTop: 1 }}>Colors {CARET}</div>
          </button>

          {/* Fonts Dropdown */}
          <button
            data-design-trigger="true"
            onClick={(e) => openPopover('fonts', e)}
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
                color: '#000',
                borderRadius: 2,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>A</span>
            </div>
            <div style={{ fontSize: 11, marginTop: 1 }}>Fonts {CARET}</div>
          </button>

          {/* Spacing, Effects, Set as Default stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 1 }}>
            <button
              data-design-trigger="true"
              onClick={(e) => openPopover('spacing', e)}
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
              data-design-trigger="true"
              onClick={(e) => openPopover('effects', e)}
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
                  border: '2px solid var(--gold)',
                  borderRadius: '50%',
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              />
              <span style={{ fontSize: 11, verticalAlign: 'middle' }}>Effects {CARET}</span>
            </button>

            <button
              onClick={handleSetAsDefault}
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

      {/* ── Group 3: Smart Features ── */}
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
            onClick={toggleVoiceTyping}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: isDictating ? '#ef4444' : 'var(--ribbon-ink)' }}
          >
            <div style={{ fontSize: 20, lineHeight: 1 }}>{isDictating ? '🔴' : '🎤'}</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>{isDictating ? 'Listening...' : 'Voice Typing'}</div>
          </button>

          <button
            onClick={toggleReadAloud}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: isSpeaking ? 'var(--gold)' : 'var(--ribbon-ink)' }}
          >
            <div style={{ fontSize: 20, lineHeight: 1 }}>🔊</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>{isSpeaking ? 'Reading...' : 'Text-to-Speech'}</div>
          </button>

          <button
            onClick={handleStopRead}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div style={{ fontSize: 20, lineHeight: 1 }}>🔇</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>Stop Read</div>
          </button>

          <button
            onClick={() => {
              setActiveTab('draw');
              toast('Switched to Draw / Inking tab', 'info');
            }}
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

      {/* ── Group 4: Page Background ── */}
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
          {/* Watermark */}
          <button
            data-design-trigger="true"
            onClick={(e) => openPopover('watermark', e)}
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

          {/* Page Color */}
          <button
            data-design-trigger="true"
            onClick={(e) => openPopover('pageColor', e)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div
              style={{
                width: 24,
                height: 28,
                border: '1px solid var(--border)',
                background: design.pageColor || '#1a1a1a',
                margin: '0 auto',
                borderRadius: 2,
              }}
            />
            <div style={{ fontSize: 11, marginTop: 3 }}>Page Color</div>
            <div style={{ fontSize: 10 }}>{CARET}</div>
          </button>

          {/* Page Border */}
          <button
            onClick={() => setBorderModalOpen(true)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--ribbon-ink)' }}
          >
            <div
              style={{
                width: 24,
                height: 28,
                border: '2px solid var(--gold)',
                background: 'transparent',
                margin: '0 auto',
                borderRadius: 2,
              }}
            />
            <div style={{ fontSize: 11, marginTop: 3 }}>Page Border</div>
            <div style={{ fontSize: 10 }}>{CARET}</div>
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ribbon-ink)', fontFamily: 'var(--font-ui)' }}>Page Background</div>
      </div>

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
    </div>
  );
}
