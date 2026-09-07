import { TitleBar } from '@/components/editor/TitleBar';
import { Ribbon } from '@/components/toolbar/Ribbon';
import { PageSidebarNav } from '@/components/sidebar/PageSidebarNav';
import { PragnaChatSidebar } from '@/components/sidebar/PragnaChatSidebar';
import { PageEditor } from '@/components/editor/PageEditor';
import { PageStatusBar } from '@/components/editor/PageStatusBar';
import { DialogManager } from '@/components/dialogs/DialogManager';
import { ToastContainer } from '@/components/ui/Toast';
import { useUIStore } from '@/store';

export function PageEditorPage() {
  const fullscreen = useUIStore((s) => s.fullscreen);

  const handleSave = () => {
    console.log('Save triggered');
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
