import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Zap, Check, Copy, Info, Lock } from 'lucide-react';
import { useUIStore, useDocumentStore, useCollaborationStore, useSubscriptionStore } from '@/store';
import { Modal, Button, Label, Stack } from '@/components/ui';
import { documentApi } from '@/services/api';

function getCollaboratorColor(index) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
  return colors[index % colors.length];
}

function buildSharedUrl(docId) {
  return `${window.location.origin}/shared/${docId}`;
}

async function copyTextToClipboard(value) {
  const text = String(value || '');
  if (!text) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Continue with the legacy fallback below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    textarea.remove();
  }
  return copied;
}

export function ShareDialog({
  documentId: propDocId,
  documentTitle: propTitle,
  documentContent: propContent,
  onClose: propOnClose,
  initialRole = 'editor',
} = {}) {
  const { id: routeId } = useParams();
  const { closeDialog, toast } = useUIStore();
  const { id, title: storeTitle, content: storeContent, setId, setLastSaved } = useDocumentStore();
  const { collaborators, connected, enableCollaboration } = useCollaborationStore();
  const { plan, openUpgradeModal } = useSubscriptionStore();
  const [internalDocId, setInternalDocId] = useState(propDocId || null);

  useEffect(() => {
    if (propDocId) {
      setInternalDocId(propDocId);
    }
  }, [propDocId]);

  const activeDocumentId = internalDocId || propDocId || routeId || id;
  const docTitle = propTitle || storeTitle || 'Untitled Document';
  const docContent = propContent || storeContent || '<p></p>';
  const [copied, setCopied] = useState(false);
  const role = initialRole;
  const [working, setWorking] = useState(false);
  const [invitedCollaborators, setInvitedCollaborators] = useState([]);

  const handleClose = () => {
    if (propOnClose) propOnClose();
    closeDialog('shareDoc');
  };

  const shareUrl = (activeDocumentId && !String(activeDocumentId).startsWith('local-') && activeDocumentId !== 'new')
    ? buildSharedUrl(activeDocumentId)
    : 'A share link will be generated when you click Copy Link.';

  const loadInvitedCollaborators = async (docId) => {
    if (!docId) {
      setInvitedCollaborators([]);
      return;
    }
    try {
      const document = await documentApi.get(docId);
      const shared = Array.isArray(document?.sharedWith)
        ? document.sharedWith
        : Array.isArray(document?.document?.sharedWith)
          ? document.document.sharedWith
          : [];
      setInvitedCollaborators(shared);
    } catch {
      setInvitedCollaborators([]);
    }
  };

  useEffect(() => {
    enableCollaboration();
  }, [enableCollaboration]);

  useEffect(() => {
    if (!activeDocumentId) {
      setInvitedCollaborators([]);
      return;
    }
    loadInvitedCollaborators(activeDocumentId);
  }, [activeDocumentId]);

  const displayedCollaborators = useMemo(() => {
    const active = (collaborators || []).map((person) => ({
      key: person.sessionId || person.id || person.email || person.name,
      title: person.name || person.email || 'Guest User',
      subtitle: person.role || 'editor',
      status: person.status || 'active',
      isInvite: false,
    }));

    const activeEmails = new Set(
      active
        .map((person) => (person.title || '').toLowerCase())
        .filter(Boolean),
    );

    const invited = (invitedCollaborators || [])
      .filter((invite) => invite?.email)
      .filter((invite) => !activeEmails.has(String(invite.email).toLowerCase()))
      .map((invite) => ({
        key: invite.id || invite.email,
        title: invite.email,
        subtitle: invite.role || 'viewer',
        status: 'invited',
        isInvite: true,
      }));

    return [...active, ...invited];
  }, [collaborators, invitedCollaborators]);

  const ensureShareableDocument = async () => {
    if (activeDocumentId && !String(activeDocumentId).startsWith('local-') && activeDocumentId !== 'new') {
      return activeDocumentId;
    }
    
    try {
      const created = await documentApi.create({ title: docTitle, content: docContent });
      const newId = String(created?.id || created?._id || created?.document?.id || created?.document?._id || '');
      if (!newId) throw new Error('The document could not be created');
      setInternalDocId(newId);
      setId(newId);
      if (created?.updatedAt) setLastSaved(created.updatedAt);
      await loadInvitedCollaborators(newId);
      if (window.location.pathname.startsWith('/doc/')) {
        window.history.replaceState(null, '', `/doc/${newId}`);
      }
      return newId;
    } catch (error) {
      console.error('Failed to create shareable document:', error);
      throw error;
    }
  };

  const copyLink = async () => {
    if (plan === 'free') {
      openUpgradeModal('Single-user editing only on Free tier. Upgrade to Basic for up to 3 collaborators or Pro for unlimited real-time collaboration.', 'basic');
      return;
    }
    if (working || copied) return; // Prevent multiple simultaneous clicks
    setWorking(true);
    try {
      setCopied(false); // Reset state first
      const docId = await ensureShareableDocument();
      const response = await documentApi.share(docId, { role });
      const nextUrl = response?.shareUrl || buildSharedUrl(docId);
      const copiedToClipboard = await copyTextToClipboard(nextUrl);
      if (!copiedToClipboard) throw new Error('Clipboard access was denied');
      setCopied(true);
      toast('Share link copied to clipboard', 'success');
      
      // Reset "copied" state after 2 seconds for re-click
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopied(false);
      toast('Unable to prepare a shared document right now', 'error');
      console.error('Copy link error:', err);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title="Share Document" onClose={handleClose} width={480}>
      <Stack gap={16}>
        {plan === 'free' ? (
          <div style={{
            padding: '12px 14px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Lock size={13} /> Free Plan: Single-User Editing
              </div>
              <div style={{ fontSize: 11, color: '#f87171' }}>
                Real-time collaboration is locked on Free. Upgrade to Basic for up to 3 collaborators or Pro for unlimited.
              </div>
            </div>
            <button
              type="button"
              onClick={() => openUpgradeModal('Upgrade to collaborate with others in real time.', 'basic')}
              style={{
                padding: '6px 12px',
                background: '#c9a84c',
                color: '#000',
                fontWeight: 700,
                fontSize: 11,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Upgrade
            </button>
          </div>
        ) : plan === 'basic' ? (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(79, 195, 247, 0.1)',
            border: '1px solid rgba(79, 195, 247, 0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
          }}>
            <span style={{ color: '#4fc3f7', fontWeight: 600 }}>
              Basic Plan: {invitedCollaborators.length} of 3 collaborators used
            </span>
            {invitedCollaborators.length >= 3 && (
              <button
                type="button"
                onClick={() => openUpgradeModal('Upgrade to Pro for unlimited real-time collaborators.', 'pro')}
                style={{
                  padding: '4px 8px',
                  background: '#c9a84c',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: 10,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        ) : null}

        <div style={{ padding:'14px 16px', background:'rgba(201, 168, 76, 0.1)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-gold)' }}>
          <div style={{ fontFamily:'var(--font-ui)', fontSize:12, fontWeight:700, color:'var(--text-gold)', marginBottom: 4, display:'flex', alignItems:'center', gap:5 }}>
            <Zap size={13} fill="currentColor" /> Real-Time Collaboration
          </div>
          <div style={{ fontFamily:'var(--font-ui)', fontSize:11, color:'var(--text-primary)', marginBottom: 8 }}>
            {connected 
              ? `Live collaboration is active. ${collaborators.length} ${collaborators.length === 1 ? 'person is' : 'people are'} editing. Both users see changes instantly.`
              : 'Share this document to start live collaboration. Collaborators will see all edits in real-time.'}
          </div>
          {collaborators.length > 0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {collaborators.map((person, index) => (
                <div
                  key={person.sessionId || `${person.name}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: getCollaboratorColor(index), display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                    {(person.name || 'G').slice(0, 1).toUpperCase()}
                  </span>
                  {person.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Link share */}
        <div>
          <Label>Share Link</Label>
          <div style={{ display:'flex', gap:6 }}>
            <div style={{
              flex:1, padding:'6px 10px', background:'var(--bg-elevated)',
              border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
              fontFamily:'var(--font-ui)', fontSize:12, color:'var(--text-secondary)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{shareUrl}</div>
            <Button 
              variant={copied ? 'primary' : 'outline'} 
              onClick={copyLink} 
              disabled={working}
              title="Copy share link to clipboard"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {copied ? <><Check size={13} strokeWidth={2} /> Copied!</> : <><Copy size={13} strokeWidth={1.75} /> Copy Link</>}
            </Button>
          </div>
          <div style={{ marginTop: 6, fontFamily:'var(--font-ui)', fontSize: 11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:5 }}>
            <Info size={13} style={{ flexShrink: 0, color: 'var(--text-gold)' }} />
            <span>Share this link with anyone to start collaborating instantly - no sign-up required. Changes are synchronized in real-time.</span>
          </div>
        </div>

        <div>
          <Label>Active Collaborators</Label>
          <div style={{ display:'grid', gap:8 }}>
            {displayedCollaborators.length === 0 ? (
              <div style={{ padding:'10px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:12, fontFamily:'var(--font-ui)', color:'var(--text-secondary)' }}>
                Nobody else is editing this document yet.
              </div>
            ) : displayedCollaborators.map((person) => (
              <div key={person.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontFamily:'var(--font-ui)', fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>{person.title}</div>
                  <div style={{ fontFamily:'var(--font-ui)', fontSize:11, color:'var(--text-secondary)' }}>{person.subtitle}</div>
                </div>
                <div style={{ fontFamily:'var(--font-ui)', fontSize:11, color:'var(--text-gold)' }}>
                  {person.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Access settings */}
        <div style={{ padding:'12px 14px', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'var(--font-ui)', fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
            <Lock size={13} /> Access Settings
          </div>
          <div style={{ fontFamily:'var(--font-ui)', fontSize:12, color:'var(--text-secondary)' }}>
            Anyone with the link can join this document. Use invited roles to guide whether they should view, comment, or edit.
          </div>
        </div>

        <Button variant="subtle" onClick={handleClose}>Done</Button>
      </Stack>
    </Modal>
  );
}
