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
import { useUIStore, useDocumentStore, useCollaborationStore, useSubscriptionStore, getDefaultLayout } from '@/store';
import { documentApi } from '@/services/api';
import { readLocalDraft, writeLocalDraft } from '@/utils/draftStorage';

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
  const { save } = useAutoSave();
  const loadedDocIdRef = useRef(null);

  // Stable refs for actions — prevents stale-closure issues without
  // adding the action functions to the useEffect dependency array
  const actionsRef = useRef({ reset, hydrateDocument, setId, toast, save });
  useEffect(() => {
    actionsRef.current = { reset, hydrateDocument, setId, toast, save };
  });

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

  // Sync store with native fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      useUIStore.setState({ fullscreen: isFs });
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Load doc when routeId / isShared / documentId changes.
  useEffect(() => {
    const { reset, hydrateDocument, setId, toast, save: triggerSave } = actionsRef.current;
    const docIdToLoad = isShared ? routeId : (routeId && routeId !== 'new' ? routeId : documentId);
    
    if (docIdToLoad && docIdToLoad !== 'new') {
      // Prevent redundant refetches if this exact document is already active in memory
      if (loadedDocIdRef.current === docIdToLoad) {
        return;
      }

      console.log(`📖 Loading document: ${docIdToLoad} (${isShared ? 'shared' : 'owned'})`);
      setId(docIdToLoad);
      loadedDocIdRef.current = docIdToLoad;

      documentApi
        .get(docIdToLoad)
        .then((doc) => {
          console.log(`✅ Document loaded: "${doc?.title}" (${doc?.content?.length || 0} chars)`);
          
          // Reconcile with any unsaved local draft from a recent refresh or edit session
          const localDraft = readLocalDraft(docIdToLoad);
          let finalDoc = doc;
          let hasUnsavedDraft = false;

          if (localDraft && localDraft.isDirty) {
            const draftTime = localDraft.updatedAt ? new Date(localDraft.updatedAt).getTime() : 0;
            const serverTime = doc?.updatedAt ? new Date(doc.updatedAt).getTime() : 0;

            if (draftTime >= serverTime) {
              console.log('🔄 Restoring unsaved edits from local draft for document:', docIdToLoad);
              finalDoc = {
                ...doc,
                title: localDraft.title || doc?.title,
                content: localDraft.content !== undefined ? localDraft.content : doc?.content,
                contentJson: localDraft.contentJson !== undefined ? localDraft.contentJson : doc?.contentJson,
                design: localDraft.design ? { ...(doc?.design || {}), ...localDraft.design } : doc?.design,
                headerFooter: localDraft.headerFooter ? { ...(doc?.headerFooter || {}), ...localDraft.headerFooter } : doc?.headerFooter,
                layout: localDraft.layout ? { ...(doc?.layout || {}), ...localDraft.layout } : doc?.layout,
                styles: Array.isArray(localDraft.styles) ? localDraft.styles : doc?.styles,
                references: localDraft.references || doc?.references,
              };
              hasUnsavedDraft = true;
            }
          }

          hydrateDocument(finalDoc);

          if (hasUnsavedDraft) {
            useDocumentStore.setState({ isDirty: true, updatedAt: new Date() });
            triggerSave?.({ manual: false })?.catch?.(() => {});
          }

          if (isShared) {
            toast('✨ Joined document for real-time collaboration', 'success');
          }
        })
        .catch((err) => {
          console.error(`❌ Failed to load document ${docIdToLoad}:`, err?.message);
          // Offline fallback: restore from local draft if server is unreachable
          const localDraft = readLocalDraft(docIdToLoad);
          if (localDraft) {
            console.log('📦 Restoring offline backup for document:', docIdToLoad);
            hydrateDocument(localDraft);
            toast('Loaded offline document backup', 'info');
            return;
          }
          if (isShared) {
            toast('Failed to load shared document', 'error');
          }
        });
    } else if (!isShared && !documentId) {
      // If store already contains preloaded template content, preserve it
      const storeState = useDocumentStore.getState();
      const hasPreloadedContent = storeState.content && storeState.content !== '<p></p>' && storeState.content !== '';
      const initialTitle = storeState.title && storeState.title !== 'Untitled Document' ? storeState.title : 'Untitled Document';
      const initialContent = hasPreloadedContent ? storeState.content : '<p></p>';

      if (!hasPreloadedContent) {
        reset();
      }

      // Only create new document for authenticated users
      console.log('📝 Creating document on backend...', initialTitle);
      documentApi
        .create({
          title: initialTitle,
          content: initialContent,
          design: { pageColor: getDefaultPageColor(), pageColorMode: 'theme' },
          layout: getDefaultLayout(),
        })
        .then((created) => {
          const newId = String(created?.id || created?._id || '');
          if (newId) {
            console.log(`✅ Document created: ${newId}`);
            loadedDocIdRef.current = newId;
            setId(newId);
            window.history.replaceState(null, '', `/doc/${newId}`);
            const currentStore = useDocumentStore.getState();
            if (currentStore.isDirty) {
              writeLocalDraft(newId, currentStore);
              triggerSave?.({ manual: false })?.catch?.(() => {});
            }
          }
        })
        .catch((err) => {
          console.warn(`⚠️  Could not create document on backend:`, err?.message);
        });
    }
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
      <TitleBar onSave={() => save({ manual: true })} />

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
