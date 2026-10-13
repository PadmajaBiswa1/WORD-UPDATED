import { useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { printableHtml } from '@/utils/printUtils';

const WIDTHS = { narrow: 520, moderate: 720, wide: 960 };
const THEMES = {
  white: { bg: '#ffffff', fg: '#1b1b1b' },
  sepia: { bg: '#f4ecd8', fg: '#3b2f1e' },
  dark: { bg: '#121214', fg: '#ecebe7' },
};

// Text nodes of the reader and where each starts in their concatenated text, so a
// speech boundary (a character offset) maps back to a DOM range.
function textIndex(root) {
  const nodes = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push({ node, start: text.length });
    text += node.data;
    // Block boundaries read as pauses rather than run-on words.
    if (!node.nextSibling && node.parentElement?.matches('p, li, h1, h2, h3, h4, h5, h6, td, th')) text += '\n';
  }
  return { nodes, text };
}

// View > Immersive Reader, as in Word: the document as plain reading text with
// text size, spacing, column width and page colour, and Read Aloud that
// highlights each word as it is spoken.
export function ImmersiveReader() {
  const { closeDialog } = useUIStore();
  const { editor } = useEditorStore();
  const [size, setSize] = useState(22);
  const [spacing, setSpacing] = useState(false);
  const [width, setWidth] = useState('moderate');
  const [theme, setTheme] = useState('sepia');
  const [speaking, setSpeaking] = useState(false);
  const bodyRef = useRef(null);
  const html = useMemo(() => printableHtml(editor?.getHTML() || ''), [editor]);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS && 'Highlight' in window;

  const stop = () => {
    if (canSpeak) window.speechSynthesis.cancel();
    if (canHighlight) CSS.highlights.delete('immersive-word');
    setSpeaking(false);
  };
  const close = () => { stop(); closeDialog('immersiveReader'); };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readAloud = () => {
    if (speaking) { stop(); return; }
    if (!canSpeak || !bodyRef.current) return;
    const { nodes, text } = textIndex(bodyRef.current);
    if (!text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onboundary = (event) => {
      if (!canHighlight || event.name !== 'word') return;
      const at = event.charIndex;
      const hit = nodes.findLast((entry) => entry.start <= at);
      if (!hit) return;
      const offset = at - hit.start;
      const length = event.charLength || (hit.node.data.slice(offset).match(/^\S+/)?.[0].length ?? 0);
      if (!length || offset >= hit.node.data.length) return;
      const range = document.createRange();
      range.setStart(hit.node, offset);
      range.setEnd(hit.node, Math.min(hit.node.data.length, offset + length));
      CSS.highlights.set('immersive-word', new window.Highlight(range));
      range.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    utterance.onend = stop;
    utterance.onerror = stop;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const colours = THEMES[theme];
  const control = { height: 30, padding: '0 10px', borderRadius: 7, border: '1px solid rgba(128,128,128,0.35)', background: 'transparent', color: 'inherit', fontSize: 12.5, cursor: 'pointer' };

  return (
    <div role="dialog" aria-modal="true" aria-label="Immersive Reader" style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', flexDirection: 'column', background: colours.bg, color: colours.fg }}>
      <style>{'::highlight(immersive-word) { background-color: #ffd54f; color: #111; }'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(128,128,128,0.25)', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14, marginRight: 8 }}>Immersive Reader</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          Text size
          <input type="range" min={14} max={40} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Text size" />
        </label>
        <button type="button" style={control} aria-pressed={spacing} onClick={() => setSpacing((on) => !on)}>{spacing ? '✓ ' : ''}Text spacing</button>
        <select aria-label="Column width" value={width} onChange={(e) => setWidth(e.target.value)} style={control}>
          <option value="narrow">Narrow column</option><option value="moderate">Moderate column</option><option value="wide">Wide column</option>
        </select>
        <select aria-label="Page colour" value={theme} onChange={(e) => setTheme(e.target.value)} style={control}>
          <option value="white">White page</option><option value="sepia">Sepia page</option><option value="dark">Dark page</option>
        </select>
        {canSpeak && <button type="button" style={{ ...control, fontWeight: 600 }} onClick={readAloud}>{speaking ? '■ Stop' : '▶ Read aloud'}</button>}
        <span style={{ flex: 1 }} />
        <button type="button" style={control} onClick={close}>Close (Esc)</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div
          ref={bodyRef}
          className="immersive-reader-body"
          style={{ maxWidth: WIDTHS[width], margin: '0 auto', padding: '48px 24px 96px', fontSize: size, lineHeight: spacing ? 2.1 : 1.7, letterSpacing: spacing ? '0.06em' : 'normal', wordSpacing: spacing ? '0.2em' : 'normal', fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif" }}
          dangerouslySetInnerHTML={{ __html: html || '<p>This document is empty.</p>' }}
        />
      </div>
    </div>
  );
}
