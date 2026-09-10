import { useNavigate } from 'react-router-dom';
import { useCollaborationStore, useDocumentStore, useEditorStore, useUIStore } from '@/store';
import { getStoredUser } from '@/services/api';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Tooltip } from '@/components/ui';

function getCollaboratorColor(index) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
  return colors[index % colors.length];
}

export function TitleBar({ onSave }) {
  const navigate = useNavigate();
  const openDialog = useUIStore((s) => s.openDialog);
  const autoSaveEnabled = useUIStore((s) => s.autoSaveEnabled);
  const toggleAutoSave = useUIStore((s) => s.toggleAutoSave);
  const copilotOpen = useUIStore((s) => s.copilotOpen);
  const toggleCopilot = useUIStore((s) => s.toggleCopilot);
  const title = useDocumentStore((s) => s.title);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const resetDocument = useDocumentStore((s) => s.reset);
  const editor = useEditorStore((s) => s.editor);
  const collaborators = useCollaborationStore((s) => s.collaborators);
  const collabStatus = useCollaborationStore((s) => s.status);
  const resetCollaboration = useCollaborationStore((s) => s.reset);
  const visibleCollaborators = collaborators.slice(0, 3);

  const canUndo = Boolean(editor?.can?.().undo?.());
  const canRedo = Boolean(editor?.can?.().redo?.());

  const handleUndo = () => {
    if (!editor) return;
    editor.chain().focus().undo().run();
  };

  const handleRedo = () => {
    if (!editor) return;
    editor.chain().focus().redo().run();
  };

  const handleLogout = () => {
    localStorage.removeItem('etherx_token');
    localStorage.removeItem('etherx_user');
    resetDocument();
    resetCollaboration();
    navigate('/signin');
  };

  const onGoldHover = (e) => {
    e.currentTarget.style.background = 'var(--bg-hover)';
    e.currentTarget.style.borderColor = 'var(--gold)';
  };
  const onGoldLeave = (e) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.borderColor = 'transparent';
  };

  return (
    <div style={{
      height: 40,
      minHeight: 40,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 10px',
      flexShrink: 0,
      overflow: 'hidden',
      userSelect: 'none',
      fontFamily: 'var(--font-ui)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: '0 1 auto',
        minWidth: 0,
      }}>
        <img src="/assets/etherxlogo.png" alt="EtherX shield logo" style={{
          width: 32,
          height: 32,
          borderRadius: 2,
          objectFit: 'contain',
          flexShrink: 0,
        }} />
        <span className="titlebar-autosave-label" style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
        }}>
          AutoSave {autoSaveEnabled ? 'On' : 'Off'}
        </span>
        <button
          type="button"
          aria-label={`AutoSave ${autoSaveEnabled ? 'on' : 'off'}`}
          onClick={toggleAutoSave}
          style={{
            width: 30,
            height: 16,
            borderRadius: 999,
            border: '1px solid #c9a84c',
            background: 'var(--bg-elevated)',
            cursor: 'pointer',
            padding: 1,
            position: 'relative',
            flexShrink: 0,
          }}
          title="Toggle AutoSave"
        >
          <span style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'var(--gold)',
            display: 'block',
            transform: `translateX(${autoSaveEnabled ? 14 : 0}px)`,
            transition: 'transform 0.1s ease',
          }} />
        </button>
        <Tooltip text="Save Document" shortcut="Ctrl+S">
          <button type="button" aria-label="Save" onClick={onSave} style={quickBtn} onMouseEnter={onGoldHover} onMouseLeave={onGoldLeave}>💾</button>
        </Tooltip>
        <Tooltip text="Undo" shortcut="Ctrl+Z">
          <button type="button" aria-label="Undo" onClick={handleUndo} disabled={!canUndo} style={{ ...quickBtn, ...(canUndo ? null : disabledBtn) }} onMouseEnter={onGoldHover} onMouseLeave={onGoldLeave}>↩</button>
        </Tooltip>
        <Tooltip text="Redo" shortcut="Ctrl+Y">
          <button type="button" aria-label="Redo" onClick={handleRedo} disabled={!canRedo} style={{ ...quickBtn, ...(canRedo ? null : disabledBtn) }} onMouseEnter={onGoldHover} onMouseLeave={onGoldLeave}>↪</button>
        </Tooltip>
        <div className="titlebar-import-btn">
          <Tooltip text="Open / Import Document" shortcut="Ctrl+O">
            <button type="button" aria-label="Import DOCX" onClick={() => openDialog('importDocx')} style={quickBtn} onMouseEnter={onGoldHover} onMouseLeave={onGoldLeave}>📥</button>
          </Tooltip>
        </div>
      </div>

      <div className="titlebar-title-wrap" style={{
        flex: '1 1 auto',
        minWidth: 80,
        maxWidth: 520,
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 520,
          minWidth: 0,
          height: 28,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          gap: 6,
        }}>
          <span aria-hidden="true" style={{ color: 'var(--gold)', fontSize: 12 }}>✎</span>
          <input
            aria-label="Document title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Document"
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              width: '100%',
              minWidth: 0,
              color: 'var(--text-primary)',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
            }}
          />
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: '0 0 auto',
        minWidth: 0,
      }}>
        <div style={presenceWrap} title={`${collabStatus} - ${collaborators.length} collaborator(s)`}>
          <button
            className="titlebar-collab-btn"
            type="button"
            aria-label={collaborators.length > 0 ? 'Open collaboration details' : 'Share document to start collaboration'}
            title={collaborators.length > 0 ? 'Open collaboration details' : 'Share document to start collaboration'}
            onClick={() => openDialog('shareDoc')}
            style={presenceStatusButton}
            onMouseEnter={onGoldHover}
            onMouseLeave={onGoldLeave}
          >
            {collaborators.length > 0 ? `${collaborators.length} editing` : 'Ready to collaborate'}
          </button>
          {visibleCollaborators.map((person, index) => (
            <span
              key={person.sessionId || `${person.name}-${index}`}
              style={{
                ...presenceBadge,
                backgroundColor: getCollaboratorColor(index),
                boxShadow: person.status === 'active' ? '0 0 8px rgba(201, 168, 76, 0.6)' : 'none',
              }}
              title={`${person.name} - ${person.status || 'active'}`}
            >
              {(person.name || 'G').slice(0, 2).toUpperCase()}
            </span>
          ))}
          {collaborators.length > visibleCollaborators.length ? (
            <span style={{ ...presenceCount, cursor: 'pointer' }} title={`+${collaborators.length - visibleCollaborators.length} more`}>
              +{collaborators.length - visibleCollaborators.length}
            </span>
          ) : null}
        </div>
        <NotificationBell />
        <button className="titlebar-comments-btn" type="button" onClick={() => openDialog('comments')} style={outlineBtn} onMouseEnter={onGoldHover} onMouseLeave={onGoldLeave}>Comments</button>
        <button
          className="titlebar-editing-btn"
          type="button"
          style={flatTextBtn}
          onClick={() => openDialog('restrictEditing')}
          onMouseEnter={onGoldHover}
          onMouseLeave={onGoldLeave}
          title="Open editing permissions"
        >
          Editing ▾
        </button>
        <button
          className="titlebar-share-btn"
          type="button"
          onClick={() => openDialog('shareDoc')}
          style={shareBtn}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#d9bb67'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gold)'; }}
        >
          Share
        </button>
        <button
          className="titlebar-logout-btn"
          type="button"
          title={`Logout${getStoredUser()?.name ? ` (${getStoredUser().name})` : ''}`}
          aria-label="Logout"
          onClick={handleLogout}
          style={{
            ...quickBtn,
            width: 'auto',
            padding: '0 9px',
            background: 'var(--gold)',
            color: 'var(--text-on-gold)',
            borderColor: 'var(--gold)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#d9bb67'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gold)'; }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

const quickBtn = {
  width: 24,
  height: 24,
  borderRadius: 3,
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--gold)',
  fontSize: 12,
  cursor: 'pointer',
  transition: 'background 0.1s, border-color 0.1s',
  flexShrink: 0,
};

const outlineBtn = {
  ...quickBtn,
  width: 'auto',
  padding: '0 9px',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const flatTextBtn = {
  ...quickBtn,
  width: 'auto',
  padding: '0 7px',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};

const shareBtn = {
  ...quickBtn,
  width: 'auto',
  padding: '0 11px',
  background: 'var(--gold)',
  borderColor: 'var(--gold)',
  color: 'var(--text-on-gold)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const disabledBtn = {
  opacity: 0.35,
  cursor: 'not-allowed',
};

const presenceWrap = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '0 2px',
  whiteSpace: 'nowrap',
};

const presenceStatusButton = {
  height: 24,
  padding: '0 6px',
  border: '1px solid transparent',
  borderRadius: 3,
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 10,
  fontWeight: 500,
  fontFamily: 'var(--font-ui)',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transition: 'background 0.1s, border-color 0.1s, color 0.1s',
};

const presenceBadge = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(212, 175, 55, 0.18)',
  border: '1px solid var(--border-gold)',
  color: 'var(--text-gold)',
  fontSize: 10,
  fontWeight: 700,
};

const presenceCount = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  minWidth: 20,
};
