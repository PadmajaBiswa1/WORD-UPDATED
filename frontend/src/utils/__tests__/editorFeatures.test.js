import { afterEach, describe, expect, it } from 'vitest';
import { Editor, Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { insertBlankPage } from '../blankPage';
import { insertTableCells, patchTableCells, setTableTheme } from '../tableFormatting';
import { parseShapeInfo, updateShapeDataUrl, generateShapeDataUrl } from '../shapeUtils';
import { drawWordArt } from '../wordArt';
import { StyledTableView } from '@/components/editor/StyledTableView';
import { formatCitation } from '@/components/dialogs/ReferenceDialogs';

const Style = Extension.create({ name: 'testTableStyles', addGlobalAttributes: () => [{ types: ['table', 'tableCell', 'tableHeader'], attributes: {
  style: { default: null, parseHTML: (element) => element.getAttribute('style'), renderHTML: (attrs) => attrs.style ? { style: attrs.style } : {} },
  theme: { default: null }, class: { default: null }, textAlign: { default: null },
} }] });
const PageBreak = Node.create({ name: 'pageBreak', group: 'block', atom: true, addAttributes: () => ({ manual: { default: true }, auto: { default: false } }), parseHTML: () => [{ tag: 'div[data-page-break]' }], renderHTML: () => ['div', { 'data-page-break': 'true' }] });
let editor;
afterEach(() => editor?.destroy());
function setup(content) {
  editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit, Table, TableRow, TableCell, TableHeader, Style, PageBreak], content, editorProps: { handleScrollToSelection: () => true } });
  return editor;
}

it('inserts a real blank page and moves remaining blocks after it', () => {
  setup('<p>First</p><p>Last</p>');
  editor.commands.setTextSelection(2);
  expect(insertBlankPage(editor)).toBe(true);
  expect(editor.getJSON().content.map((node) => node.type)).toEqual(['paragraph', 'pageBreak', 'paragraph', 'pageBreak', 'paragraph']);
  expect(editor.state.selection.$from.parent.textContent).toBe('');
  expect(editor.getText()).toContain('Last');
});

const table = '<table><tbody><tr><td style="background-color:#ff0000;border:2px solid #000000"><p>A</p></td><td style="background-color:#0000ff"><p>B</p></td></tr><tr><td style="background-color:#00ff00"><p>C</p></td><td style="background-color:#ffff00"><p>D</p></td></tr></tbody></table>';
function selectCell(text) {
  let pos;
  editor.state.doc.descendants((node, offset) => { if (node.isText && node.text === text) pos = offset; });
  editor.commands.setTextSelection(pos);
}
for (const command of ['addRowBefore', 'addRowAfter', 'addColumnBefore', 'addColumnAfter']) {
  it(`${command} inherits nearby cell shading and borders`, () => {
    setup(table);
    selectCell('A');
    const firstCell = editor.state.doc.firstChild.firstChild.firstChild;
    expect(insertTableCells(editor, command)).toBe(true);
    const result = editor.state.doc.firstChild;
    const row = command.startsWith('addRow') ? (command.endsWith('Before') ? 0 : 1) : 0;
    const column = command.startsWith('addColumn') ? (command.endsWith('Before') ? 0 : 1) : 0;
    expect(result.child(row).child(column).attrs.style).toBe(firstCell.attrs.style);
    expect(result.childCount).toBe(command.startsWith('addRow') ? 3 : 2);
    expect(result.firstChild.childCount).toBe(command.startsWith('addColumn') ? 3 : 2);
  });
}

it('table shading preserves existing borders and table theme survives HTML', () => {
  setup(table); selectCell('A');
  patchTableCells(editor, { 'background-color': '#d4af37' });
  expect(editor.state.doc.firstChild.firstChild.firstChild.attrs.style).toContain('border:2px solid #000000');
  setTableTheme(editor, 'table-theme-accent');
  expect(editor.getHTML()).toContain('table-theme-accent');
});

it('shape changes preserve custom SVG geometry, no-fill, outline, and text', () => {
  const src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 20L90 20" stroke="#722ed1" fill="none"/></svg>');
  const next = updateShapeDataUrl(src, { fill: 'none', stroke: '#ff0000', strokeWidth: 6, text: 'Test & more', textColor: '#00ff00' });
  expect(decodeURIComponent(next)).toContain('M10 20L90 20');
  expect(parseShapeInfo(next)).toMatchObject({ fill: 'none', stroke: '#ff0000', strokeWidth: 6, text: 'Test & more', textColor: '#00ff00' });
  const hexagon = generateShapeDataUrl({ shapeId: 'hexagon' });
  expect(parseShapeInfo(updateShapeDataUrl(hexagon, { fill: '#2563eb' })).shapeId).toBe('hexagon');
});

it('WordArt gradient uses selected color and all effects render differently', () => {
  const operations = [];
  const stops = [];
  const ctx = { measureText: () => ({ width: 100 }), clearRect: () => {}, fillText: (...args) => operations.push(['fill', ...args]), strokeText: (...args) => operations.push(['stroke', ...args]), createLinearGradient: () => ({ addColorStop: (...args) => stops.push(args) }) };
  const canvas = { getContext: () => ctx };
  drawWordArt(canvas, { text: 'RESH', style: 'gradient', color: '#0a4bb2', font: 'Verdana' });
  expect(stops[0]).toEqual([0, '#0a4bb2']);
  expect(ctx.font).toContain('"Verdana", "EtherX WordArt Verdana"');
  drawWordArt(canvas, { text: 'RESH', style: 'outline' });
  expect(operations.at(-1)[0]).toBe('stroke');
  const fills = operations.length;
  drawWordArt(canvas, { text: 'RESH', style: 'emboss' });
  expect(operations.length - fills).toBe(3);
  drawWordArt(canvas, { text: 'RESH', style: 'glow', color: '#00ff00' });
  expect(ctx.shadowColor).toBe('#00ff00');
});

it('resizable table view renders updated theme, alignment, and inline style', () => {
  setup(table);
  const node = editor.state.doc.firstChild;
  const view = new StyledTableView(node, 25);
  const changed = node.type.create({ ...node.attrs, class: 'table-theme-accent', theme: 'table-theme-accent', style: 'margin-left:auto;margin-right:auto;background-color:#ffffff' }, node.content);
  expect(view.update(changed)).toBe(true);
  expect(view.table.className).toBe('table-theme-accent');
  expect(view.table.style.backgroundColor).toBe('rgb(255, 255, 255)');
});

it('citation style and page number produce distinct APA, MLA, and Chicago citations', () => {
  const source = { author: 'Jane Smith', year: '2026', title: 'Test' };
  expect(formatCitation(source, 'apa', '42')).toBe('(Smith, 2026, p. 42)');
  expect(formatCitation(source, 'mla', '42')).toBe('(Smith 42)');
  expect(formatCitation(source, 'chicago', '42')).toBe('(Smith 2026, 42)');
});
