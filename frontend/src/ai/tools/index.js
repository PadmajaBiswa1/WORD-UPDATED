import { getOutline, readBlocks, findText, getSelection, readTable } from './readTools';
import { replaceText, rewriteBlock, insertBlocks, deleteBlocks, setTableCell } from './editTools';
import { formatText, setBlockStyle, tableAddRow, tableAddColumn, tableDeleteRow, insertTable, addComment } from './structureTools';
import { listComments, replyComment, resolveComment, listChanges, resolveChange } from './reviewTools';
import { insertAtCursor, updatePlan } from './cursorTools';
import { replaceAll, setList, insertPageBreak, insertToc, addFootnote, setLink, insertImage, setHeaderFooter } from './documentTools';

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
  fn('read_table', 'Read a table as rows of cells with cell ids (t1.r0c0) and the paragraph ids inside each cell (use those with replace_text for small edits in a cell).', { table_id: str('table id like t1') }, ['table_id']),
  fn('replace_text', 'Replace an exact phrase inside one block. Preferred for small edits. Shown as a suggestion.', { block_id: str('block id'), find: str('exact current text'), replace: str('new text'), occurrence: { type: 'integer' } }, ['block_id', 'find', 'replace']),
  fn('rewrite_block', "Replace a block's whole text. Shown as a word-level suggestion.", { block_id: str('block id'), text: str('new full text of the block') }, ['block_id', 'text']),
  fn('insert_blocks', 'Insert new content (markdown: paragraphs, headings, lists) after a block. Shown as a suggestion.', { after_id: str('block id to insert after'), markdown: str('content in markdown') }, ['after_id', 'markdown']),
  fn('delete_blocks', 'Suggest deleting whole blocks.', { ids }, ['ids']),
  fn('set_table_cell', "Replace a whole table cell's text; separate paragraphs with \\n to keep the cell's paragraphs. For small fixes use replace_text on the cell's paragraph ids instead. Shown as a suggestion.", { cell_id: str('cell id like t1.r2c1'), text: str('new cell text') }, ['cell_id', 'text']),
  fn('format_text', 'Format a phrase, a whole block (omit find), or the whole document (block_id "all").', { block_id: str('block id, or "all" for the whole document'), find: str('exact phrase'), bold: { type: 'boolean' }, italic: { type: 'boolean' }, underline: { type: 'boolean' }, color: str('CSS color like #c00000'), font_size: { type: 'number', description: 'points' }, font_family: str('font name like Georgia, Arial, Times New Roman') }, ['block_id']),
  fn('set_block_style', 'Set block style (normal, h1-h4), alignment and line spacing.', { ids, style: { type: 'string', enum: ['normal', 'h1', 'h2', 'h3', 'h4'] }, align: { type: 'string', enum: ['left', 'center', 'right', 'justify'] }, line_spacing: { type: 'number' } }, ['ids']),
  fn('table_add_row', 'Add a row after row index (0-based).', { table_id: str('table id'), index: { type: 'integer' } }, ['table_id']),
  fn('table_add_column', 'Add a column after column index (0-based).', { table_id: str('table id'), index: { type: 'integer' } }, ['table_id']),
  fn('table_delete_row', 'Delete the row at index (0-based).', { table_id: str('table id'), index: { type: 'integer' } }, ['table_id', 'index']),
  fn('insert_table', 'Insert a new table after a block. rows is an array of rows, each an array of cell texts.', { after_id: str('block id'), rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } }, ['after_id', 'rows']),
  fn('add_comment', 'Leave a comment on a phrase (or whole block) for the user.', { block_id: str('block id'), find: str('exact phrase'), text: str('comment text') }, ['block_id', 'text']),
  fn('list_comments', "List the document's comment threads: id, author, text, replies, and the block id and quoted text a comment is anchored to.", { include_resolved: { type: 'boolean' } }),
  fn('reply_comment', 'Reply to a comment thread as Pragna.', { comment_id: str('comment id'), text: str('reply text') }, ['comment_id', 'text']),
  fn('resolve_comment', 'Mark a comment thread resolved once it has been addressed.', { comment_id: str('comment id') }, ['comment_id']),
  fn('list_changes', "List the user's tracked changes (insertions and deletions) with change ids tc#, text and block id.", {}),
  fn('replace_all', 'Replace a word or phrase everywhere in the document in one step. Shown as one suggestion.', { find: str('exact text to find'), replace: str('replacement text'), match_case: { type: 'boolean', description: 'default true' } }, ['find', 'replace']),
  fn('set_list', 'Make blocks a bullet, numbered or task list, or remove the list (kind "none").', { ids, kind: { type: 'string', enum: ['bullet', 'ordered', 'task', 'none'] } }, ['ids', 'kind']),
  fn('insert_page_break', 'Insert a page break after a block.', { after_id: str('block id') }, ['after_id']),
  fn('insert_toc', 'Insert a table of contents built from the headings, after a block. Shown as a suggestion.', { after_id: str('block id') }, ['after_id']),
  fn('add_footnote', 'Add a numbered footnote: a [n] marker after the phrase (or block end) and the note at the end of the document.', { block_id: str('block id'), find: str('phrase the note refers to'), text: str('footnote text') }, ['block_id', 'text']),
  fn('set_link', 'Turn a phrase (or whole block) into a hyperlink.', { block_id: str('block id'), find: str('exact phrase'), url: str('http(s) or mailto URL') }, ['block_id', 'url']),
  fn('insert_image', 'Insert an image from a URL after a block.', { after_id: str('block id'), url: str('http(s) image URL'), alt: str('alt text describing the image') }, ['after_id', 'url']),
  fn('set_header_footer', 'Set the page header text, footer text, and whether page numbers show. Omitted fields stay as they are.', { header: str('header text'), footer: str('footer text'), page_numbers: { type: 'boolean' } }),
  fn('insert_at_cursor', "Write text at the user's cursor (as it was when they asked), or replace their selection. Plain text goes inline; markdown with headings, lists or blank lines goes in as new blocks after the cursor's block. Shown as a suggestion.", { text: str('text or markdown to insert'), replace_selection: { type: 'boolean', description: 'replace the selected text instead of inserting' } }, ['text']),
  fn('update_plan', 'Show the user your plan for a multi-step task as a checklist; call again to mark steps active or done.', { steps: { type: 'array', items: { type: 'object', properties: { text: str('step'), status: { type: 'string', enum: ['pending', 'active', 'done'] } }, required: ['text'] } } }, ['steps']),
  fn('resolve_change', 'Accept or reject one tracked change by id from list_changes, or every change with change_id "all".', { change_id: str('change id like tc2, or "all"'), accept: { type: 'boolean', description: 'true accepts, false rejects' } }, ['change_id', 'accept']),
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
  list_comments: listComments,
  reply_comment: replyComment,
  resolve_comment: resolveComment,
  list_changes: listChanges,
  resolve_change: resolveChange,
  insert_at_cursor: insertAtCursor,
  update_plan: updatePlan,
  replace_all: replaceAll,
  set_list: setList,
  insert_page_break: insertPageBreak,
  insert_toc: insertToc,
  add_footnote: addFootnote,
  set_link: setLink,
  insert_image: insertImage,
  set_header_footer: setHeaderFooter,
};

export const EDITING_TOOLS = new Set(['replace_text', 'rewrite_block', 'insert_blocks', 'delete_blocks', 'set_table_cell', 'replace_all', 'insert_toc', 'add_footnote', 'insert_at_cursor']);

export function executeTool(name, rawArgs, ctx) {
  // Own keys only: `constructor`, `toString` etc. are not tools.
  const handler = Object.hasOwn(HANDLERS, name) ? HANDLERS[name] : null;
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
