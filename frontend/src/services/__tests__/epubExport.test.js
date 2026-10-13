import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { buildEpubBlob } from '../epubExport';

const save = vi.hoisted(() => vi.fn());
vi.mock('file-saver', () => ({ default: { saveAs: save } }));

describe('EPUB export', () => {
  it('builds a valid archive with content and metadata without downloading', async () => {
    const { blob, filename } = await buildEpubBlob('Studio export', '<h1>Chapter one</h1><p>Document content.</p>', { author: 'Studio author' });
    const bytes = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob);
    });
    const zip = await JSZip.loadAsync(bytes);
    expect(filename).toBe('Studio export.epub');
    expect(await zip.file('mimetype').async('text')).toBe('application/epub+zip');
    expect(await zip.file('OEBPS/content.opf').async('text')).toContain('Studio author');
    const chapters = Object.keys(zip.files).filter((name) => name.startsWith('OEBPS/') && name.endsWith('.xhtml') && !name.includes('nav'));
    expect(chapters.length).toBeGreaterThan(0);
    expect((await Promise.all(chapters.map((name) => zip.file(name).async('text')))).join('')).toContain('Document content.');
    expect(save).not.toHaveBeenCalled();
  });
});
