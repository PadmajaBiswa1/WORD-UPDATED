import { describe, it, expect, vi } from 'vitest';
import { createTestEditor } from './testEditor';
import { BlockRefs } from '@/ai/blockRefs';
import { getOutline, readBlocks, findText, readTable, getSelection } from '@/ai/tools/readTools';
import { replaceText, rewriteBlock, insertBlocks, deleteBlocks, setTableCell } from '@/ai/tools/editTools';

const setup = (html) => {
  const editor = createTestEditor(html);
  return { editor, ctx: { editor, refs: new BlockRefs(editor) } };
};
const idOf = (outline, start) => outline.blocks.find((b) => b.text.startsWith(start)).id;

describe('read tools', () => {
  it('outlines blocks with ids and pages', () => {
    const { ctx } = setup('<h2>Intro</h2><p>Hello world</p>');
    const out = getOutline({}, ctx);
    expect(out.blocks.map((b) => [b.type, b.text])).toEqual([['heading2', 'Intro'], ['paragraph', 'Hello world']]);
    expect(out.next_page).toBeNull();
  });

  it('finds text and reads blocks', () => {
    const { ctx } = setup('<p>alpha beta</p><p>gamma</p>');
    const hits = findText({ query: 'GAMMA' }, ctx);
    expect(hits.matches).toHaveLength(1);
    expect(readBlocks({ ids: [hits.matches[0].block_id] }, ctx).blocks[0].text).toBe('gamma');
  });

  it('reads a table with cell ids', () => {
    const { ctx } = setup('<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>');
    const outline = getOutline({}, ctx);
    const t = outline.blocks.find((b) => b.type === 'table');
    const table = readTable({ table_id: t.id }, ctx);
    expect(table.rows[0]).toEqual([{ cell_id: `${t.id}.r0c0`, text: 'a' }, { cell_id: `${t.id}.r0c1`, text: 'b' }]);
  });

  it('reports unknown ids as errors', () => {
    const { ctx } = setup('<p>x</p>');
    expect(readBlocks({ ids: ['b99'] }, ctx).blocks[0].error).toMatch(/unknown/);
  });
});

describe('edit tools', () => {
  it('replace_text makes a word-level suggestion', () => {
    const { editor, ctx } = setup('<p>MongoDB store data</p>');
    const id = idOf(getOutline({}, ctx), 'MongoDB');
    const r = replaceText({ block_id: id, find: 'store', replace: 'stores' }, ctx);
    expect(r.ok).toBe(true);
    expect(editor.getHTML()).toContain('<del data-suggestion=');
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe('<p>MongoDB stores data</p>');
  });

  it('rewrite twice keeps one original-to-final diff', () => {
    const { editor, ctx } = setup('<p>teh quick fox</p>');
    const id = idOf(getOutline({}, ctx), 'teh');
    rewriteBlock({ block_id: id, text: 'the quick fox' }, ctx);
    rewriteBlock({ block_id: id, text: 'the quick brown fox' }, ctx);
    expect(readBlocks({ ids: [id] }, ctx).blocks[0].text).toBe('the quick brown fox');
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe('<p>teh quick fox</p>');
  });

  it('rewrites a block Pragna inserted without touching its neighbours', () => {
    const { editor, ctx } = setup('<p>first</p><p>last</p>');
    insertBlocks({ after_id: idOf(getOutline({}, ctx), 'first'), markdown: 'draft line' }, ctx);
    const inserted = idOf(getOutline({}, ctx), 'draft');
    rewriteBlock({ block_id: inserted, text: 'final line' }, ctx);
    expect(editor.getText()).toContain('final line');
    expect(editor.getText()).toContain('last');
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe('<p>first</p><p>last</p>');
  });

  it('replace_text reports a missing phrase', () => {
    const { ctx } = setup('<p>abc</p>');
    const id = idOf(getOutline({}, ctx), 'abc');
    expect(replaceText({ block_id: id, find: 'zzz', replace: 'y' }, ctx).error).toMatch(/not found/);
  });

  it('insert_blocks inserts suggested paragraphs after a block; reject removes them', () => {
    const { editor, ctx } = setup('<p>first</p><p>last</p>');
    const id = idOf(getOutline({}, ctx), 'first');
    insertBlocks({ after_id: id, markdown: 'new **bold** line' }, ctx);
    expect(editor.getText()).toContain('new bold line');
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe('<p>first</p><p>last</p>');
  });

  it('delete_blocks marks then accept removes', () => {
    const { editor, ctx } = setup('<p>keep</p><p>drop</p>');
    const id = idOf(getOutline({}, ctx), 'drop');
    deleteBlocks({ ids: [id] }, ctx);
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe('<p>keep</p>');
  });

  it('set_table_cell rewrites one cell', () => {
    const { editor, ctx } = setup('<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>');
    const t = getOutline({}, ctx).blocks.find((b) => b.type === 'table');
    setTableCell({ cell_id: `${t.id}.r0c1`, text: 'B2' }, ctx);
    editor.commands.acceptAllSuggestions();
    expect(editor.getText()).toContain('B2');
  });
});

describe('tool safety', () => {
  it('returns { error } instead of throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(getOutline({}, {}).error).toMatch(/failed/);
    expect(spy).toHaveBeenCalled();
    expect(replaceText({ block_id: 'b1', find: 'a' }, {}).error).toBeTruthy();
    expect(setTableCell({ cell_id: 'zz', text: 'x' }, setup('<p>x</p>').ctx).error).toBeTruthy();
    spy.mockRestore();
  });
});

const TABLE = '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>';
const tableOf = (ctx) => getOutline({}, ctx).blocks.find((b) => b.type === 'table');

describe('accepted-view reads', () => {
  it('read_table returns accepted text after set_table_cell, original after reject', () => {
    const { editor, ctx } = setup(TABLE);
    const t = tableOf(ctx);
    setTableCell({ cell_id: `${t.id}.r0c0`, text: 'B2' }, ctx);
    expect(readTable({ table_id: t.id }, ctx).rows[0][0].text).toBe('B2');
    expect(tableOf(ctx).text).toBe('B2 | b');
    editor.commands.rejectAllSuggestions();
    expect(readTable({ table_id: t.id }, ctx).rows[0][0].text).toBe('a');
  });

  it('read_table rejects a non-table id', () => {
    const { ctx } = setup('<p>x</p>');
    const id = getOutline({}, ctx).blocks[0].id;
    expect(readTable({ table_id: id }, ctx).error).toBeTruthy();
  });

  it('get_selection caps at 40 blocks and flags truncation', () => {
    const { editor, ctx } = setup(Array.from({ length: 50 }, (_, i) => `<p>line ${i}</p>`).join(''));
    editor.commands.selectAll();
    const sel = getSelection({}, ctx);
    expect(sel.blocks).toHaveLength(40);
    expect(sel.truncated).toBe(true);
    expect(sel.text.split('\n')).toHaveLength(40);
  });

  it('get_selection text hides pending deletions', () => {
    const { editor, ctx } = setup('<p>MongoDB store data</p>');
    replaceText({ block_id: getOutline({}, ctx).blocks[0].id, find: 'store', replace: 'stores' }, ctx);
    editor.commands.selectAll();
    expect(getSelection({}, ctx).text).toBe('MongoDB stores data');
  });
});

describe('structural edits', () => {
  it('set_table_cell on a two-paragraph cell: accept leaves one paragraph, reject restores both', () => {
    const { editor, ctx } = setup('<table><tbody><tr><td><p>one</p><p>two</p></td></tr></tbody></table>');
    const original = editor.getHTML();
    const t = tableOf(ctx);
    const r = setTableCell({ cell_id: `${t.id}.r0c0`, text: 'merged' }, ctx);
    expect(r.ok).toBe(true);
    expect(r.suggestion_id).toBeTruthy();
    expect(readTable({ table_id: t.id }, ctx).rows[0][0].text).toBe('merged');
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe(original);
    setTableCell({ cell_id: `${t.id}.r0c0`, text: 'merged' }, ctx);
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe(original.replace('<p>one</p><p>two</p>', '<p>merged</p>'));
  });

  it('insert_blocks after a bullet inserts a sibling item, reject restores the list', () => {
    const { editor, ctx } = setup('<ul><li><p>first</p></li><li><p>last</p></li></ul>');
    const original = editor.getHTML();
    const first = getOutline({}, ctx).blocks[0].id;
    expect(insertBlocks({ after_id: first, markdown: '- new item' }, ctx).ok).toBe(true);
    const doc = editor.state.doc;
    const list = doc.firstChild;
    expect(doc.childCount).toBe(1);
    expect(list.childCount).toBe(3);
    expect(list.child(1).textContent).toBe('new item');
    expect(list.child(1).childCount).toBe(1);
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe(original);
  });

  it('insert_blocks with plain text after a bullet wraps it in a new item', () => {
    const { editor, ctx } = setup('<ul><li><p>first</p></li><li><p>last</p></li></ul>');
    const original = editor.getHTML();
    insertBlocks({ after_id: getOutline({}, ctx).blocks[0].id, markdown: 'plain text' }, ctx);
    expect(editor.state.doc.firstChild.childCount).toBe(3);
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe(original);
  });

  it('delete_blocks on one bullet: accept leaves a one-item list, no empty bullet', () => {
    const { editor, ctx } = setup('<ul><li><p>keep</p></li><li><p>drop</p></li></ul>');
    const drop = getOutline({}, ctx).blocks.find((b) => b.text === 'drop').id;
    deleteBlocks({ ids: [drop] }, ctx);
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe('<ul><li><p>keep</p></li></ul>');
  });

  it('insert_blocks with an HTML table: reject removes the whole table', () => {
    const { editor, ctx } = setup('<p>intro</p><p>outro</p>');
    const original = editor.getHTML();
    const r = insertBlocks({
      after_id: getOutline({}, ctx).blocks[0].id,
      markdown: '<table><tbody><tr><td>x</td><td>y</td></tr><tr><td>z</td><td>w</td></tr></tbody></table>',
    }, ctx);
    expect(r.ok).toBe(true);
    expect(editor.getHTML()).toContain('<table');
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe(original);
  });

  it('insert_blocks with a multi-item list after a paragraph: reject restores exactly', () => {
    const { editor, ctx } = setup('<p>intro</p><p>outro</p>');
    const original = editor.getHTML();
    insertBlocks({ after_id: getOutline({}, ctx).blocks[0].id, markdown: '- one\n- two\n- three' }, ctx);
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe(original);
  });

  it('delete_blocks reports all-unknown ids as an error', () => {
    const { ctx } = setup('<p>x</p>');
    expect(deleteBlocks({ ids: ['b99'] }, ctx).error).toMatch(/unknown/);
  });
});
