import { useState, useRef } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Input, Label, Stack } from '@/components/ui';
import { uploadApi } from '@/services/api';
import { insertDocumentImage } from '@/utils/insertDocumentImage';

export function InsertImageDialog() {
   const { closeDialog, toast } = useUIStore();
   const { editor } = useEditorStore();
   const [tab,   setTab]   = useState('upload'); // 'upload' | 'url'
   const [url,   setUrl]   = useState('');
   const [alt,   setAlt]   = useState('');
   const [loading, setLoading] = useState(false);
   const fileRef = useRef();

   const insertUrl = () => {
     if (!url.trim()) return;
     try {
       if (!insertDocumentImage(editor, { src: url.trim(), alt, width: '360' })) throw new Error('Editor not ready');
       closeDialog('insertImage');
     } catch (err) {
       console.error('Error inserting image from URL:', err);
       toast('Failed to insert image', 'error');
     }
   };

   const handleFile = async (file) => {
     if (!file) return;
     setLoading(true);
     try {
       // Try server upload; fall back to base64 preview
       let src;
       try {
         const res = await uploadApi.image(file);
         src = res.url;
       } catch {
         src = await fileToBase64(file);
       }
       if (!insertDocumentImage(editor, { src, alt: alt || file.name, width: '360' })) throw new Error('Editor not ready');
       closeDialog('insertImage');
     } catch (err) {
       console.error('Image upload/insert error:', err);
       toast('Image upload failed', 'error');
     } finally {
       setLoading(false);
     }
   };

  return (
    <Modal title="Insert Image" onClose={() => closeDialog('insertImage')} width={460}>
      {/* Tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'1px solid var(--border)' }}>
        {['upload','url'].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background:'none', border:'none', borderBottom: tab===t ? '2px solid var(--gold)' : '2px solid transparent',
            color: tab===t ? 'var(--gold)' : 'var(--text-secondary)',
            fontFamily:'var(--font-ui)', fontSize:12, fontWeight: tab===t ? 700:400,
            padding:'6px 16px', cursor:'pointer', textTransform:'uppercase', letterSpacing:'.06em',
          }}>{t === 'upload' ? '⬆ Upload' : '🔗 From URL'}</button>
        ))}
      </div>

      <Stack gap={14}>
        {tab === 'upload' ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed var(--border-gold)', borderRadius: 'var(--radius-md)',
              padding: '36px 20px', textAlign: 'center', cursor: 'pointer',
              background: 'var(--gold-dim)', transition: 'var(--transition)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-gold)')}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={(e) => handleFile(e.target.files[0])} />
            <div style={{ fontSize:32, marginBottom:8 }}>🖼</div>
            <div style={{ fontFamily:'var(--font-ui)', color:'var(--text-secondary)', fontSize:13 }}>
              {loading ? 'Uploading…' : 'Drop image here or click to browse'}
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>PNG, JPG, GIF, WebP</div>
          </div>
        ) : (
          <>
            <div><Label>Image URL</Label><Input value={url} onChange={setUrl} placeholder="https://example.com/image.png" autoFocus /></div>
          </>
        )}

        <div><Label>Alt Text (optional)</Label><Input value={alt} onChange={setAlt} placeholder="Describe the image…" /></div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('insertImage')}>Cancel</Button>
          <Button variant="primary" onClick={tab === 'url' ? insertUrl : () => fileRef.current?.click()}
            disabled={loading || (tab==='url' && !url.trim())}>
            {loading ? 'Uploading…' : '✓ Insert'}
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
