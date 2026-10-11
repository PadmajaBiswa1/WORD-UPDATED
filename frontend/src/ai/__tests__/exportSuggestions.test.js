import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { acceptSuggestionsInHtml } from '@/services/suggestionHtml';
import { buildDocxBlob } from '@/services/export';

// jsdom's Blob has no arrayBuffer()
const readBlob = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsArrayBuffer(blob);
});

const html = '<p><del data-suggestion="s1" data-author="Pragna">teh</del><ins data-suggestion="s1" data-author="Pragna">the</ins> fox <span data-comment-id="c1">here</span></p>';

describe('export of suggestions', () => {
  it('accepts suggestions for non-docx formats', () => {
    expect(acceptSuggestionsInHtml(html)).toBe('<p>the fox here</p>');
  });

  it('writes Word tracked changes into docx', async () => {
    const blob = await buildDocxBlob(html, {});
    const zip = await JSZip.loadAsync(await readBlob(blob));
    const xml = await zip.file('word/document.xml').async('string');
    expect(xml).toMatch(/<w:ins [^>]*w:author="Pragna"/);
    expect(xml).toMatch(/<w:del [^>]*w:author="Pragna"/);
    expect(xml).toContain('<w:delText');
  });
});
