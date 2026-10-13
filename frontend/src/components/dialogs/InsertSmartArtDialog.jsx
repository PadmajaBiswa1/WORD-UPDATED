import { useMemo, useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button } from '@/components/ui';
import { SMARTART_LAYOUTS, SMARTART_COLORS, renderSmartArt, svgDataUrl } from '@/utils/smartArt';

const SAMPLE = { list: 'Plan\nBuild\nTest\nShip', process: 'Research\nDraft\nReview\nPublish', cycle: 'Plan\nDo\nCheck\nAct', hierarchy: 'Director\n  Design lead\n  Engineering lead\nOperations\n  Support', pyramid: 'Vision\nStrategy\nTactics\nTasks' };

// Insert > SmartArt: pick a layout, type the items, and the graphic goes in as a
// picture (so size, wrap and position work). Reopen the dialog to make a new one.
export function InsertSmartArtDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [layout, setLayout] = useState('process');
  const [text, setText] = useState(SAMPLE.process);
  const [color, setColor] = useState('gold');
  const [edited, setEdited] = useState(false);
  const close = () => closeDialog('insertSmartArt');
  const markup = useMemo(() => renderSmartArt(layout, text, color), [layout, text, color]);

  const pickLayout = (id) => { setLayout(id); if (!edited) setText(SAMPLE[id]); };
  const insert = () => {
    if (!text.trim()) { toast('Type at least one item', 'warning'); return; }
    const width = Math.min(620, Number(markup.match(/width="(\d+)/)?.[1]) || 480);
    editor?.chain().focus().setImage({ src: svgDataUrl(markup), alt: `SmartArt: ${text.split('\n').map((l) => l.trim()).filter(Boolean).join(', ')}`, width: String(width) }).run();
    toast('SmartArt inserted', 'success');
    close();
  };

  return (
    <Modal title="Choose a SmartArt Graphic" onClose={close} width={720}>
      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 16 }}>
        <div role="radiogroup" aria-label="Layout" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SMARTART_LAYOUTS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={layout === l.id} onClick={() => pickLayout(l.id)}
              style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', background: layout === l.id ? 'rgba(212,175,55,0.14)' : 'transparent', border: layout === l.id ? '1px solid var(--gold)' : '1px solid var(--border)' }}>
              {l.name}
            </button>
          ))}
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>Colours</div>
          <div role="radiogroup" aria-label="Colours" style={{ display: 'flex', gap: 6 }}>
            {Object.entries(SMARTART_COLORS).map(([key, [c]]) => (
              <button key={key} type="button" role="radio" aria-checked={color === key} title={key} onClick={() => setColor(key)}
                style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: color === key ? '2px solid var(--text-primary)' : '1px solid var(--border)' }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Text, one item per line{layout === 'hierarchy' ? ' (indent a line to put it under the one above)' : ''}
            <textarea aria-label="SmartArt text" value={text} onChange={(e) => { setText(e.target.value); setEdited(true); }} rows={6}
              style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box', padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 13 }} />
          </label>
          <div style={{ height: 230, borderRadius: 8, background: '#ffffff', display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 8 }}>
            <img alt="SmartArt preview" src={svgDataUrl(markup)} style={{ maxWidth: '100%', maxHeight: '100%' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={insert}>Insert</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
