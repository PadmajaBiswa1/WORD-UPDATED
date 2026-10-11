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
});
