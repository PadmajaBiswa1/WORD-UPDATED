import { describe, it, expect } from 'vitest';
import { describeChange, buildHistory } from '@/ai/memory';

describe('describeChange', () => {
  it('summarises edits by quoted text, not run-scoped ids', () => {
    expect(describeChange('replace_text', { block_id: 'b3', find: 'teh', replace: 'the' }, { ok: true, suggestion_id: 's1' }))
      .toEqual({ text: 'Replaced "teh" with "the"', suggestionId: 's1' });
    expect(describeChange('replace_all', { find: 'Acme', replace: 'Globex' }, { ok: true, replaced: 3, suggestion_id: 's2' }).text)
      .toBe('Replaced "Acme" with "Globex" everywhere (3)');
    expect(describeChange('set_list', { ids: ['b1'], kind: 'bullet' }, { ok: true }).text).toBe('Made a bullet list');
    expect(describeChange('resolve_comment', { comment_id: 'c1' }, { ok: true }).text).toBe('Resolved comment c1');
  });

  it('ignores reads, failures and unchanged results', () => {
    expect(describeChange('get_outline', {}, { blocks: [] })).toBeNull();
    expect(describeChange('replace_text', { find: 'a', replace: 'b' }, { error: 'not found' })).toBeNull();
    expect(describeChange('rewrite_block', { text: 'x' }, { ok: true, unchanged: true })).toBeNull();
  });

  it('shortens long quotes', () => {
    const long = 'x'.repeat(200);
    expect(describeChange('rewrite_block', { text: long }, { ok: true, suggestion_id: 's' }).text.length).toBeLessThan(110);
  });
});

describe('buildHistory', () => {
  const messages = [
    { id: 'welcome', role: 'assistant', content: 'Hi' },
    { role: 'user', content: 'fix typos' },
    {
      role: 'assistant', content: 'Fixed 2 typos.', isAgentRun: true,
      changes: [{ text: 'Replaced "teh" with "the"', suggestionId: 's1' }, { text: 'Replaced "adn" with "and"', suggestionId: 's2' }, { text: 'Made a bullet list' }],
    },
    { role: 'assistant', content: 'oops', isError: true },
    { role: 'user', content: 'now bold the title' },
  ];

  it('adds each run\'s changes with their review status', () => {
    const history = buildHistory(messages, new Set(['s2']));
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(history[1].content).toBe([
      'Fixed 2 typos.',
      '',
      'Changes Pragna made in that run:',
      '- Replaced "teh" with "the" (accepted or rejected by the user)',
      '- Replaced "adn" with "and" (still pending review)',
      '- Made a bullet list',
    ].join('\n'));
  });

  it('keeps only the most recent messages', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
    const history = buildHistory(many, new Set(), { limit: 10 });
    expect(history).toHaveLength(10);
    expect(history.at(-1).content).toBe('m29');
  });
});
