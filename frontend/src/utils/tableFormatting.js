import { parseStyle, toStyle } from './paragraphStyle';
import { selectedRect, TableMap } from '@tiptap/pm/tables';

export function activeTable(editor) {
  if (!editor) return null;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') return { node: $from.node(depth), pos: $from.before(depth) };
  }
  return null;
}

export function patchTableCells(editor, patch, all = false) {
  const table = activeTable(editor);
  if (!table) return false;
  const tr = editor.state.tr;
  const edit = (node, pos) => {
    if (!['tableCell', 'tableHeader'].includes(node.type.name)) return;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, style: toStyle({ ...parseStyle(node.attrs.style), ...patch }) || null });
  };
  const selection = editor.state.selection;
  if (all) table.node.descendants((node, offset) => edit(node, table.pos + offset + 1));
  else if (typeof selection.forEachCell === 'function') selection.forEachCell(edit);
  else {
    const { $from } = selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if (['tableCell', 'tableHeader'].includes($from.node(depth).type.name)) {
        edit($from.node(depth), $from.before(depth));
        break;
      }
    }
  }
  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  return true;
}

export function setTableTheme(editor, theme) {
  const table = activeTable(editor);
  if (!table) return false;
  const className = String(table.node.attrs.class || '').replace(/\btable-theme-[\w-]+\b/g, '').trim();
  const tr = editor.state.tr.setNodeMarkup(table.pos, undefined, { ...table.node.attrs, theme, class: `${className} ${theme}`.trim() });
  editor.view.dispatch(tr);
  return true;
}

export function resizeTable(editor, { width, height, columnWidth, rowHeight, columnIndex, rowIndex } = {}) {
  const table = activeTable(editor);
  if (!table || !editor.isEditable) return false;
  const map = TableMap.get(table.node);
  const rect = selectedRect(editor.state);
  const element = editor.view.nodeDOM(table.pos)?.querySelector('table') || editor.view.nodeDOM(table.pos);
  const currentWidth = element?.offsetWidth || map.width * 100;
  const widths = Array.from({ length: map.width }, (_, index) => {
    const cell = table.node.nodeAt(map.map[index]);
    const first = map.map.indexOf(map.map[index]);
    return cell?.attrs.colwidth?.[index - first] || currentWidth / map.width;
  });
  let requested;
  if (width != null) {
    requested = Math.max(map.width * 25, Number(width) || currentWidth);
    const border = element ? getComputedStyle(element) : null;
    const inner = requested - (parseFloat(border?.borderLeftWidth) || 0) - (parseFloat(border?.borderRightWidth) || 0);
    const total = widths.reduce((sum, value) => sum + value, 0);
    widths.forEach((value, index) => { widths[index] = Math.max(25, Math.floor(value / total * inner)); });
  }
  if (columnWidth != null) for (let column = columnIndex ?? rect.left; column < (columnIndex != null ? columnIndex + 1 : rect.right); column += 1) widths[column] = Math.max(25, Number(columnWidth) || widths[column]);
  const tr = editor.state.tr;
  if (width != null || columnWidth != null) {
    const seen = new Set();
    for (let row = 0; row < map.height; row += 1) for (let column = 0; column < map.width; column += 1) {
      const offset = map.map[row * map.width + column];
      if (seen.has(offset)) continue;
      seen.add(offset);
      const cell = table.node.nodeAt(offset);
      tr.setNodeMarkup(table.pos + offset + 1, undefined, { ...cell.attrs, colwidth: widths.slice(column, column + cell.attrs.colspan) });
    }
    const tableWidth = requested || widths.reduce((sum, value) => sum + value, 0) + 2;
    tr.setNodeMarkup(table.pos, undefined, { ...table.node.attrs, width: String(tableWidth), style: toStyle({ ...parseStyle(table.node.attrs.style), width: `${tableWidth}px` }) });
  }
  if (height != null || rowHeight != null) {
    let offset = table.pos + 1;
    table.node.forEach((row, _, index) => {
      if (height != null || (rowIndex != null ? index === rowIndex : index >= rect.top && index < rect.bottom)) {
        const value = Math.max(24, Number(height != null ? height / map.height : rowHeight) || 24);
        tr.setNodeMarkup(offset, undefined, { ...row.attrs, style: toStyle({ ...parseStyle(row.attrs.style), height: `${Math.round(value)}px` }) });
      }
      offset += row.nodeSize;
    });
  }
  if (tr.docChanged) editor.view.dispatch(tr);
  return tr.docChanged;
}

export function insertTableCells(editor, command) {
  const table = activeTable(editor);
  if (!table) return false;
  const rect = selectedRect(editor.state);
  const isRow = command.startsWith('addRow');
  const before = command.endsWith('Before');
  const index = isRow ? (before ? rect.top : rect.bottom) : (before ? rect.left : rect.right);
  const sourceIndex = isRow ? (before ? rect.top : rect.bottom - 1) : (before ? rect.left : rect.right - 1);
  const oldMap = TableMap.get(table.node);
  const attributes = Array.from({ length: isRow ? oldMap.width : oldMap.height }, (_, i) => {
    const offset = oldMap.map[isRow ? sourceIndex * oldMap.width + i : i * oldMap.width + sourceIndex];
    return table.node.nodeAt(offset)?.attrs || {};
  });
  if (!editor.chain().focus()[command]().run()) return false;
  const next = activeTable(editor);
  if (!next) return true;
  const map = TableMap.get(next.node);
  const tr = editor.state.tr;
  const seen = new Set();
  attributes.forEach((attrs, i) => {
    const offset = map.map[isRow ? index * map.width + i : i * map.width + index];
    if (seen.has(offset)) return;
    seen.add(offset);
    const node = next.node.nodeAt(offset);
    if (!node) return;
    const inherited = {};
    for (const key of ['style', 'textAlign', 'class', 'backgroundColor', 'colwidth']) {
      if (key in node.attrs && key in attrs) inherited[key] = attrs[key];
    }
    tr.setNodeMarkup(next.pos + offset + 1, undefined, { ...node.attrs, ...inherited });
  });
  if (tr.docChanged) editor.view.dispatch(tr);
  return true;
}
