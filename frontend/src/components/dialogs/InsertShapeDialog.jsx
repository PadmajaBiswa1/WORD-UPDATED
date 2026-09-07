import { useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Stack, Label } from '@/components/ui';

const SHAPES = [
  { id:'rect',     label:'Rectangle',  svg:(c,s)=>`<rect width="140" height="80" rx="4" fill="${c}" stroke="${s}" stroke-width="2"/>` },
  { id:'circle',   label:'Circle',     svg:(c,s)=>`<ellipse cx="70" cy="70" rx="68" ry="68" fill="${c}" stroke="${s}" stroke-width="2"/>` },
  { id:'triangle', label:'Triangle',   svg:(c,s)=>`<polygon points="75,5 145,145 5,145" fill="${c}" stroke="${s}" stroke-width="2"/>` },
  { id:'star',     label:'Star',       svg:(c,s)=>`<polygon points="75,5 90,50 140,50 100,80 115,125 75,95 35,125 50,80 10,50 60,50" fill="${c}" stroke="${s}" stroke-width="2"/>` },
  { id:'arrow',    label:'Arrow →',    svg:(c,s)=>`<polygon points="0,30 90,30 90,10 140,50 90,90 90,70 0,70" fill="${c}" stroke="${s}" stroke-width="2"/>` },
  { id:'diamond',  label:'Diamond',    svg:(c,s)=>`<polygon points="75,5 140,70 75,135 10,70" fill="${c}" stroke="${s}" stroke-width="2"/>` },
  { id:'hexagon',  label:'Hexagon',    svg:(c,s)=>`<polygon points="37,5 113,5 150,70 113,135 37,135 0,70" fill="${c}" stroke="${s}" stroke-width="2"/>` },
  { id:'cross',    label:'Cross',      svg:(c,s)=>`<polygon points="45,0 85,0 85,45 130,45 130,85 85,85 85,130 45,130 45,85 0,85 0,45 45,45" fill="${c}" stroke="${s}" stroke-width="2"/>` },
];

export function InsertShapeDialog() {
  const { closeDialog } = useUIStore();
  const { editor } = useEditorStore();
  const [selected, setSelected]  = useState('rect');
  const [fill,     setFill]      = useState('#d4af37');
  const [stroke,   setStroke]    = useState('#b8952d');
  const [size,     setSize]      = useState(120);
  const [opacity,  setOpacity]   = useState(1);

  const shape = SHAPES.find((s) => s.id === selected);

  const viewBoxes = { rect:'0 0 140 80', circle:'0 0 140 140', triangle:'0 0 150 150', star:'0 0 150 130', arrow:'0 0 140 100', diamond:'0 0 150 140', hexagon:'0 0 150 140', cross:'0 0 130 130' };

  const insertShape = () => {
    if (!shape) return;
    const vb   = viewBoxes[selected] || '0 0 140 140';
    const inner = shape.svg(fill, stroke);
    const svg  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${size}" opacity="${opacity}">${inner}</svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    editor?.chain().focus().setImage({ src: dataUrl, alt: shape.label, width: String(size) }).run();
    closeDialog('insertShape');
  };

  const fillC = shape ? shape.svg(fill, stroke) : '';
  const vb    = viewBoxes[selected] || '0 0 140 140';

  return (
    <Modal title="Insert Shape" onClose={() => closeDialog('insertShape')} width={500}>
      <div style={{ display:'flex', gap:20 }}>
        {/* Shape grid */}
        <div>
          <Label>Shape</Label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 72px)', gap:6, marginTop:6 }}>
            {SHAPES.map((s) => (
              <button key={s.id} onClick={() => setSelected(s.id)} style={{
                width:72, height:60, background: selected===s.id ? 'var(--bg-active)':'var(--bg-elevated)',
                border: selected===s.id ? '1px solid var(--gold)':'1px solid var(--border)',
                borderRadius:'var(--radius-sm)', cursor:'pointer', padding:4,
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
              }}>
                <svg viewBox={viewBoxes[s.id]||'0 0 140 140'} width={32} height={28} style={{ overflow:'visible' }}
                  dangerouslySetInnerHTML={{ __html: s.svg(selected===s.id?'var(--gold)':'#555', selected===s.id?'#b8952d':'#444') }} />
                <span style={{ fontSize:9, color: selected===s.id?'var(--gold)':'var(--text-muted)', fontFamily:'var(--font-ui)' }}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Config + Preview */}
        <Stack gap={12} style={{ flex:1 }}>
          <div>
            <Label>Fill Color</Label>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="color" value={fill} onChange={(e)=>setFill(e.target.value)} style={{ width:36, height:28, border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:2, background:'transparent', cursor:'pointer' }} />
              <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)' }}>{fill}</span>
            </div>
          </div>
          <div>
            <Label>Stroke Color</Label>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="color" value={stroke} onChange={(e)=>setStroke(e.target.value)} style={{ width:36, height:28, border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:2, background:'transparent', cursor:'pointer' }} />
            </div>
          </div>
          <div>
            <Label>Size — {size}px</Label>
            <input type="range" min={40} max={400} value={size} onChange={(e)=>setSize(+e.target.value)} style={{ width:'100%', accentColor:'var(--gold)' }} />
          </div>
          <div>
            <Label>Opacity — {Math.round(opacity*100)}%</Label>
            <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e)=>setOpacity(+e.target.value)} style={{ width:'100%', accentColor:'var(--gold)' }} />
          </div>

          {/* Preview */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', height:80 }}>
            {shape && (
              <svg viewBox={vb} width={60} height={60} opacity={opacity}
                dangerouslySetInnerHTML={{ __html: shape.svg(fill, stroke) }} />
            )}
          </div>

          <Button variant="primary" onClick={insertShape}>✓ Insert Shape</Button>
        </Stack>
      </div>
    </Modal>
  );
}
