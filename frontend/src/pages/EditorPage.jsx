// ═══════════════════════════════════════════════════════════════
//  EditorPage — Main editor layout
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { TitleBar }       from '@/components/editor/TitleBar';
import { Ribbon }         from '@/components/toolbar/Ribbon';
import { PageSidebar }    from '@/components/sidebar/PageSidebar';
import { PragnaChatSidebar } from '@/components/sidebar/PragnaChatSidebar';
import { EditorCanvas }   from '@/components/editor/EditorCanvas';
import { StatusBar }      from '@/components/editor/StatusBar';
import { DialogManager }  from '@/components/dialogs/DialogManager';
import { ToastContainer } from '@/components/ui/Toast';
import { useAutoSave }    from '@/hooks/useAutoSave';
import { useCollaboration } from '@/hooks/useCollaboration';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePagination }  from '@/hooks/usePagination';
import { useClipboardListener } from '@/hooks/useClipboardListener';
import { useUIStore, useDocumentStore, useCollaborationStore } from '@/store';
import { documentApi } from '@/services/api';

function getDefaultPageColor() {
  return '#1a1a1a';
}

export function EditorPage({ isShared = false }) {
  const { id: routeId } = useParams();
  const fullscreen = useUIStore((s) => s.fullscreen);
  // Store actions — read once into refs so they never appear in deps
  const reset = useDocumentStore((s) => s.reset);
  const hydrateDocument = useDocumentStore((s) => s.hydrateDocument);
  const setId = useDocumentStore((s) => s.setId);
  const documentId = useDocumentStore((s) => s.id);
  const toast = useUIStore((s) => s.toast);
  const enableCollaboration = useCollaborationStore((s) => s.enableCollaboration);
  const disableCollaboration = useCollaborationStore((s) => s.disableCollaboration);

  // Stable refs for actions — prevents stale-closure issues without
  // adding the action functions to the useEffect dependency array
  // (Zustand actions are stable, but inline selectors create new fn
  //  references each render which would cause an infinite loop)
  const actionsRef = useRef({ reset, hydrateDocument, setId, toast });
  useEffect(() => {
    actionsRef.current = { reset, hydrateDocument, setId, toast };
  });

  const { save } = useAutoSave();
  useKeyboardShortcuts();
  usePagination();
  useClipboardListener();
  
  // For shared documents, always use routeId; for owned, use stored documentId
  const activeDocId = isShared ? routeId : (routeId && routeId !== 'new' ? routeId : documentId);
  useCollaboration(activeDocId && activeDocId !== 'new' ? activeDocId : null);

  useEffect(() => {
    if (activeDocId && activeDocId !== 'new') {
      enableCollaboration();
    } else {
      disableCollaboration();
    }
  }, [activeDocId, disableCollaboration, enableCollaboration]);

  // Load doc when routeId / isShared / documentId changes.
  // Actions are accessed via actionsRef to avoid adding them as deps
  // (which would cause an infinite re-render loop).
  useEffect(() => {
    const { reset, hydrateDocument, setId, toast } = actionsRef.current;
    const docIdToLoad = isShared ? routeId : (routeId && routeId !== 'new' ? routeId : documentId);
    
    if (docIdToLoad && docIdToLoad !== 'new') {
      console.log(`📖 Loading document: ${docIdToLoad} (${isShared ? 'shared' : 'owned'})`);
      setId(docIdToLoad);
      documentApi
        .get(docIdToLoad)
        .then((doc) => {
          console.log(`✅ Document loaded: "${doc?.title}" (${doc?.content?.length || 0} chars)`);
          hydrateDocument(doc);
          if (isShared) {
            toast('✨ Joined document for real-time collaboration', 'success');
          }
        })
        .catch((err) => {
          console.error(`❌ Failed to load document ${docIdToLoad}:`, err?.message);
          if (isShared) {
            toast('Failed to load shared document', 'error');
          }
        });
    } else if (!isShared && !documentId) {
      // Only create new document for authenticated users
      console.log('📝 Creating new blank document...');
      reset();
      documentApi
        .create({
          title: 'Untitled Document',
          content: '<p></p>',
          design: { pageColor: getDefaultPageColor(), pageColorMode: 'theme' },
        })
        .then((created) => {
          const newId = String(created?.id || created?._id || '');
          if (newId) {
            console.log(`✅ Document created: ${newId}`);
            setId(newId);
            window.history.replaceState(null, '', `/doc/${newId}`);
          }
        })
        .catch((err) => {
          console.warn(`⚠️  Could not create document on backend:`, err?.message);
        });
    }
  // ✅ Only the actual data values that should trigger a reload
  }, [routeId, isShared, documentId]);

  return (
    <div style={{
      height: '100vh', width: '100vw',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg-app)',
      ...(fullscreen ? { position:'fixed', inset:0, zIndex:9000 } : {}),
    }}>
      {/* Title bar */}
      <TitleBar onSave={save} />

      {/* Ribbon */}
      <Ribbon />

      {/* Body: sidebar + canvas + AI Copilot chat */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>
        <PageSidebar />
        <EditorCanvas />
        <PragnaChatSidebar />
      </div>

      {/* Status bar */}
      <StatusBar />

      {/* Dialogs (portal-like, fixed positioning) */}
      <DialogManager />

      {/* Toasts */}
      <ToastContainer />
    </div>
  );
}
