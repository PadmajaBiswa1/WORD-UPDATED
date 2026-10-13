import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Stack } from '@/components/ui';
import { applyCase } from '@/utils/textCase';

// The built-in macros, run on the current selection.
const MACROS = [
  { id: 'upper', name: 'UpperCase', desc: 'MAKE THE SELECTION UPPERCASE' },
  { id: 'lower', name: 'LowerCase', desc: 'make the selection lowercase' },
  { id: 'title', name: 'TitleCase', desc: 'Capitalize Each Word In The Selection' },
];

export function MacrosDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const close = () => closeDialog('macros');

  const runMacro = (macro) => {
    if (!editor || editor.state.selection.empty) {
      toast('Select text to run a macro', 'info');
      return;
    }
    applyCase(editor, macro.id);
    toast(`Macro ${macro.name} run`, 'success');
    close();
  };

  return (
    <Modal title="Macros" onClose={close} width={420}>
      <Stack gap={8}>
        {MACROS.map((macro) => (
          <div key={macro.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{macro.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{macro.desc}</div>
            </div>
            <Button variant="outline" onClick={() => runMacro(macro)}>Run</Button>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={close}>Close</Button>
        </div>
      </Stack>
    </Modal>
  );
}
