import { test, expect } from '@playwright/test';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } from 'docx';

const itemText = 'Authentication, accounts and settings. Formatting, images and text must remain within each page. ';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><rect width="400" height="260" fill="orange"/></svg>';

async function ui(page, patch) {
  await page.evaluate(async (patch) => {
    // Use the same module URL as the app, including Vite's HMR timestamp.
    const url = performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === '/src/store/index.js').name;
    const { useUIStore } = await import(url);
    useUIStore.setState(patch);
  }, patch);
}

async function openDialog(page, name) {
  await page.evaluate(async (name) => {
    const url = performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === '/src/store/index.js').name;
    const { useUIStore } = await import(url);
    useUIStore.getState().openDialog(name);
  }, name);
}

async function openEditor(page, content = '<p>Existing content.</p>', routePath = '/doc/layout-test') {
  await page.addInitScript(() => {
    sessionStorage.setItem('etherxword_seen_splash', '1');
    localStorage.setItem('etherx_token', 'layout-test');
    localStorage.setItem('etherx_user', JSON.stringify({ id: 'layout-test', name: 'Layout Test', email: 'layout@example.test' }));
  });
  // No test documents or uploads are written to the running backend.
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/upload/image') return route.fulfill({ status: 503, body: 'Offline upload' });
    const body = path === '/api/documents/layout-test' || (path === '/api/documents' && route.request().method() === 'POST')
      ? { id: 'layout-test', title: 'Import layout', content, design: { spacing: '1.15' }, layout: { pageSize: 'a4', pageOrientation: 'portrait', pageMargin: 'normal' } }
      : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(routePath);
  await page.waitForFunction(() => !!window.__ETHERX_EDITOR__);
  await page.evaluate(() => document.fonts.ready);
}

async function layoutErrors(page) {
  return page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === '/src/store/index.js').name;
    const { useUIStore } = await import(url);
    const { getLayoutMetrics } = await import('/src/utils/pageLayout.js');
    const state = useUIStore.getState();
    const metrics = getLayoutMetrics({ size: state.pageSize, orientation: state.pageOrientation, margin: state.pageMargin });
    const pm = window.__ETHERX_EDITOR__.view.dom;
    const scale = pm.getBoundingClientRect().width / pm.offsetWidth;
    const frames = [...document.querySelectorAll('[data-etherx-page-surface="background"]')].map((el) => el.getBoundingClientRect());
    const errors = [];
    for (const el of pm.querySelectorAll('p,h1,h2,h3,h4,h5,h6,img')) {
      const rect = el.getBoundingClientRect();
      if (!rect.height) continue;
      if (!frames.some((frame) => rect.top >= frame.top + metrics.padding * scale - 3 && rect.bottom <= frame.bottom - metrics.padding * scale + 3)) {
        errors.push(el.textContent.slice(0, 40) || el.tagName);
      }
    }
    for (const el of pm.querySelectorAll('.etherx-inner-break > div')) {
      if (el.style.background !== 'var(--bg-app)') continue;
      if (!frames.some((frame) => Math.abs(el.getBoundingClientRect().top - frame.bottom) < 3)) errors.push('Misplaced page gap mask');
    }
    return errors;
  });
}

async function imageGeometry(page, alt) {
  return page.locator(`.tiptap.ProseMirror img[alt="${alt}"]`).evaluate((img) => {
    const root = img.closest('.ProseMirror');
    const rect = img.getBoundingClientRect();
    const origin = root.getBoundingClientRect();
    const scale = origin.width / root.offsetWidth;
    return { left: (rect.left - origin.left) / scale, top: (rect.top - origin.top) / scale, width: rect.width / scale, height: rect.height / scale, connected: img.isConnected };
  });
}

async function insertImage(page, name) {
  await openDialog(page, 'insertImage');
  await page.getByRole('dialog', { name: 'Insert Image' }).locator('input[type="file"]').setInputFiles({ name, mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await expect(page.locator(`.tiptap.ProseMirror img[alt="${name}"]`)).toBeVisible();
}

test('DOCX lists and tables stay inside page margins after import and layout changes', async ({ page }) => {
  await openEditor(page);
  const children = [new Paragraph({ text: 'Import regression', heading: 'Heading1' })];
  for (let i = 0; i < 50; i++) children.push(new Paragraph({ children: [new TextRun({ text: `${i} ${itemText.repeat(2)}`, size: 22 })], bullet: { level: 0 }, spacing: { after: 100 } }));
  children.push(new Table({ width: { size: 9000, type: 'dxa' }, columnWidths: [4500, 4500], rows: Array.from({ length: 25 }, (_, i) => new TableRow({ children: [new TableCell({ children: [new Paragraph(`${i} ${itemText}`)] }), new TableCell({ children: [new Paragraph(itemText)] })] })) }));
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  await openDialog(page, 'importDocx');
  await page.locator('input[type="file"][accept=".docx"]').setInputFiles({ name: 'layout.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer });
  await expect(page.locator('.tiptap.ProseMirror li')).toHaveCount(50);
  await expect(page.locator('.tiptap.ProseMirror tr')).toHaveCount(25);
  const contentText = await page.locator('.tiptap.ProseMirror').evaluate((pm) => pm.textContent);
  await expect.poll(() => layoutErrors(page)).toEqual([]);
  for (const patch of [{ zoom: 50 }, { zoom: 125 }, { zoom: 200 }, { zoom: 100, pageOrientation: 'landscape' }, { pageMargin: 'wide' }]) {
    await ui(page, patch);
    await expect.poll(() => layoutErrors(page)).toEqual([]);
    expect(await page.locator('.tiptap.ProseMirror').evaluate((pm) => pm.textContent)).toBe(contentText);
  }
});

test('opening a new document creates one record despite StrictMode effect replay', async ({ page }) => {
  let creates = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/documents' && request.method() === 'POST') creates += 1;
  });
  await openEditor(page, '<p></p>', '/doc/new');
  await expect(page).toHaveURL(/\/doc\/layout-test$/);
  expect(creates).toBe(1);
});

test('opening a multi-page document does not autosave page spacers as edits', async ({ page }) => {
  let saves = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/documents/layout-test' && request.method() === 'PUT') saves += 1;
  });
  await openEditor(page, Array.from({ length: 40 }, (_, i) => `<p>${i} ${itemText.repeat(2)}</p>`).join(''));
  await expect(page.locator('.tiptap.ProseMirror [data-etherx-auto-break="true"]').first()).toBeAttached();
  await expect.poll(() => layoutErrors(page)).toEqual([]);
  // Wait beyond the autosave debounce to catch unexpected background writes.
  await page.waitForTimeout(1400);
  expect(saves).toBe(0);
});

test('adding pictures preserves existing pictures, including a selected picture', async ({ page }) => {
  await openEditor(page, '<p></p>');
  await insertImage(page, 'first.svg');
  await page.locator('.tiptap.ProseMirror img').click();
  await insertImage(page, 'second.svg');
  await expect(page.locator('.tiptap.ProseMirror img')).toHaveCount(2);
  for (const name of ['first.svg', 'second.svg']) {
    await expect(page.locator(`.tiptap.ProseMirror img[alt="${name}"]`)).toHaveAttribute('src', /^data:image/);
  }
  await expect.poll(() => layoutErrors(page)).toEqual([]);
});

test('Pragna inserts multiple pictures into an empty document and preserves offline sources after reload', async ({ page }) => {
  await openEditor(page, '<p></p>');
  await page.locator('input[type="file"][accept="image/*"][multiple]').setInputFiles([
    { name: 'one.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) },
    { name: 'two.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) },
  ]);
  await expect(page.getByRole('button', { name: 'Remove attachment' })).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Ask Pragna' }).fill('insert images');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.tiptap.ProseMirror img')).toHaveCount(2);
  const content = await page.evaluate(() => window.__ETHERX_EDITOR__.getHTML());
  expect(content).not.toContain('blob:');
  await page.route('**/api/documents/layout-test', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'layout-test', title: 'Saved pictures', content }) }));
  await page.reload();
  await expect(page.locator('.tiptap.ProseMirror img')).toHaveCount(2);
  for (const name of ['one.svg', 'two.svg']) {
    await expect(page.locator(`.tiptap.ProseMirror img[alt="${name}"]`)).toHaveJSProperty('naturalWidth', 400);
  }
});

test('picture drag, resize, cancel and saved geometry remain stable below the last text', async ({ page }) => {
  await openEditor(page, '<p>Above the picture.</p>');
  await page.evaluate(() => window.__ETHERX_EDITOR__.commands.setTextSelection(window.__ETHERX_EDITOR__.state.doc.content.size - 1));
  await insertImage(page, 'moving.svg');
  const image = page.locator('.tiptap.ProseMirror img[alt="moving.svg"]');
  const before = await imageGeometry(page, 'moving.svg');
  const box = await image.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 200, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => (await imageGeometry(page, 'moving.svg')).top).toBeGreaterThan(before.top + 100);
  await expect(image).toBeVisible();
  await expect.poll(() => layoutErrors(page)).toEqual([]);
  const moved = await imageGeometry(page, 'moving.svg');
  const movedBox = await image.boundingBox();
  await page.mouse.move(movedBox.x + movedBox.width / 2, movedBox.y + movedBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(movedBox.x + movedBox.width / 2 + 30, movedBox.y + movedBox.height / 2 + 30, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect.poll(async () => (await imageGeometry(page, 'moving.svg')).top).toBeCloseTo(moved.top, 0);
  const beforeCancel = await page.evaluate(() => window.__ETHERX_EDITOR__.getHTML());
  await image.click();
  expect(await page.evaluate(() => window.__ETHERX_EDITOR__.getHTML())).toBe(beforeCancel);
  const cancelBox = await image.boundingBox();
  await page.mouse.move(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cancelBox.x + cancelBox.width / 2 + 20, cancelBox.y + cancelBox.height / 2 + 40, { steps: 5 });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel')));
  await page.mouse.up();
  await expect.poll(async () => (await imageGeometry(page, 'moving.svg')).top).toBeCloseTo(moved.top, 0);
  expect(await page.evaluate(() => window.__ETHERX_EDITOR__.getHTML())).toBe(beforeCancel);
  const handle = page.locator('[data-etherx-handle="se"]');
  await expect(handle).toBeVisible();
  const corner = await handle.boundingBox();
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(corner.x + corner.width / 2 + 40, corner.y + corner.height / 2 + 26, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await imageGeometry(page, 'moving.svg')).width).toBeGreaterThan(moved.width + 20);
  const saved = await page.evaluate(() => window.__ETHERX_EDITOR__.getHTML());
  await page.evaluate((html) => window.__ETHERX_EDITOR__.commands.setContent(html), saved);
  await expect(image).toBeVisible();
  await expect.poll(() => layoutErrors(page)).toEqual([]);
  await page.locator('.tiptap.ProseMirror p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Still editable.');
  await expect(page.locator('.tiptap.ProseMirror')).toContainText('Still editable.');
});

for (const container of ['list', 'table']) {
test(`moving a picture inside a long ${container} keeps page gaps and surrounding text aligned`, async ({ page }) => {
  const source = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const items = Array.from({ length: 35 }, (_, i) => {
    const content = `<p>${i} ${itemText.repeat(2)}</p>${i === 1 ? `<img src="${source}" alt="nested" width="240" height="150">` : ''}`;
    return container === 'list' ? `<li>${content}</li>` : `<tr><td>${content}</td></tr>`;
  }).join('');
  const blocks = container === 'list' ? `<ul>${items}</ul>` : `<table><tbody>${items}</tbody></table>`;
  await openEditor(page, `<p>Before the content.</p>${blocks}<p>After the content.</p>`);
  await expect.poll(() => layoutErrors(page)).toEqual([]);
  const image = page.locator('.tiptap.ProseMirror img[alt="nested"]');
  const before = await imageGeometry(page, 'nested');
  const text = await page.locator('.tiptap.ProseMirror').textContent();
  const paragraphs = () => page.locator('.tiptap.ProseMirror p').evaluateAll((els) => els.map((el) => {
    const rect = el.getBoundingClientRect();
    const origin = el.closest('.ProseMirror').getBoundingClientRect();
    return { top: rect.top - origin.top, height: rect.height };
  }));
  const originalParagraphs = await paragraphs();
  const box = await image.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2 + 160, { steps: 15 });
  await expect.poll(() => layoutErrors(page)).toEqual([]);
  expect(await paragraphs()).toEqual(originalParagraphs);
  await page.mouse.up();
  await expect.poll(() => layoutErrors(page)).toEqual([]);
  await expect.poll(async () => Math.abs((await imageGeometry(page, 'nested')).top - (before.top + 160 / (720 / 794)))).toBeLessThan(2);
  expect(await page.locator('.tiptap.ProseMirror').textContent()).toBe(text);
  expect(await image.evaluate((img) => img.parentElement.classList.contains('ProseMirror'))).toBe(true);
  const dropped = await imageGeometry(page, 'nested');
  await page.evaluate(() => window.__ETHERX_EDITOR__.commands.undo());
  await expect.poll(() => layoutErrors(page)).toEqual([]);
  await expect.poll(async () => Math.abs((await imageGeometry(page, 'nested')).top - before.top)).toBeLessThan(2);
  expect(await image.evaluate((img) => img.parentElement.classList.contains('ProseMirror'))).toBe(false);
  await page.evaluate(() => window.__ETHERX_EDITOR__.commands.redo());
  await expect.poll(async () => (await imageGeometry(page, 'nested')).top).toBeCloseTo(dropped.top, 0);

  for (const zoom of [50, 125]) {
    await ui(page, { zoom });
    await expect.poll(() => layoutErrors(page)).toEqual([]);
    const previous = await imageGeometry(page, 'nested');
    const box = await image.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 15, box.y + box.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await imageGeometry(page, 'nested')).top).toBeCloseTo(previous.top + 30 / (zoom / 100 * 720 / 794), 0);
    await expect.poll(() => layoutErrors(page)).toEqual([]);
    expect(await page.locator('.tiptap.ProseMirror').textContent()).toBe(text);
  }
  const saved = await page.evaluate(() => window.__ETHERX_EDITOR__.getHTML());
  const savedGeometry = await imageGeometry(page, 'nested');
  await page.route('**/api/documents/layout-test', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'layout-test', title: 'Moved picture', content: saved }) }));
  await page.reload();
  await expect.poll(() => layoutErrors(page)).toEqual([]);
  await expect.poll(async () => (await imageGeometry(page, 'nested')).top).toBeCloseTo(savedGeometry.top, 0);
  await expect(page.locator(container === 'list' ? '.tiptap.ProseMirror li' : '.tiptap.ProseMirror tr')).toHaveCount(35);
});
}

test('document themes preserve text, inline pictures and floating shapes across pages', async ({ page }) => {
  const source = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const paragraphs = Array.from({ length: 10 }, (_, i) => `<p>${i} ${itemText.repeat(2)}</p>`).join('');
  await openEditor(page, `<h2 style="font-family:Georgia;font-size:14pt">Existing heading</h2>${paragraphs}<img src="${source}" alt="inline" width="360"><p>Following picture.</p><img src="${source}" alt="floating shape" width="200" height="125" data-wrap="inFrontOfText" style="position:absolute;left:200px;top:1500px;z-index:2">${paragraphs}`);
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  await expect.poll(() => layoutErrors(page)).toEqual([]);

  const snapshot = () => page.evaluate(() => {
    const editor = window.__ETHERX_EDITOR__;
    const root = editor.view.dom;
    const origin = root.getBoundingClientRect();
    const scale = origin.width / root.offsetWidth;
    const style = getComputedStyle(root);
    return {
      content: editor.state.doc.content.content.filter((node) => node.type.name !== 'pageBreak').map((node) => node.toJSON()),
      font: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      pages: document.querySelectorAll('[data-etherx-page-surface="background"]').length,
      blocks: [...root.querySelectorAll('p,h2,img')].map((el) => {
        const rect = el.getBoundingClientRect();
        return { top: Math.round((rect.top - origin.top) / scale), left: Math.round((rect.left - origin.left) / scale), width: Math.round(rect.width / scale), height: Math.round(rect.height / scale) };
      }),
    };
  });
  const before = await snapshot();
  for (const name of ['Modern Blue', 'Editorial Crimson', 'Royal Gold', 'Emerald Forest', 'Executive Slate', 'Amethyst Creative', 'Warm Amber', 'Celestial Teal', 'Classic Serif', 'Obsidian Prestige']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect.poll(() => page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === '/src/store/index.js').name;
      const { useDocumentStore } = await import(url);
      return useDocumentStore.getState().design.themeName;
    })).toBe(name);
    await expect.poll(() => snapshot(), { message: `${name} keeps page geometry and content` }).toEqual(before);
  }
  await page.getByTitle('Switch to light mode', { exact: true }).click();
  await expect.poll(() => snapshot()).toEqual(before);
  await page.getByTitle('Switch to dark mode', { exact: true }).click();
  await expect.poll(() => snapshot()).toEqual(before);
});
