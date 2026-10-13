import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { useUIStore } from '@/store';
import { activeTable, resizeTable } from '@/utils/tableFormatting';

// Word-style table chrome: a move handle outside the top-left corner (click selects the whole
// table), a resize square outside the bottom-right corner, and invisible row borders that drag
// row heights. Column borders are dragged by the table extension's own column resizing.
export function TableResizeControls({ editor, scrollContainerRef }) {
  const viewMode = useUIStore((state) => state.viewMode);
  const [bounds, setBounds] = useState(null);
  const drag = useRef(null);
  useEffect(() => {
    if (!editor || viewMode === 'read') { setBounds(null); return undefined; }
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const selected = editor.isEditable && activeTable(editor);
        const dom = selected && editor.view.nodeDOM(selected.pos);
        const table = dom?.matches?.('table') ? dom : dom?.querySelector?.('table');
        if (!table) { setBounds(null); return; }
        const rect = table.getBoundingClientRect();
        const scale = rect.width / table.offsetWidth || 1;
        const rows = Array.from(table.rows).map((row) => { const box = row.getBoundingClientRect(); return { bottom: box.bottom - rect.top, height: box.height / scale }; });
        // The overlay is portaled above the ribbon, so clip it to the visible editor area.
        const view = scrollContainerRef?.current?.getBoundingClientRect() ?? { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
        const clip = { top: view.top - rect.top, right: rect.right - view.right, bottom: rect.bottom - view.bottom, left: view.left - rect.left };
        if (rect.bottom < view.top || rect.top > view.bottom || rect.right < view.left || rect.left > view.right) { setBounds(null); return; }
        setBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, scale, rows, clip });
      });
    };
    update(); editor.on('transaction', update);
    window.addEventListener('scroll', update, true); window.addEventListener('resize', update);
    const move = (event) => {
      if (!drag.current || !editor.isEditable) return;
      const start = drag.current;
      if (start.row != null) resizeTable(editor, { rowHeight: start.height + (event.clientY - start.y) / start.scale, rowIndex: start.row });
      else resizeTable(editor, { width: start.width + (event.clientX - start.x) / start.scale, height: start.height + (event.clientY - start.y) / start.scale });
    };
    const end = () => { drag.current = null; document.body.style.cursor = ''; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
    return () => { cancelAnimationFrame(frame); editor.off('transaction', update); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); end(); };
  }, [editor, viewMode, scrollContainerRef]);
  if (!bounds || !editor?.isEditable) return null;
  const startResize = (event, dimensions, cursor) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = cursor;
    drag.current = { x: event.clientX, y: event.clientY, scale: bounds.scale, ...dimensions };
  };
  const selectWholeTable = (event) => {
    event.preventDefault();
    const table = activeTable(editor);
    if (!table) return;
    const map = TableMap.get(table.node);
    const start = table.pos + 1;
    const { tr, doc } = editor.state;
    editor.view.dispatch(tr.setSelection(CellSelection.create(doc, start + map.map[0], start + map.map[map.map.length - 1])));
    editor.view.focus();
  };
  const { clip } = bounds;
  const square = { position: 'absolute', padding: 0, border: '1px solid var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 2, pointerEvents: 'auto' };
  return createPortal(<div data-table-selection="true" style={{ position: 'fixed', left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height, pointerEvents: 'none', zIndex: 3300, clipPath: `inset(${Math.max(clip.top, -20)}px ${Math.max(clip.right, -20)}px ${Math.max(clip.bottom, -20)}px ${Math.max(clip.left, -20)}px)` }}>
    <button type="button" aria-label="Select table" title="Select table" onPointerDown={selectWholeTable} style={{ ...square, left: -18, top: -18, width: 14, height: 14, cursor: 'move', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M5 0.5v9M0.5 5h9M3.5 2L5 0.5 6.5 2M3.5 8L5 9.5 6.5 8M2 3.5L0.5 5 2 6.5M8 3.5L9.5 5 8 6.5" /></svg>
    </button>
    {bounds.rows.map((row, index) => <div key={`row-${index}`} role="separator" aria-orientation="horizontal" aria-label={`Resize row ${index + 1}`} title={`Drag to resize row ${index + 1}`} onPointerDown={(event) => startResize(event, { row: index, height: row.height }, 'row-resize')} style={{ position: 'absolute', left: 0, right: 0, top: row.bottom - 3, height: 6, cursor: 'row-resize', pointerEvents: 'auto' }} />)}
    <button type="button" aria-label="Resize table" title="Drag to resize table" onPointerDown={(event) => startResize(event, { width: bounds.width / bounds.scale, height: bounds.height / bounds.scale }, 'nwse-resize')} style={{ ...square, right: -10, bottom: -10, width: 8, height: 8, cursor: 'nwse-resize' }} />
  </div>, document.body);
}
