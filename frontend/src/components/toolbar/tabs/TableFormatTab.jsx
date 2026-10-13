import { useEditorStore } from '@/store';
import { useEffect, useState, useRef } from 'react';
import { RibbonGroup } from '../RibbonGroup';
import { Table2, ChevronDown } from 'lucide-react';
import { patchTableCells, insertTableCells, activeTable, resizeTable } from '@/utils/tableFormatting';

const controlStyle = { height: 22, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-ui)', cursor: 'pointer', whiteSpace: 'nowrap' };
const columnStyle = { display: 'flex', flexDirection: 'column', gap: 2 };

export function TableFormatTab() {
  const editor = useEditorStore((state) => state.editor);
  const [sizes, setSizes] = useState({ width: '', columnWidth: '', rowHeight: '' });
  const editingSize = useRef(false);
  const syncSizes = useRef(() => {});
  useEffect(() => { for (const input of document.querySelectorAll('[data-table-size-input]')) if (document.activeElement !== input) input.value = sizes[input.dataset.sizeField] || ''; }, [sizes]);
  useEffect(() => {
    if (!editor) return undefined;
    const sync = () => {
      if (editingSize.current || document.activeElement?.hasAttribute('data-table-size-input')) return;
      const table = activeTable(editor);
      if (!table) return;
      const dom = editor.view.nodeDOM(table.pos);
      const element = dom?.matches?.('table') ? dom : dom?.querySelector?.('table');
      const cell = editor.view.domAtPos(editor.state.selection.from).node;
      const cellEl = (cell.nodeType === 1 ? cell : cell.parentElement)?.closest?.('td,th');
      setSizes({ width: String(element?.offsetWidth || ''), columnWidth: String(cellEl?.offsetWidth || ''), rowHeight: String(cellEl?.parentElement?.offsetHeight || '') });
    };
    syncSizes.current = sync;
    sync(); editor.on('transaction', sync);
    return () => editor.off('transaction', sync);
  }, [editor]);
  if (!editor) return null;
  const sizeInput = (label, key) => <label style={{ ...controlStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>{label}<input type="text" inputMode="numeric" aria-label={label} data-table-size-input="true" data-size-field={key} defaultValue="" onFocus={() => { editingSize.current = true; }} onChange={(event) => setSizes((current) => ({ ...current, [key]: event.target.value }))} onBlur={(event) => { const value = Number(event.currentTarget.value); if (value > 0) resizeTable(editor, { [key]: value }); editingSize.current = false; syncSizes.current(); }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} style={{ width: 58, height: 18, background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: 0, fontSize: 12 }} /><span>px</span></label>;
  const command = (name) => () => name.startsWith('addRow') || name.startsWith('addColumn')
    ? insertTableCells(editor, name) : editor.chain().focus()[name]().run();
  const tool = (label, name) => <button key={name} type="button" title={label} disabled={!editor.can()[name]()} onMouseDown={(event) => event.preventDefault()} onClick={command(name)} style={{ ...controlStyle, opacity: editor.can()[name]() ? 1 : 0.45 }}>{label}</button>;
  return <>
    <RibbonGroup label="Table Styles">
      <button type="button" title="Table Styles" aria-haspopup="menu" data-design-trigger="true" data-design-name="tableStyles" onMouseDown={(event) => event.preventDefault()} onClick={() => window.dispatchEvent(new CustomEvent('etherx:open-design-feature', { detail: { feature: 'tableStyles' } }))} style={{ ...controlStyle, height: 66, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Table2 size={24} /><span>Table Styles <ChevronDown size={12} style={{ verticalAlign: 'middle' }} /></span>
      </button>
    </RibbonGroup>
    <RibbonGroup label="Table Size"><div style={columnStyle}>{sizeInput('Table width', 'width')}{sizeInput('Column width', 'columnWidth')}{sizeInput('Row height', 'rowHeight')}</div></RibbonGroup>
    <RibbonGroup label="Rows & Columns">
      <div style={{ display: 'flex', gap: 5 }}>
        <div style={columnStyle}>{tool('Row above', 'addRowBefore')}{tool('Row below', 'addRowAfter')}{tool('Delete row', 'deleteRow')}</div>
        <div style={columnStyle}>{tool('Column left', 'addColumnBefore')}{tool('Column right', 'addColumnAfter')}{tool('Delete column', 'deleteColumn')}</div>
      </div>
    </RibbonGroup>
    <RibbonGroup label="Merge & Split">
      <div style={columnStyle}>{tool('Merge cells', 'mergeCells')}{tool('Split cell', 'splitCell')}{tool('Delete table', 'deleteTable')}</div>
    </RibbonGroup>
    <RibbonGroup label="Headers">
      <div style={columnStyle}>{tool('Header row', 'toggleHeaderRow')}{tool('Header column', 'toggleHeaderColumn')}{tool('Header cell', 'toggleHeaderCell')}</div>
    </RibbonGroup>
    <RibbonGroup label="Cell Formatting">
      <div style={columnStyle}>
        <label style={{ ...controlStyle, display: 'flex', alignItems: 'center', gap: 6 }}>Shading <input type="color" aria-label="Cell shading" defaultValue="#d4af37" onChange={(event) => patchTableCells(editor, { 'background-color': event.target.value })} style={{ width: 28, height: 16, padding: 0, border: 0 }} /></label>
        <select aria-label="Cell vertical alignment" style={controlStyle} defaultValue="top" onChange={(event) => patchTableCells(editor, { 'vertical-align': event.target.value })}><option value="top">Align top</option><option value="middle">Align middle</option><option value="bottom">Align bottom</option></select>
        <button type="button" style={controlStyle} onMouseDown={(event) => event.preventDefault()} onClick={() => patchTableCells(editor, { 'background-color': null })}>Clear shading</button>
      </div>
    </RibbonGroup>
    <RibbonGroup label="Borders">
      <div style={columnStyle}>
        <button type="button" style={controlStyle} onMouseDown={(event) => event.preventDefault()} onClick={() => patchTableCells(editor, { border: '1px solid var(--border)' }, true)}>All borders</button>
        <button type="button" style={controlStyle} onMouseDown={(event) => event.preventDefault()} onClick={() => patchTableCells(editor, { border: 'none' }, true)}>No borders</button>
        <label style={{ ...controlStyle, display: 'flex', alignItems: 'center', gap: 6 }}>Color <input type="color" aria-label="Table border color" defaultValue="#d4af37" onChange={(event) => patchTableCells(editor, { border: `1px solid ${event.target.value}` }, true)} style={{ width: 28, height: 16, padding: 0, border: 0 }} /></label>
      </div>
    </RibbonGroup>
  </>;
}
