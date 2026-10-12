import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Undo2, Redo2, FolderOpen, Zap } from 'lucide-react';
import { useCollaborationStore, useDocumentStore, useEditorStore, useUIStore, useSubscriptionStore } from '@/store';
import { getStoredUser } from '@/services/api';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Tooltip } from '@/components/ui';
import { RibbonFeatureSearch } from '@/components/toolbar/RibbonFeatureSearch';

function getCollaboratorColor(index) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
  return colors[index % colors.length];
}

export function TitleBar({ onSave }) {
  const navigate = useNavigate();
  const openDialog = useUIStore((s) => s.openDialog);
  const autoSaveEnabled = useUIStore((s) => s.autoSaveEnabled);
  const toggleAutoSave = useUIStore((s) => s.toggleAutoSave);
  const title = useDocumentStore((s) => s.title);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const resetDocument = useDocumentStore((s) => s.reset);
  const editor = useEditorStore((s) => s.editor);
  const undoStack = useDocumentStore((s) => s.undoStack);
  const redoStack = useDocumentStore((s) => s.redoStack);
  const undoDocumentAction = useDocumentStore((s) => s.undoDocumentAction);
  const redoDocumentAction = useDocumentStore((s) => s.redoDocumentAction);
  const collaborators = useCollaborationStore((s) => s.collaborators);
  const collabStatus = useCollaborationStore((s) => s.status);
  const resetCollaboration = useCollaborationStore((s) => s.reset);
  const visibleCollaborators = collaborators.slice(0, 3);
  const plan = useSubscriptionStore((s) => s.plan);
  const openUpgradeModal = useSubscriptionStore((s) => s.openUpgradeModal);

  const [editorCanUndo, setEditorCanUndo] = useState(false);
  const [editorCanRedo, setEditorCanRedo] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const updateCan = () => {
      setEditorCanUndo(Boolean(editor.can().undo()));
      setEditorCanRedo(Boolean(editor.can().redo()));
    };
    updateCan();
    editor.on('transaction', updateCan);
    return () => {
      editor.off('transaction', updateCan);
    };
  }, [editor]);

  const canUndo = (undoStack && undoStack.length > 0) || editorCanUndo;
  const canRedo = (redoStack && redoStack.length > 0) || editorCanRedo;

  const handleUndo = () => {
    undoDocumentAction();
  };

  const handleRedo = () => {
    redoDocumentAction();
  };

  const handleLogout = () => {
    localStorage.removeItem('etherx_token');
    localStorage.removeItem('etherx_user');
    resetDocument();
    resetCollaboration();
    navigate('/signin');
  };

  const isSaving = useDocumentStore((s) => s.isSaving);
  const isDirty = useDocumentStore((s) => s.isDirty);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const user = getStoredUser() || {};
  const initials = (user.name || user.email || 'U').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const saveLabel = isSaving ? 'Saving…' : isDirty ? 'Edited' : 'Saved';

  return (
    <div style={{
      height: 40,
      minHeight: 40,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'var(--bg-app)',
      padding: '0 10px',
      flexShrink: 0,
      userSelect: 'none',
      fontFamily: 'var(--font-ui)',
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <img src="/assets/etherxlogo.png" alt="EtherX Word" style={logoImg} />
        <span className="titlebar-autosave-label" style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>AutoSave</span>
        <button
          type="button"
          role="switch"
          aria-checked={autoSaveEnabled}
          aria-label="AutoSave"
          title={`AutoSave is ${autoSaveEnabled ? 'on' : 'off'}`}
          onClick={toggleAutoSave}
          style={{ ...toggleTrack, background: autoSaveEnabled ? 'var(--gold)' : '#2a2a2e' }}
        >
          <span style={{ ...toggleKnob, left: autoSaveEnabled ? 16 : 2, background: autoSaveEnabled ? 'var(--text-on-gold)' : '#8b8984' }} />
        </button>
        <Tooltip text="Save" shortcut="Ctrl+S">
          <button type="button" aria-label="Save" onClick={onSave} style={iconBtn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
            <Save size={15} strokeWidth={1.75} />
          </button>
        </Tooltip>
        <Tooltip text="Undo" shortcut="Ctrl+Z">
          <button type="button" aria-label="Undo" onClick={handleUndo} disabled={!canUndo} style={{ ...iconBtn, ...(canUndo ? null : disabledBtn) }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
            <Undo2 size={15} strokeWidth={1.75} />
          </button>
        </Tooltip>
        <Tooltip text="Redo" shortcut="Ctrl+Y">
          <button type="button" aria-label="Redo" onClick={handleRedo} disabled={!canRedo} style={{ ...iconBtn, ...(canRedo ? null : disabledBtn) }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
            <Redo2 size={15} strokeWidth={1.75} />
          </button>
        </Tooltip>
        <div className="titlebar-import-btn">
          <Tooltip text="Open / Import Document" shortcut="Ctrl+O">
            <button type="button" aria-label="Open or import a document" onClick={() => openDialog('importDocx')} style={iconBtn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              <FolderOpen size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="titlebar-title-wrap" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-primary)', whiteSpace: 'nowrap', minWidth: 0 }}>
        <input
          aria-label="Document title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Document"
          style={{ ...titleInput, width: `${Math.min(40, Math.max(8, (title || 'Untitled Document').length)) + 2}ch` }}
          onFocus={(e) => { e.currentTarget.style.background = 'var(--bg-active)'; }}
          onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
        />
        <span aria-hidden="true" style={{ color: '#6f6d68' }}>·</span>
        <span role="status" style={{ color: 'var(--text-muted)' }}>{saveLabel}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
        <div className="titlebar-search">
          <RibbonFeatureSearch compactWidth={260} onActivateTab={(id) => setActiveTab(id)} />
        </div>
        <button
          type="button"
          onClick={() => openUpgradeModal(plan === 'pro' ? undefined : 'Upgrade to Pro to unlock AI writing tools and unlimited collaboration.', plan === 'pro' ? undefined : 'pro')}
          title={plan === 'pro' ? 'Pro plan · view plans' : `${plan} plan · upgrade to Pro`}
          style={plan === 'pro' ? planBadge : { ...planBadge, color: 'var(--text-on-gold)', background: 'var(--gold)' }}
        >
          {plan === 'pro' ? 'PRO' : <><Zap size={10} fill="currentColor" />Upgrade</>}
        </button>
        <NotificationBell />
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }} title={`${collabStatus} · ${collaborators.length} editing`}>
          {visibleCollaborators.map((person, index) => (
            <span
              key={person.sessionId || `${person.name}-${index}`}
              style={{ ...avatar, background: getCollaboratorColor(index), marginLeft: index ? -6 : 0, boxShadow: '0 0 0 2px var(--bg-app)' }}
              title={`${person.name} - ${person.status || 'active'}`}
            >
              {(person.name || 'G').slice(0, 2).toUpperCase()}
            </span>
          ))}
          {collaborators.length > visibleCollaborators.length ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>+{collaborators.length - visibleCollaborators.length}</span>
          ) : null}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={user.name || user.email || 'Account'}
            onClick={() => setMenuOpen((open) => !open)}
            style={{ ...avatar, background: '#c4644a', border: 0, cursor: 'pointer', marginLeft: 4 }}
          >
            {initials}
          </button>
          {menuOpen && (
            <div role="menu" style={accountMenu} onMouseLeave={() => setMenuOpen(false)}>
              <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{user.name || 'Signed in'}</div>
                {user.email ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</div> : null}
              </div>
              <button type="button" role="menuitem" className="titlebar-logout-btn" onClick={handleLogout} style={menuItem} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function hoverOn(e) {
  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
  e.currentTarget.style.color = 'var(--text-primary)';
}
function hoverOff(e) {
  e.currentTarget.style.background = 'transparent';
  e.currentTarget.style.color = '';
}

const logoImg = {
  width: 24,
  height: 24,
  objectFit: 'contain',
  flex: 'none',
  marginRight: 8,
};

const toggleTrack = {
  width: 30,
  height: 16,
  borderRadius: 8,
  border: 0,
  position: 'relative',
  margin: '0 8px 0 4px',
  flex: 'none',
  cursor: 'pointer',
  padding: 0,
};

const toggleKnob = {
  position: 'absolute',
  top: 2,
  width: 12,
  height: 12,
  borderRadius: '50%',
  transition: 'left 0.12s ease',
};

const iconBtn = {
  width: 28,
  height: 28,
  border: 0,
  background: 'transparent',
  borderRadius: 6,
  color: '#a19f99',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
};

const titleInput = {
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  outline: 'none',
  color: 'var(--text-primary)',
  fontSize: 12.5,
  fontFamily: 'var(--font-ui)',
  padding: '3px 6px',
  textAlign: 'center',
  minWidth: 0,
};

const planBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.06em',
  color: 'var(--gold)',
  padding: '3px 7px',
  borderRadius: 5,
  background: 'rgba(212,175,55,0.1)',
  border: 0,
  marginLeft: 4,
  cursor: 'pointer',
};

const avatar = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  color: '#fff',
  display: 'grid',
  placeItems: 'center',
  fontSize: 10.5,
  fontWeight: 600,
  flexShrink: 0,
};

const accountMenu = {
  position: 'absolute',
  top: 32,
  right: 0,
  minWidth: 200,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: 'var(--shadow-lg)',
  padding: 4,
  zIndex: 1000,
};

const menuItem = {
  width: '100%',
  textAlign: 'left',
  border: 0,
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 12.5,
  padding: '6px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};

const disabledBtn = {
  opacity: 0.35,
  cursor: 'not-allowed',
};
