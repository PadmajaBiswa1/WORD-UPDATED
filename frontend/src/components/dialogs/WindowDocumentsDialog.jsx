import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useDocumentStore } from '@/store';
import { Modal, Button } from '@/components/ui';
import { documentApi } from '@/services/api';

// View > View Side by Side ("Compare Side by Side with") and View > Switch
// Windows: pick one of your documents.
export function WindowDocumentsDialog({ mode }) {
  const { closeDialog, setSidePane, toast } = useUIStore();
  const currentId = useDocumentStore((s) => s.id);
  const navigate = useNavigate();
  const [docs, setDocs] = useState(null);
  const name = mode === 'switch' ? 'switchWindows' : 'sideBySide';
  const close = () => closeDialog(name);

  useEffect(() => {
    documentApi.list()
      .then((data) => setDocs((data?.documents || data || []).filter((d) => d.id !== currentId)))
      .catch((err) => { toast(`Could not load documents: ${err.message}`, 'error'); setDocs([]); });
  }, [currentId, toast]);

  const pick = (doc) => {
    close();
    if (mode === 'switch') navigate(`/doc/${doc.id}`);
    else setSidePane({ kind: 'doc', id: doc.id, title: doc.title });
  };

  return (
    <Modal title={mode === 'switch' ? 'Switch Windows' : 'Compare Side by Side'} onClose={close} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{mode === 'switch' ? 'Open another of your documents:' : 'Show this document side by side with:'}</div>
        <div role="listbox" aria-label="Documents" style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {!docs && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>}
          {docs && !docs.length && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>You have no other documents.</div>}
          {docs?.map((doc) => (
            <button key={doc.id} type="button" role="option" aria-selected="false" onClick={() => pick(doc)}
              style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
              {doc.title || 'Untitled Document'}
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : ''}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={close}>Cancel</Button></div>
      </div>
    </Modal>
  );
}
