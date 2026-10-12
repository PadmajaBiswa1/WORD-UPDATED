import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import { useUIStore, useDocumentStore, useEditorStore, useCollaborationStore } from '@/store';
import { PAGE_SIZES, getLayoutMetrics, PAGE_GAP } from '@/utils/pageLayout';

const THUMB_W  = 96;
const THUMB_H  = 135;

/**
 * Scroll the editor scroll area to the exact top of a given page index.
 * Uses the same pageStep formula as EditorCanvas — no DOM offsetTop needed.
 */
function scrollEditorToPage(pageIndex, zoom, metrics) {
  const scrollArea = document.getElementById('editor-scroll-area');
  if (!scrollArea) return;
  const scale = zoom / 100;
  const pageStep = (metrics.pageHeight + PAGE_GAP) * scale;
  // The scroll container has padding = 40*scale at top which offsets the
  // page content div. scrollTop = pageIndex * pageStep lands exactly at the
  // top of page i with the top padding naturally showing above it.
  // We subtract a small amount (8px scaled) so the page doesn't jam to the
  // very top edge of the viewport — keeps a comfortable margin.
  const targetTop = Math.max(0, pageIndex * pageStep - 8 * scale);
  scrollArea.scrollTo({ top: targetTop, behavior: 'smooth' });
}

// Split ProseMirror DOM children into page buckets using rendered offsetTop.
function getPageBuckets(pageCount, metrics, zoom) {
  const proseMirror = document.querySelector('.ProseMirror');
  if (!proseMirror) return null;

  const children = Array.from(proseMirror.children);
  if (!children.length) return null;

  const buckets = Array.from({ length: pageCount }, () => []);
  const scale = zoom / 100;
  const pageStep = (metrics.pageHeight + PAGE_GAP) * scale;

  children.forEach((child) => {
    const page = Math.min(Math.floor(child.offsetTop / pageStep), pageCount - 1);
    buckets[Math.max(0, page)].push(child.outerHTML);
  });

  return buckets;
}

export function PageSidebar() {
  const { sidebarOpen, activePage, setActivePage, pageSize, pageOrientation, pageMargin, zoom } = useUIStore();
  const { pageCount, pageOrder, reorderPages, pageThumbnails } = useDocumentStore();
  const editor = useEditorStore((s) => s.editor);
  const typingUsers = useCollaborationStore((s) => s.typingUsers);

  const metrics = getLayoutMetrics({ size: pageSize, orientation: pageOrientation, margin: pageMargin });
  const sizeLabel = (PAGE_SIZES[pageSize] || PAGE_SIZES.a4).label;
  const orientationLabel = pageOrientation === 'landscape' ? 'Landscape' : 'Portrait';

  const [view, setView] = useState('pages');
  const [query, setQuery] = useState('');
  const [headings, setHeadings] = useState([]);
  const [docVersion, setDocVersion] = useState(0);

  useEffect(() => {
    if (!editor) return undefined;
    const collect = () => {
      const list = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && node.textContent.trim()) {
          list.push({ pos, level: node.attrs.level || 1, text: node.textContent.trim() });
        }
      });
      setHeadings(list);
      setDocVersion((v) => v + 1);
    };
    collect();
    editor.on('update', collect);
    return () => { editor.off('update', collect); };
  }, [editor]);

  // docVersion changes on every edit, so results stay fresh while the user types.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!editor || q.length < 2) return [];
    const found = [];
    editor.state.doc.descendants((node, pos) => {
      if (found.length >= 50 || !node.isTextblock) return found.length < 50;
      const text = node.textContent;
      const at = text.toLowerCase().indexOf(q);
      if (at >= 0) {
        const start = Math.max(0, at - 24);
        found.push({ pos: pos + 1 + at, before: (start ? '…' : '') + text.slice(start, at), match: text.slice(at, at + q.length), after: text.slice(at + q.length, at + q.length + 40) });
      }
      return false;
    });
    return found;
  }, [editor, query, docVersion]);

  const jumpTo = (pos, length = 0) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection({ from: pos, to: pos + length }).scrollIntoView().run();
  };

  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const dragNode = useRef(null);
  const didDrag  = useRef(false);

  if (!sidebarOpen) return null;

  const order = pageOrder.length === pageCount
    ? pageOrder
    : Array.from({ length: Math.max(1, pageCount) }, (_, i) => i);

  const handleDragStart = (e, i) => {
    dragNode.current = i;
    didDrag.current  = false;
    setDragIndex(i);
    e.dataTransfer.effectAllowed = 'move';
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-999px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragEnter = (e, i) => {
    e.preventDefault();
    if (i !== dragNode.current) { didDrag.current = true; setDropIndex(i); }
  };

  const handleDrop = (e, i) => {
    e.preventDefault();
    const from = dragNode.current;
    if (from !== null && from !== i && editor) {
      // 1. Get page buckets from rendered DOM
      const buckets = getPageBuckets(pageCount, metrics, zoom);
      if (buckets) {
        // 2. Reorder buckets
        const reordered = [...buckets];
        const [movedBucket] = reordered.splice(from, 1);
        reordered.splice(i, 0, movedBucket);

        // 3. Flatten back to HTML and set into editor
        const newHTML = reordered.flat().join('');
        editor.commands.setContent(newHTML || '<p></p>', false);
      }

      // 4. Update page order in store
      reorderPages(from, i);
      setActivePage(i);

      // 5. Scroll to the dropped page using precise math
      setTimeout(() => scrollEditorToPage(i, zoom, metrics), 100);
    }
    setDragIndex(null); setDropIndex(null); dragNode.current = null;
  };

  const handleDragEnd = () => {
    setDragIndex(null); setDropIndex(null); dragNode.current = null;
  };

  const handleClick = (i) => {
    if (didDrag.current) { didDrag.current = false; return; }
    setActivePage(i);
    // Use precise math-based scroll — avoids the offsetTop bounce bug
    scrollEditorToPage(i, zoom, metrics);
  };

  const typingNames = (typingUsers || []).filter((u) => u?.sessionId).map((u) => u.name);
  const hasTyping = typingNames.length > 0;

  const navTabs = [['headings', 'Headings'], ['pages', 'Pages'], ['results', 'Results']];

  return (
    <div
      className="page-sidebar-container"
      style={{
        width: 220,
        flexShrink: 0,
        background: '#0f0f11',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ height: 40, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 0 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
        Navigation
        <button
          type="button"
          onClick={() => useUIStore.getState().toggleSidebar()}
          aria-label="Close navigation"
          title="Close"
          style={{ width: 26, height: 26, border: 0, background: 'transparent', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={14} />
        </button>
      </div>

      <label style={{ margin: '0 12px', height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderRadius: 6, background: '#17171a', border: '1px solid rgba(255,255,255,0.07)', color: '#6f6d68', fontSize: 12 }}>
        <Search size={13} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim()) setView('results'); }}
          placeholder="Search document"
          aria-label="Search document"
          style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-ui)' }}
        />
      </label>

      <div role="tablist" style={{ display: 'flex', gap: 16, padding: '12px 14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {navTabs.map(([id, name]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            style={{ border: 0, background: 'transparent', padding: '0 0 8px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font-ui)', color: view === id ? 'var(--text-primary)' : '#7d7b76', fontWeight: view === id ? 500 : 400, boxShadow: `inset 0 -2px 0 ${view === id ? 'var(--gold)' : 'transparent'}` }}
          >
            {name}
          </button>
        ))}
      </div>

      {hasTyping ? (
        <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Typing: <span style={{ color: 'var(--text-primary)' }}>{typingNames.slice(0, 3).join(', ')}{typingNames.length > 3 ? '…' : ''}</span>
        </div>
      ) : null}

      {view === 'headings' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          {headings.length ? headings.map((h) => (
            <button
              key={h.pos}
              type="button"
              onClick={() => jumpTo(h.pos + 1)}
              title={h.text}
              style={{ ...navRow, paddingLeft: 8 + (Math.min(h.level, 4) - 1) * 12, color: h.level === 1 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: h.level === 1 ? 500 : 400 }}
              onMouseEnter={rowHoverOn}
              onMouseLeave={rowHoverOff}
            >
              {h.text}
            </button>
          )) : (
            <div style={emptyNote}>Apply Heading styles from the Home tab to see your document outline here.</div>
          )}
        </div>
      )}

      {view === 'results' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          {results.length ? results.map((r) => (
            <button key={r.pos} type="button" onClick={() => jumpTo(r.pos, r.match.length)} style={{ ...navRow, whiteSpace: 'normal', lineHeight: 1.45 }} onMouseEnter={rowHoverOn} onMouseLeave={rowHoverOff}>
              <span style={{ color: 'var(--text-muted)' }}>{r.before}</span>
              <mark style={{ background: 'rgba(214,178,94,0.25)', color: 'var(--text-primary)', borderRadius: 2 }}>{r.match}</mark>
              <span style={{ color: 'var(--text-muted)' }}>{r.after}</span>
            </button>
          )) : (
            <div style={emptyNote}>{query.trim().length >= 2 ? 'No matches.' : 'Search for text in this document.'}</div>
          )}
        </div>
      )}

      {view === 'pages' && (
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px', display: 'flex', flexDirection: 'column' }}>
        {order.map((pageNum, i) => {
          const isDragging  = dragIndex === i;
          const isDropAbove = dropIndex === i && dragIndex !== null && dragIndex > i;
          const isDropBelow = dropIndex === i && dragIndex !== null && dragIndex < i;

          return (
            <div
              key={pageNum}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragEnter={(e) => handleDragEnter(e, i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              onClick={() => handleClick(i)}
              style={{
                padding: '4px 0',
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
                transform: isDragging ? 'scale(1.03)' : 'scale(1)',
                opacity: isDragging ? 0.45 : 1,
                position: 'relative',
              }}
            >
              <div style={{ ...dropLine, top: 0, background: isDropAbove ? 'var(--gold)' : 'transparent' }} />
              <PageThumb index={i} active={activePage === i} thumbnail={pageThumbnails[pageNum]} isDragging={isDragging} />
              <div style={{ ...dropLine, bottom: 0, background: isDropBelow ? 'var(--gold)' : 'transparent' }} />
            </div>
          );
        })}
        <div style={{ marginTop: 'auto', paddingTop: 12, textAlign: 'center', fontSize: 11, color: '#6f6d68' }}>
          {pageCount} page{pageCount !== 1 ? 's' : ''} · {sizeLabel} · {orientationLabel}
        </div>
      </div>
      )}
    </div>
  );
}

const navRow = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 0,
  background: 'transparent',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 12,
  fontFamily: 'var(--font-ui)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const emptyNote = {
  padding: '8px 10px',
  fontSize: 12,
  lineHeight: 1.5,
  color: '#7d7b76',
  textAlign: 'center',
};

const dropLine = { position: 'absolute', left: 8, right: 8, height: 2, borderRadius: 2, zIndex: 10 };

function rowHoverOn(e) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }
function rowHoverOff(e) { e.currentTarget.style.background = 'transparent'; }

function PageThumb({ index, active, thumbnail, isDragging }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: THUMB_W,
          height: THUMB_H,
          borderRadius: 2,
          overflow: 'hidden',
          background: 'var(--bg-page)',
          flexShrink: 0,
          boxShadow: isDragging
            ? '0 8px 24px rgba(0,0,0,0.5), 0 0 0 2px var(--gold)'
            : active ? '0 0 0 2px var(--gold)' : '0 0 0 1px rgba(255,255,255,0.08)',
          transition: 'box-shadow 0.15s',
        }}
        onMouseEnter={(e) => { if (!active && !isDragging) e.currentTarget.style.boxShadow = '0 0 0 1px rgba(214,178,94,0.6)'; }}
        onMouseLeave={(e) => { if (!active && !isDragging) e.currentTarget.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.08)'; }}
      >
        {thumbnail
          ? <img src={thumbnail} alt={`Page ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
          : null}
      </div>
      <span style={{ fontSize: 11.5, fontFamily: 'var(--font-ui)', color: active ? 'var(--gold)' : '#7d7b76', userSelect: 'none' }}>{index + 1}</span>
    </div>
  );
}
