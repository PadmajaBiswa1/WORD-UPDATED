// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Export Service (client-side)
// ═══════════════════════════════════════════════════════════════
import { saveAs } from 'file-saver';
import { PAGE_SIZES, MARGIN_MAP } from '@/utils/pageLayout';
import { useDocumentStore, useUIStore } from '@/store';
import { stripAutoPageBreaks } from '@/components/editor/PageBreak';
import { WORD_SINGLE_LINE } from '@/services/docxImport';
import { acceptSuggestionsInHtml } from '@/services/suggestionHtml';
import { portableExportHtml, exportPageFill, flattenExportMedia, rasterizeExportImage } from './exportAppearance';

export function sanitizeFilename(name) {
  return (name || 'document').replace(/[^a-z0-9_\-\s]/gi, '_').trim() || 'document';
}

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Normalizes color strings from CSS/inline styles.
 * - Converts rgb(r,g,b), rgba, and hex to 6-char uppercase hex (without # for docx, or #rrggbb for HTML)
 * - Detects light/cream/off-white colors (e.g. #F5F1E8, #ffffff, luminance > 0.82) that would be invisible
 *   on standard white/light document backgrounds in external apps and normalizes them to readable dark text (#1a1a1a).
 * - Preserves user-chosen vivid colors (red, blue, gold, green, etc.).
 */
export function normalizeExportColor(colorStr, forDocx = false, preserveLight = false) {
  if (!colorStr || typeof colorStr !== 'string') return undefined;
  const s = colorStr.trim().toLowerCase();
  if (['inherit', 'initial', 'unset', 'transparent', 'currentcolor'].includes(s)) return undefined;
  if (/^rgba\([^)]*,\s*0(?:\.0*)?\s*\)$/.test(s)) return undefined;

  let r = 0, g = 0, b = 0, hasColor = false;

  const hexMatch = s.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
      hasColor = true;
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      hasColor = true;
    }
  }

  const rgbMatch = s.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    r = parseInt(rgbMatch[1], 10);
    g = parseInt(rgbMatch[2], 10);
    b = parseInt(rgbMatch[3], 10);
    hasColor = true;
  }

  if (!hasColor) return undefined;

  // Calculate relative luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.82 && !preserveLight) {
    // Light text on white canvas is invisible; normalize to dark text
    return forDocx ? '1A1A1A' : '#1a1a1a';
  }

  const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
  const hexOut = `${toHex(r)}${toHex(g)}${toHex(b)}`;
  return forDocx ? hexOut : `#${hexOut.toLowerCase()}`;
}

/**
 * Checks whether a DOM node represents a page break element.
 */
export function isPageBreakElement(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName.toLowerCase();

  if (
    el.getAttribute('data-page-break') === 'true' ||
    el.getAttribute('data-manual') === 'true' ||
    el.getAttribute('data-etherx-auto-break') === 'true'
  ) {
    return true;
  }

  if (el.classList) {
    if (
      el.classList.contains('etherx-page-break') ||
      el.classList.contains('etherx-auto-page-break') ||
      el.classList.contains('etherx-manual-page-break')
    ) {
      return true;
    }
  }

  const style = el.style || {};
  if (
    style.pageBreakAfter === 'always' ||
    style.pageBreakBefore === 'always' ||
    style.breakAfter === 'page' ||
    style.breakBefore === 'page'
  ) {
    return true;
  }

  if (tag === 'div' && el.hasAttribute('fillheight')) {
    return true;
  }

  return false;
}

/**
 * Cleans up raw editor HTML for external exports.
 * Preserves page breaks as standard CSS break elements, and normalizes inline color tags.
 */
export function prepareExportHtml(rawHtml = '', options = {}) {
  if (!rawHtml || typeof rawHtml !== 'string') return '<p></p>';

  // Auto page breaks are the editor's on-screen layout spacers; the target format paginates
  // itself, so only manual breaks are exported.
  let html = stripAutoPageBreaks(options.keepSuggestions ? rawHtml : acceptSuggestionsInHtml(rawHtml))
    // Standardize all page break div variations into clean page break elements
    .replace(
      /<div\b[^>]*?(?:data-page-break=["']true["']|class=["'][^"']*?etherx-page-break[^"']*?["']|data-etherx-auto-break=["']true["'])[^>]*>(?:&nbsp;|\s)*<\/div>/gi,
      '<div data-page-break="true" class="etherx-page-break" style="page-break-after: always; break-after: page; height: 0; margin: 0; padding: 0;"></div>'
    )
    // Normalize light off-white inline font colors to dark for light-background reading
    .replace(/style="([^"]*)"/gi, (match, styleBody) => {
      const parts = styleBody.split(';').map((p) => p.trim()).filter(Boolean);
      const updated = parts.map((part) => {
        const [prop, ...valParts] = part.split(':');
        if (!prop || !valParts.length) return part;
        const pName = prop.trim().toLowerCase();
        const pVal = valParts.join(':').trim();
        if (pName === 'color' && !options.preserveColors) {
          const norm = normalizeExportColor(pVal, false);
          return norm ? `color: ${norm}` : '';
        }
        return part;
      }).filter(Boolean);
      return updated.length ? `style="${updated.join('; ')}"` : '';
    });

  // If entirely empty or only whitespace/empty tags, provide minimal placeholder
  const textContent = html.replace(/<[^>]+>/g, '').trim();
  if (!textContent && !/<(?:img|table|iframe|svg)\b/i.test(html) && !/data-page-break/.test(html)) {
    return '<p></p>';
  }

  return html;
}

/**
 * Safely resolves document metadata (headerFooter, design, pageSettings)
 * by merging passed options with active Zustand store states when running in the browser.
 */
export function resolveExportMetadata(options = {}) {
  let docState = {};
  let uiState = {};

  try {
    if (useDocumentStore?.getState) docState = useDocumentStore.getState() || {};
    if (useUIStore?.getState) uiState = useUIStore.getState() || {};
  } catch {}

  const pageSettings = {
    format: options.pageSettings?.format || options.layout?.pageSize || options.format || uiState.pageSize || 'a4',
    orientation: options.pageSettings?.orientation || options.layout?.pageOrientation || options.orientation || uiState.pageOrientation || 'portrait',
    margin: options.pageSettings?.margin || options.layout?.pageMargin || options.margin || uiState.pageMargin || 'normal',
    columns: options.pageSettings?.columns || options.layout?.pageColumns || options.columns || uiState.pageColumns || 1,
    lineNumbers: options.layout?.lineNumbers ?? docState.layout?.lineNumbers ?? false,
    hyphenation: options.layout?.hyphenation ?? docState.layout?.hyphenation ?? false,
  };

  const headerFooter = {
    headerText: (options.headerFooter?.headerText !== undefined
      ? options.headerFooter.headerText
      : (docState.headerFooter?.headerText || '')) || '',
    headerAlign: options.headerFooter?.headerAlign || docState.headerFooter?.headerAlign || 'Center',
    footerText: (options.headerFooter?.footerText !== undefined
      ? options.headerFooter.footerText
      : (docState.headerFooter?.footerText || '')) || '',
    footerAlign: options.headerFooter?.footerAlign || docState.headerFooter?.footerAlign || 'Center',
    pageNumberEnabled: options.headerFooter?.pageNumberEnabled !== undefined
      ? options.headerFooter.pageNumberEnabled
      : Boolean(docState.headerFooter?.pageNumberEnabled),
    pageNumberStyle: options.headerFooter?.pageNumberStyle || docState.headerFooter?.pageNumberStyle || 'bottom-center',
    pageNumberStart: Number(options.headerFooter?.pageNumberStart || docState.headerFooter?.pageNumberStart || 1),
  };

  const design = {
    ...(options.design !== undefined ? options.design : docState.design || {}),
  };

  const watermark = options.watermark || design.watermark || uiState.watermarkText || '';

  return { pageSettings, headerFooter, design, watermark, comments: options.comments || docState.comments || [], references: options.references || docState.references || {} };
}

/* ── HTML ───────────────────────────────────────────────────── */

export function buildHtmlDocument(title, rawHtml, options = {}) {
  const cleanTitle = (title || 'Untitled Document').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const meta = resolveExportMetadata(options);
  const content = prepareExportHtml(portableExportHtml(rawHtml, meta), { ...options, preserveColors: true });
  const { headerFooter, design, pageSettings, watermark } = meta;

  const headingFont = design.headingFont || design.font || 'Crimson Pro';
  const bodyFont = design.bodyFont || design.font || 'Crimson Pro';
  const headingColor = design.heading || design.accent || '#111111';
  const lineSpacing = design.spacing || '1.7';
  const padding = MARGIN_MAP[pageSettings.margin] || MARGIN_MAP.normal;
  const dims = PAGE_SIZES[pageSettings.format] || PAGE_SIZES.a4;
  const width = pageSettings.orientation === 'landscape' ? dims.h : dims.w;
  const fill = exportPageFill(design);
  const border = design.borderSetting && design.borderSetting !== 'none' && design.borderStyle !== 'none';
  const borderCss = ['top', 'right', 'bottom', 'left'].map((side) => `border-${side}:${border && design.borderSides?.[side] !== false ? `${Number(design.borderWidth || 1)}pt ${design.borderStyle || 'solid'} ${design.borderColor || '#6f5320'}` : 'none'};`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${cleanTitle}</title>
  <style>
    @page {
      size: ${pageSettings.format.toUpperCase()} ${pageSettings.orientation};
      margin: ${padding}px;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: "${bodyFont}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 15px;
      line-height: ${lineSpacing};
      color: #1a1a1a;
      background-color: #ffffff;
      max-width: 820px;
      margin: 40px auto;
      padding: 0 32px;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .document-header {
      font-size: 11px;
      color: #71717a;
      text-align: ${String(headerFooter.headerAlign || 'Center').toLowerCase()};
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 8px;
      margin-bottom: 24px;
    }
    .document-footer {
      font-size: 11px;
      color: #71717a;
      text-align: ${String(headerFooter.footerAlign || 'Center').toLowerCase()};
      border-top: 1px solid #e5e5e5;
      padding-top: 8px;
      margin-top: 36px;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: "${headingFont}", serif;
      color: ${headingColor};
      line-height: 1.3;
      margin-top: 1.4em;
      margin-bottom: 0.5em;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eaeaea; padding-bottom: 8px; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    p { margin: 0 0 10pt 0; }
    a { color: #0563c1; text-decoration: underline; }
    blockquote {
      border-left: 4px solid #d4af37;
      margin: 1.2em 0;
      padding-left: 16px;
      color: #555555;
      font-style: italic;
    }
    ul, ol { padding-left: 28px; margin: 0 0 10pt 0; }
    li { margin-bottom: 0.35em; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.5em 0;
    }
    table[align="center"], table[data-align="center"], table.table-align-center {
      margin-left: auto !important;
      margin-right: auto !important;
    }
    table[align="right"], table[data-align="right"], table.table-align-right {
      margin-left: auto !important;
      margin-right: 0 !important;
    }
    table[align="left"], table[data-align="left"], table.table-align-left {
      margin-left: 0 !important;
      margin-right: auto !important;
    }
    th, td {
      border: 1px solid #d0d0d0;
      padding: 8px 12px;
      text-align: left;
    }
    th[style*="text-align: center"], td[style*="text-align: center"], th[align="center"], td[align="center"] {
      text-align: center !important;
    }
    th[style*="text-align: right"], td[style*="text-align: right"], th[align="right"], td[align="right"] {
      text-align: right !important;
    }
    th[style*="text-align: justify"], td[style*="text-align: justify"] {
      text-align: justify !important;
    }
    th { background-color: #f7f7f7; font-weight: 600; }
    img { max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 12px auto; }
    code {
      font-family: Consolas, Monaco, "Courier New", monospace;
      background-color: #f3f3f3;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre {
      background-color: #f7f7f7;
      padding: 14px;
      border-radius: 6px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 2em 0; }
    .etherx-page-break {
      page-break-after: always !important;
      break-after: page !important;
      display: block;
      height: 0;
      margin: 24px 0;
      border-top: 1px dashed rgba(201, 168, 76, 0.4);
    }
    @media print {
      body { margin: 0; padding: 0; max-width: 100%; }
      .etherx-page-break { border-top: none; margin: 0; }
    }
    body { background-image:${design.pageFillImage || 'none'}; max-width:${width}px; padding:${padding}px; background:${fill}; font-size:${Number(design.fontSize) || 12}pt; }
    main { position:relative; isolation:isolate; column-count:${Math.max(1, Number(pageSettings.columns) || 1)}; column-gap:48px; hyphens:${pageSettings.hyphenation ? 'auto' : 'manual'}; }
    main > :not(img):not([data-page-break]) { position:relative; z-index:1; }
    h1 { border:0; padding:0; } h1,h2,h3,h4,h5,h6 { margin:0 0 10pt; }
    img { border-radius:0; margin:0; } table { margin:0 0 10pt; }
    .document-border { position:fixed; inset:${Number(design.borderDistance || 24)}pt; ${borderCss} pointer-events:none; }
    .document-watermark { position:fixed; top:45%; left:50%; transform:translate(-50%,-50%) rotate(-28deg); font-size:78px; font-weight:bold; opacity:.11; pointer-events:none; }
    .document-header,.document-footer { white-space:pre-wrap; border:0; }
    @page { ${headerFooter.pageNumberEnabled ? `@${headerFooter.pageNumberStyle.replace('top-', 'top-').replace('bottom-', 'bottom-')} { content: counter(page); }` : ''} }
    @media print { body { padding:0; background:${fill}; } .document-header { position:fixed; top:-${Math.max(20, padding * .6)}px; left:0; right:0; } .document-footer { position:fixed; bottom:-${Math.max(20, padding * .6)}px; left:0; right:0; } }
  </style>
</head>
<body>
  ${border ? '<div class="document-border"></div>' : ''}
  ${watermark ? `<div class="document-watermark">${escapeHtml(watermark)}</div>` : ''}
  ${headerFooter.headerText ? `<div class="document-header">${escapeHtml(headerFooter.headerText)}</div>` : ''}
  <main>${content}</main>
  ${headerFooter.footerText ? `<div class="document-footer">${escapeHtml(headerFooter.footerText)}</div>` : ''}
</body>
</html>`;
}

export function buildHtmlBlob(title, html, options = {}) {
  const doc = buildHtmlDocument(title, html, options);
  return new Blob([doc], { type: 'text/html;charset=utf-8' });
}

export function exportToHtml(title, html, options = {}) {
  const blob = buildHtmlBlob(title, html, options);
  saveAs(blob, `${sanitizeFilename(title)}.html`);
  return blob;
}

/* ── PDF (Multi-Page A4 Precision via jsPDF + html2canvas) ──── */

/**
 * Splits document content into separate page block arrays.
 * Respects explicit page break elements AND block overflow metrics.
 */
export async function buildPdfBlob(title, htmlOrEl, options = {}) {
  const [{ default: jsPDF }, { default: h2c }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const meta = resolveExportMetadata(options);
  const { pageSettings, headerFooter, design, watermark } = meta;
  const landscape = pageSettings.orientation === 'landscape';
  const format = (pageSettings.format || 'a4').toLowerCase();
  const dims = PAGE_SIZES[format] || PAGE_SIZES.a4;
  const width = landscape ? dims.h : dims.w;
  const height = landscape ? dims.w : dims.h;
  const padding = MARGIN_MAP[pageSettings.margin] || MARGIN_MAP.normal;
  const contentWidth = width - padding * 2;
  const contentHeight = height - padding * 2;
  const raw = typeof htmlOrEl === 'string' ? htmlOrEl : htmlOrEl?.innerHTML || '<p></p>';
  const source = document.createElement('div');
  source.innerHTML = prepareExportHtml(portableExportHtml(raw, meta), { preserveColors: true });
  flattenExportMedia(source);
  for (const image of source.querySelectorAll('img')) if (image.style.filter || image.style.opacity) {
    const raster = await rasterizeExportImage(image.src, { filter: image.style.filter, opacity: image.style.opacity });
    image.src = raster.src; image.style.filter = ''; image.style.opacity = '';
  }
  const sections = [[]];
  for (const node of Array.from(source.childNodes)) {
    if (isPageBreakElement(node)) sections.push([]);
    else sections.at(-1).push(node);
  }
  const pdf = new jsPDF({ orientation: landscape ? 'l' : 'p', unit: 'mm', format });
  pdf.setProperties({ title: title || 'Document', creator: 'EtherX Word' });
  const stage = document.createElement('div');
  stage.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;pointer-events:none;z-index:-99999;`;
  document.body.appendChild(stage);
  let pageIndex = 0;
  try {
    await document.fonts?.ready;
    for (const blocks of sections) {
      const content = document.createElement('div');
      content.style.cssText = `position:relative;isolation:isolate;width:${contentWidth}px;font-family:"${design.bodyFont || design.font || 'Crimson Pro'}",serif;font-size:${Number(design.fontSize) || 12}pt;line-height:${design.spacing || 1.7};color:#1a1a1a;overflow-wrap:break-word;`;
      for (const block of blocks) content.appendChild(block.cloneNode(true));
      content.querySelectorAll('p,h1,h2,h3,h4,h5,h6').forEach((el) => {
        if (!el.style.marginTop) el.style.marginTop = '0';
        if (!el.style.marginBottom) el.style.marginBottom = '10pt';
        if (/^H/.test(el.tagName)) { if (!el.style.fontFamily) el.style.fontFamily = design.headingFont || design.font || 'Crimson Pro'; if (!el.style.color) el.style.color = design.heading || design.accent || '#c9a84c'; }
      });
      content.querySelectorAll('table').forEach((table) => { table.style.borderCollapse = 'collapse'; if (!table.style.width) table.style.width = '100%'; });
      content.querySelectorAll('img').forEach((image) => { image.style.maxWidth = '100%'; });
      const columns = Math.max(1, Number(pageSettings.columns) || 1);
      if (columns > 1) { content.style.columnCount = String(columns); content.style.columnGap = '48px'; content.style.columnFill = 'auto'; content.style.height = `${contentHeight}px`; }
      stage.appendChild(content);
      await Promise.all(Array.from(content.querySelectorAll('img')).map((image) => image.complete && image.naturalWidth ? Promise.resolve() : new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('An image could not be loaded for PDF export')), 15000); image.onload = () => { clearTimeout(timer); resolve(); }; image.onerror = () => { clearTimeout(timer); reject(new Error('An image could not be loaded for PDF export')); }; })));
      const extent = Math.max(content.scrollHeight, content.offsetHeight);
      const cuts = [0];
      if (columns === 1) {
        const bounds = content.getBoundingClientRect();
        const lines = [];
        const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const range = document.createRange(); range.selectNodeContents(walker.currentNode);
          for (const rect of range.getClientRects()) if (rect.height) lines.push({ top: rect.top - bounds.top, bottom: rect.bottom - bounds.top });
        }
        while (cuts.at(-1) + contentHeight < extent) {
          const target = cuts.at(-1) + contentHeight;
          const intersecting = lines.filter((line) => line.top < target && line.bottom > target);
          const safe = intersecting.length ? Math.min(...intersecting.map((line) => line.top)) : target;
          cuts.push(safe > cuts.at(-1) + contentHeight * .5 ? safe : target);
        }
      } else {
        const pages = Math.max(1, Math.ceil((content.scrollWidth + 48) / (contentWidth + 48)));
        for (let index = 1; index < pages; index += 1) cuts.push(index * (contentWidth + 48));
      }
      for (const [slice, offset] of cuts.entries()) {
        const page = document.createElement('div');
        page.style.backgroundImage = design.pageFillImage || 'none';
        page.style.cssText = `position:relative;width:${width}px;height:${height}px;background:${exportPageFill(design)};font-family:"${design.bodyFont || design.font || 'Crimson Pro'}",serif;overflow:hidden;`;
        page.style.backgroundImage = design.pageFillImage || 'none';
        if (watermark) {
          const wm = document.createElement('div'); wm.textContent = watermark;
          wm.style.cssText = 'position:absolute;left:50%;top:45%;transform:translate(-50%,-50%) rotate(-28deg);font-size:78px;font-weight:bold;opacity:.11;color:#6f5320;white-space:nowrap;'; page.appendChild(wm);
        }
        if (design.borderSetting && design.borderSetting !== 'none' && design.borderStyle !== 'none') {
          const frame = document.createElement('div');
          frame.style.cssText = `position:absolute;inset:${Number(design.borderDistance || 24) * 96 / 72}px;box-sizing:border-box;`;
          for (const side of ['Top','Right','Bottom','Left']) frame.style[`border${side}`] = design.borderSides?.[side.toLowerCase()] === false ? 'none' : `${Number(design.borderWidth || 1) * 96 / 72}px ${design.borderStyle || 'solid'} ${design.borderColor || '#6f5320'}`;
          if (design.borderSetting === 'shadow') frame.style.boxShadow = '3px 3px 0 rgba(0,0,0,.35)';
          page.appendChild(frame);
        }
        const number = pageIndex + headerFooter.pageNumberStart;
        for (const kind of ['header','footer']) {
          const text = headerFooter[`${kind}Text`];
          const numbered = headerFooter.pageNumberEnabled && headerFooter.pageNumberStyle.startsWith(kind === 'header' ? 'top' : 'bottom');
          if (!text && !numbered) continue;
          const element = document.createElement('div');
          element.textContent = `${text || ''}${text && numbered ? ' — ' : ''}${numbered ? number : ''}`;
          element.style.cssText = `position:absolute;${kind === 'header' ? 'top' : 'bottom'}:${Math.max(20,padding * .38)}px;left:${padding}px;right:${padding}px;font-size:10px;white-space:pre-wrap;color:#71717a;text-align:${numbered ? headerFooter.pageNumberStyle.endsWith('right') ? 'right' : 'center' : String(headerFooter[`${kind}Align`] || 'Center').toLowerCase()};`;
          page.appendChild(element);
        }
        const viewport = document.createElement('div');
        const sliceHeight = columns === 1 && cuts[slice + 1] !== undefined ? cuts[slice + 1] - offset : contentHeight;
        viewport.style.cssText = `position:absolute;left:${padding}px;top:${padding}px;width:${contentWidth}px;height:${sliceHeight}px;overflow:hidden;`;
        content.style.transform = columns === 1 ? `translateY(-${offset}px)` : `translateX(-${offset}px)`;
        viewport.appendChild(content); page.appendChild(viewport); stage.replaceChildren(page);
        const canvas = await h2c(page, { scale: 2, useCORS: true, backgroundColor: exportPageFill(design), logging: false, scrollX:0, scrollY:0, ignoreElements: (el) => document.body.contains(el) && el !== document.body && !el.contains(stage) && !stage.contains(el) });
        if (pageIndex) pdf.addPage(format, landscape ? 'l' : 'p');
        pdf.addImage(canvas.toDataURL('image/jpeg', .98), 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
        const pageRect = page.getBoundingClientRect();
        for (const link of content.querySelectorAll('a[href]')) for (const rect of link.getClientRects()) {
          if (rect.top >= pageRect.top + padding && rect.bottom <= pageRect.top + padding + sliceHeight && rect.left >= pageRect.left + padding && rect.right <= pageRect.left + padding + contentWidth) pdf.link((rect.left - pageRect.left) / width * pdf.internal.pageSize.getWidth(), (rect.top - pageRect.top) / height * pdf.internal.pageSize.getHeight(), rect.width / width * pdf.internal.pageSize.getWidth(), rect.height / height * pdf.internal.pageSize.getHeight(), { url: link.href });
        }
        pageIndex += 1;
      }
    }
    return { blob: pdf.output('blob'), pdf };
  } finally { stage.remove(); }
}

export async function exportToPdf(title, htmlOrEl, options = {}) {
  const { blob } = await buildPdfBlob(title, htmlOrEl, options);
  saveAs(blob, `${sanitizeFilename(title)}.pdf`);
  return blob;
}

/* ── DOCX (via docx library with Images, Page Breaks, Headers) ─ */

/**
 * Helper to fetch or decode an image URL / base64 string into a Uint8Array for docx ImageRun.
 */
async function extractImageBytes(src) {
  if (!src || typeof src !== 'string') return null;

  try {
    if (src.startsWith('data:image/')) {
      const parts = src.split(',');
      if (parts.length < 2) return null;
      if (!/;base64/i.test(parts[0])) return new TextEncoder().encode(decodeURIComponent(parts.slice(1).join(',')));
      const binaryString = atob(parts.slice(1).join(','));
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    // Uploads use /uploads/... in production and through Vite's proxy. Resolve
    // paths exactly as the editor's <img> does, including document-relative URLs.
    const url = new URL(src, document.baseURI);
    if (['http:', 'https:', 'blob:'].includes(url.protocol)) {
      const res = await fetch(url.href);
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      return buffer.byteLength ? new Uint8Array(buffer) : null;
    }
  } catch (err) {
    console.warn('Could not extract image for DOCX export:', err?.message);
  }

  return null;
}

function isDocxRasterImage(bytes) {
  const startsWith = (signature) => signature.every((byte, index) => bytes[index] === byte);
  return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) // PNG
    || startsWith([0xff, 0xd8, 0xff]) // JPEG
    || startsWith([0x47, 0x49, 0x46, 0x38]) // GIF
    || startsWith([0x42, 0x4d]); // BMP
}

/**
 * Maps font names to universal Microsoft Office fonts on Windows and macOS.
 * Web fonts (like Crimson Pro, Cinzel, Noto Serif, JetBrains Mono) are not installed
 * locally in Windows, causing Word to fall back to arbitrary fonts like Segoe Print / cursive.
 * This ensures Microsoft Word displays the exact intended serif, sans-serif, or monospace styling.
 */
export function mapFontForDocx(fontName = '') {
  if (!fontName || typeof fontName !== 'string') return 'Georgia';
  const clean = fontName.split(',')[0].replace(/['"]/g, '').trim();
  const lower = clean.toLowerCase();

  const WEB_FONT_MAP = {
    'crimson pro': 'Georgia',
    'cinzel': 'Georgia',
    'noto serif': 'Georgia',
    'noto serif devanagari': 'Georgia',
    'noto naskh arabic': 'Times New Roman',
    'ebrama': 'Ebrima',
    'ebrima': 'Ebrima',
    'jetbrains mono': 'Consolas',
    'fira code': 'Consolas',
    'roboto': 'Arial',
    'inter': 'Calibri',
    'open sans': 'Calibri',
    'lato': 'Calibri',
    'montserrat': 'Arial',
    'poppins': 'Calibri',
    'source sans pro': 'Calibri',
    'merriweather': 'Georgia',
    'pt serif': 'Georgia',
    'playfair display': 'Georgia',
  };

  if (WEB_FONT_MAP[lower]) {
    return WEB_FONT_MAP[lower];
  }

  // Generic CSS fallbacks
  if (lower === 'serif') return 'Georgia';
  if (lower === 'sans-serif') return 'Calibri';
  if (lower === 'monospace') return 'Courier New';
  if (lower === 'cursive') return 'Segoe Script';

  return clean;
}

export async function buildDocxBlob(rawHtml, options = {}) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ExternalHyperlink,
    Table,
    TableRow,
    TableCell,
    HeadingLevel,
    AlignmentType,
    WidthType,
    BorderStyle,
    ShadingType,
    VerticalAlign,
    ThematicBreak,
    PageBreak,
    Header,
    Footer,
    PageNumber,
    ImageRun,
    InsertedTextRun,
    DeletedTextRun,
    PageOrientation,
    HorizontalPositionAlign,
    VerticalPositionAlign,
    CommentRangeStart, CommentRangeEnd, CommentReference,
    HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom,
    TextWrappingType,
    TextWrappingSide,
    TableLayoutType,
    LineRuleType,
    LevelFormat,
    convertMillimetersToTwip,
  } = await import('docx');

  const meta = resolveExportMetadata(options);
  const { pageSettings, headerFooter, design } = meta;

  const isLandscape = pageSettings.orientation === 'landscape';
  const formatKey = (pageSettings.format || 'a4').toLowerCase();

  // A4 is 210mm x 297mm
  const formatSizesMm = {
    a4: { w: 210, h: 297 },
    letter: { w: 215.9, h: 279.4 },
    legal: { w: 215.9, h: 355.6 },
    a3: { w: 297, h: 420 },
  };
  const baseSize = formatSizesMm[formatKey] || formatSizesMm.a4;
  const pageWidthMm = isLandscape ? baseSize.h : baseSize.w;
  const pageHeightMm = isLandscape ? baseSize.w : baseSize.h;

  // Margin in Twips (1 inch = 1440 twips = 25.4mm)
  const marginPresetsTwips = {
    normal: 1440,   // 1 inch
    narrow: 720,    // 0.5 inch
    moderate: 1080, // 0.75 inch
    wide: 2160,     // 1.5 inch
  };
  const marginTwips = marginPresetsTwips[pageSettings.margin] || 1440;

  const bodyFont = mapFontForDocx(design.bodyFont || design.font || 'Crimson Pro');
  const headingFont = mapFontForDocx(design.headingFont || design.font || 'Crimson Pro');
  const headingColor = normalizeExportColor(design.heading || design.accent || '#c9a84c', true, true) || 'C9A84C';
  const lineSpacingMultiplier = Number(design.spacing || '1.7') || 1.7;
  // CSS line-height n shows lines n x font size apart; Word's single (240) is ~1.15 x font size.
  const wordLineSpacing = Math.round((lineSpacingMultiplier / WORD_SINGLE_LINE) * 240);

  const cleanHtml = prepareExportHtml(portableExportHtml(rawHtml, meta), { ...options, keepSuggestions: true, preserveColors: true });
  const div = document.createElement('div');
  div.innerHTML = cleanHtml;
  flattenExportMedia(div);

  // Paragraph alignment from the editor's `text-align` style (or legacy `align` attribute).
  const alignmentFor = (el) => {
    const value = String(el?.style?.textAlign || el?.getAttribute?.('align') || '').toLowerCase();
    if (value === 'center') return AlignmentType.CENTER;
    if (value === 'right' || value === 'end') return AlignmentType.RIGHT;
    if (value === 'justify') return AlignmentType.JUSTIFIED;
    if (value === 'left' || value === 'start') return AlignmentType.LEFT;
    return undefined;
  };

  // CSS length -> twips (1pt = 20 twips, 1px = 15 twips at 96 DPI).
  const cssToTwips = (value) => {
    const match = /^(-?\d*\.?\d+)(pt|px)?$/.exec(String(value || '').trim());
    if (!match) return undefined;
    return Math.round(Number(match[1]) * (match[2] === 'px' ? 15 : 20));
  };

  const cssBorder = (style, side) => {
    const kind = style.getPropertyValue(`border-${side}-style`);
    return { style: !kind || ['none', 'hidden'].includes(kind) ? BorderStyle.NONE : ({ double: BorderStyle.DOUBLE, dashed: BorderStyle.DASHED, dotted: BorderStyle.DOTTED })[kind] || BorderStyle.SINGLE, size: Math.max(0, Math.round((parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0) * 6)), color: normalizeExportColor(style.getPropertyValue(`border-${side}-color`), true, true) || 'D0D0D0' };
  };

  // Paragraph spacing from the element's inline style (line-height, margin-top/bottom),
  // falling back to the document defaults. A unitless line-height is a line multiple.
  const paragraphSpacing = (el, fallback) => {
    const style = el?.style;
    if (!style) return fallback;
    const spacing = { ...fallback };
    const lineHeight = String(style.lineHeight || '').trim();
    if (/^\d*\.?\d+$/.test(lineHeight)) {
      spacing.line = Math.round((Number(lineHeight) / WORD_SINGLE_LINE) * 240);
      delete spacing.lineRule;
    } else if (cssToTwips(lineHeight) !== undefined) {
      spacing.line = cssToTwips(lineHeight);
      spacing.lineRule = LineRuleType.EXACT;
    }
    const before = cssToTwips(style.marginTop);
    const after = cssToTwips(style.marginBottom);
    if (before !== undefined) spacing.before = Math.max(0, before);
    if (after !== undefined) spacing.after = Math.max(0, after);
    return spacing;
  };

  // Images: the editor renders them `display:block` with no margin (left-aligned) and expresses
  // alignment through margins (`auto` sides) or `float`. Sizes are CSS px; Word wants px at 96 DPI.
  const PX_TO_TWIP = 15;
  const PX_TO_EMU = 9525;
  const printableWidthPx = Math.floor((pageWidthMm / 25.4) * 96 - (2 * marginTwips) / PX_TO_TWIP);
  const printableHeightPx = Math.floor((pageHeightMm / 25.4) * 96 - (2 * marginTwips) / PX_TO_TWIP);

  const loadNaturalSize = (src) => new Promise((resolve) => {
    const probe = new window.Image();
    const finish = (size) => { clearTimeout(timer); resolve(size); };
    const timer = setTimeout(() => finish(null), 15000);
    probe.onload = () => finish({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.onerror = () => finish(null);
    probe.src = src;
  });

  const imageData = new Map();
  await Promise.all(Array.from(div.querySelectorAll('img')).map(async (img) => {
    let src = img.getAttribute('src');
    if (!src) throw new Error('An image has no source');
    const bytes = await extractImageBytes(src);
    if (!bytes?.length) throw new Error(`Image "${img.alt || 'Document image'}" could not be embedded. Check that its source is available.`);
    // Detect the payload, not just its URL: uploaded SVG/WebP pictures can have
    // ordinary paths or extensionless URLs and still need conversion for Word.
    if (!isDocxRasterImage(bytes) || img.style.filter || img.style.opacity) {
      const raster = await rasterizeExportImage(src, { filter: img.style.filter, opacity: img.style.opacity });
      src = raster.src;
      const rasterBytes = await extractImageBytes(src);
      if (!rasterBytes?.length) throw new Error('An image could not be embedded');
      imageData.set(img, { bytes: rasterBytes, natural: { w: raster.width, h: raster.height } });
    } else {
      const natural = await loadNaturalSize(src);
      imageData.set(img, { bytes, natural });
    }
  }));

  const cssPx = (value, percentOf) => {
    const raw = String(value || '').trim();
    if (!raw || raw === 'auto') return 0;
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return raw.endsWith('%') ? (n / 100) * percentOf : n;
  };

  const imageSize = (img, natural) => {
    let width = cssPx(img.style?.width, printableWidthPx) || cssPx(img.getAttribute('width'), printableWidthPx);
    let height = cssPx(img.style?.height, printableHeightPx) || cssPx(img.getAttribute('height'), printableHeightPx);
    const ratio = natural?.w && natural?.h ? natural.h / natural.w : (width && height ? height / width : 0.6);
    if (!width && !height) width = natural?.w || 500;
    if (!width) width = height / ratio;
    if (!height) height = width * ratio;
    // Same limits the editor applies (max-width: 100%, max-height: page content height).
    const scale = Math.min(1, printableWidthPx / width, printableHeightPx / height);
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
  };

  const floatSide = (img) => {
    const value = String(img.style?.float || img.getAttribute('data-wrap') || '').toLowerCase();
    return value === 'left' || value === 'right' ? value : '';
  };

  const buildImageRun = (img) => {
    const data = imageData.get(img);
    if (!data) return null;
    const transformation = { ...imageSize(img, data.natural), rotation: Number(img.getAttribute('data-rotate')) || Number(img.style.transform?.match(/rotate\((-?[\d.]+)deg\)/)?.[1]) || 0 };
    const absolute = img.style.position === 'absolute' || ['behindText', 'inFrontOfText'].includes(img.getAttribute('data-wrap'));
    if (absolute) return new ImageRun({ data: data.bytes, transformation, altText: { name: img.alt || 'Document image', description: img.alt || '' }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: Math.round((parseFloat(img.style.left) || 0) * PX_TO_EMU) }, verticalPosition: { relative: VerticalPositionRelativeFrom.MARGIN, offset: Math.round((parseFloat(img.style.top) || 0) * PX_TO_EMU) }, behindDocument: img.getAttribute('data-wrap') === 'behindText' || Number(img.style.zIndex) <= 0, allowOverlap: true, wrap: { type: TextWrappingType.NONE } } });
    const side = floatSide(img);
    if (!side) return new ImageRun({ data: data.bytes, transformation });

    // Floated image: anchor it in the paragraph and wrap text around it, like the editor.
    const gap = (value) => Math.round(cssPx(value, 0) * PX_TO_EMU);
    return new ImageRun({
      data: data.bytes,
      transformation,
      floating: {
        horizontalPosition: {
          relative: HorizontalPositionRelativeFrom.MARGIN,
          align: side === 'left' ? HorizontalPositionAlign.LEFT : HorizontalPositionAlign.RIGHT,
        },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
        wrap: { type: TextWrappingType.SQUARE, side: TextWrappingSide.BOTH_SIDES },
        margins: {
          top: gap(img.style?.marginTop),
          bottom: gap(img.style?.marginBottom),
          left: gap(img.style?.marginLeft),
          right: gap(img.style?.marginRight),
        },
      },
    });
  };

  // A block image's paragraph: alignment from its auto margins, a fixed left margin
  // (e.g. after dragging) becomes a left indent.
  const blockImageParagraph = (img, containerAlign) => {
    const run = buildImageRun(img);
    if (!run) return null;
    if (floatSide(img)) return { floatRun: run };

    const ml = img.style?.marginLeft;
    const mr = img.style?.marginRight;
    let alignment = containerAlign || AlignmentType.LEFT;
    let indentPx = 0;
    if (ml === 'auto' && mr === 'auto') alignment = AlignmentType.CENTER;
    else if (ml === 'auto') alignment = AlignmentType.RIGHT;
    else if (!containerAlign) indentPx = cssPx(ml, printableWidthPx);

    return new Paragraph({
      alignment,
      indent: indentPx ? { left: Math.round(indentPx * PX_TO_TWIP) } : undefined,
      children: [run],
      spacing: {
        before: Math.round(cssPx(img.style?.marginTop, 0) * PX_TO_TWIP),
        after: Math.round(cssPx(img.style?.marginBottom, 0) * PX_TO_TWIP) || 200,
      },
    });
  };

  // Floated images are anchored to the next paragraph so the following text wraps around them.
  let pendingFloats = [];
  const takePendingFloats = () => {
    const runs = pendingFloats;
    pendingFloats = [];
    return runs;
  };

  const revisionIds = new Map();
  const commentIds = new Map(meta.comments.map((comment, index) => [String(comment.id), index]));
  const revisionId = (key) => {
    if (!revisionIds.has(key)) revisionIds.set(key, revisionIds.size + 1);
    return revisionIds.get(key);
  };

  // Helper to extract styled TextRuns recursively from inline nodes
  const parseInlineNodes = (node, inheritedProps = {}) => {
    const runs = [];

    const walkInline = (currNode, currProps) => {
      if (currNode.nodeType === 3) {
        const txt = currNode.textContent;
        if (txt) {
          const { __revision: revision, ...props } = currProps;
          if (revision) {
            const Run = revision.kind === 'ins' ? InsertedTextRun : DeletedTextRun;
            runs.push(new Run({ text: txt, font: bodyFont, ...props, id: revision.id, author: revision.author, date: revision.date }));
          } else {
            runs.push(new TextRun({ text: txt, font: bodyFont, ...props }));
          }
        }
        return;
      }

      if (currNode.nodeType !== 1) return;

      const tag = currNode.tagName.toLowerCase();
      const style = currNode.style || {};
      const nextProps = { font: bodyFont, ...currProps };
      const commentId = commentIds.get(currNode.getAttribute('data-comment-id'));
      if (commentId !== undefined) runs.push(new CommentRangeStart(commentId));

      if (tag === 'strong' || tag === 'b' || style.fontWeight === 'bold' || parseInt(style.fontWeight, 10) >= 700) {
        nextProps.bold = true;
      }
      if (tag === 'em' || tag === 'i' || style.fontStyle === 'italic') {
        nextProps.italics = true;
      }
      if (tag === 'u' || style.textDecoration?.includes('underline')) {
        nextProps.underline = {};
      }
      if (tag === 's' || tag === 'strike' || (tag === 'del' && !currNode.hasAttribute('data-suggestion')) || style.textDecoration?.includes('line-through')) {
        nextProps.strike = true;
      }
      if (tag === 'code') {
        nextProps.font = 'Courier New';
      }
      if (tag === 'br') {
        const { __revision: _brRevision, ...brProps } = currProps;
        runs.push(new TextRun({ break: 1, ...brProps }));
        return;
      }
      if (tag === 'img') {
        const imageRun = buildImageRun(currNode);
        if (imageRun) runs.push(imageRun);
        return;
      }

      // Font size in half-points; the editor stores pt, pasted content may use px.
      if (tag === 'sub') nextProps.subScript = true;
      if (tag === 'sup') nextProps.superScript = true;
      if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        const fill = normalizeExportColor(style.backgroundColor, true, true);
        if (fill) nextProps.shading = { fill, type: ShadingType.CLEAR };
      }
      if (tag === 'mark' && !nextProps.shading) nextProps.shading = { fill: 'FFFF00', type: ShadingType.CLEAR };

      if (style.fontSize) {
        const n = parseFloat(style.fontSize);
        const pt = String(style.fontSize).trim().endsWith('px') ? n * 0.75 : n;
        if (pt > 0) nextProps.size = Math.max(2, Math.round(pt * 2));
      }

      // Color normalization: must be 6-char hex without #
      const colorVal = style.color || currNode.getAttribute('color');
      if (colorVal) {
        const hex = normalizeExportColor(colorVal, true, true);
        if (hex) nextProps.color = hex;
      }

      // Font family
      if (style.fontFamily) {
        const mappedFont = mapFontForDocx(style.fontFamily);
        if (mappedFont) nextProps.font = mappedFont;
      }

      const tracked = currNode.getAttribute('data-mark');
      if (((tag === 'ins' || tag === 'del') && currNode.hasAttribute('data-suggestion')) || ['insertion', 'deletion'].includes(tracked)) {
        const revision = {
          kind: tracked === 'insertion' ? 'ins' : tracked === 'deletion' ? 'del' : tag,
          id: revisionId(currNode.getAttribute('data-suggestion') || `${tracked}:${currNode.getAttribute('data-author')}:${currNode.getAttribute('data-date')}`),
          author: currNode.getAttribute('data-author') || 'Pragna',
          date: currNode.getAttribute('data-created') || currNode.getAttribute('data-date') || new Date().toISOString(),
        };
        currNode.childNodes.forEach((child) => walkInline(child, { ...nextProps, __revision: revision }));
        return;
      }

      if (tag === 'a' && currNode.getAttribute('href')) {
        const href = currNode.getAttribute('href');
        const { __revision: _linkRevision, ...linkProps } = nextProps;
        const linkRuns = [];
        currNode.childNodes.forEach((child) => {
          if (child.nodeType === 3) {
            linkRuns.push(new TextRun({
              text: child.textContent || '',
              color: '0563C1',
              underline: {},
              font: bodyFont,
              ...linkProps,
            }));
          } else {
            walkInline(child, { color: '0563C1', underline: {}, font: bodyFont, ...nextProps });
          }
        });
        if (linkRuns.length) {
          try {
            runs.push(new ExternalHyperlink({ children: linkRuns, link: href }));
          } catch {
            runs.push(...linkRuns);
          }
        }
        return;
      }

      currNode.childNodes.forEach((child) => walkInline(child, nextProps));
      if (commentId !== undefined) runs.push(new CommentRangeEnd(commentId), new TextRun({ children: [new CommentReference(commentId)] }));
    };

    walkInline(node, inheritedProps);

    if (!runs.length && node.textContent) {
      runs.push(new TextRun({ text: node.textContent, font: bodyFont, ...inheritedProps }));
    }

    return runs;
  };

  const children = [];

  // `containerAlign`: alignment inherited from an enclosing table cell / blockquote / list item.
  const parseBlockElement = async (node, containerAlign) => {
    if (node.nodeType === 3) {
      const text = (node.textContent || '').trim();
      if (text) {
        return new Paragraph({
          alignment: containerAlign,
          children: [...takePendingFloats(), new TextRun({ text, font: bodyFont })],
          spacing: paragraphSpacing(node.parentElement, { line: wordLineSpacing, after: 200 }),
        });
      }
      return null;
    }

    if (node.nodeType !== 1) return null;

    // Check if this is a Page Break element
    if (isPageBreakElement(node)) {
      return new Paragraph({
        children: [new PageBreak()],
      });
    }

    const tag = node.tagName.toLowerCase();

    // Images
    if (tag === 'img') {
      const result = blockImageParagraph(node, containerAlign);
      if (result?.floatRun) {
        pendingFloats.push(result.floatRun);
        return null;
      }
      return result;
    }

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      const levelMap = {
        h1: HeadingLevel.HEADING_1,
        h2: HeadingLevel.HEADING_2,
        h3: HeadingLevel.HEADING_3,
        h4: HeadingLevel.HEADING_4,
        h5: HeadingLevel.HEADING_5,
        h6: HeadingLevel.HEADING_6,
      };
      const headingRuns = parseInlineNodes(node, { font: headingFont, color: headingColor, bold: true });
      return new Paragraph({
        heading: levelMap[tag],
        alignment: alignmentFor(node) ?? containerAlign,
        children: [...takePendingFloats(), ...headingRuns],
        spacing: paragraphSpacing(node, { before: 240, after: 120 }),
      });
    }

    // Horizontal Rule
    if (tag === 'hr') {
      return new Paragraph({ thematicBreak: true });
    }

    // Blockquote
    if (tag === 'blockquote') {
      return new Paragraph({
        indent: { left: 720 },
        alignment: alignmentFor(node) ?? alignmentFor(node.querySelector(':scope > p')) ?? containerAlign,
        children: [...takePendingFloats(), ...parseInlineNodes(node, { italics: true, color: '555555', font: bodyFont })],
        spacing: paragraphSpacing(node.querySelector(':scope > p') || node, { line: wordLineSpacing, after: 200 }),
      });
    }

    // Lists
    if (tag === 'ul' || tag === 'ol') {
      return parseList(node, 0, containerAlign);
    }

    // Tables
    if (tag === 'table') {
      const alignAttr = (node.getAttribute('align') || node.getAttribute('data-align') || '').toLowerCase();
      const mLeft = node.style?.marginLeft;
      const mRight = node.style?.marginRight;
      let tableAlignment = AlignmentType.LEFT;
      if (alignAttr === 'center' || (mLeft === 'auto' && mRight === 'auto') || node.classList.contains('table-align-center')) {
        tableAlignment = AlignmentType.CENTER;
      } else if (alignAttr === 'right' || (mLeft === 'auto' && (mRight === '0' || mRight === '0px')) || node.classList.contains('table-align-right')) {
        tableAlignment = AlignmentType.RIGHT;
      }

      // Check table width
      let tableWidth = { size: 100, type: WidthType.PERCENTAGE };
      const rawWidth = node.style?.width || node.getAttribute('width');
      if (rawWidth && rawWidth.includes('%')) {
        const pct = parseInt(rawWidth, 10);
        if (pct > 0 && pct <= 100) {
          tableWidth = { size: pct, type: WidthType.PERCENTAGE };
        }
      }

      // Column widths: the editor stores each cell's spanned column widths in `colwidth`
      // (px); fall back to the <colgroup>. Only this table's own rows/cells, not nested tables'.
      const ownRows = Array.from(node.rows);
      const colCount = Math.max(0, ...ownRows.map((tr) => Array.from(tr.cells).reduce((n, c) => n + (c.colSpan || 1), 0)));
      let gridPx = null;
      for (const tr of ownRows) {
        const widths = Array.from(tr.cells).flatMap((c) => String(c.getAttribute('colwidth') || '').split(',').map(Number));
        if (widths.length === colCount && widths.every((w) => w > 0)) { gridPx = widths; break; }
      }
      if (!gridPx) {
        const cols = Array.from(node.querySelectorAll(':scope > colgroup > col')).map((col) => parseFloat(col.style.width));
        if (cols.length === colCount && cols.every((w) => w > 0)) gridPx = cols;
      }
      let gridTwips = null;
      if (gridPx) {
        const scale = Math.min(1, printableWidthPx / gridPx.reduce((a, b) => a + b, 0));
        gridTwips = gridPx.map((w) => Math.round(w * scale * PX_TO_TWIP));
        tableWidth = { size: gridTwips.reduce((a, b) => a + b, 0), type: WidthType.DXA };
      }
      const occupied = [];

      const rows = [];
      for (const [rowIndex, tr] of ownRows.entries()) {
        const cells = [];
        let gridCol = 0;
        for (const cell of Array.from(tr.cells)) {
          while (occupied[rowIndex]?.[gridCol]) gridCol += 1;
          const colSpan = cell.colSpan || 1;
          const rowSpan = cell.rowSpan || 1;
          for (let r = 0; r < rowSpan; r += 1) {
            occupied[rowIndex + r] = occupied[rowIndex + r] || [];
            for (let c = 0; c < colSpan; c += 1) occupied[rowIndex + r][gridCol + c] = true;
          }
          const cellWidth = gridTwips
            ? { size: gridTwips.slice(gridCol, gridCol + colSpan).reduce((a, b) => a + b, 0), type: WidthType.DXA }
            : undefined;
          gridCol += colSpan;
          const isHeader = cell.tagName.toLowerCase() === 'th';
          const cellParas = [];

          // Cell alignment applies to every paragraph in the cell that has none of its own.
          const cellAlign = alignmentFor(cell);

          if (cell.children.length > 0) {
            for (const child of Array.from(cell.childNodes)) {
              const res = await parseBlockElement(child, cellAlign);
              if (Array.isArray(res)) cellParas.push(...res);
              else if (res) cellParas.push(res);
            }
          }
          if (!cellParas.length) {
            cellParas.push(new Paragraph({
              children: parseInlineNodes(cell, isHeader ? { bold: true, font: bodyFont } : { font: bodyFont }),
              spacing: { after: 60 },
              alignment: cellAlign,
            }));
          }

          // Shading for header or custom background
          let shading = undefined;
          if (cell.style?.backgroundColor) {
            const hex = normalizeExportColor(cell.style.backgroundColor, true, true);
            if (hex) {
              shading = { fill: hex.replace('#', ''), type: ShadingType.CLEAR };
            }
          }

          cells.push(new TableCell({
            children: cellParas,
            shading,
            width: cellWidth,
            columnSpan: colSpan > 1 ? colSpan : undefined,
            rowSpan: rowSpan > 1 ? rowSpan : undefined,
            verticalAlign: ({ middle: VerticalAlign.CENTER, bottom: VerticalAlign.BOTTOM })[cell.style.verticalAlign] || VerticalAlign.TOP,
            borders: Object.fromEntries(['top', 'right', 'bottom', 'left'].map((side) => [side, cssBorder(cell.style, side)])),
            margins: Object.fromEntries(['top', 'bottom', 'left', 'right'].map((side) => [side, cssToTwips(cell.style.getPropertyValue(`padding-${side}`)) ?? (side === 'top' || side === 'bottom' ? 40 : 100)])),
          }));
        }
        if (cells.length) {
          rows.push(new TableRow({ children: cells, tableHeader: Array.from(tr.cells).every((cell) => cell.tagName === 'TH'), ...(cssToTwips(tr.style.height) ? { height: { value: cssToTwips(tr.style.height), rule: 'atLeast' } } : {}) }));
        }
      }
      if (rows.length) {
        return new Table({
          rows,
          alignment: tableAlignment,
          width: tableWidth,
          ...(gridTwips ? { columnWidths: gridTwips, layout: TableLayoutType.FIXED } : {}),
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
            left: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
            right: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
          },
        });
      }
      return null;
    }

    // Divs / Containers: Check if it contains block children or just inline text
    if (tag === 'div') {
      // Check for nested image
      const nestedImg = node.querySelector(':scope > img');
      if (nestedImg && node.children.length === 1) {
        return await parseBlockElement(nestedImg, alignmentFor(node) ?? containerAlign);
      }

      const hasBlockChildren = Array.from(node.children).some((c) =>
        /^(p|div|h[1-6]|ul|ol|table|blockquote|hr)$/i.test(c.tagName)
      );
      if (hasBlockChildren) {
        const innerBlocks = [];
        for (const child of Array.from(node.childNodes)) {
          const res = await parseBlockElement(child, alignmentFor(node) ?? containerAlign);
          if (Array.isArray(res)) innerBlocks.push(...res);
          else if (res) innerBlocks.push(res);
        }
        return innerBlocks;
      }
    }

    // Standard Paragraph: check if contains an image
    const singleImg = node.querySelector(':scope > img');
    if (singleImg && node.childNodes.length === 1) {
      return await parseBlockElement(singleImg, alignmentFor(node) ?? containerAlign);
    }

    const runs = [...takePendingFloats(), ...parseInlineNodes(node, { font: bodyFont })];

    return new Paragraph({
      alignment: alignmentFor(node) ?? containerAlign,
      children: runs.length ? runs : [new TextRun({ text: '', font: bodyFont })],
      spacing: paragraphSpacing(node, { line: wordLineSpacing, after: 200 }),
    });
  };

  // Lists: each <li> paragraph gets the bullet / number of its nesting level; further paragraphs
  // in the same item are indented to match, and nested lists recurse one level deeper.
  // Every <ol> is its own numbering instance so numbering restarts per list.
  let listInstance = 0;
  const parseList = async (listEl, level, containerAlign) => {
    const ordered = listEl.tagName.toLowerCase() === 'ol';
    const instance = ++listInstance;
    const out = [];
    for (const li of Array.from(listEl.children)) {
      if (li.tagName.toLowerCase() !== 'li') continue;
      let first = true;
      let inline = [];
      const emit = (el, runs) => {
        const marker = ordered
          ? { numbering: { reference: 'etherx-ordered', level, instance } }
          : { bullet: { level } };
        out.push(new Paragraph({
          ...(first ? marker : { indent: { left: 720 * (level + 1) } }),
          alignment: alignmentFor(el) ?? alignmentFor(li) ?? containerAlign,
          children: [...takePendingFloats(), ...(runs.length ? runs : [new TextRun({ text: '', font: bodyFont })])],
          spacing: paragraphSpacing(el, { line: wordLineSpacing, after: 100 }),
        }));
        first = false;
      };
      const flushInline = () => {
        if (!inline.length) return;
        const holder = document.createElement('span');
        inline.forEach((n) => holder.appendChild(n.cloneNode(true)));
        inline = [];
        if (holder.textContent.trim() || holder.querySelector('img')) emit(li, parseInlineNodes(holder, { font: bodyFont }));
      };
      for (const child of Array.from(li.childNodes)) {
        const childTag = child.nodeType === 1 ? child.tagName.toLowerCase() : '';
        if (childTag === 'ul' || childTag === 'ol') {
          flushInline();
          out.push(...await parseList(child, Math.min(level + 1, 8), containerAlign));
        } else if (childTag === 'p') {
          flushInline();
          emit(child, parseInlineNodes(child, { font: bodyFont }));
        } else if (/^(table|blockquote|h[1-6]|div|img|hr)$/.test(childTag)) {
          flushInline();
          const res = await parseBlockElement(child, containerAlign);
          if (Array.isArray(res)) out.push(...res);
          else if (res) out.push(res);
        } else {
          inline.push(child);
        }
      }
      flushInline();
    }
    return out;
  };

  for (const node of Array.from(div.childNodes)) {
    const result = await parseBlockElement(node);
    if (Array.isArray(result)) {
      result.forEach((b) => b && children.push(b));
    } else if (result) {
      children.push(result);
    }
  }

  // A floated image with no paragraph after it still needs an anchor.
  if (pendingFloats.length) {
    children.push(new Paragraph({ children: takePendingFloats() }));
  }

  // Guarantee at least one valid paragraph
  if (!children.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: '', font: bodyFont })],
      spacing: { line: wordLineSpacing, after: 200 },
    }));
  }

  // Header definition
  const headerAlign = String(headerFooter.headerAlign || 'Center').toLowerCase();
  const headerAlignmentType =
    headerAlign === 'left' ? AlignmentType.LEFT :
    headerAlign === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER;

  const headerChildren = headerFooter.headerText ? [
    new Paragraph({
      alignment: headerAlignmentType,
      children: [
        new TextRun({
          text: headerFooter.headerText,
          font: bodyFont,
          size: 18, // 9pt
          color: '71717A',
        }),
      ],
      spacing: { after: 120 },
    }),
  ] : [];

  // Footer definition
  const footerAlign = String(headerFooter.footerAlign || 'Center').toLowerCase();
  const footerAlignmentType =
    footerAlign === 'left' ? AlignmentType.LEFT :
    footerAlign === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER;

  const footerRuns = [];
  if (headerFooter.footerText) {
    footerRuns.push(new TextRun({ text: headerFooter.footerText, font: bodyFont, size: 18, color: '71717A' }));
  }
  if (headerFooter.pageNumberEnabled && !headerFooter.pageNumberStyle.startsWith('top')) {
    if (headerFooter.footerText) {
      footerRuns.push(new TextRun({ text: ' — Page ', font: bodyFont, size: 18, color: '71717A' }));
    }
    footerRuns.push(new TextRun({ children: [PageNumber.CURRENT], font: bodyFont, size: 18, color: '71717A' }));
  }

  const footerChildren = [
    new Paragraph({
      alignment: headerFooter.pageNumberEnabled && !headerFooter.pageNumberStyle.startsWith('top') ? (headerFooter.pageNumberStyle.endsWith('right') ? AlignmentType.RIGHT : AlignmentType.CENTER) : footerAlignmentType,
      children: footerRuns.length ? footerRuns : [new TextRun({ text: '', font: bodyFont })],
      spacing: { before: 120 },
    }),
  ];

  if (headerFooter.pageNumberEnabled && headerFooter.pageNumberStyle.startsWith('top')) headerChildren.push(new Paragraph({ alignment: headerFooter.pageNumberStyle.endsWith('right') ? AlignmentType.RIGHT : AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: bodyFont, size: 18 })] }));
  if (meta.watermark) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240"><text x="320" y="140" text-anchor="middle" font-size="64" font-family="serif" fill="#6f5320" fill-opacity="0.11">${escapeHtml(meta.watermark)}</text></svg>`;
    const raster = await rasterizeExportImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);
    headerChildren.push(new Paragraph({ children: [new ImageRun({ data: await extractImageBytes(raster.src), transformation: { width: 500, height: 188, rotation: 332 }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER }, behindDocument: true, allowOverlap: true, wrap: { type: TextWrappingType.NONE } } })] }));
  }
  const pageBorders = design.borderSetting && design.borderSetting !== 'none' && design.borderStyle !== 'none' ? { pageBorders: { offsetFrom: 'page', zOrder: 'back' }, ...Object.fromEntries(['top','right','bottom','left'].map((side) => [`pageBorder${side[0].toUpperCase() + side.slice(1)}`, { style: design.borderSides?.[side] === false ? BorderStyle.NONE : ({ dashed: BorderStyle.DASHED, double: BorderStyle.DOUBLE })[design.borderStyle] || BorderStyle.SINGLE, color: normalizeExportColor(design.borderColor || '#6f5320', true, true), size: Math.round(Number(design.borderWidth || 1) * 8), space: Number(design.borderDistance || 24) }])) } : undefined;

  const doc = new Document({
    comments: { children: meta.comments.map((comment, id) => ({ id, author: comment.author?.name || comment.author || 'Reviewer', date: new Date(comment.createdAt || comment.timestamp || Date.now()), children: [new Paragraph({ children: [new TextRun(comment.text || comment.body || '')] })] })) },
    background: { color: normalizeExportColor(exportPageFill(design), true, true) || 'FFFFFF' },
    features: { updateFields: true, trackRevisions: Boolean(options.trackChanges) },
    customProperties: [{ name: 'EtherX.DocumentMetadata', value: JSON.stringify({ ...meta, signatures: options.signatures || [], documentParts: options.documentParts || [], styles: options.styles || [] }) }],
    numbering: {
      config: [{
        reference: 'etherx-ordered',
        levels: Array.from({ length: 9 }, (_, level) => ({
          level,
          format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3],
          text: `%${level + 1}.`,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
        })),
      }],
    },
    styles: {
      default: {
        document: {
          run: {
            font: bodyFont,
            size: Math.round((Number(design.fontSize) || 12) * 2),
            color: normalizeExportColor(design.subtle, true) || '1A1A1A',
          },
          paragraph: {
            spacing: { line: wordLineSpacing, after: 200 },
          },
        },
        heading1: {
          run: {
            font: headingFont,
            size: 32,
            bold: true,
            color: headingColor,
          },
          paragraph: {
            spacing: { before: 240, after: 120 },
          },
        },
        heading2: {
          run: {
            font: headingFont,
            size: 28,
            bold: true,
            color: headingColor,
          },
          paragraph: {
            spacing: { before: 200, after: 100 },
          },
        },
        heading3: {
          run: {
            font: headingFont,
            size: 26,
            bold: true,
            color: headingColor,
          },
          paragraph: {
            spacing: { before: 180, after: 80 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          column: { count: Math.max(1, Number(pageSettings.columns) || 1), space: 720, equalWidth: true },
          ...(pageSettings.lineNumbers ? { lineNumbers: { countBy: 1, start: 1, restart: 'continuous' } } : {}),
          page: {
            borders: pageBorders,
            pageNumbers: { start: headerFooter.pageNumberStart },
            size: {
              width: convertMillimetersToTwip(pageWidthMm),
              height: convertMillimetersToTwip(pageHeightMm),
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: marginTwips,
              bottom: marginTwips,
              left: marginTwips,
              right: marginTwips,
            },
          },
        },
        headers: {
          default: new Header({ children: headerChildren }),
        },
        footers: {
          default: new Footer({ children: footerChildren }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function exportToDocx(title, html, options = {}) {
  const blob = await buildDocxBlob(html, options);
  saveAs(blob, `${sanitizeFilename(title)}.docx`);
  return blob;
}

/* ── Markdown & EPUB ──────────────────────────────────────────── */
export { exportToMarkdown, downloadMarkdown, buildMarkdownBlob } from './markdownExport';
export { exportToEpub, buildEpubBlob } from './epubExport';
