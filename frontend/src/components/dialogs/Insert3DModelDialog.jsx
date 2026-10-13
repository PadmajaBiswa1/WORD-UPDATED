import { useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Stack, Input } from '@/components/ui';
import { sketchfabEmbedUrl } from '@/components/editor/MediaEmbed';

// Insert > 3D Models > From Online Sources: an interactive Sketchfab model,
// embedded as a block you can rotate and zoom in the document.
export function Insert3DModelDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [modelUrl, setModelUrl] = useState('');
  const close = () => closeDialog('insert3DModel');

  const handleInsert = () => {
    const src = sketchfabEmbedUrl(modelUrl.trim());
    if (!src) {
      toast('Paste a Sketchfab model link, e.g. https://sketchfab.com/3d-models/…', 'warning');
      return;
    }
    if (!editor?.chain().focus().insertMediaEmbed(src).run()) {
      toast('Could not insert the 3D model', 'error');
      return;
    }
    toast('3D model inserted', 'success');
    setModelUrl('');
    close();
  };

  return (
    <Modal title="Insert 3D Model" onClose={close} width={450}>
      <Stack gap={12}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
            Sketchfab model link
          </label>
          <Input
            placeholder="https://sketchfab.com/3d-models/…"
            value={modelUrl}
            onChange={setModelUrl}
            onKeyDown={(e) => { if (e.key === 'Enter') handleInsert(); }}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Open a model on sketchfab.com and copy its page link. Model files from your device (.glb) are not supported yet.
          </div>
        </div>

        <Stack gap={8} direction="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={close}>Cancel</Button>
          <Button onClick={handleInsert} disabled={!modelUrl.trim()}>Insert</Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
