import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// View > Multiple Pages and View > Side to Side. The document is one continuous
// editor whose pagination is measured vertically, so these views show a live
// copy of each page (cloned from the editor and clipped to that page) instead
// of re-laying out the editor. Clicking a page returns to it for editing.
export function PageSpread({ mode, source, editor, pageCount, pageWidth, pageHeight, pageStep, onPick, onExit }) {
  const rootRef = useRef(null);
  const pageRefs = useRef([]);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [version, setVersion] = useState(0);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.focus();
    return () => observer.disconnect();
  }, []);

  // Refresh the copies when the document changes (e.g. a collaborator edits).
  useEffect(() => {
    if (!editor) return undefined;
    let timer;
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => setVersion((v) => v + 1), 300); };
    editor.on('update', bump);
    return () => { clearTimeout(timer); editor.off('update', bump); };
  }, [editor]);

  const gap = 24;
  // Side to Side: pages fill the height and scroll sideways. Multiple Pages:
  // two pages side by side per row, as Word shows by default.
  const scale = mode === 'side'
    ? Math.max(0.1, (box.h - gap * 2) / pageHeight)
    : Math.max(0.1, Math.min((box.w - gap * 3) / (pageWidth * 2), (box.h - gap * 2) / pageHeight));

  useEffect(() => {
    if (!source) return;
    pageRefs.current.slice(0, pageCount).forEach((slot, i) => {
      if (!slot) return;
      const copy = source.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      copy.querySelectorAll('[contenteditable]').forEach((el) => el.setAttribute('contenteditable', 'false'));
      copy.style.margin = `${-i * pageStep}px 0 0 0`;
      copy.style.pointerEvents = 'none';
      slot.replaceChildren(copy);
    });
  }, [source, pageCount, pageStep, version, box.w, box.h]);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); onExit(); }
    if (mode === 'side' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault();
      rootRef.current?.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * (pageWidth * scale + gap), behavior: 'smooth' });
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-label={mode === 'side' ? 'Side to side pages' : 'Multiple pages'}
      data-page-spread={mode}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute', inset: 0, zIndex: 5, outline: 'none',
        background: 'var(--t1,#0e0e10)',
        overflowX: mode === 'side' ? 'auto' : 'hidden', overflowY: mode === 'side' ? 'hidden' : 'auto',
        display: 'flex', flexDirection: 'row', flexWrap: mode === 'side' ? 'nowrap' : 'wrap',
        alignItems: 'flex-start', alignContent: 'flex-start', justifyContent: mode === 'side' ? 'flex-start' : 'center',
        gap, padding: gap, boxSizing: 'border-box',
      }}
    >
      {Array.from({ length: pageCount }).map((_, i) => (
        <button
          key={i}
          type="button"
          title={`Page ${i + 1} — click to edit`}
          aria-label={`Page ${i + 1}`}
          onClick={() => onPick(i)}
          style={{ flex: 'none', padding: 0, border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
        >
          <div style={{ width: pageWidth * scale, height: pageHeight * scale, overflow: 'hidden', position: 'relative', boxShadow: 'var(--shadow-page)' }}>
            <div
              ref={(el) => { pageRefs.current[i] = el; }}
              style={{ width: pageWidth, height: pageHeight, overflow: 'hidden', transform: `scale(${scale})`, transformOrigin: 'top left' }}
            />
          </div>
          <span style={{ fontSize: 11, color: 'var(--t27,#7d7b76)' }}>{i + 1}</span>
        </button>
      ))}
    </div>
  );
}
