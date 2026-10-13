import { useState } from 'react';
import { useUIStore } from '@/store';
import { Modal, Button } from '@/components/ui';
import { arrangeDocumentWindows, documentWindows } from '@/utils/documentWindows';

export function ArrangeWindowsDialog() {
  const [layout, setLayout] = useState('tiled');
  const { closeDialog, toast } = useUIStore();
  const windows = documentWindows();
  return <Modal title="Arrange All" onClose={() => closeDialog('arrangeWindows')} width={420}>
    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Arrange document windows opened with New Window.</p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {['tiled', 'horizontal', 'vertical'].map((item) => <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="radio" name="window-layout" checked={layout === item} onChange={() => setLayout(item)} />{item[0].toUpperCase() + item.slice(1)}</label>)}
    </div>
    {!windows.length && <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Open another document with New Window first.</p>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      <Button onClick={() => closeDialog('arrangeWindows')}>Cancel</Button>
      <Button variant="primary" disabled={!windows.length} onClick={() => {
        if (arrangeDocumentWindows(layout)) closeDialog('arrangeWindows');
        else toast('Allow New Window in your browser to arrange document windows', 'info');
      }}>Arrange</Button>
    </div>
  </Modal>;
}
