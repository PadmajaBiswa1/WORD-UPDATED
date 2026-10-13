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
    expect(result.changes).toEqual([expect.objectContaining({ text: 'Replaced "teh" with "the"' })]);
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

  it('aborts the in-flight model call and resolves as stopped', async () => {
    const editor = createTestEditor('<p>x</p>');
    const controller = new AbortController();
    let received = null;
    const agentStep = (payload, opts = {}) => new Promise((resolve, reject) => {
      received = opts.signal;
      // Like fetch: rejects with an AbortError when the signal fires, otherwise never settles.
      opts.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    });
    const pending = runAgent({ editor, prompt: 'p', signal: controller.signal, agentStep });
    await Promise.resolve();
    controller.abort();
    const result = await pending;
    expect(received).toBe(controller.signal);
    expect(result.stopped).toBe(true);
    expect(result.error).toBeUndefined();
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

  it('streams the plan and writes at the cursor captured when the run started', async () => {
    const editor = createTestEditor('<p>Hello world</p>');
    editor.commands.setTextSelection(7);
    const script = [
      () => ({ content: '', tool_calls: [call('update_plan', { steps: [{ text: 'Write greeting', status: 'active' }] })] }),
      () => ({ content: '', tool_calls: [call('insert_at_cursor', { text: 'big ' })] }),
      () => ({ content: 'Done.', tool_calls: [] }),
    ];
    let n = 0;
    const plans = [];
    const result = await runAgent({
      editor,
      prompt: 'add a word here',
      agentStep: async () => ({ success: true, ...script[n++]() }),
      onStep: (s) => { if (s.kind === 'plan') plans.push(s.plan); },
    });
    expect(plans).toEqual([[{ text: 'Write greeting', status: 'active' }]]);
    expect(result.suggestions).toBe(1);
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe('<p>Hello big world</p>');
  });

  it('allows 40 steps by default', async () => {
    const editor = createTestEditor('<p>x</p>');
    let n = 0;
    const result = await runAgent({
      editor,
      prompt: 'loop',
      agentStep: async () => { n += 1; return { success: true, content: '', tool_calls: [call('get_outline', {}, `c${n}`)] }; },
    });
    expect(n).toBe(40);
    expect(result.error).toMatch(/step limit \(40\)/);
  });
});
