import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildOdtContentXml, buildOdtBlob, htmlToPlainText } from '@/services/odtExport';

const HTML = '<h1>Title</h1><p>Hello <strong>bold</strong> &amp; <em>it</em></p><ul><li><p>one</p></li><li><p>two</p></li></ul><table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>';

describe('ODT export', () => {
  it('writes headings, marks, lists and tables as ODF', () => {
    const xml = buildOdtContentXml(HTML);
    expect(xml).toContain('<text:h text:style-name="Heading_20_1" text:outline-level="1">Title</text:h>');
    expect(xml).toContain('<text:span text:style-name="T_b">bold</text:span> &amp; <text:span text:style-name="T_i">it</text:span>');
    expect(xml).toMatch(/<text:list text:style-name="L_bullet"><text:list-item><text:p[^>]*>one<\/text:p><\/text:list-item>/);
    expect(xml).toContain('<table:table-column table:number-columns-repeated="2"/>');
    expect(() => new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror')).not.toThrow();
    expect(new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror')).toBe(null);
  });

  it('packages a valid ODT zip with the mimetype first', async () => {
    const blob = await buildOdtBlob('Doc', HTML);
    const bytes = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsArrayBuffer(blob); });
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
    expect(await zip.file('mimetype').async('string')).toBe('application/vnd.oasis.opendocument.text');
    expect(zip.file('content.xml')).toBeTruthy();
  });
});

describe('plain text export', () => {
  it('keeps paragraphs, bullets and table cells', () => {
    expect(htmlToPlainText(HTML)).toBe('Title\nHello bold & it\n• one\n• two\na\tb\n');
  });
});
