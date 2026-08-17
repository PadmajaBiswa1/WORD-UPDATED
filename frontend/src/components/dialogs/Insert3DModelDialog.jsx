import { useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Stack, Input } from '@/components/ui';

export function Insert3DModelDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [modelUrl, setModelUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInsert = async () => {
    if (!modelUrl.trim()) {
      toast('Please enter a model URL', 'warning');
      return;
    }

    // Validate that it's a 3D model URL
    const url = modelUrl.trim().toLowerCase();
    const is3dFormat = url.endsWith('.glb') || url.endsWith('.gltf') || url.endsWith('.obj') || url.endsWith('.fbx');
    
    if (!is3dFormat && !url.includes('sketchfab.com') && !url.includes('model-viewer')) {
      toast('URL should be a 3D model file (.glb, .gltf, .obj, .fbx) or a supported model hosting service', 'warning');
      return;
    }

    if (!editor) {
      toast('Editor is not ready', 'error');
      return;
    }

    setLoading(true);
    try {
      // For now, create an embeddable reference to the 3D model
      // In a full implementation, this would use a 3D viewer library like Three.js or Babylon.js
      const html = `<div style="margin:12px 0;border:2px solid #8b4513;border-radius:4px;padding:16px;background:#f5f5f5;text-align:center;">
        <div style="font-weight:600;color:#666;margin-bottom:8px;">3D Model</div>
        <div style="font-size:12px;color:#999;margin-bottom:12px;word-break:break-all;">${modelUrl}</div>
        <div style="font-size:11px;color:#999;padding:8px;border-top:1px solid #ddd;margin-top:8px;">
          3D models are embedded as references. Use a model viewer to interact with it in exported documents.
        </div>
      </div>`;
      
      editor.chain().focus().insertContent(html).run();
      toast('3D model reference inserted', 'success');
      closeDialog('insert3DModel');
      setModelUrl('');
    } catch (err) {
      toast(`Failed to insert 3D model: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Insert 3D Model" onClose={() => closeDialog('insert3DModel')} width={450}>
      <Stack gap={12}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
            Model URL
          </label>
          <Input
            placeholder="https://example.com/model.glb"
            value={modelUrl}
            onChange={(e) => setModelUrl(e.target.value)}
            disabled={loading}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Supported formats: .glb, .gltf, .obj, .fbx<br/>
            Also supports Sketchfab links
          </div>
        </div>

        <div style={{ padding: 12, background: '#f9f9f9', borderRadius: 4, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong>Note:</strong> 3D model embedding requires external viewers. The model will be embedded as a reference that can be opened in 3D viewers or model hosting platforms.
        </div>

        <Stack gap={8} direction="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('insert3DModel')} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={loading || !modelUrl.trim()}>
            {loading ? 'Inserting…' : 'Insert'}
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
