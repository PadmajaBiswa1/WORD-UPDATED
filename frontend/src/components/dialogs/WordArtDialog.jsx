import { useState, useRef, useEffect } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Input, Label, Stack } from '@/components/ui';
import { WORDART_FONTS, loadWordArtFont, drawWordArt } from '@/utils/wordArt';
import '@/theme/wordart.css';

const STYLES = [
  { id: 'fill',      label: 'Fill',       color: '#d4af37', shadow: 'none',                  stroke: 'none'    },
  { id: 'outline',   label: 'Outline',    color: 'transparent', shadow: 'none',              stroke: '#d4af37' },
  { id: 'shadow',    label: 'Shadow',     color: '#d4af37', shadow: '3px 3px 6px #000',      stroke: 'none'    },
  { id: 'gradient',  label: 'Gradient',   color: 'linear-gradient(135deg,#d4af37,#fff)',      shadow: 'none', stroke: 'none' },
  { id: 'glow',      label: 'Glow',       color: '#fff',    shadow: '0 0 12px #d4af37, 0 0 24px #d4af37', stroke: 'none' },
  { id: 'emboss',    label: 'Emboss',     color: '#c9a84c', shadow: '1px 1px 0 #fff,-1px -1px 0 #555', stroke: 'none' },
];

const FONTS = Object.keys(WORDART_FONTS);

export function WordArtDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const canvasRef = useRef();
  const [text, setText]     = useState('WordArt');
  const [style, setStyle]   = useState('fill');
  const [font, setFont]     = useState('Arial');
  const [size, setSize]     = useState(48);
  const [color, setColor]   = useState('#d4af37');

  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFontReady(false);
    const render = async () => {
      await loadWordArtFont(font, size);
      if (cancelled || !canvasRef.current) return;
      drawWordArt(canvasRef.current, { text: text || 'WordArt', style, font, size, color });
      setFontReady(true);
    };
    render().catch(() => {
      if (!cancelled) toast('Unable to load WordArt font', 'error');
    });
    return () => { cancelled = true; };
  }, [text, style, font, size, color]);

  const insert = () => {
    if (!editor || !canvasRef.current || !fontReady) return;
    const img = canvasRef.current.toDataURL('image/png');
    editor.chain().focus().setImage({ src: img, alt: text, width: String(canvasRef.current.width), height: String(canvasRef.current.height) }).run();
    toast('WordArt inserted!', 'success');
    closeDialog('wordArt');
  };

  return (
    <Modal title="Insert WordArt" onClose={() => closeDialog('wordArt')} width={560}>
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Controls */}
        <Stack gap={12} style={{ flex: '0 0 200px' }}>
          <div><Label>Text</Label><Input value={text} onChange={setText} placeholder="Your text…" autoFocus /></div>
          <div>
            <Label>Font</Label>
            <select aria-label="WordArt font" value={font} onChange={(e) => setFont(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-ui)' }}>
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <Label>Size — {size}px</Label>
            <input type="range" min={20} max={100} value={size} onChange={(e) => setSize(+e.target.value)} style={{ width: '100%', accentColor: 'var(--gold)' }} />
          </div>
          <div>
            <Label>Color</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" aria-label="WordArt color" value={color} onChange={(e) => setColor(e.target.value)}
                style={{ width: 36, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 2, background: 'transparent', cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{color}</span>
            </div>
          </div>
          <div>
            <Label>Style</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {STYLES.map((s) => (
                <Button key={s.id} variant={style === s.id ? 'primary' : 'subtle'} onClick={() => setStyle(s.id)}>{s.label}</Button>
              ))}
            </div>
          </div>
        </Stack>

        {/* Preview + actions */}
        <Stack gap={12} style={{ flex: 1 }}>
          <Label>Preview</Label>
          <canvas ref={canvasRef} width={480} height={120} aria-label="WordArt preview"
            style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', width: '100%', background: '#1a1a1a' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="subtle" onClick={() => closeDialog('wordArt')}>Cancel</Button>
            <Button variant="primary" onClick={insert} disabled={!fontReady}>✓ Insert</Button>
          </div>
        </Stack>
      </div>
    </Modal>
  );
}
