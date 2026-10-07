import { useEffect, useRef } from 'react';
import { useCollaborationStore, useDocumentStore, useEditorStore, useUIStore } from '@/store';
import { getCollab, initCollab } from '@/services/websocket';
import { stripAutoPageBreaks } from '@/components/editor/PageBreak';

const CHANGE_DEBOUNCE_MS = 500;
const COMMENT_DEBOUNCE_MS = 250;

function commentsKey(comments) {
  return JSON.stringify(
    (comments || []).map((comment) => ({
      id: comment.id,
      text: comment.text,
      resolved: comment.resolved,
    })),
  );
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
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
      setTypingUsers([]);
      return undefined;
    }


    const collab = initCollab(docId);
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
      if (typeof documentState.content === 'string') {
        const cleaned = stripAutoPageBreaks(documentState.content);
        suppressNextContentBroadcast.current = cleaned;
        useDocumentStore.getState().applyRemoteUpdate({ ...documentState, content: cleaned });
        lastSentContent.current = cleaned;
      }
      if (Array.isArray(documentState.comments)) {
        const key = commentsKey(documentState.comments);
        suppressNextCommentBroadcast.current = key;
        useDocumentStore.getState().replaceComments(documentState.comments);
        lastSentComments.current = key;
      }
      setCollaborators(data.collaborators || []);
      if (Number.isFinite(Number(documentState.revision))) {
        setRevision(Number(documentState.revision));
      }
      setLastSyncedAt(new Date());
    });

    const offPresence = collab.on('presence', (data) => {
      setCollaborators(data?.collaborators || []);

      // Typing indicator: treat presence updates as activity for the sender.
      try {
        const remoteUser = data?.user || {};
        const remoteSessionId = remoteUser?.id || remoteUser?.sessionId || data?.uid || remoteUser?.uid;
        if (remoteSessionId && remoteSessionId !== collab.sessionId) {
          const timers = typingTimersRef.current;
          const key = remoteSessionId;
          if (timers.has(key)) clearTimeout(timers.get(key));
          const timeoutId = setTimeout(() => {
            const nowTyping = Array.from(typingTimersRef.current.keys()).filter((k) => k !== key);
            setTypingUsers(nowTyping.map((sid) => ({ sessionId: sid, name: sid })));
          }, 1200);
          timers.set(key, timeoutId);
          const currentTyping = Array.from(timers.keys()).map((sid) => ({ sessionId: sid, name: sid }));
          setTypingUsers(currentTyping);
        }
      } catch {
        // ignore typing indicator errors
      }
    });


    const offChange = collab.on('change', (data) => {
      if (!data || data.sessionId === collab.sessionId) return;
      const nextDocument = data.payload || {};

      // Typing indicator: mark remote collaborator as typing briefly when changes arrive.
      try {
        const remoteUser = data?.user || {};
        const remoteSessionId = remoteUser?.id || remoteUser?.sessionId || data?.uid || remoteUser?.uid;
        const typingName = remoteUser?.name || data?.userName || 'Someone';
        if (remoteSessionId && remoteSessionId !== collab.sessionId) {
          const timers = typingTimersRef.current;
          const key = remoteSessionId;
          if (timers.has(key)) clearTimeout(timers.get(key));
          const timeoutId = setTimeout(() => {
            const nowTyping = Array.from(typingTimersRef.current.keys()).filter((k) => k !== key);
            // Store expects objects; keep minimal shape.
            setTypingUsers(nowTyping.map((sid) => ({ sessionId: sid, name: sid })));
          }, 1800);
          timers.set(key, timeoutId);

          const currentTyping = Array.from(timers.keys()).map((sid) => ({ sessionId: sid, name: sid }));
          setTypingUsers(currentTyping);
        }
      } catch {
        // ignore typing indicator errors
      }

      const currentRevision = Number(useDocumentStore.getState().revision || 0);
      const incomingRevision = Number(nextDocument.revision ?? data.revision);
      const currentContent = useDocumentStore.getState().content;

      if (typeof nextDocument.content === 'string') {
        const cleanedContent = stripAutoPageBreaks(nextDocument.content);
        // Only drop if content is identical and revision is not newer
        if (cleanedContent === currentContent && Number.isFinite(incomingRevision) && incomingRevision <= currentRevision) {
          return;
        }
        suppressNextContentBroadcast.current = cleanedContent;
        useDocumentStore.getState().applyRemoteUpdate({ ...nextDocument, content: cleanedContent });
        lastSentContent.current = cleanedContent;
        setLastRemoteEditAt(new Date(nextDocument.updatedAt || Date.now()));
      } else {
        useDocumentStore.getState().applyRemoteUpdate(nextDocument);
      }

      if (Array.isArray(nextDocument.comments)) {
        const key = commentsKey(nextDocument.comments);
        suppressNextCommentBroadcast.current = key;
        useDocumentStore.getState().replaceComments(nextDocument.comments);
        lastSentComments.current = key;
      }
      if (Number.isFinite(incomingRevision)) {
        setRevision(incomingRevision);
      }
    });

    const offComment = collab.on('comment', (data) => {
      if (!data || data.sessionId === collab.sessionId) return;
      if (!Array.isArray(data.payload?.comments)) return;

      const currentRevision = Number(useDocumentStore.getState().revision || 0);
      const incomingRevision = Number(data.payload?.revision ?? data.revision);
      if (Number.isFinite(incomingRevision) && incomingRevision <= currentRevision) return;

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

    const offConflict = collab.on('conflict', ({ document: latestDocument }) => {
      if (latestDocument && typeof latestDocument === 'object') {
        const cleanedContent = typeof latestDocument.content === 'string' ? stripAutoPageBreaks(latestDocument.content) : '';
        suppressNextContentBroadcast.current = cleanedContent;
        suppressNextCommentBroadcast.current = commentsKey(latestDocument.comments || []);
        useDocumentStore.getState().applyRemoteUpdate({ ...latestDocument, content: cleanedContent });
        useDocumentStore.getState().replaceComments(latestDocument.comments || []);
        if (Number.isFinite(Number(latestDocument.revision))) {
          setRevision(Number(latestDocument.revision));
        }
        lastSentContent.current = cleanedContent;
        lastSentComments.current = commentsKey(latestDocument.comments || []);
      }
      toast('Synced latest version after simultaneous edits', 'warning');
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
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
      setTypingUsers([]);
    };

  }, [docId, collaborationEnabled, configureSession, resetCollaboration, setCollaborators, setConnected, setLastRemoteEditAt, setLastSyncedAt, setRevision, toast]);

  useEffect(() => {
    const collab = getCollab();
    if (!docId || !collab) return undefined;
    if (suppressNextContentBroadcast.current === content) {
      suppressNextContentBroadcast.current = null;
      return undefined;
    }
    if (content === lastSentContent.current) return undefined;

    clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => {
      collab.broadcastChange({
        title,
        content,
        comments: useDocumentStore.getState().comments,
        trackChanges,
        baseRevision: Number(useDocumentStore.getState().revision || 0),
        updatedAt: new Date().toISOString(),
      });
      lastSentContent.current = content;
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
