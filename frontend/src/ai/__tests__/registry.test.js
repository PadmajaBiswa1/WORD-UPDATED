import { describe, it, expect } from 'vitest';
import { createTestEditor } from './testEditor';
import { BlockRefs } from '@/ai/blockRefs';
import { TOOL_SCHEMAS, executeTool } from '@/ai/tools';
import { RunRecorder } from '@/ai/runRecorder';
import { runAgent } from '@/ai/agentLoop';
import { listSuggestionIds } from '@/ai/suggestions';

describe('tool registry', () => {
  it('lists the 32 spec tools', () => {
    expect(TOOL_SCHEMAS.map((t) => t.function.name).sort()).toEqual([
      'add_comment', 'add_footnote', 'delete_blocks', 'find_text', 'format_text', 'get_outline', 'get_selection',
      'insert_at_cursor', 'insert_blocks', 'insert_image', 'insert_page_break', 'insert_table', 'insert_toc', 'list_changes',
      'list_comments', 'read_blocks', 'read_table', 'replace_all', 'replace_text', 'reply_comment',
      'resolve_change', 'resolve_comment', 'rewrite_block', 'set_block_style', 'set_header_footer',
      'set_link', 'set_list', 'set_table_cell', 'table_add_column', 'table_add_row', 'table_delete_row', 'update_plan',
    ]);
  });

  // backend/lib/agentStep.js rejects a step with more than MAX_TOOLS (64) tools,
  // which would break every agent run.
  it('stays within the backend tool cap', () => {
    expect(TOOL_SCHEMAS.length).toBeLessThanOrEqual(64);
  });

  it('turns bad input into errors', () => {
    const editor = createTestEditor('<p>x</p>');
    const ctx = { editor, refs: new BlockRefs(editor) };
    expect(executeTool('nope', '{}', ctx).error).toMatch(/unknown tool/);
    for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
      expect(executeTool(name, '{}', ctx).error).toMatch(/unknown tool/);
    }
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
    expect(recorder.changed).toBe(false);
    expect(recorder.undo()).toBe(false);
    expect(recorder.skipped).toBe(0);
    expect(editor.getHTML()).toBe('<p>user x</p>');
  });

  it('cannot undo twice', () => {
    const { editor, recorder, ctx, firstId } = setup('<p>alpha</p>');
    const original = editor.getHTML();
    executeTool('format_text', { block_id: firstId(), bold: true }, ctx);
    expect(recorder.undo()).toBe(true);
    expect(editor.getHTML()).toBe(original);
    expect(recorder.changed).toBe(false);
    expect(recorder.undo()).toBe(false);
    expect(editor.getHTML()).toBe(original);
  });

  it('does not record its own undo and stops listening after it', () => {
    const { editor, recorder, ctx, firstId } = setup('<p>alpha</p>');
    executeTool('format_text', { block_id: firstId(), bold: true }, ctx);
    const steps = recorder.items.length;
    expect(recorder.undo()).toBe(true);
    expect(recorder.items).toHaveLength(0);
    expect(recorder.maps).toHaveLength(0);
    editor.commands.insertContentAt(1, 'x');
    expect(recorder.maps).toHaveLength(0);
    expect(steps).toBeGreaterThan(0);
  });

  it('does not dispatch when no inverse step could be applied', () => {
    const { editor, recorder, ctx } = setup('<p>alpha</p><p>beta</p>');
    const id = executeTool('get_outline', {}, ctx).blocks[1].id;
    executeTool('replace_text', { block_id: id, find: 'beta', replace: 'BETA' }, ctx);
    const doc = editor.state.doc;
    editor.view.dispatch(editor.state.tr.delete(doc.child(0).nodeSize, doc.content.size));
    let dispatched = 0;
    editor.on('transaction', () => { dispatched += 1; });
    expect(recorder.undo()).toBe(false);
    expect(recorder.skipped).toBeGreaterThan(0);
    expect(dispatched).toBe(0);
  });
});

describe('whole-run undo after the run finished', () => {
  const call = (name, args, id = name) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
  // Runs a scripted agent: get_outline, then `edits(outline)` tool calls, then a summary.
  const scripted = (editor, edits) => {
    let n = 0;
    return runAgent({
      editor,
      prompt: 'edit',
      agentStep: async ({ messages }) => {
        n += 1;
        if (n === 1) return { success: true, content: '', tool_calls: [call('get_outline', {})] };
        if (n === 2) {
          const outline = JSON.parse(messages[messages.length - 1].content);
          return { success: true, content: '', tool_calls: edits(outline.blocks.map((b) => b.id)) };
        }
        return { success: true, content: 'done', tool_calls: [] };
      },
    });
  };
  const twoEdits = ([b1, b2]) => [
    call('replace_text', { block_id: b1, find: 'alpha beta', replace: 'ALPHA' }, 'c1'),
    call('replace_text', { block_id: b2, find: 'two', replace: 'TWO' }, 'c2'),
  ];

  it('reverts a suggestion the user accepted after the run', async () => {
    const editor = createTestEditor('<p>alpha beta</p><p>one two three</p>');
    const original = editor.getHTML();
    const result = await scripted(editor, twoEdits);
    expect(result.recorder.changed).toBe(true);
    editor.commands.acceptSuggestion(listSuggestionIds(editor.state.doc)[0]);
    expect(result.recorder.undo()).toBe(true);
    expect(result.recorder.skipped).toBe(0);
    expect(editor.getHTML()).toBe(original);
  });

  it('reverts a suggestion the user rejected after the run', async () => {
    const editor = createTestEditor('<p>alpha beta</p><p>one two three</p>');
    const original = editor.getHTML();
    const result = await scripted(editor, twoEdits);
    editor.commands.rejectSuggestion(listSuggestionIds(editor.state.doc)[1]);
    expect(result.recorder.undo()).toBe(true);
    expect(editor.getHTML()).toBe(original);
  });

  it('keeps user typing made after the run finished', async () => {
    const editor = createTestEditor('<p>alpha beta</p><p>one two three</p>');
    const result = await scripted(editor, twoEdits);
    editor.commands.insertContentAt(1, 'USER ');
    expect(result.recorder.undo()).toBe(true);
    expect(result.recorder.skipped).toBe(0);
    expect(editor.getHTML()).toBe('<p>USER alpha beta</p><p>one two three</p>');
  });

  it('stops recording once the recorder is stopped (next run started)', async () => {
    const editor = createTestEditor('<p>alpha beta</p><p>one two three</p>');
    const result = await scripted(editor, twoEdits);
    const maps = result.recorder.maps.length;
    result.recorder.stop();
    editor.commands.insertContentAt(1, 'x');
    expect(result.recorder.maps).toHaveLength(maps);
  });
});
