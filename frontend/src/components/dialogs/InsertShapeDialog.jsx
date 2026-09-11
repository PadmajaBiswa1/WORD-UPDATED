import { useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Stack, Label } from '@/components/ui';
import { SHAPES, SHAPE_PRESETS, generateShapeDataUrl } from '@/utils/shapeUtils';

export function InsertShapeDialog() {
  const { closeDialog } = useUIStore();
  const { editor } = useEditorStore();
  const [selected, setSelected] = useState('rect');
  const [fill, setFill] = useState('#d4af37');
  const [stroke, setStroke] = useState('#b8952d');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [size, setSize] = useState(140);
  const [opacity, setOpacity] = useState(1);
  const [shapeText, setShapeText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');

  const shape = SHAPES.find((s) => s.id === selected) || SHAPES[0];

  const applyPreset = (p) => {
    setFill(p.fill);
    setStroke(p.stroke);
    setStrokeWidth(p.strokeWidth || 2);
    if (p.textColor) setTextColor(p.textColor);
  };

  const insertShape = () => {
    if (!shape) return;
    const dataUrl = generateShapeDataUrl({
      shapeId: selected,
      fill,
      stroke,
      strokeWidth,
      size,
      text: shapeText,
      textColor,
      opacity,
    });
    editor?.chain().focus().setImage({
      src: dataUrl,
      alt: shape.label,
      width: String(size),
    }).run();
    closeDialog('insertShape');
  };

  return (
    <Modal title="Insert Shape" onClose={() => closeDialog('insertShape')} width={520}>
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Shape grid */}
        <div>
          <Label>Choose Shape</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 72px)', gap: 6, marginTop: 6 }}>
            {SHAPES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                style={{
                  width: 72,
                  height: 60,
                  background: selected === s.id ? 'var(--bg-active)' : 'var(--bg-elevated)',
                  border: selected === s.id ? '1px solid var(--gold)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                }}
              >
                <svg
                  viewBox={s.viewBox}
                  width={32}
                  height={28}
                  style={{ overflow: 'visible' }}
                  dangerouslySetInnerHTML={{
                    __html: s.innerSvg(selected === s.id ? 'var(--gold)' : '#555', selected === s.id ? '#b8952d' : '#444'),
                  }}
                />
                <span style={{ fontSize: 9, color: selected === s.id ? 'var(--gold)' : 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{s.label}</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <Label>Style Presets</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
              {SHAPE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  style={{
                    padding: '4px 6px',
                    fontSize: 10,
                    fontFamily: 'var(--font-ui)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: p.fill, border: `1px solid ${p.stroke}`, display: 'inline-block' }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Config + Preview */}
        <Stack gap={10} style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <Label>Fill Color</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <input
                  type="color"
                  value={fill === 'transparent' ? '#ffffff' : fill}
                  onChange={(e) => setFill(e.target.value)}
                  style={{ width: 32, height: 26, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 2, background: 'transparent', cursor: 'pointer' }}
                />
                <button
                  type="button"
                  onClick={() => setFill('transparent')}
                  style={{ fontSize: 10, padding: '2px 6px', border: '1px solid var(--border)', background: fill === 'transparent' ? 'var(--gold)' : 'transparent', color: fill === 'transparent' ? '#000' : 'var(--text-muted)', cursor: 'pointer', borderRadius: 3 }}
                >
                  None
                </button>
              </div>
            </div>
            <div>
              <Label>Outline Color</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <input
                  type="color"
                  value={stroke}
                  onChange={(e) => setStroke(e.target.value)}
                  style={{ width: 32, height: 26, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 2, background: 'transparent', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Text Inside Shape (Optional)</Label>
            <input
              type="text"
              placeholder="e.g. Callout or Label..."
              value={shapeText}
              onChange={(e) => setShapeText(e.target.value)}
              style={{
                width: '100%',
                height: 28,
                marginTop: 4,
                boxSizing: 'border-box',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '0 8px',
                fontSize: 12,
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <Label>Size — {size}px</Label>
              <input type="range" min={40} max={400} value={size} onChange={(e) => setSize(+e.target.value)} style={{ width: '100%', accentColor: 'var(--gold)' }} />
            </div>
            <div>
              <Label>Opacity — {Math.round(opacity * 100)}%</Label>
              <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(+e.target.value)} style={{ width: '100%', accentColor: 'var(--gold)' }} />
            </div>
          </div>

          {/* Preview */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', height: 74, overflow: 'hidden' }}>
            <svg
              viewBox={shape.viewBox}
              width={70}
              height={50}
              opacity={opacity}
              dangerouslySetInnerHTML={{
                __html: `${shape.innerSvg(fill, stroke, strokeWidth)}${shapeText ? `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-size="14" font-weight="600">${shapeText}</text>` : ''}`,
              }}
            />
          </div>

          <Button variant="primary" onClick={insertShape} style={{ height: 32 }}>✓ Insert Shape</Button>
        </Stack>
      </div>
    </Modal>
  );
}
