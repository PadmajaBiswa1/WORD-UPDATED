import { test, expect } from '@playwright/test';
import JSZip from 'jszip';

async function openExportEditor(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('etherxword_seen_splash', '1');
    localStorage.setItem('etherx_token', 'export-test');
    localStorage.setItem('etherx_user', JSON.stringify({ id: 'export-test', name: 'Export Test' }));
  });
  await page.route('**/api/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(new URL(route.request().url()).pathname === '/api/documents/export-test'
      ? { id: 'export-test', title: 'Image export', content: '<p>Export content.</p>' } : []),
  }));
  await page.goto('/doc/export-test');
  await page.waitForFunction(() => !!window.__ETHERX_EDITOR__);
}

async function exportArchive(page, html) {
  const bytes = await page.evaluate(async (html) => {
    const { buildDocxBlob } = await import('/src/services/export.js');
    const blob = await buildDocxBlob(html);
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, html);
  return JSZip.loadAsync(Buffer.from(bytes));
}

test('DOCX embeds uploaded pictures with relative paths', async ({ page }) => {
  await openExportEditor(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 40; canvas.height = 20;
    canvas.getContext('2d').fillRect(0, 0, 40, 20);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const image = Buffer.from(png, 'base64');
  await page.route('**/uploads/uploaded.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: image }));
  const html = '<p>Before picture.</p><img src="/uploads/uploaded.png" alt="Uploaded picture" width="40" height="20"><p>After picture.</p>';
  await page.evaluate((html) => window.__ETHERX_EDITOR__.commands.setContent(html), html);
  await expect(page.locator('.tiptap.ProseMirror img')).toHaveJSProperty('naturalWidth', 40);
  const zip = await exportArchive(page, html);
  const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/') && !zip.files[name].dir);
  expect(media).toHaveLength(1);
  expect(await zip.file(media[0]).async('nodebuffer')).toEqual(image);
  const xml = await zip.file('word/document.xml').async('string');
  expect(xml).toContain('Before picture.');
  expect(xml).toContain('After picture.');
  expect(xml).toContain('<a:blip');
});

test('DOCX converts uploaded SVG and WebP and preserves inline, floating, data and blob pictures', async ({ page }) => {
  await openExportEditor(page);
  const vector = '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30"><rect width="60" height="30" fill="red"/><text x="2" y="20">图片</text></svg>';
  const formats = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 60; canvas.height = 30;
    canvas.getContext('2d').fillRect(0, 0, 60, 30);
    return { png: canvas.toDataURL('image/png'), webp: canvas.toDataURL('image/webp') };
  });
  await page.route('**/uploads/vector', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: Buffer.from(vector) }));
  await page.route('**/uploads/photo', (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: Buffer.from(formats.webp.split(',')[1], 'base64') }));
  await page.route('**/doc/uploads/local.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(formats.png.split(',')[1], 'base64') }));
  const blobUrl = await page.evaluate(async (src) => URL.createObjectURL(await (await fetch(src)).blob()), formats.png);
  const html = `<p>Six pictures.</p>
    <img src="/uploads/vector" width="60" height="30">
    <img src="/uploads/photo" width="60" height="30">
    <img src="data:image/svg+xml,${encodeURIComponent(vector)}" width="60" height="30">
    <img src="uploads/local.png" width="60" height="30">
    <img src="${formats.png}" width="60" height="30" style="filter:grayscale(1);opacity:0.5">
    <img src="${blobUrl}" alt="Floating picture" width="60" height="30" data-wrap="inFrontOfText" style="position:absolute;left:120px;top:200px;z-index:2">`;
  const zip = await exportArchive(page, html);
  const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/') && !zip.files[name].dir);
  expect(media).toHaveLength(6);
  for (const name of media) {
    const bytes = await zip.file(name).async('nodebuffer');
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  }
  const xml = await zip.file('word/document.xml').async('string');
  expect(xml.match(/<a:blip /g)).toHaveLength(6);
  expect(xml).toContain('<wp:anchor');
  expect(xml).toContain('Floating picture');
  expect(xml).toContain('Six pictures.');
});

test('DOCX reports the unavailable picture without changing document content', async ({ page }) => {
  await openExportEditor(page);
  await page.route('**/uploads/missing.png', (route) => route.fulfill({ status: 404 }));
  const html = '<p>Keep my content.</p><img src="/uploads/missing.png" alt="Missing screenshot">';
  await page.evaluate((html) => window.__ETHERX_EDITOR__.commands.setContent(html), html);
  const before = await page.evaluate(() => window.__ETHERX_EDITOR__.getHTML());
  await expect(exportArchive(page, html)).rejects.toThrow('Missing screenshot');
  expect(await page.evaluate(() => window.__ETHERX_EDITOR__.getHTML())).toBe(before);
});
