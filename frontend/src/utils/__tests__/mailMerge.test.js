import { describe, it, expect } from 'vitest';
import { csvToRecipients, recipientsToCsv, mergeDocumentHtml, mergeErrors, labelSheetHtml } from '../mailMerge';

describe('mail merge', () => {
  it('round trips quoted commas, quotes, multiline values, and custom fields', () => {
    const records = [{ Name: 'Ada, "A"', Address: 'First\nSecond', Company: 'A & B' }, { Name: 'Bob', Company: 'Test' }];
    expect(csvToRecipients(recipientsToCsv(records))).toEqual(records.map((row) => ({ Address: '', ...row })));
    expect(() => csvToRecipients('Name,Name\nA,B')).toThrow('unique');
    expect(() => csvToRecipients('Name\n"Ada')).toThrow('quote');
  });
  it('evaluates conditional rules, maps fields, and treats recipient values as text', () => {
    const template = '<p>{{#if FirstName}}Hello {{FirstName}}{{else}}Hello there{{/if}} {{Company}}</p>';
    expect(mergeDocumentHtml(template, { Name: '<Ada>', Company: 'A & B' }, { FirstName: 'Name' })).toBe('<p>Hello &lt;Ada&gt; A &amp; B</p>');
    expect(mergeDocumentHtml(template, { FirstName: '', Company: 'Test' }, {})).toBe('<p>Hello there Test</p>');
  });
  it('checks all recipients instead of just the first record', () => {
    expect(mergeErrors('{{FirstName}} {{Email}}', [{ Name: 'Ada', Email: 'a@example.com' }, { Name: 'Bob' }], { FirstName: 'Name' })).toEqual(['Recipient 2: Email']);
    expect(mergeErrors('{{#if Name}}{{Name}}{{else}}Hello{{/if}}', [{ Name: 'Ada' }], {})).toEqual([]);
  });
  it('builds a label grid that preserves recipient text and has a stable update target', () => {
    const html = labelSheetHtml([{ FirstName: '<Ada>', LastName: 'L', Address: 'A & B' }], 2, 2);
    expect(html).toContain('id="etherx-mailing-labels"');
    expect(html).toContain('&lt;Ada&gt; L<br>A &amp; B');
    expect(html.match(/<td /g)).toHaveLength(4);
  });
});
