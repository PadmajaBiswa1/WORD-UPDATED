import { getOutline, readBlocks, findText, getSelection, readTable } from './readTools';
import { replaceText, rewriteBlock, insertBlocks, deleteBlocks, setTableCell } from './editTools';
import { formatText, setBlockStyle, tableAddRow, tableAddColumn, tableDeleteRow, insertTable, addComment } from './structureTools';

const fn = (name, description, properties, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});
const str = (description) => ({ type: 'string', description });
const ids = { type: 'array', items: { type: 'string' }, description: 'Block ids like b12' };

export const TOOL_SCHEMAS = [
  fn('get_outline', 'List the document blocks in reading order with ids (b#, tables t#) and their first words. 60 per page.', { page: { type: 'integer' } }),
  fn('read_blocks', 'Read the full text of blocks by ids, or a range from_id..to_id (max 40).', { ids, from_id: str('first block id'), to_id: str('last block id') }),
  fn('find_text', 'Find blocks containing text. Returns block ids and snippets.', { query: str('text to find'), match_case: { type: 'boolean' } }, ['query']),
  fn('get_selection', "Get the user's current selection: text and block ids.", {}),
  fn('read_table', 'Read a table as rows of cells with cell ids (t1.r0c0).', { table_id: str('table id like t1') }, ['table_id']),
  fn('replace_text', 'Replace an exact phrase inside one block. Preferred for small edits. Shown as a suggestion.', { block_id: str('block id'), find: str('exact current text'), replace: str('new text'), occurrence: { type: 'integer' } }, ['block_id', 'find', 'replace']),
  fn('rewrite_block', "Replace a block's whole text. Shown as a word-level suggestion.", { block_id: str('block id'), text: str('new full text of the block') }, ['block_id', 'text']),
  fn('insert_blocks', 'Insert new content (markdown: paragraphs, headings, lists) after a block. Shown as a suggestion.', { after_id: str('block id to insert after'), markdown: str('content in markdown') }, ['after_id', 'markdown']),
  fn('delete_blocks', 'Suggest deleting whole blocks.', { ids }, ['ids']),
  fn('set_table_cell', "Set a table cell's text. Shown as a suggestion.", { cell_id: str('cell id like t1.r2c1'), text: str('new cell text') }, ['cell_id', 'text']),
  fn('format_text', 'Format a phrase (or the whole block if find is omitted).', { block_id: str('block id'), find: str('exact phrase'), bold: { type: 'boolean' }, italic: { type: 'boolean' }, underline: { type: 'boolean' }, color: str('CSS color like #c00000'), font_size: { type: 'number', description: 'points' } }, ['block_id']),
  fn('set_block_style', 'Set block style (normal, h1-h4), alignment and line spacing.', { ids, style: { type: 'string', enum: ['normal', 'h1', 'h2', 'h3', 'h4'] }, align: { type: 'string', enum: ['left', 'center', 'right', 'justify'] }, line_spacing: { type: 'number' } }, ['ids']),
  fn('table_add_row', 'Add a row after row index (0-based).', { table_id: str('table id'), index: { type: 'integer' } }, ['table_id']),
  fn('table_add_column', 'Add a column after column index (0-based).', { table_id: str('table id'), index: { type: 'integer' } }, ['table_id']),
  fn('table_delete_row', 'Delete the row at index (0-based).', { table_id: str('table id'), index: { type: 'integer' } }, ['table_id', 'index']),
  fn('insert_table', 'Insert a new table after a block. rows is an array of rows, each an array of cell texts.', { after_id: str('block id'), rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } }, ['after_id', 'rows']),
  fn('add_comment', 'Leave a comment on a phrase (or whole block) for the user.', { block_id: str('block id'), find: str('exact phrase'), text: str('comment text') }, ['block_id', 'text']),
];

const HANDLERS = {
  get_outline: getOutline,
  read_blocks: readBlocks,
  find_text: findText,
  get_selection: getSelection,
  read_table: readTable,
  replace_text: replaceText,
  rewrite_block: rewriteBlock,
  insert_blocks: insertBlocks,
  delete_blocks: deleteBlocks,
  set_table_cell: setTableCell,
  format_text: formatText,
  set_block_style: setBlockStyle,
  table_add_row: tableAddRow,
  table_add_column: tableAddColumn,
  table_delete_row: tableDeleteRow,
  insert_table: insertTable,
  add_comment: addComment,
};

export const EDITING_TOOLS = new Set(['replace_text', 'rewrite_block', 'insert_blocks', 'delete_blocks', 'set_table_cell']);

export function executeTool(name, rawArgs, ctx) {
  const handler = HANDLERS[name];
  if (!handler) return { error: `unknown tool "${name}"` };
  let args = rawArgs;
  if (typeof rawArgs === 'string') {
    try { args = rawArgs.trim() ? JSON.parse(rawArgs) : {}; } catch { return { error: 'arguments were not valid JSON; send a JSON object' }; }
  }
  try {
    return handler(args || {}, ctx);
  } catch (err) {
    return { error: `tool failed: ${err.message}` };
  }
}
