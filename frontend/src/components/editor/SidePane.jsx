import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store';
import { documentApi } from '@/services/api';
import { printableHtml } from '@/utils/printUtils';

// The second pane of View > Split (another view of this document) and View >
// View Side by Side (another document). It is a read-only copy; with
// Synchronous Scrolling on it follows the editor's scroll position and the
// editor follows it.
export function SidePane({ pane, source, editor, mainScroll, pageWidth }) {
  const { syncScroll, setSidePane, paneRatio, setPaneRatio } = useUIStore();
  const scrollRef = useRef(null);
  const bodyRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [version, setVersion] = useState(0);
  const syncing = useRef(false);

  // Another document: load it once.
  useEffect(() => {
    if (pane.kind !== 'doc') return undefined;
    let alive = true;
    setDoc(null);
    documentApi.get(pane.id)
      .then((data) => { if (alive) setDoc(data?.document || data); })
      .catch((err) => { if (alive) setDoc({ title: pane.title, error: err.message }); });
    return () => { alive = false; };
  }, [pane.kind, pane.id, pane.title]);

  // Split: refresh the copy when this document changes.
  useEffect(() => {
    if (pane.kind !== 'split' || !editor) return undefined;
    let timer;
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => setVersion((v) => v + 1), 250); };
    editor.on('update', bump);
    return () => { clearTimeout(timer); editor.off('update', bump); };
  }, [pane.kind, editor]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (pane.kind === 'split') {
      if (!source) return;
      const copy = source.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      copy.querySelectorAll('[contenteditable]').forEach((el) => el.setAttribute('contenteditable', 'false'));
      copy.style.pointerEvents = 'none';
      body.replaceChildren(copy);
    }
  }, [pane.kind, source, version]);

  // Synchronous scrolling, by proportion so documents of different length line up.
  useEffect(() => {
    const a = mainScroll;
    const b = scrollRef.current;
    if (!syncScroll || !a || !b) return undefined;
    const follow = (from, to) => () => {
      if (syncing.current) { syncing.current = false; return; }
      const max = from.scrollHeight - from.clientHeight;
      syncing.current = true;
      to.scrollTop = max > 0 ? (from.scrollTop / max) * (to.scrollHeight - to.clientHeight) : 0;
    };
    const onA = follow(a, b);
    const onB = follow(b, a);
    a.addEventListener('scroll', onA, { passive: true });
    b.addEventListener('scroll', onB, { passive: true });
    return () => { a.removeEventListener('scroll', onA); b.removeEventListener('scroll', onB); };
  }, [syncScroll, mainScroll, doc, version]);

  const startDrag = (event) => {
    event.preventDefault();
    const host = scrollRef.current?.parentElement?.parentElement;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const move = (e) => setPaneRatio((e.clientX - rect.left) / rect.width);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const title = pane.kind === 'split' ? 'This document (split)' : (doc?.title || pane.title || 'Document');
  return (
    <div data-side-pane={pane.kind} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: `${(1 - paneRatio) * 100}%`, display: 'flex', zIndex: 4, background: 'var(--t1,#0e0e10)' }}>
      <div role="separator" aria-orientation="vertical" aria-label="Resize panes" onMouseDown={startDrag}
        style={{ width: 6, cursor: 'col-resize', background: 'var(--border)', flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}{syncScroll ? ' · synchronous scrolling' : ''}</span>
          <button type="button" aria-label="Close pane" title="Close" onClick={() => setSidePane(null)}
            style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {pane.kind === 'split'
            ? <div ref={bodyRef} style={{ margin: '0 auto', width: 'max-content' }} />
            : (
              <div style={{ margin: '0 auto', maxWidth: pageWidth, background: 'var(--bg-page,#fff)', color: 'var(--text-primary)', padding: 48, boxShadow: 'var(--shadow-page)' }}>
                {!doc && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>}
                {doc?.error && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Could not open this document: {doc.error}</div>}
                {doc && !doc.error && <div className="ProseMirror-copy" style={{ fontFamily: 'var(--design-body-font, Calibri, sans-serif)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: printableHtml(doc.content || '<p></p>') }} />}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
