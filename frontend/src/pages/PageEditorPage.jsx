import { TitleBar } from '@/components/editor/TitleBar';
import { Ribbon } from '@/components/toolbar/Ribbon';
import { PageSidebarNav } from '@/components/sidebar/PageSidebarNav';
import { PragnaChatSidebar } from '@/components/sidebar/PragnaChatSidebar';
import { PageEditor } from '@/components/editor/PageEditor';
import { PageStatusBar } from '@/components/editor/PageStatusBar';
import { DialogManager } from '@/components/dialogs/DialogManager';
import { ToastContainer } from '@/components/ui/Toast';
import { useUIStore, useDocumentStore } from '@/store';
import { documentApi } from '@/services/api';
import { upsertLocalDoc } from '@/services/storageFallback';

export function PageEditorPage() {
  const fullscreen = useUIStore((s) => s.fullscreen);
  const toast = useUIStore((s) => s.toast);

  const handleSave = async () => {
    const store = useDocumentStore.getState();
    const { id, title, content, contentJson, setSaving, setLastSaved, setIsDirty } = store;
    try {
      setSaving(true);
      if (id) {
        try {
          await documentApi.save(id, { title, content, contentJson });
        } catch (err) {
          console.warn('Backend save deferred to local backup:', err);
        }
      }
      upsertLocalDoc({
        id: id || 'doc_current',
        title: title || 'Untitled Document',
        content: content || '<p></p>',
        updatedAt: new Date().toISOString(),
      });
      setIsDirty(false);
      setLastSaved(new Date());
      toast('Document saved', 'success');
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-app)',
        ...(fullscreen ? { position: 'fixed', inset: 0, zIndex: 9000 } : {}),
      }}
    >
      <TitleBar onSave={handleSave} />
      <Ribbon />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <PageSidebarNav />
        <PageEditor />
        <PragnaChatSidebar />
      </div>

      <PageStatusBar />
      <DialogManager />
      <ToastContainer />
    </div>
  );
}
