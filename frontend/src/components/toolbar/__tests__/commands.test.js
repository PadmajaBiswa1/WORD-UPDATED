import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COMMANDS } from '../defaultCommands';
import { RIBBON_COMMANDS } from '../../design/ribbonModel';
import dialogSource from '../../dialogs/DialogManager.jsx?raw';
import { useUIStore } from '@/store';
import { createTestEditor } from '@/ai/__tests__/testEditor';
import { FormatPainterService } from '@/services/formatPainter';

afterEach(() => { FormatPainterService.clearFormat(); vi.unstubAllGlobals(); });

describe('studio feature bindings', () => {
  it('resolves every ribbon command to an executable handler', () => {
    const commands = new Map(DEFAULT_COMMANDS.map((command) => [command.id, command]));
    for (const id of Object.values(RIBBON_COMMANDS)) expect(commands.get(id)?.run, id).toBeTypeOf('function');
    expect(new Set(DEFAULT_COMMANDS.map((command) => command.id)).size).toBe(DEFAULT_COMMANDS.length);
  });

  it('renders every dialog requested by a registered command', () => {
    const requested = new Set();
    for (const command of DEFAULT_COMMANDS) {
      for (const match of command.run.toString().matchAll(/openDialog\?\.\(['"]([^'"]+)['"]/g)) requested.add(match[1]);
    }
    for (const name of requested) expect(dialogSource, name).toMatch(new RegExp(`dialogs\\.${name}\\b`));
  });

  it('keeps view and focus controls in shared state', () => {
    const ui = useUIStore.getState();
    for (const mode of ['print', 'web', 'outline', 'draft', 'read']) {
      DEFAULT_COMMANDS.find((command) => command.id === `view-${mode}`).run({ setViewMode: ui.setViewMode });
      expect(useUIStore.getState().viewMode).toBe(mode);
    }
    useUIStore.setState({ focusMode: false });
    DEFAULT_COMMANDS.find((command) => command.id === 'view-focus').run({ toggleFocusMode: ui.toggleFocusMode });
    expect(useUIStore.getState().focusMode).toBe(true);
  });

  it('copies formatting without toggling existing bold off', () => {
    const editor = createTestEditor('<p><strong>source target</strong></p>');
    editor.commands.setTextSelection({ from: 1, to: 7 });
    expect(FormatPainterService.pickFormat(editor)).toBe(true);
    editor.commands.setTextSelection({ from: 8, to: 14 });
    expect(FormatPainterService.applyFormat(editor)).toBe(true);
    expect(editor.isActive('bold')).toBe(true);
    editor.destroy();
  });

  it('does not delete selected text when clipboard access fails', async () => {
    const editor = createTestEditor('<p>Keep this text</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Blocked')) } });
    await DEFAULT_COMMANDS.find((command) => command.id === 'home-cut').run({ editor, toast: vi.fn() });
    expect(editor.getText()).toBe('Keep this text');
    editor.destroy();
  });

  it('pastes plain text without interpreting markup', async () => {
    const editor = createTestEditor('<p></p>');
    const clipboard = { readText: vi.fn().mockResolvedValue('<strong>literal</strong>') };
    vi.stubGlobal('navigator', new Proxy(navigator, { get: (target, key) => key === 'clipboard' ? clipboard : Reflect.get(target, key, target) }));
    await DEFAULT_COMMANDS.find((command) => command.id === 'home-paste').run({ editor, toast: vi.fn() });
    expect(editor.getText()).toBe('<strong>literal</strong>');
    expect(editor.getHTML()).not.toContain('<strong>literal</strong>');
    editor.destroy();
  });
});
