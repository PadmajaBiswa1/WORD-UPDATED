import { useState } from 'react';
import { useUIStore } from '@/store';
import { Modal, Button, Stack } from '@/components/ui';

const PRESETS = [200, 100, 75];

// View > Zoom, as in Word: preset or custom percentage, page width or whole page.
export function ZoomDialog() {
  const { zoom, setZoom, closeDialog, isPageWidth, isFitPage, togglePageWidth, toggleFitPage } = useUIStore();
  const [choice, setChoice] = useState(isPageWidth ? 'width' : isFitPage ? 'page' : 'percent');
  const [percent, setPercent] = useState(zoom);
  const close = () => closeDialog('zoom');

  const apply = () => {
    if (choice === 'width') { if (!isPageWidth) togglePageWidth(); }
    else if (choice === 'page') { if (!isFitPage) toggleFitPage(); }
    else setZoom(Math.round(Number(percent) || 100));
    close();
  };
  const pick = (value) => { setChoice('percent'); setPercent(value); };
  const radio = (checked, onChange, label) => (
    <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
      <input type="radio" name="zoom" checked={checked} onChange={onChange} />{label}
    </label>
  );

  return (
    <Modal title="Zoom" onClose={close} width={360}>
      <Stack gap={10}>
        {PRESETS.map((value) => radio(choice === 'percent' && Number(percent) === value, () => pick(value), `${value}%`))}
        {radio(choice === 'width', () => setChoice('width'), 'Page width')}
        {radio(choice === 'page', () => setChoice('page'), 'Whole page')}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
          Percent
          <input aria-label="Zoom percent" type="number" min={25} max={200} value={percent}
            onChange={(e) => pick(e.target.value)}
            style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} />
          %
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={apply}>OK</Button>
        </div>
      </Stack>
    </Modal>
  );
}
