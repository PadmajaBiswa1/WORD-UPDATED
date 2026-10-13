import { useCollaborationStore, useDocumentStore, useUIStore } from '@/store';
import { StatusBarView } from '@/components/design/DesignViews';

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

export function StatusBar() {
  const { wordCount = 0, pageCount = 1 } = useDocumentStore();
  const { zoom, setZoom, activePage, toggleSidebar, viewMode, setViewMode, focusMode, toggleFocusMode } = useUIStore();
  const { connected, collaborators, status } = useCollaborationStore();
  const currentPage = Math.min(pageCount, Math.max(1, activePage + 1));
  const people = collaborators.length || 1;
  const live = connected || status === 'Live';
  const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  const viewBtn = (mode) => ({
    [mode]: () => setViewMode(mode),
    [`${mode}Bg`]: viewMode === mode ? 'rgba(212,175,55,0.14)' : 'transparent',
    [`${mode}Color`]: viewMode === mode ? 'var(--t32,#e3c378)' : 'var(--t25,#8b8984)',
  });

  const v = {
    togglePages: toggleSidebar,
    pageLabel: `Page ${currentPage} of ${pageCount}`,
    wordsLabel: wordCount === 1 ? '1 word' : `${(wordCount || 0).toLocaleString()} words`,
    liveDot: live ? '#6bbf7a' : 'var(--t28,#6f6d68)',
    liveLabel: `${live ? 'Live' : 'Offline'} · ${people} collaborator${people === 1 ? '' : 's'}`,
    focusOn: focusMode,
    toggleFocus: toggleFocusMode,
    focusColor: focusMode ? 'var(--t32,#e3c378)' : 'inherit',
    view: { ...viewBtn('read'), ...viewBtn('print'), ...viewBtn('web') },
    zoomOut: () => setZoom(clampZoom(zoom - 10)),
    zoomIn: () => setZoom(clampZoom(zoom + 10)),
    zoomReset: () => setZoom(100),
    zoomLabel: `${zoom}%`,
    zoomPos: `${((clampZoom(zoom) - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100}%`,
    zoomInput: (
      <input
        type="range"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={10}
        value={clampZoom(zoom)}
        aria-label="Zoom"
        onChange={(e) => setZoom(Number(e.target.value))}
        style={{ position: 'absolute', inset: '-8px 0', width: '100%', height: 19, margin: 0, opacity: 0, cursor: 'pointer' }}
      />
    ),
  };

  return <StatusBarView v={v} />;
}
