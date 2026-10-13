import { describe, it, expect } from 'vitest';
import { pageRule, printableHtml } from '@/utils/printUtils';

describe('pageRule', () => {
  it('uses the document paper size, orientation and margins', () => {
    expect(pageRule({ pageSize: 'letter', pageOrientation: 'landscape', pageMargin: 'narrow' }))
      .toBe('@page { size: Letter landscape; margin: 48px; }');
  });

  it('falls back to A4 portrait with normal margins', () => {
    expect(pageRule({})).toBe('@page { size: A4 portrait; margin: 96px; }');
  });
});

describe('printableHtml', () => {
  it('strips script and event handlers from untrusted content', () => {
    const html = printableHtml('<p>ok</p><img src="x" onerror="alert(1)"><script>alert(2)</script>');
    expect(html).toContain('<p>ok</p>');
    expect(html).not.toMatch(/onerror|<script/);
  });

  it('prints pending suggestions as accepted', () => {
    const html = printableHtml('<p>a <del data-suggestion="s1">old</del><ins data-suggestion="s1">new</ins></p>');
    expect(html).toBe('<p>a new</p>');
  });
});
