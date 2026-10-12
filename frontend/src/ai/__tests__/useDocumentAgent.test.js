import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createTestEditor } from './testEditor';

const agentStep = vi.fn();
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, aiApi: { ...actual.aiApi, agentStep: (...args) => agentStep(...args) } };
});

const { useDocumentAgent } = await import('@/ai/useDocumentAgent');

beforeAll(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });

const call = (name, args) => ({ id: name, type: 'function', function: { name, arguments: JSON.stringify(args) } });

function mount(editor) {
  const hook = {};
  function Probe() { Object.assign(hook, useDocumentAgent(editor)); return null; }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Probe)));
  return { hook, unmount: () => act(() => root.unmount()) };
}

// One run that replaces "teh" with "the" in the first block, then finishes.
function editingScript() {
  const script = [
    () => ({ content: '', tool_calls: [call('get_outline', {})] }),
    (msgs) => {
      const outline = JSON.parse(msgs[msgs.length - 1].content);
      return { content: '', tool_calls: [call('replace_text', { block_id: outline.blocks[0].id, find: 'teh', replace: 'the' })] };
    },
    () => ({ content: 'Done.', tool_calls: [] }),
  ];
  let n = 0;
  return async ({ messages }) => ({ success: true, ...script[n++](messages) });
}

describe('useDocumentAgent undoRun', () => {
  it('refuses to undo the previous run while a new run is in progress', async () => {
    const editor = createTestEditor('<p>teh fox</p><p>one two</p>');
    const { hook, unmount } = mount(editor);

    agentStep.mockImplementation(editingScript());
    await act(() => hook.run('fix typos'));
    expect(hook.lastRun.recorder.changed).toBe(true);
    const afterFirst = editor.getHTML();

    // Second run hangs on its first model step.
    let release;
    agentStep.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    let second;
    act(() => { second = hook.run('again'); });
    expect(hook.running).toBe(true);

    // The user edits the document while the second run waits.
    editor.commands.insertContentAt(1, 'X');
    let undone;
    act(() => { undone = hook.undoRun(); });
    expect(undone).toBe(false);
    expect(editor.getHTML()).toBe(afterFirst.replace('<p>', '<p>X'));

    await act(async () => { release({ success: true, content: 'Nothing to do.', tool_calls: [] }); await second; });
    // The first run's recorder was stopped when the second started, so its undo stays refused.
    expect(hook.undoRun()).toBe(false);
    unmount();
  });

  it('still undoes the last run when no other run started', async () => {
    const editor = createTestEditor('<p>teh fox</p>');
    const { hook, unmount } = mount(editor);
    agentStep.mockImplementation(editingScript());
    await act(() => hook.run('fix typos'));
    let undone;
    act(() => { undone = hook.undoRun(); });
    expect(undone).toBe(true);
    expect(editor.getHTML()).toBe('<p>teh fox</p>');
    unmount();
  });
});
