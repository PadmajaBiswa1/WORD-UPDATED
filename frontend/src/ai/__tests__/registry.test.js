import { describe, it, expect } from 'vitest';
import { createTestEditor } from './testEditor';
import { BlockRefs } from '@/ai/blockRefs';
import { TOOL_SCHEMAS, executeTool } from '@/ai/tools';
import { RunRecorder } from '@/ai/runRecorder';

describe('tool registry', () => {
  it('lists the 17 spec tools', () => {
    expect(TOOL_SCHEMAS.map((t) => t.function.name).sort()).toEqual([
      'add_comment', 'delete_blocks', 'find_text', 'format_text', 'get_outline', 'get_selection',
      'insert_blocks', 'insert_table', 'read_blocks', 'read_table', 'replace_text', 'rewrite_block',
      'set_block_style', 'set_table_cell', 'table_add_column', 'table_add_row', 'table_delete_row',
    ]);
  });

  it('turns bad input into errors', () => {
    const editor = createTestEditor('<p>x</p>');
    const ctx = { editor, refs: new BlockRefs(editor) };
    expect(executeTool('nope', '{}', ctx).error).toMatch(/unknown tool/);
    expect(executeTool('read_blocks', '{not json', ctx).error).toMatch(/JSON/);
    expect(executeTool('get_outline', '{}', ctx).blocks).toHaveLength(1);
  });
});

describe('RunRecorder', () => {
  it('undoes agent edits but keeps the user typing that came after', () => {
    const editor = createTestEditor('<p>alpha</p>');
    const recorder = new RunRecorder(editor);
    const ctx = { editor, refs: new BlockRefs(editor) };
    const id = executeTool('get_outline', {}, ctx).blocks[0].id;
    executeTool('format_text', { block_id: id, bold: true }, ctx);
    editor.commands.insertContentAt(editor.state.doc.content.size, '<p>mine</p>');
    recorder.stop();
    expect(recorder.undo()).toBe(true);
    expect(editor.getHTML()).toBe('<p>alpha</p><p>mine</p>');
  });

  const setup = (html) => {
    const editor = createTestEditor(html);
    const recorder = new RunRecorder(editor);
    const ctx = { editor, refs: new BlockRefs(editor) };
    const firstId = () => executeTool('get_outline', {}, ctx).blocks[0].id;
    return { editor, recorder, ctx, firstId };
  };

  it('reverts a multi-step run whose later edits touch the same range', () => {
    const { editor, recorder, ctx, firstId } = setup('<p>one two three four</p>');
    const original = editor.getHTML();
    const id = firstId();
    expect(executeTool('replace_text', { block_id: id, find: 'two', replace: 'TWO' }, ctx).ok).toBe(true);
    expect(executeTool('replace_text', { block_id: id, find: 'TWO', replace: 'second' }, ctx).ok).toBe(true);
    executeTool('rewrite_block', { block_id: id, text: 'one second three FOUR' }, ctx);
    executeTool('format_text', { block_id: id, find: 'one', bold: true }, ctx);
    expect(editor.getHTML()).not.toBe(original);
    recorder.stop();
    expect(recorder.undo()).toBe(true);
    expect(recorder.skipped).toBe(0);
    expect(editor.getHTML()).toBe(original);
  });

  it('keeps a user edit made inside an agent-edited block', () => {
    const { editor, recorder, ctx, firstId } = setup('<p>alpha beta gamma</p>');
    const id = firstId();
    executeTool('replace_text', { block_id: id, find: 'gamma', replace: 'delta' }, ctx);
    // user types at the very start of the block, before the agent's change
    editor.commands.insertContentAt(1, 'USER ');
    recorder.stop();
    expect(recorder.undo()).toBe(true);
    expect(recorder.skipped).toBe(0);
    expect(editor.getHTML()).toBe('<p>USER alpha beta gamma</p>');
  });

  it('counts skipped steps when the user deleted the agent-changed range', () => {
    const { editor, recorder, ctx, firstId } = setup('<p>alpha</p><p>beta</p>');
    const outline = executeTool('get_outline', {}, ctx);
    const id = outline.blocks[1].id;
    executeTool('replace_text', { block_id: id, find: 'beta', replace: 'BETA' }, ctx);
    // user deletes the whole second paragraph
    const doc = editor.state.doc;
    const from = doc.child(0).nodeSize;
    editor.view.dispatch(editor.state.tr.delete(from, doc.content.size));
    recorder.stop();
    const result = recorder.undo();
    expect(recorder.skipped).toBeGreaterThan(0);
    expect(typeof result).toBe('boolean');
    expect(editor.getHTML()).toContain('<p>alpha</p>');
    expect(editor.getHTML()).not.toContain('BETA');
  });

  it('returns false when the run changed nothing', () => {
    const { editor, recorder, ctx } = setup('<p>x</p>');
    executeTool('get_outline', {}, ctx);
    editor.commands.insertContentAt(1, 'user ');
    recorder.stop();
    expect(recorder.changed).toBe(false);
    expect(recorder.undo()).toBe(false);
    expect(recorder.skipped).toBe(0);
    expect(editor.getHTML()).toBe('<p>user x</p>');
  });

  it('cannot undo twice', () => {
    const { editor, recorder, ctx, firstId } = setup('<p>alpha</p>');
    const original = editor.getHTML();
    executeTool('format_text', { block_id: firstId(), bold: true }, ctx);
    recorder.stop();
    expect(recorder.undo()).toBe(true);
    expect(editor.getHTML()).toBe(original);
    expect(recorder.changed).toBe(false);
    expect(recorder.undo()).toBe(false);
    expect(editor.getHTML()).toBe(original);
  });
});
