import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Zap, Check, Copy, Info, Lock } from 'lucide-react';
import { useUIStore, useDocumentStore } from '@/store';
import { useCollaborationStore } from '@/store';
import { Modal, Button, Input, Label, Stack } from '@/components/ui';
import { documentApi } from '@/services/api';
import { sendInviteEmail } from '@/services/emailjs';
import { getStoredUser } from '@/services/api';

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

export function ShareDialog() {
  const { id: routeId } = useParams();
  const { closeDialog, toast } = useUIStore();
  const { id, title, content, setId, setLastSaved } = useDocumentStore();
  const { collaborators, connected, enableCollaboration } = useCollaborationStore();
  const activeDocumentId = routeId || id;
  const [copied, setCopied] = useState(false);
  const [email,  setEmail]  = useState('');
  const [role,   setRole]   = useState('viewer');
  const [working, setWorking] = useState(false);
  const [invitedCollaborators, setInvitedCollaborators] = useState([]);

  const shareUrl = activeDocumentId
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
    if (activeDocumentId) return activeDocumentId; // Current route/store document is shareable
    
    try {
      const created = await documentApi.create({ title, content });
      const newId = String(created?.id || created?._id || created?.document?.id || created?.document?._id || '');
      if (!newId) throw new Error('The document could not be created');
      setId(newId);
      if (created?.updatedAt) setLastSaved(created.updatedAt);
      await loadInvitedCollaborators(newId);
      // Update URL without navigation
      window.history.replaceState(null, '', `/doc/${newId}`);
      return newId;
    } catch (error) {
      console.error('Failed to create shareable document:', error);
      throw error;
    }
  };

  const copyLink = async () => {
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

  const inviteUser = async () => {
    const inviteEmail = email.trim().toLowerCase();
    if (!inviteEmail) {
      toast('Please enter an email address', 'warning');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast('Please enter a valid email address', 'error');
      return;
    }

    if (working) {
      toast('Please wait, processing previous invite...', 'info');
      return;
    }

    setWorking(true);
    try {
      console.log(`📧 Starting invite process for: ${inviteEmail}`);
      const docId = await ensureShareableDocument();
      console.log(`📄 Document ID: ${docId}`);
      
      let response;
      let shareError = null;
      
      try {
        response = await documentApi.share(docId, { email: inviteEmail, role });
        console.log(`📧 Share response successful:`, response);
      } catch (err) {
        console.error(`📧 Share request failed:`, err?.message, `(status: ${err?.status})`);
        shareError = err;
        
        // Only fall back when the server explicitly reports a missing route.
        // A document-level 404 should be shown as-is instead of being mislabeled
        // as an API route failure.
        if (err?.routeMissing && typeof documentApi.invite === 'function') {
          try {
            console.log(`📧 Attempting fallback to invite endpoint...`);
            response = await documentApi.invite(docId, { email: inviteEmail, role });
            console.log(`📧 Invite response successful:`, response);
            shareError = null; // Clear error since invite succeeded
          } catch (inviteErr) {
            console.error(`📧 Invite request also failed:`, inviteErr?.message);
            shareError = inviteErr;
          }
        }
        
        // If no fallback or fallback failed, throw the error
        if (shareError) throw shareError;
      }
      
      if (!response) throw new Error('No response from share request');
      console.log(`📧 Final share response:`, response);
      
      const sharedEmail = response?.share?.email || inviteEmail;

      // Update invited collaborators list
      if (Array.isArray(response?.sharedWith)) {
        setInvitedCollaborators(response.sharedWith);
        console.log(`✅ Collaborators updated:`, response.sharedWith);
      } else {
        await loadInvitedCollaborators(docId);
      }

      // Provide detailed feedback based on response
      let emailError = null;
      if (sharedEmail) {
        try {
          await sendInviteEmail({
            toEmail: sharedEmail,
            toName: sharedEmail,
            inviterName: getStoredUser().name || getStoredUser().email || 'A collaborator',
            documentTitle: title || 'Untitled Document',
            shareUrl: response?.shareUrl || buildSharedUrl(docId),
            role,
          });
        } catch (inviteEmailErr) {
          emailError = inviteEmailErr?.message || 'Email delivery failed';
          console.error('Invite email failed:', inviteEmailErr);
        }
      }

      if (response?.share) {
        if (emailError) {
          toast(`✓ ${sharedEmail} added as collaborator. Email could not be sent.`, 'warning');
        } else if (sharedEmail) {
          toast(`✓ Invitation email sent to ${sharedEmail}`, 'success');
        } else {
          toast(`✓ ${sharedEmail} added as collaborator`, 'success');
        }
      } else {
        toast(`✓ ${sharedEmail} has been invited`, 'success');
      }

      if (!emailError && sharedEmail) {
        console.log(`✅ Email invitation sent successfully`);
      }
      
      // Clear email field after successful invite
      setEmail('');
      console.log(`✅ Email field cleared, ready for next invite`);
    } catch (error) {
      const errorMsg = error?.message || 'Unknown error';
      console.error(`❌ Invite failed: ${errorMsg}`, error);
      toast(`Invite failed: ${errorMsg}`, 'error');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title="Share Document" onClose={() => closeDialog('shareDoc')} width={480}>
      <Stack gap={20}>
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

        {/* Invite */}
        <div>
          <Label>Invite by Email</Label>
          <div style={{ display:'flex', gap:6 }}>
            <Input value={email} onChange={setEmail} placeholder="colleague@company.com" style={{ flex:1 }} />
            <select value={role} onChange={(e) => setRole(e.target.value)}
              style={{ background:'var(--bg-elevated)', color:'var(--text-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'6px 8px', fontSize:12, fontFamily:'var(--font-ui)', outline:'none' }}>
              <option value="viewer">Viewer</option>
              <option value="commenter">Commenter</option>
              <option value="editor">Editor</option>
            </select>
            <Button variant="primary" onClick={inviteUser} disabled={!email.trim() || working}>Invite</Button>
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

        <Button variant="subtle" onClick={() => closeDialog('shareDoc')}>Done</Button>
      </Stack>
    </Modal>
  );
}
