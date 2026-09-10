import { useCollaborationStore, useDocumentStore, useUIStore } from '@/store';

export function StatusBar() {
  const { wordCount = 0, pageCount = 1 } = useDocumentStore();
  const { zoom, setZoom, activePage } = useUIStore();
  const { connected, collaborators, status } = useCollaborationStore();
  const currentPage = Math.min(pageCount, Math.max(1, activePage + 1));
  return (
    <div style={{
      height: 22, flexShrink: 0,
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 8px', gap: 0,
      fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)',
      userSelect: 'none',
    }}>
      <Stat label="Page" value={`${currentPage} of ${pageCount}`} />
      <Sep />
      <Stat label="" value={`${(wordCount || 0).toLocaleString()} words`} />
      <span className="status-bar-sep-collab"><Sep /></span>
      <span className="status-bar-collab">
        <Stat label="" value={`${status}${collaborators.length ? ` • ${collaborators.length} collaborator${collaborators.length === 1 ? '' : 's'}` : ''}`} />
      </span>
      <span className="status-bar-sep-lang"><Sep /></span>
      <span className="status-bar-lang">
        <Stat label="" value="English (United States)" />
      </span>
      <div style={{ flex: 1 }} />
      <span style={{ ...statusDot, background: connected ? 'var(--gold)' : 'var(--text-muted)' }} />
      <span className="status-bar-views">
        <button style={viewBtn} onMouseEnter={onHover} onMouseLeave={onLeave}>▤</button>
        <button style={viewBtn} onMouseEnter={onHover} onMouseLeave={onLeave}>▦</button>
        <button style={viewBtn} onMouseEnter={onHover} onMouseLeave={onLeave}>▥</button>
      </span>
      <span className="status-bar-sep-views"><Sep /></span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <button onClick={() => setZoom(zoom - 10)} style={zoomBtn} onMouseEnter={onHover} onMouseLeave={onLeave}>−</button>
        <span className="status-bar-slider">
          <input type="range" min={25} max={200} value={zoom} onChange={(e) => setZoom(+e.target.value)}
            style={{ width: 86, accentColor: 'var(--gold)', cursor: 'pointer' }} />
        </span>
        <button onClick={() => setZoom(zoom + 10)} style={zoomBtn} onMouseEnter={onHover} onMouseLeave={onLeave}>+</button>
        <button onClick={() => setZoom(100)} style={{ ...zoomBtn, minWidth: 38, color: 'var(--text-primary)' }} onMouseEnter={onHover} onMouseLeave={onLeave}>{zoom}%</button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <span>
      {label ? <span style={{ color: 'var(--text-secondary)' }}>{label} </span> : null}
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </span>
  );
}
function Sep() {
  return <span style={{ margin: '0 8px', color: 'var(--border-strong)' }}>|</span>;
}
const zoomBtn = {
  height: 18,
  minWidth: 18,
  border: '1px solid transparent',
  borderRadius: 2,
  background: 'transparent',
  color: 'var(--gold)',
  cursor: 'pointer',
  fontSize: 12,
  padding: '0 4px',
  lineHeight: 1,
  transition: 'background 0.1s, border-color 0.1s',
};

const viewBtn = {
  ...zoomBtn,
  marginRight: 2,
};

const statusDot = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  display: 'inline-block',
  marginRight: 6,
};

function onHover(e) {
  e.currentTarget.style.background = 'var(--bg-hover)';
  e.currentTarget.style.borderColor = 'var(--gold)';
}

function onLeave(e) {
  e.currentTarget.style.background = 'transparent';
  e.currentTarget.style.borderColor = 'transparent';
}
