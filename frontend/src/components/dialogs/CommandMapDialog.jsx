import { useUIStore } from '@/store';
import { Button, Modal, Stack } from '@/components/ui';

const GROUPS = [
  {
    title: 'Core Editing',
    items: [
      ['Ctrl+F / Ctrl+H', 'Find and Replace'],
      ['Ctrl+B', 'Bold'],
      ['Ctrl+I', 'Italic'],
      ['Ctrl+U', 'Underline'],
      ['Ctrl+= / Ctrl+Shift+=', 'Subscript / Superscript'],
      ['Ctrl+Shift+> / Ctrl+Shift+<', 'Grow / shrink font'],
      ['Ctrl+] / Ctrl+[', 'Font size up / down 1 pt'],
      ['Shift+F3', 'Change case'],
      ['Ctrl+K', 'Insert link'],
      ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / Redo'],
      ['Ctrl+Y', 'Redo'],
      ['Ctrl+P', 'Print'],
    ],
  },
  {
    title: 'View and Window',
    items: [
      ['Ctrl+- / Ctrl+0', 'Zoom out / reset'],
      ['F11', 'Toggle Fullscreen'],
    ],
  },
  {
    title: 'Review',
    items: [
      ['F7', 'Toggle Spelling and Grammar'],
      ['Ctrl+Alt+M', 'New Comment from selection'],
      ['Ctrl+Shift+E / Ctrl+Shift+T', 'Toggle Track Changes'],
      ['Ctrl+Alt+L', 'Open Language dialog'],
      ['Ctrl+Alt+W', 'Open Word Count dialog'],
      ['Ctrl+Alt+A', 'Open Accessibility check'],
    ],
  },
  {
    title: 'Mailings and References',
    items: [
      ['Ctrl+Shift+M', 'Start Mail Merge'],
      ['Ctrl+Shift+F', 'Insert Merge Field'],
      ['Ctrl+Alt+F', 'Insert Footnote'],
      ['Ctrl+Alt+D', 'Insert Endnote'],
      ['Ctrl+Shift+R', 'Open Table of Contents dialog'],
      ['Ctrl+Shift+B', 'Open Bibliography dialog'],
    ],
  },
  {
    title: 'Help',
    items: [
      ['Ctrl+/', 'Open this Keyboard Command Map'],
    ],
  },
];

export function CommandMapDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);

  return (
    <Modal title="Keyboard Command Map" onClose={() => closeDialog('commandMap')} width={680}>
      <Stack gap={14}>
        {GROUPS.map((group) => (
          <div key={group.title} style={groupBox}>
            <div style={groupTitle}>{group.title}</div>
            <div style={rowsWrap}>
              {group.items.map(([combo, action]) => (
                <div key={`${group.title}-${combo}`} style={row}>
                  <span style={comboStyle}>{combo}</span>
                  <span style={actionStyle}>{action}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('commandMap')}>Close</Button>
        </div>
      </Stack>
    </Modal>
  );
}

const groupBox = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-elevated)',
  overflow: 'hidden',
};

const groupTitle = {
  fontFamily: 'var(--font-ui)',
  fontWeight: 700,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--text-secondary)',
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
};

const rowsWrap = {
  display: 'grid',
  gridTemplateColumns: '1fr',
};

const row = {
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 200px) 1fr',
  gap: 12,
  alignItems: 'center',
  padding: '8px 12px',
  borderBottom: '1px solid color-mix(in srgb, var(--border) 65%, transparent)',
};

const comboStyle = {
  fontFamily: 'var(--font-ui)',
  fontWeight: 700,
  color: 'var(--gold)',
  fontSize: 12,
};

const actionStyle = {
  fontFamily: 'var(--font-ui)',
  color: 'var(--text-primary)',
  fontSize: 12,
};
