import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollaborationStore, useDocumentStore, useEditorStore, useUIStore, useSubscriptionStore } from '@/store';
import { getStoredUser } from '@/services/api';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { TopBarView } from '@/components/design/DesignViews';
import { applyDesignTheme, getUiTheme } from '@/theme/tokens';
import { RibbonFeatureSearch } from '@/components/toolbar/RibbonFeatureSearch';
import EtherxWordLogo from '@/components/brand/EtherxWordLogo';

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

  const titleRef = useRef(null);
  const [uiTheme, setUiTheme] = useState(getUiTheme);
  useEffect(() => {
    const sync = () => setUiTheme(getUiTheme());
    window.addEventListener('etherx:theme-change', sync);
    return () => window.removeEventListener('etherx:theme-change', sync);
  }, []);
  const toggleTheme = () => {
    const next = uiTheme === 'light' ? 'dark' : 'light';
    applyDesignTheme(next);
    setUiTheme(next);
  };

  const v = {
    brand: <button className="studio-brand" type="button" title="EtherX Word · Documents" aria-label="EtherX Word home" onClick={() => navigate('/home')}><EtherxWordLogo title="EtherX Word" /></button>,
    autoSaveOn: autoSaveEnabled,
    autoSaveTitle: `AutoSave is ${autoSaveEnabled ? 'on' : 'off'}`,
    toggleAutoSave,
    autoSaveTrack: autoSaveEnabled ? 'var(--t31,#d6b25e)' : 'var(--t17,#3d3830)',
    autoSaveKnob: autoSaveEnabled ? '#1a1405' : 'var(--t27,#8f8164)',
    autoSaveKnobLeft: autoSaveEnabled ? '16px' : '2px',
    save: onSave,
    undo: handleUndo,
    undoDisabled: !canUndo,
    undoColor: canUndo ? 'var(--t22,#c4c2bd)' : 'var(--t28,#6f6d68)',
    redo: handleRedo,
    redoDisabled: !canRedo,
    redoColor: canRedo ? 'var(--t22,#c4c2bd)' : 'var(--t28,#6f6d68)',
    openImport: () => openDialog('importDocx'),
    focusTitle: () => titleRef.current?.focus(),
    titleField: (
      <input
        ref={titleRef}
        aria-label="Document title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        placeholder="Untitled Document"
        style={{ ...titleInput, width: `${Math.min(40, Math.max(8, (title || 'Untitled Document').length)) + 1}ch` }}
      />
    ),
    saveIcon: isSaving ? 'loader' : isDirty ? 'cloud-upload' : 'cloud-check',
    saveLabel,
    search: <RibbonFeatureSearch variant="pill" onActivateTab={(id) => setActiveTab(id)} />,
    planLabel: plan === 'pro' ? 'PRO' : String(plan || 'free').toUpperCase(),
    planTitle: plan === 'pro' ? 'Pro plan · view plans' : `${plan} plan · upgrade to Pro`,
    openPlans: () => openUpgradeModal(plan === 'pro' ? undefined : 'Upgrade to Pro to unlock AI writing tools and unlimited collaboration.', plan === 'pro' ? undefined : 'pro'),
    toggleTheme,
    themeIcon: uiTheme === 'light' ? 'moon' : 'sun',
    themeTitle: uiTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
    notifications: <NotificationBell />,
    initials,
    avatarTitle: `${user.name || user.email || 'Account'} · ${collaborators.length || 1} editing (${collabStatus})`,
    toggleAccount: () => setMenuOpen((open) => !open),
    accountMenu: menuOpen ? (
      <div role="menu" style={accountMenu} onClick={(e) => e.stopPropagation()} onMouseLeave={() => setMenuOpen(false)}>
        <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid rgba(var(--ink,255,255,255),0.08)', marginBottom: 4, textAlign: 'left' }}>
          <div style={{ fontSize: 12.5, color: 'var(--t18,#f1efea)' }}>{user.name || 'Signed in'}</div>
          {user.email ? <div style={{ fontSize: 11, color: 'var(--t25,#8b8984)' }}>{user.email}</div> : null}
        </div>
        <button type="button" role="menuitem" className="titlebar-logout-btn" onClick={handleLogout} style={menuItem} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
          Log out
        </button>
      </div>
    ) : null,
  };

  return <TopBarView v={v} />;
}

function hoverOn(e) {
  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
  e.currentTarget.style.color = 'var(--text-primary)';
}
function hoverOff(e) {
  e.currentTarget.style.background = 'transparent';
  e.currentTarget.style.color = '';
}





const titleInput = {
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  outline: 'none',
  color: 'var(--t18,#f1efea)',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
  padding: 0,
  minWidth: 0,
  cursor: 'text',
};



const accountMenu = {
  position: 'absolute',
  top: 32,
  right: 0,
  minWidth: 200,
  background: 'var(--t4,#181715)',
  border: '1px solid rgba(var(--ink,255,255,255),0.08)',
  borderRadius: 8,
  boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
  padding: 4,
  zIndex: 1000,
};

const menuItem = {
  width: '100%',
  textAlign: 'left',
  border: 0,
  background: 'transparent',
  color: 'var(--t22,#c4c2bd)',
  fontSize: 12.5,
  padding: '6px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};
