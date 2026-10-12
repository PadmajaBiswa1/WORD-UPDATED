import { SpellCheck, Accessibility, Monitor, BookOpen, FileText, Globe } from 'lucide-react';
import { useCollaborationStore, useDocumentStore, useUIStore } from '@/store';

const VIEWS = [
  ['read', 'Read Mode', BookOpen],
  ['print', 'Print Layout', FileText],
  ['web', 'Web Layout', Globe],
];

export function StatusBar() {
  const { wordCount = 0, pageCount = 1 } = useDocumentStore();
  const { zoom, setZoom, activePage, toggleSidebar, viewMode, setViewMode, focusMode, toggleFocusMode } = useUIStore();
  const { connected, collaborators, status } = useCollaborationStore();
  const currentPage = Math.min(pageCount, Math.max(1, activePage + 1));
  const people = collaborators.length || 1;
  const live = connected || status === 'Live';
  return (
    <div style={{
      height: 26, flexShrink: 0,
      background: '#0f0f11',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 10px 0 14px',
      fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--text-muted)',
      whiteSpace: 'nowrap', overflow: 'hidden', userSelect: 'none',
    }}>
      <button type="button" onClick={toggleSidebar} title="Navigation pane" style={plainBtn}>Page {currentPage} of {pageCount}</button>
      <span>{(wordCount || 0).toLocaleString()} words</span>
      <span className="status-bar-lang" style={inline}><SpellCheck size={13} aria-label="Proofing" />English (United States)</span>
      <span className="status-bar-a11y" style={{ ...inline, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}><Accessibility size={13} />Accessibility: Good to go</span>
      <div style={{ flex: 1 }} />
      <span className="status-bar-collab" style={inline}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? '#6bbf7a' : '#6f6d68' }} />
        {live ? 'Live' : status || 'Offline'} · {people} collaborator{people === 1 ? '' : 's'}
      </span>
      <button type="button" onClick={toggleFocusMode} aria-pressed={focusMode} title="Focus mode" style={{ ...plainBtn, ...inline, color: focusMode ? 'var(--gold-hover)' : 'inherit' }}>
        <Monitor size={13} />Focus
      </button>
      <span className="status-bar-views" style={{ display: 'flex', gap: 2 }}>
        {VIEWS.map(([mode, label, Icon]) => (
          <button
            key={mode}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={viewMode === mode}
            onClick={() => setViewMode(mode)}
            style={{ ...viewBtn, background: viewMode === mode ? 'rgba(212,175,55,0.14)' : 'transparent', color: viewMode === mode ? 'var(--gold-hover)' : 'var(--text-muted)' }}
          >
            <Icon size={13} />
          </button>
        ))}
      </span>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" onClick={() => setZoom(zoom - 10)} title="Zoom out" aria-label="Zoom out" style={zoomBtn}>−</button>
        <span className="status-bar-slider">
          <input
            type="range"
            min={25}
            max={200}
            value={zoom}
            onChange={(e) => setZoom(+e.target.value)}
            aria-label="Zoom"
            className="etherx-zoom-slider"
            style={{ width: 100, cursor: 'pointer' }}
          />
        </span>
        <button type="button" onClick={() => setZoom(zoom + 10)} title="Zoom in" aria-label="Zoom in" style={zoomBtn}>+</button>
        <button type="button" onClick={() => setZoom(100)} title="Reset zoom" style={{ ...plainBtn, width: 38, textAlign: 'right' }}>{zoom}%</button>
      </div>
    </div>
  );
}

const inline = { display: 'flex', alignItems: 'center', gap: 5 };

const plainBtn = {
  border: 0,
  background: 'transparent',
  padding: 0,
  color: 'inherit',
  fontSize: 11.5,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
};

const viewBtn = {
  width: 24,
  height: 22,
  border: 0,
  borderRadius: 4,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
};

const zoomBtn = {
  width: 20,
  height: 20,
  border: 0,
  background: 'transparent',
  borderRadius: 4,
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 13,
  lineHeight: 1,
};
