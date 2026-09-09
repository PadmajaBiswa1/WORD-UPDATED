import { useRef, useState } from 'react';
import { useUIStore, useDocumentStore, useEditorStore, useCollaborationStore } from '@/store';
import { PAGE_SIZES, getLayoutMetrics, PAGE_GAP } from '@/utils/pageLayout';

const THUMB_W  = 108;
const THUMB_H  = 153;

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

  return (
    <div style={{
      width: 160, flexShrink: 0,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 12px 8px', borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-ui)', fontSize: 10,
        color: 'var(--text-muted)', letterSpacing: '.08em',
        textTransform: 'uppercase', fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Pages</span>
        <span style={{ color: '#d4af37' }}>{pageCount}</span>
      </div>

      {hasTyping ? (
        <div style={{
          padding: '6px 12px 10px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          gap: 2,
        }}>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: 9,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em',
            fontWeight: 700,
          }}>
            Typing
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: 10,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontWeight: 600,
          }}>
            {typingNames.slice(0, 3).join(', ')}{typingNames.length > 3 ? '…' : ''}
          </div>
        </div>
      ) : null}


      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column' }}>
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
                padding: '8px 0',
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
                transform: isDragging ? 'scale(1.03)' : 'scale(1)',
                opacity: isDragging ? 0.45 : 1,
                position: 'relative',
              }}
            >
              {/* Drop line ABOVE */}
              <div style={{
                position: 'absolute', top: 0, left: 8, right: 8, height: 2,
                background: isDropAbove ? '#d4af37' : 'transparent',
                boxShadow: isDropAbove ? '0 0 6px #d4af37' : 'none',
                borderRadius: 2, transition: 'background 0.1s, box-shadow 0.1s', zIndex: 10,
              }} />

              <PageThumb
                index={i}
                active={activePage === i}
                thumbnail={pageThumbnails[pageNum]}
                isDragging={isDragging}
              />

              {/* Drop line BELOW */}
              <div style={{
                position: 'absolute', bottom: 0, left: 8, right: 8, height: 2,
                background: isDropBelow ? '#d4af37' : 'transparent',
                boxShadow: isDropBelow ? '0 0 6px #d4af37' : 'none',
                borderRadius: 2, transition: 'background 0.1s, box-shadow 0.1s', zIndex: 10,
              }} />
            </div>
          );
        })}
      </div>

      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--border)',
        fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-muted)',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <span>{pageCount} page{pageCount !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: 9 }}>{sizeLabel} · {orientationLabel}</span>
      </div>
    </div>
  );
}

function PageThumb({ index, active, thumbnail, isDragging }) {
  const themeColors = {
    bg: '#1a1a1a',
    border: active ? '#d4af37' : '#333333',
    placeholder: '#171717',
    placeholderLine: '#333333',
    pageNum: '#666666',
    pageNumBg: 'rgba(0,0,0,0.5)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: THUMB_W, height: THUMB_H,
        border: active ? '2px solid #d4af37' : `1px solid ${themeColors.border}`,
        borderRadius: 3,
        overflow: 'hidden',
        background: themeColors.bg,
        flexShrink: 0,
        position: 'relative',
        transition: 'border-color 0.15s, box-shadow 0.15s, background-color 0.15s',
        boxShadow: isDragging
          ? '0 8px 24px rgba(0,0,0,0.5), 0 0 0 2px #d4af37'
          : active ? '0 0 12px rgba(212, 175, 55, 0.35)' : '0 2px 4px rgba(0,0,0,0.1)',
      }}
        onMouseEnter={(e) => { if (!active && !isDragging) e.currentTarget.style.borderColor = '#d4af37'; }}
        onMouseLeave={(e) => { if (!active && !isDragging) e.currentTarget.style.borderColor = themeColors.border; }}
      >
        {thumbnail
          ? <img src={thumbnail} alt={`Page ${index + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: themeColors.placeholder }}>
              <div style={{ width: 64, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <div key={j} style={{ height: 2, background: themeColors.placeholderLine, borderRadius: 1, width: j % 3 === 0 ? '55%' : '100%' }} />
                ))}
              </div>
            </div>
        }
        <div style={{
          position: 'absolute', bottom: 4, right: 5,
          fontSize: 8, color: themeColors.pageNum, fontFamily: 'var(--font-ui)',
          background: themeColors.pageNumBg, borderRadius: 2, padding: '1px 4px',
        }}>{index + 1}</div>
      </div>

      <span style={{
        fontSize: 10, fontFamily: 'var(--font-ui)',
        color: active ? '#d4af37' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
        userSelect: 'none',
      }}>Page {index + 1}</span>
    </div>
  );
}
