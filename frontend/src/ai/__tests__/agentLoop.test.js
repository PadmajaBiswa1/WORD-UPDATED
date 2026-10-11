import { describe, it, expect } from 'vitest';
import { createTestEditor } from './testEditor';
import { runAgent } from '@/ai/agentLoop';

const call = (name, args, id = name) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });

describe('runAgent', () => {
  it('reads, edits and finishes with a summary', async () => {
    const editor = createTestEditor('<p>teh fox</p>');
    const script = [
      (msgs) => ({ content: '', tool_calls: [call('get_outline', {})] }),
      (msgs) => {
        const outline = JSON.parse(msgs[msgs.length - 1].content);
        return { content: '', tool_calls: [call('replace_text', { block_id: outline.blocks[0].id, find: 'teh', replace: 'the' })] };
      },
      () => ({ content: 'Fixed one typo.', tool_calls: [] }),
    ];
    let n = 0;
    const steps = [];
    const result = await runAgent({
      editor,
      prompt: 'fix typos',
      agentStep: async ({ messages }) => ({ success: true, ...script[n++](messages) }),
      onStep: (s) => steps.push(s.label),
    });
    expect(result.summary).toBe('Fixed one typo.');
    expect(result.suggestions).toBe(1);
    expect(steps.some((l) => l.startsWith('Editing'))).toBe(true);
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe('<p>the fox</p>');
  });

  it('feeds tool errors back instead of failing', async () => {
    const editor = createTestEditor('<p>x</p>');
    const seen = [];
    let n = 0;
    await runAgent({
      editor,
      prompt: 'p',
      agentStep: async ({ messages }) => {
        seen.push(messages[messages.length - 1]);
        return n++ === 0
          ? { success: true, content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_blocks', arguments: '{bad' } }] }
          : { success: true, content: 'done', tool_calls: [] };
      },
    });
    expect(seen[1].role).toBe('tool');
    expect(JSON.parse(seen[1].content).error).toMatch(/JSON/);
  });

  it('stops after maxSteps', async () => {
    const editor = createTestEditor('<p>x</p>');
    const result = await runAgent({
      editor, prompt: 'loop', maxSteps: 3,
      agentStep: async () => ({ success: true, content: '', tool_calls: [call('get_outline', {})] }),
    });
    expect(result.steps).toBe(3);
    expect(result.error).toMatch(/step limit/);
  });

  it('honours an abort signal', async () => {
    const editor = createTestEditor('<p>x</p>');
    const controller = new AbortController();
    controller.abort();
    const result = await runAgent({ editor, prompt: 'p', signal: controller.signal, agentStep: async () => ({ success: true, content: 'x', tool_calls: [] }) });
    expect(result.stopped).toBe(true);
  });

  it('returns an error and detaches listeners when a step throws', async () => {
    const editor = createTestEditor('<p>teh fox</p>');
    const before = editor.emitter?.events?.transaction?.length ?? null;
    let n = 0;
    const result = await runAgent({
      editor,
      prompt: 'fix',
      agentStep: async () => ({ success: true, content: '', tool_calls: [call('get_outline', {})] }),
      onStep: () => { if (n++ === 2) throw new Error('boom'); },
    });
    expect(result.error).toBe('boom');
    expect(result.recorder).toBeTruthy();
    if (before !== null) expect(editor.emitter.events.transaction?.length ?? 0).toBe(before);
    // Listeners are gone: a later edit is not recorded.
    editor.commands.insertContentAt(1, 'x');
    expect(result.recorder.maps).toHaveLength(0);
  });

  it('detaches listeners when setup throws', async () => {
    const editor = createTestEditor('<p>x</p>');
    const result = await runAgent({ editor, prompt: 'p', history: null, agentStep: async () => ({ success: true, content: 'x', tool_calls: [] }) });
    expect(result.error).toBeTruthy();
    expect(result.recorder).toBeTruthy();
    editor.commands.insertContentAt(1, 'y');
    expect(result.recorder.maps).toHaveLength(0);
  });
});
