import { useState } from 'react';
import { useDocumentStore, useUIStore } from '@/store';
import { Modal, Button } from '@/components/ui';

export function PageSetupDialog() {
  const layout = useDocumentStore((s) => s.layout);
  const setLayout = useDocumentStore((s) => s.setLayout);
  const closeDialog = useUIStore((s) => s.closeDialog);
  const [draft, setDraft] = useState(layout);
  const close = () => closeDialog('pageSetup');
  const fields = [
    ['pageSize', 'Paper size', [['a4', 'A4'], ['letter', 'Letter'], ['legal', 'Legal'], ['a3', 'A3']]],
    ['pageOrientation', 'Orientation', [['portrait', 'Portrait'], ['landscape', 'Landscape']]],
    ['pageMargin', 'Margins', [['normal', 'Normal'], ['narrow', 'Narrow'], ['moderate', 'Moderate'], ['wide', 'Wide']]],
    ['pageColumns', 'Columns', [[1, 'One'], [2, 'Two'], [3, 'Three']]],
  ];
  return <Modal title="Page setup" onClose={close}>
    {fields.map(([key, label, options]) => <label key={key} className="studio-setting-row" style={{ justifyContent: 'space-between' }}>
      <span>{label}</span><select className="studio-setting-input" aria-label={label} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: key === 'pageColumns' ? Number(e.target.value) : e.target.value })}>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>)}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
      <Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => { setLayout(draft); close(); }}>Apply</Button>
    </div>
  </Modal>;
}
