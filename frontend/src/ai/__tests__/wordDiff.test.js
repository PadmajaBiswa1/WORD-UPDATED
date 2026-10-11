import { describe, it, expect } from 'vitest';
import { tokenize, diffWords } from '@/ai/wordDiff';

const join = (ops, keep) => ops.filter((o) => keep.includes(o.type)).map((o) => o.text).join('');

describe('diffWords', () => {
  it('tokenizes words, spaces and punctuation separately', () => {
    expect(tokenize('Hi, you  there.')).toEqual(['Hi', ',', ' ', 'you', '  ', 'there', '.']);
  });

  it('marks a single changed word', () => {
    const ops = diffWords('teh quick fox', 'the quick fox');
    expect(ops).toEqual([
      { type: 'delete', text: 'teh' },
      { type: 'insert', text: 'the' },
      { type: 'equal', text: ' quick fox' },
    ]);
  });

  it('reconstructs both texts', () => {
    const a = 'MongoDB is a NoSQL database that store data.';
    const b = 'MongoDB is a NoSQL database that stores data in documents.';
    const ops = diffWords(a, b);
    expect(join(ops, ['equal', 'delete'])).toBe(a);
    expect(join(ops, ['equal', 'insert'])).toBe(b);
  });

  it('handles empty sides', () => {
    expect(diffWords('', 'new')).toEqual([{ type: 'insert', text: 'new' }]);
    expect(diffWords('old', '')).toEqual([{ type: 'delete', text: 'old' }]);
    expect(diffWords('same', 'same')).toEqual([{ type: 'equal', text: 'same' }]);
  });

  it('falls back to whole replace for very long inputs', () => {
    const a = 'a '.repeat(700);
    const b = 'b '.repeat(700);
    expect(diffWords(a, b)).toEqual([{ type: 'delete', text: a }, { type: 'insert', text: b }]);
  });

  it('keeps Indic words with combining marks whole', () => {
    expect(tokenize('ಕನ್ನಡ')).toEqual(['ಕನ್ನಡ']);
    expect(tokenize('हिन्दी भाषा')).toEqual(['हिन्दी', ' ', 'भाषा']);
  });

  it('diffs Kannada as whole words, never a lone vowel sign', () => {
    expect(diffWords('ನಾನು ಕನ್ನಡ ಕಲಿತೆ', 'ನಾನು ಕನ್ನಡಿ ಕಲಿತೆ')).toEqual([
      { type: 'equal', text: 'ನಾನು ' },
      { type: 'delete', text: 'ಕನ್ನಡ' },
      { type: 'insert', text: 'ಕನ್ನಡಿ' },
      { type: 'equal', text: ' ಕಲಿತೆ' },
    ]);
  });

  it('diffs Hindi as whole words, never a lone vowel sign', () => {
    expect(diffWords('वह भाषा बोलता है', 'वह भाषी बोलता है')).toEqual([
      { type: 'equal', text: 'वह ' },
      { type: 'delete', text: 'भाषा' },
      { type: 'insert', text: 'भाषी' },
      { type: 'equal', text: ' बोलता है' },
    ]);
  });
});
