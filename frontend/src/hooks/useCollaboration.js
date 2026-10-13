import { useEffect, useRef } from 'react';
import { useCollaborationStore, useDocumentStore, useEditorStore, useUIStore } from '@/store';
import { getCollab, initCollab } from '@/services/websocket';
import { stripAutoPageBreaks } from '@/components/editor/PageBreak';

const CHANGE_DEBOUNCE_MS = 500;
const COMMENT_DEBOUNCE_MS = 250;

function commentsKey(comments) {
  return JSON.stringify(comments || []);
}

function contentKey(document) {
  return JSON.stringify([stripAutoPageBreaks(document.content), document.title, document.trackChanges]);
}

export function useCollaboration(docId) {
  const editor = useEditorStore((s) => s.editor);
  const content = useDocumentStore((s) => s.content);
  const title = useDocumentStore((s) => s.title);
  const comments = useDocumentStore((s) => s.comments);
  const trackChanges = useDocumentStore((s) => s.trackChanges);
  const revision = useDocumentStore((s) => s.revision);
  const setRevision = useDocumentStore((s) => s.setRevision);
  const collaborationEnabled = useCollaborationStore((s) => s.collaborationEnabled);
  const setCollaborators = useCollaborationStore((s) => s.setCollaborators);
  const setTypingUsers = useCollaborationStore((s) => s.setTypingUsers);
  const setConnected = useCollaborationStore((s) => s.setConnected);
  const configureSession = useCollaborationStore((s) => s.configureSession);
  const setLastSyncedAt = useCollaborationStore((s) => s.setLastSyncedAt);
  const setLastRemoteEditAt = useCollaborationStore((s) => s.setLastRemoteEditAt);
  const resetCollaboration = useCollaborationStore((s) => s.reset);
  const toast = useUIStore((s) => s.toast);


  const suppressNextContentBroadcast = useRef(null);
  const suppressNextCommentBroadcast = useRef(null);
  const lastSentContent = useRef('');
  const lastSentComments = useRef('');
  const changeTimer = useRef(null);
  const commentTimer = useRef(null);

  const typingTimersRef = useRef(new Map());

  useEffect(() => {
    if (!docId || !collaborationEnabled) {
      resetCollaboration();
      typingTimersRef.current.forEach((entry) => clearTimeout(entry.timer));
      typingTimersRef.current.clear();
      setTypingUsers([]);
      return undefined;
    }


    const collab = initCollab(docId);
    const markTyping = (data, duration) => {
      const user = data?.user || {};
      const sessionId = data?.sessionId || user.sessionId || user.id || data?.uid;
      if (!sessionId || sessionId === collab.sessionId) return;
      const timers = typingTimersRef.current;
      if (timers.has(sessionId)) clearTimeout(timers.get(sessionId).timer);
      const refresh = () => setTypingUsers(Array.from(timers, ([id, entry]) => ({ sessionId: id, name: entry.name })));
      const timer = setTimeout(() => { timers.delete(sessionId); refresh(); }, duration);
      timers.set(sessionId, { timer, name: user.name || sessionId });
      refresh();
    };
    configureSession({
      sessionId: collab.sessionId,
      userName: collab.user.name,
      role: collab.user.role,
    });

    const offConnected = collab.on('connected', () => {
      setConnected(true);
      setLastSyncedAt(new Date());
    });

    const offDisconnected = collab.on('disconnected', () => {
      setConnected(false);
    });

    const offSnapshot = collab.on('snapshot', (data) => {
      if (!data) return;
      const documentState = data.document || {};
      const currentStore = useDocumentStore.getState();
      if (!currentStore.isDirty) {
        const patch = { ...documentState };
        if (typeof patch.content === 'string') patch.content = stripAutoPageBreaks(patch.content);
        const key = contentKey({ ...currentStore, ...patch });
        suppressNextContentBroadcast.current = key;
        currentStore.applyRemoteUpdate(patch);
        lastSentContent.current = key;
        if (Array.isArray(patch.comments)) {
          const commentKey = commentsKey(patch.comments);
          suppressNextCommentBroadcast.current = commentKey;
          lastSentComments.current = commentKey;
        }
      }
      setCollaborators(data.collaborators || []);
      if (Number.isFinite(Number(documentState.revision))) {
        setRevision(Number(documentState.revision));
      }
      setLastSyncedAt(new Date());
    });

    const offPresence = collab.on('presence', (data) => {
      setCollaborators(data?.collaborators || []);

      markTyping(data, 1200);
    });


    const offChange = collab.on('change', (data) => {
      if (!data || data.sessionId === collab.sessionId) return;
      if (data.sessionId === 'rest-save' && data.user?.id && (data.user.id === collab.user?.id || data.user.email === collab.user?.email)) {
        return;
      }
      const nextDocument = data.payload || {};

      markTyping(data, 1800);

      const currentStore = useDocumentStore.getState();
      const currentRevision = Number(currentStore.revision || 0);
      const incomingRevision = Number(nextDocument.revision ?? data.revision);
      const currentContent = currentStore.content;

      if (Number.isFinite(incomingRevision) && incomingRevision <= currentRevision) {
        return;
      }

      // When the user has uncommitted local edits, never overwrite their active typing
      if (currentStore.isDirty) {
        if (Number.isFinite(incomingRevision)) {
          setRevision(incomingRevision);
        }
        return;
      }

      const patch = { ...nextDocument };
      if (typeof patch.content === 'string') patch.content = stripAutoPageBreaks(patch.content);
      if (Number.isFinite(incomingRevision)) patch.revision = incomingRevision;
      const key = contentKey({ ...currentStore, ...patch });
      suppressNextContentBroadcast.current = key;
      currentStore.applyRemoteUpdate(patch);
      lastSentContent.current = key;
      setLastRemoteEditAt(new Date(nextDocument.updatedAt || Date.now()));

      if (Array.isArray(nextDocument.comments)) {
        const key = commentsKey(nextDocument.comments);
        suppressNextCommentBroadcast.current = key;
        lastSentComments.current = key;
      }
    });

    const offComment = collab.on('comment', (data) => {
      if (!data || data.sessionId === collab.sessionId) return;
      if (!Array.isArray(data.payload?.comments)) return;

      const currentRevision = Number(useDocumentStore.getState().revision || 0);
      const incomingRevision = Number(data.payload?.revision ?? data.revision);
      if (Number.isFinite(incomingRevision) && incomingRevision <= currentRevision) return;
      if (useDocumentStore.getState().isDirty) {
        if (Number.isFinite(incomingRevision)) setRevision(incomingRevision);
        return;
      }

      const key = commentsKey(data.payload.comments);
      suppressNextCommentBroadcast.current = key;
      useDocumentStore.getState().replaceComments(data.payload.comments);
      lastSentComments.current = key;
      setLastRemoteEditAt(new Date());
      if (Number.isFinite(incomingRevision)) {
        setRevision(incomingRevision);
      }
    });

    const offAck = collab.on('ack', ({ type, result }) => {
      if (type !== 'change' && type !== 'comment') return;
      const nextRevision = Number(result?.revision ?? result?.document?.revision);
      if (Number.isFinite(nextRevision)) {
        setRevision(nextRevision);
      }
      setLastSyncedAt(new Date());
    });

    const offConflict = collab.on('conflict', ({ document: latestDocument, expectedRevision }) => {
      const currentStore = useDocumentStore.getState();
      const nextRevision = Number(expectedRevision ?? latestDocument?.revision);
      if (Number.isFinite(nextRevision)) {
        setRevision(nextRevision);
      }

      // CRITICAL: NEVER overwrite local content if user is currently editing or has uncommitted changes!
      // The user's typed changes must ALWAYS STAY!
      const currentContent = currentStore.content;
      const activeEditor = useEditorStore.getState().editor;
      const editorHtml = stripAutoPageBreaks(activeEditor ? activeEditor.getHTML() : currentContent);

      if (currentStore.isDirty || editorHtml !== (latestDocument?.content || '')) {
        // Re-broadcast local changes with the newly aligned revision so changes are persisted
        clearTimeout(changeTimer.current);
        changeTimer.current = setTimeout(() => {
          collab.broadcastChange({
            title: currentStore.title,
            content: editorHtml,
            comments: currentStore.comments,
            trackChanges: currentStore.trackChanges,
            baseRevision: nextRevision,
            updatedAt: new Date().toISOString(),
          });
          lastSentContent.current = contentKey({ ...currentStore, content: editorHtml });
        }, 150);
        return;
      }

      // Only if editor has no uncommitted changes, sync with remote
      if (latestDocument && typeof latestDocument === 'object') {
        const cleanedContent = typeof latestDocument.content === 'string' ? stripAutoPageBreaks(latestDocument.content) : '';
        if (cleanedContent && cleanedContent !== currentContent) {
          const key = contentKey({ ...currentStore, ...latestDocument, content: cleanedContent });
          suppressNextContentBroadcast.current = key;
          currentStore.applyRemoteUpdate({ ...latestDocument, content: cleanedContent });
          lastSentContent.current = key;
        }
      }
    });

    return () => {
      clearTimeout(changeTimer.current);
      clearTimeout(commentTimer.current);
      offConnected();
      offDisconnected();
      offSnapshot();
      offPresence();
      offChange();
      offComment();
      offAck();
      offConflict();
      collab.disconnect();
      resetCollaboration();
      typingTimersRef.current.forEach((entry) => clearTimeout(entry.timer));
      typingTimersRef.current.clear();
      setTypingUsers([]);
    };

  }, [docId, collaborationEnabled, configureSession, resetCollaboration, setCollaborators, setConnected, setLastRemoteEditAt, setLastSyncedAt, setRevision, toast]);

  useEffect(() => {
    const collab = getCollab();
    if (!docId || !collab) return undefined;
    const key = contentKey({ content, title, trackChanges });
    if (suppressNextContentBroadcast.current === key) {
      suppressNextContentBroadcast.current = null;
      return undefined;
    }
    if (key === lastSentContent.current) return undefined;

    clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => {
      collab.broadcastChange({
        title,
        content: stripAutoPageBreaks(content),
        comments: useDocumentStore.getState().comments,
        trackChanges,
        baseRevision: Number(useDocumentStore.getState().revision || 0),
        updatedAt: new Date().toISOString(),
      });
      lastSentContent.current = key;
      setLastSyncedAt(new Date());
    }, CHANGE_DEBOUNCE_MS);

    return () => clearTimeout(changeTimer.current);
  }, [content, docId, title, trackChanges, setLastSyncedAt]);

  useEffect(() => {
    const collab = getCollab();
    if (!docId || !collab) return undefined;
    const currentKey = commentsKey(comments);
    if (suppressNextCommentBroadcast.current === currentKey) {
      suppressNextCommentBroadcast.current = null;
      return undefined;
    }
    if (currentKey === lastSentComments.current) return undefined;

    clearTimeout(commentTimer.current);
    commentTimer.current = setTimeout(() => {
      collab.broadcastComment({
        comments: useDocumentStore.getState().comments,
        baseRevision: Number(useDocumentStore.getState().revision || 0),
        updatedAt: new Date().toISOString(),
      });
      lastSentComments.current = currentKey;
      setLastSyncedAt(new Date());
    }, COMMENT_DEBOUNCE_MS);

    return () => clearTimeout(commentTimer.current);
  }, [comments, docId, revision, setLastSyncedAt]);

  useEffect(() => {
    const collab = getCollab();
    if (!docId || !collab || !editor) return undefined;
    const emitPresence = () => {
      const selection = editor.state.selection;
      collab.broadcastPresence({
        cursor: {
          cursor: selection.head,
          from: selection.from,
          to: selection.to,
          anchor: selection.anchor,
          head: selection.head,
        },
        updatedAt: new Date().toISOString(),
      });
    };
    emitPresence();
    editor.on('selectionUpdate', emitPresence);
    return () => editor.off('selectionUpdate', emitPresence);
  }, [docId, editor]);
}
