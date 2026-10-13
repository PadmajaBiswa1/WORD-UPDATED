import { useEditorStore } from '@/store';
import { useEffect, useState, useRef } from 'react';
import { RibbonGroup } from '../RibbonGroup';
import { RibbonButton } from '../RibbonButton';
import { patchTableCells, insertTableCells, activeTable, resizeTable } from '@/utils/tableFormatting';

const GOLD = 'var(--gold, #d4af37)';
const DANGER = '#e5484d';
const columnStyle = { display: 'flex', flexDirection: 'column', gap: 2 };
const rowHeight = { height: 22 };
const fieldStyle = { height: 22, padding: '0 6px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6 };

// 3x3 grid glyph; `fill` marks the cells the command touches, `badge` hints at add/remove.
function GridGlyph({ fill = [], tone = GOLD, badge, size = 20 }) {
  const cell = 16 / 3;
  const marked = new Set(fill.map(([r, c]) => `${r}${c}`));
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => marked.has(`${r}${c}`) && (
        <rect key={`${r}${c}`} x={2 + c * cell} y={2 + r * cell} width={cell} height={cell} fill={tone} opacity="0.85" />
      )))}
      <rect x="2" y="2" width="16" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d={`M2 ${2 + cell}H18M2 ${2 + 2 * cell}H18M${2 + cell} 2V18M${2 + 2 * cell} 2V18`} stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      {badge && (
        <g>
          <circle cx="16" cy="16" r="4" fill={badge === '+' ? GOLD : DANGER} stroke="var(--bg-base, #111)" strokeWidth="1" />
          <path d={badge === '+' ? 'M16 14v4M14 16h4' : 'M14.6 14.6l2.8 2.8M17.4 14.6l-2.8 2.8'} stroke="#111" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

const row = (r) => [[r, 0], [r, 1], [r, 2]];
const col = (c) => [[0, c], [1, c], [2, c]];

function StylesGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="22" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3h17A2.5 2.5 0 0 1 24 5.5V8H2z" fill={GOLD} />
      <rect x="2.6" y="13" width="20.8" height="5" fill={GOLD} opacity="0.22" />
      <path d="M2 13h22M2 18h22M9.3 8v15M16.6 8v15" stroke="currentColor" strokeWidth="0.9" opacity="0.6" />
    </svg>
  );
}

function MergeGlyph({ split }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      {split
        ? <><path d="M11 4v14" stroke={GOLD} strokeWidth="1.4" strokeDasharray="2 1.6" /><path d="M8.5 11H5M5 11l1.6-1.6M5 11l1.6 1.6M13.5 11H17M17 11l-1.6-1.6M17 11l-1.6 1.6" stroke={GOLD} strokeWidth="1.3" strokeLinecap="round" /></>
        : <><rect x="2.6" y="4.6" width="16.8" height="12.8" fill={GOLD} opacity="0.18" /><path d="M4.5 11H9M9 11L7.4 9.4M9 11l-1.6 1.6M17.5 11H13M13 11l1.6-1.6M13 11l1.6 1.6" stroke={GOLD} strokeWidth="1.3" strokeLinecap="round" /></>}
    </svg>
  );
}

function AlignGlyph({ at }) {
  const y = { top: 4, middle: 8, bottom: 12 }[at];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <path d={`M4.5 ${y}h7M4.5 ${y + 2}h5`} stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SizeGlyph({ axis }) {
  const d = axis === 'x' ? 'M2 8h12M2 8l2.5-2.5M2 8l2.5 2.5M14 8l-2.5-2.5M14 8l-2.5 2.5' : 'M8 2v12M8 2L5.5 4.5M8 2l2.5 2.5M8 14l-2.5-2.5M8 14l2.5-2.5';
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={d} stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" /></svg>;
}

function BucketGlyph({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 9l5-5 6 6-5 5a1.4 1.4 0 0 1-2 0L4 11a1.4 1.4 0 0 1 0-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M4.5 10.5h10" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <path d="M16.5 12.5s1.5 1.8 1.5 2.8a1.5 1.5 0 0 1-3 0c0-1 1.5-2.8 1.5-2.8z" fill={color} />
      <rect x="2" y="17" width="16" height="2.4" rx="1" fill={color} />
    </svg>
  );
}

// Colour picker dressed as a ribbon button: the native input sits invisibly on top.
function ColorButton({ label, ariaLabel, value, onChange, icon }) {
  return (
    <label title={label} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 6px', borderRadius: 6, fontSize: 11, color: 'var(--ribbon-ink, var(--text-primary))', cursor: 'pointer' }}>
      {icon}
      <span>{label}</span>
      <input type="color" aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
    </label>
  );
}

export function TableFormatTab() {
  const editor = useEditorStore((state) => state.editor);
  const [sizes, setSizes] = useState({ width: '', columnWidth: '', rowHeight: '' });
  const [shading, setShading] = useState('#d4af37');
  const [borderColor, setBorderColor] = useState('#d4af37');
  const [valign, setValign] = useState('top');
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
  const keepSelection = (event) => event.preventDefault();
  const sizeInput = (label, key, icon) => (
    <label title={label} style={{ ...fieldStyle, justifyContent: 'space-between' }}>
      {icon}<span style={{ minWidth: 44 }}>{label}</span>
      <input type="text" inputMode="numeric" aria-label={label} data-table-size-input="true" data-size-field={key} defaultValue="" onFocus={() => { editingSize.current = true; }} onChange={(event) => setSizes((current) => ({ ...current, [key]: event.target.value }))} onBlur={(event) => { const value = Number(event.currentTarget.value); if (value > 0) resizeTable(editor, { [key]: value }); editingSize.current = false; syncSizes.current(); }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} style={{ width: 40, height: 16, background: 'transparent', color: 'var(--text-primary)', border: 0, fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
      <span style={{ opacity: 0.6 }}>px</span>
    </label>
  );
  const command = (name) => () => name.startsWith('addRow') || name.startsWith('addColumn')
    ? insertTableCells(editor, name) : editor.chain().focus()[name]().run();
  const tool = (label, name, icon, size = 'small') => (
    <RibbonButton key={name} size={size} icon={icon} label={label} title={label} disabled={!editor.can()[name]()} onMouseDown={keepSelection} onClick={command(name)} style={size === 'small' ? rowHeight : undefined} />
  );
  const action = (label, icon, run) => <RibbonButton size="small" icon={icon} label={label} title={label} onMouseDown={keepSelection} onClick={run} style={rowHeight} />;
  const applyAlign = (value) => { setValign(value); patchTableCells(editor, { 'vertical-align': value }); };
  return <>
    <RibbonGroup label="Table Styles">
      <RibbonButton icon={<StylesGlyph />} label="Table Styles" title="Table Styles" dropdown onMouseDown={keepSelection} onClick={() => window.dispatchEvent(new CustomEvent('etherx:open-design-feature', { detail: { feature: 'tableStyles' } }))} />
    </RibbonGroup>
    <RibbonGroup label="Table Size">
      <div style={columnStyle}>{sizeInput('Table width', 'width', <SizeGlyph axis="x" />)}{sizeInput('Column width', 'columnWidth', <SizeGlyph axis="x" />)}{sizeInput('Row height', 'rowHeight', <SizeGlyph axis="y" />)}</div>
    </RibbonGroup>
    <RibbonGroup label="Rows & Columns">
      <div style={{ display: 'flex', gap: 2 }}>
        {tool('Insert Above', 'addRowBefore', <GridGlyph fill={row(0)} badge="+" />, 'large')}
        {tool('Insert Below', 'addRowAfter', <GridGlyph fill={row(2)} badge="+" />, 'large')}
        {tool('Insert Left', 'addColumnBefore', <GridGlyph fill={col(0)} badge="+" />, 'large')}
        {tool('Insert Right', 'addColumnAfter', <GridGlyph fill={col(2)} badge="+" />, 'large')}
      </div>
    </RibbonGroup>
    <RibbonGroup label="Delete">
      <div style={columnStyle}>
        {tool('Delete row', 'deleteRow', <GridGlyph size={16} fill={row(1)} tone={DANGER} />)}
        {tool('Delete column', 'deleteColumn', <GridGlyph size={16} fill={col(1)} tone={DANGER} />)}
        {tool('Delete table', 'deleteTable', <GridGlyph size={16} badge="×" />)}
      </div>
    </RibbonGroup>
    <RibbonGroup label="Merge">
      <div style={{ display: 'flex', gap: 2 }}>
        {tool('Merge Cells', 'mergeCells', <MergeGlyph />, 'large')}
        {tool('Split Cell', 'splitCell', <MergeGlyph split />, 'large')}
      </div>
    </RibbonGroup>
    <RibbonGroup label="Headers">
      <div style={columnStyle}>
        {tool('Header row', 'toggleHeaderRow', <GridGlyph size={16} fill={row(0)} />)}
        {tool('Header column', 'toggleHeaderColumn', <GridGlyph size={16} fill={col(0)} />)}
        {tool('Header cell', 'toggleHeaderCell', <GridGlyph size={16} fill={[[0, 0]]} />)}
      </div>
    </RibbonGroup>
    <RibbonGroup label="Cell">
      <div style={columnStyle}>
        <ColorButton label="Shading" ariaLabel="Cell shading" value={shading} icon={<BucketGlyph color={shading} />} onChange={(value) => { setShading(value); patchTableCells(editor, { 'background-color': value }); }} />
        <div role="radiogroup" aria-label="Cell vertical alignment" style={{ display: 'flex', gap: 2 }}>
          {['top', 'middle', 'bottom'].map((at) => (
            <RibbonButton key={at} size="small" active={valign === at} icon={<AlignGlyph at={at} />} label="" title={`Align ${at}`} onMouseDown={keepSelection} onClick={() => applyAlign(at)} style={{ ...rowHeight, padding: '0 4px' }} />
          ))}
        </div>
        {action('Clear shading', <GridGlyph size={16} badge="×" tone="transparent" />, () => patchTableCells(editor, { 'background-color': null }))}
      </div>
    </RibbonGroup>
    <RibbonGroup label="Borders">
      <div style={columnStyle}>
        {action('All borders', <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" stroke={GOLD} strokeWidth="1.4" /><path d="M8 1.5v13M1.5 8h13" stroke={GOLD} strokeWidth="1.4" /></svg>, () => patchTableCells(editor, { border: `1px solid ${borderColor}` }, true))}
        {action('No borders', <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.8" opacity="0.6" /><path d="M8 1.5v13M1.5 8h13" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.8" opacity="0.6" /></svg>, () => patchTableCells(editor, { border: 'none' }, true))}
        <ColorButton label="Pen color" ariaLabel="Table border color" value={borderColor} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 13l1-3.5L11 2.5l2.5 2.5L6.5 12z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /><rect x="1.5" y="13.6" width="13" height="2" rx="0.8" fill={borderColor} /></svg>} onChange={(value) => { setBorderColor(value); patchTableCells(editor, { border: `1px solid ${value}` }, true); }} />
      </div>
    </RibbonGroup>
  </>;
}
