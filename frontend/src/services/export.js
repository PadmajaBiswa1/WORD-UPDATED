// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Export Service (client-side)
// ═══════════════════════════════════════════════════════════════
import { saveAs } from 'file-saver';
import { PAGE_SIZES, MARGIN_MAP } from '@/utils/pageLayout';
import { useDocumentStore, useUIStore } from '@/store';
import { stripAutoPageBreaks } from '@/components/editor/PageBreak';

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
export function normalizeExportColor(colorStr, forDocx = false) {
  if (!colorStr || typeof colorStr !== 'string') return undefined;
  const s = colorStr.trim().toLowerCase();
  if (['inherit', 'initial', 'unset', 'transparent', 'currentcolor'].includes(s)) return undefined;

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
  if (lum > 0.82) {
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
  let html = stripAutoPageBreaks(rawHtml)
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
        if (pName === 'color') {
          const norm = normalizeExportColor(pVal, false);
          return norm ? `color: ${norm}` : '';
        }
        return part;
      }).filter(Boolean);
      return updated.length ? `style="${updated.join('; ')}"` : '';
    });

  // If entirely empty or only whitespace/empty tags, provide minimal placeholder
  const textContent = html.replace(/<[^>]+>/g, '').trim();
  if (!textContent && !/<img\b/i.test(html) && !/<table\b/i.test(html)) {
    return '<p></p>';
  }

  return html;
}

/**
 * Safely resolves document metadata (headerFooter, design, pageSettings)
 * by merging passed options with active Zustand store states when running in the browser.
 */
function resolveExportMetadata(options = {}) {
  let docState = {};
  let uiState = {};

  try {
    if (useDocumentStore?.getState) docState = useDocumentStore.getState() || {};
    if (useUIStore?.getState) uiState = useUIStore.getState() || {};
  } catch {}

  const pageSettings = {
    format: options.pageSettings?.format || options.format || uiState.pageSize || 'a4',
    orientation: options.pageSettings?.orientation || options.orientation || uiState.pageOrientation || 'portrait',
    margin: options.pageSettings?.margin || options.margin || uiState.pageMargin || 'normal',
    columns: options.pageSettings?.columns || options.columns || uiState.pageColumns || 1,
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
    ...(docState.design || {}),
    ...(options.design || {}),
  };

  const watermark = options.watermark || design.watermark || uiState.watermarkText || '';

  return { pageSettings, headerFooter, design, watermark };
}

/* ── HTML ───────────────────────────────────────────────────── */

export function buildHtmlDocument(title, rawHtml, options = {}) {
  const cleanTitle = (title || 'Untitled Document').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const content = prepareExportHtml(rawHtml, options);
  const { headerFooter, design, pageSettings } = resolveExportMetadata(options);

  const headingFont = design.headingFont || design.font || 'Crimson Pro';
  const bodyFont = design.bodyFont || design.font || 'Crimson Pro';
  const headingColor = design.heading || design.accent || '#111111';
  const lineSpacing = design.spacing || '1.7';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${cleanTitle}</title>
  <style>
    @page {
      size: ${pageSettings.format.toUpperCase()} ${pageSettings.orientation};
      margin: 25.4mm;
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
  </style>
</head>
<body>
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
function partitionContentIntoPages(sourceRoot, contentWidth, contentHeight, styles) {
  const pages = [[]];
  let currentPageIndex = 0;
  let currentY = 0;

  // Measurement probe container offscreen
  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  probe.style.width = `${contentWidth}px`;
  probe.style.boxSizing = 'border-box';
  probe.style.fontFamily = styles.fontFamily;
  probe.style.lineHeight = styles.lineHeight;
  probe.style.fontSize = '15px';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);

  try {
    const childNodes = Array.from(sourceRoot.childNodes);

    for (let i = 0; i < childNodes.length; i += 1) {
      const node = childNodes[i];

      // Skip empty comment / blank text nodes
      if (node.nodeType === 3 && !node.textContent.trim()) {
        continue;
      }

      // Check if this element is an explicit page break
      if (node.nodeType === 1 && isPageBreakElement(node)) {
        if (pages[currentPageIndex].length > 0) {
          pages.push([]);
          currentPageIndex += 1;
          currentY = 0;
        }
        continue;
      }

      // Wrap bare text nodes in paragraph elements for proper block flow
      let blockNode = node;
      if (node.nodeType === 3) {
        const p = document.createElement('p');
        p.textContent = node.textContent;
        blockNode = p;
      }

      const clone = blockNode.cloneNode(true);
      probe.innerHTML = '';
      probe.appendChild(clone);

      const rect = clone.getBoundingClientRect();
      const measuredHeight = Math.max(20, Math.ceil(rect.height || clone.offsetHeight || 28));

      // Check if adding this block overflows the current page content area
      if (pages[currentPageIndex].length > 0 && currentY + measuredHeight > contentHeight) {
        pages.push([]);
        currentPageIndex += 1;
        currentY = 0;
      }

      pages[currentPageIndex].push(blockNode.cloneNode(true));
      currentY += measuredHeight;
    }
  } finally {
    probe.remove();
  }

  // Ensure at least one page with empty paragraph if document has no blocks
  if (pages.length === 0 || (pages.length === 1 && pages[0].length === 0)) {
    const emptyP = document.createElement('p');
    emptyP.innerHTML = '&nbsp;';
    return [[emptyP]];
  }

  return pages;
}

export async function buildPdfBlob(title, htmlOrEl, options = {}) {
  const [{ default: jsPDF }, { default: h2c }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const meta = resolveExportMetadata(options);
  const { pageSettings, headerFooter, design, watermark } = meta;

  const orientation = pageSettings.orientation === 'landscape' ? 'landscape' : 'portrait';
  const formatKey = (pageSettings.format || 'a4').toLowerCase();
  const formatDims = PAGE_SIZES[formatKey] || PAGE_SIZES.a4;

  const isLandscape = orientation === 'landscape';
  const pageWidth = isLandscape ? formatDims.h : formatDims.w;
  const pageHeight = isLandscape ? formatDims.w : formatDims.h;

  const padding = MARGIN_MAP[pageSettings.margin] || MARGIN_MAP.normal;
  const contentWidth = Math.max(100, pageWidth - padding * 2);
  const contentHeight = Math.max(100, pageHeight - padding * 2);

  const headingFont = design.headingFont || design.font || 'Crimson Pro';
  const bodyFont = design.bodyFont || design.font || 'Crimson Pro';
  const headingColor = design.heading || design.accent || '#c9a84c';
  const lineSpacing = String(design.spacing || '1.7');

  // Parse source HTML or Element
  const parseContainer = document.createElement('div');
  const rawHtml = typeof htmlOrEl === 'string' ? htmlOrEl : (htmlOrEl?.innerHTML || '<p></p>');
  parseContainer.innerHTML = prepareExportHtml(rawHtml);

  // Normalize light text colors for dark contrast on white pages
  parseContainer.querySelectorAll('*').forEach((el) => {
    if (el.style && el.style.color) {
      const norm = normalizeExportColor(el.style.color, false);
      if (norm) el.style.color = norm;
    }
  });

  const pageGroups = partitionContentIntoPages(
    parseContainer,
    contentWidth,
    contentHeight,
    { fontFamily: `'${bodyFont}', serif`, lineHeight: lineSpacing }
  );

  const pdf = new jsPDF({
    orientation: isLandscape ? 'l' : 'p',
    unit: 'mm',
    format: formatKey,
  });

  const pdfPageWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();

  // Create isolated stage for page captures
  const stage = document.createElement('div');
  stage.style.position = 'fixed';
  stage.style.left = '-10000px';
  stage.style.top = '0';
  stage.style.width = `${pageWidth}px`;
  stage.style.opacity = '1';
  stage.style.pointerEvents = 'none';
  stage.style.zIndex = '-99999';
  document.body.appendChild(stage);

  try {
    for (let pageIdx = 0; pageIdx < pageGroups.length; pageIdx += 1) {
      const blocks = pageGroups[pageIdx];

      // Page Canvas Container
      const pageEl = document.createElement('div');
      pageEl.style.width = `${pageWidth}px`;
      pageEl.style.height = `${pageHeight}px`;
      pageEl.style.position = 'relative';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.background = '#ffffff';
      pageEl.style.overflow = 'hidden';
      pageEl.style.fontFamily = `'${bodyFont}', serif`;
      pageEl.style.lineHeight = lineSpacing;
      pageEl.style.color = '#1a1a1a';

      // Decorative Inward Page Border (if configured in design)
      if (design.borderStyle && design.borderStyle !== 'none' && design.borderSetting && design.borderSetting !== 'none') {
        const borderWidth = Number(design.borderWidth || 1);
        const borderInset = Math.round(Math.max(12, Math.min(padding - borderWidth - 4, Number(design.borderDistance || 24))));
        const sides = design.borderSides || { top: true, right: true, bottom: true, left: true };

        const borderEl = document.createElement('div');
        borderEl.style.position = 'absolute';
        borderEl.style.top = `${borderInset}px`;
        borderEl.style.left = `${borderInset}px`;
        borderEl.style.right = `${borderInset}px`;
        borderEl.style.bottom = `${borderInset}px`;
        borderEl.style.pointerEvents = 'none';
        borderEl.style.boxSizing = 'border-box';
        borderEl.style.borderTop = sides.top !== false ? `${borderWidth}px ${design.borderStyle} ${design.borderColor || '#6f5320'}` : 'none';
        borderEl.style.borderRight = sides.right !== false ? `${borderWidth}px ${design.borderStyle} ${design.borderColor || '#6f5320'}` : 'none';
        borderEl.style.borderBottom = sides.bottom !== false ? `${borderWidth}px ${design.borderStyle} ${design.borderColor || '#6f5320'}` : 'none';
        borderEl.style.borderLeft = sides.left !== false ? `${borderWidth}px ${design.borderStyle} ${design.borderColor || '#6f5320'}` : 'none';
        pageEl.appendChild(borderEl);
      }

      // Watermark
      if (watermark) {
        const wmEl = document.createElement('div');
        wmEl.textContent = watermark;
        wmEl.style.position = 'absolute';
        wmEl.style.top = '48%';
        wmEl.style.left = '50%';
        wmEl.style.transform = 'translate(-50%, -50%) rotate(-28deg)';
        wmEl.style.fontSize = '72px';
        wmEl.style.fontWeight = '700';
        wmEl.style.letterSpacing = '0.08em';
        wmEl.style.opacity = '0.10';
        wmEl.style.color = '#6f5320';
        wmEl.style.pointerEvents = 'none';
        wmEl.style.userSelect = 'none';
        wmEl.style.whiteSpace = 'nowrap';
        pageEl.appendChild(wmEl);
      }

      // Document Header
      if (headerFooter.headerText) {
        const headerTopOffset = Math.max(20, Math.round(padding * 0.38));
        const headEl = document.createElement('div');
        headEl.textContent = headerFooter.headerText;
        headEl.style.position = 'absolute';
        headEl.style.top = `${headerTopOffset}px`;
        headEl.style.left = `${padding}px`;
        headEl.style.right = `${padding}px`;
        headEl.style.textAlign = String(headerFooter.headerAlign || 'Center').toLowerCase();
        headEl.style.fontSize = '10px';
        headEl.style.color = '#71717a';
        headEl.style.fontFamily = `'${bodyFont}', serif`;
        headEl.style.pointerEvents = 'none';
        headEl.style.userSelect = 'none';
        pageEl.appendChild(headEl);
      }

      // Document Footer (Footer text & Page Numbers)
      const footerBottomOffset = Math.max(20, Math.round(padding * 0.38));
      const footEl = document.createElement('div');
      footEl.style.position = 'absolute';
      footEl.style.bottom = `${footerBottomOffset}px`;
      footEl.style.left = `${padding}px`;
      footEl.style.right = `${padding}px`;
      footEl.style.textAlign = String(headerFooter.footerAlign || 'Center').toLowerCase();
      footEl.style.fontSize = '10px';
      footEl.style.color = '#71717a';
      footEl.style.fontFamily = `'${bodyFont}', serif`;
      footEl.style.pointerEvents = 'none';
      footEl.style.userSelect = 'none';

      let footerContent = '';
      if (headerFooter.footerText) {
        footerContent += escapeHtml(headerFooter.footerText);
      }
      if (headerFooter.pageNumberEnabled || !headerFooter.footerText) {
        const pageNum = pageIdx + headerFooter.pageNumberStart;
        if (headerFooter.footerText) {
          footerContent += ` — Page ${pageNum}`;
        } else {
          footerContent += `${pageNum}`;
        }
      }
      footEl.innerHTML = footerContent;
      pageEl.appendChild(footEl);

      // Page Content Box
      const contentEl = document.createElement('div');
      contentEl.style.position = 'absolute';
      contentEl.style.top = `${padding}px`;
      contentEl.style.left = `${padding}px`;
      contentEl.style.width = `${contentWidth}px`;
      contentEl.style.height = `${contentHeight}px`;
      contentEl.style.boxSizing = 'border-box';
      contentEl.style.overflow = 'hidden';
      contentEl.style.wordBreak = 'break-word';
      contentEl.style.overflowWrap = 'break-word';

      // Attach page blocks
      blocks.forEach((b) => {
        contentEl.appendChild(b.cloneNode(true));
      });

      // Apply typographic hierarchy & element styles to content
      contentEl.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
        h.style.fontFamily = `'${headingFont}', serif`;
        h.style.color = headingColor;
        h.style.lineHeight = '1.3';
        h.style.marginTop = '0';
        h.style.marginBottom = '10pt';
      });
      contentEl.querySelectorAll('p').forEach((p) => {
        p.style.marginTop = '0';
        p.style.marginBottom = '10pt';
        p.style.lineHeight = lineSpacing;
      });
      contentEl.querySelectorAll('ul, ol').forEach((list) => {
        list.style.marginTop = '0';
        list.style.marginBottom = '10pt';
        list.style.paddingLeft = '28px';
      });
      contentEl.querySelectorAll('li').forEach((li) => {
        li.style.marginBottom = '4pt';
      });
      contentEl.querySelectorAll('table').forEach((tbl) => {
        tbl.style.borderCollapse = 'collapse';
        tbl.style.boxSizing = 'border-box';

        // Check alignment from align attr, data-align attr, style, or class
        const alignAttr = (tbl.getAttribute('align') || tbl.getAttribute('data-align') || '').toLowerCase();
        const mLeft = tbl.style.marginLeft;
        const mRight = tbl.style.marginRight;
        const isCenter = alignAttr === 'center' || (mLeft === 'auto' && mRight === 'auto') || tbl.classList.contains('table-align-center');
        const isRight = alignAttr === 'right' || (mLeft === 'auto' && (mRight === '0' || mRight === '0px')) || tbl.classList.contains('table-align-right');

        if (isCenter) {
          tbl.style.marginLeft = 'auto';
          tbl.style.marginRight = 'auto';
          tbl.style.marginTop = tbl.style.marginTop || '12pt';
          tbl.style.marginBottom = tbl.style.marginBottom || '12pt';
        } else if (isRight) {
          tbl.style.marginLeft = 'auto';
          tbl.style.marginRight = '0';
          tbl.style.marginTop = tbl.style.marginTop || '12pt';
          tbl.style.marginBottom = tbl.style.marginBottom || '12pt';
        } else {
          tbl.style.marginLeft = '0';
          tbl.style.marginRight = 'auto';
          tbl.style.marginTop = tbl.style.marginTop || '12pt';
          tbl.style.marginBottom = tbl.style.marginBottom || '12pt';
        }

        const rawWidth = tbl.style.width || tbl.getAttribute('width');
        if (rawWidth) {
          tbl.style.width = rawWidth;
        } else if (!isCenter && !isRight) {
          tbl.style.width = '100%';
        } else {
          tbl.style.maxWidth = '100%';
          if (!tbl.style.width) tbl.style.width = '100%';
        }
      });
      contentEl.querySelectorAll('th, td').forEach((cell) => {
        if (!cell.style.border) cell.style.border = '1px solid #d0d0d0';
        if (!cell.style.padding) cell.style.padding = '6px 10px';
        cell.style.boxSizing = 'border-box';
        const cellAlign = cell.style.textAlign || cell.getAttribute('align');
        if (cellAlign) {
          cell.style.textAlign = cellAlign;
        }
      });
      contentEl.querySelectorAll('th').forEach((th) => {
        if (!th.style.backgroundColor) {
          th.style.backgroundColor = '#f7f7f7';
        }
        th.style.fontWeight = th.style.fontWeight || '600';
      });
      contentEl.querySelectorAll('img').forEach((img) => {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '4px';
        img.style.display = 'block';
        img.style.margin = '10px auto';
      });

      pageEl.appendChild(contentEl);
      stage.innerHTML = '';
      stage.appendChild(pageEl);

      // Wait for any images inside this page to complete loading
      const imgs = Array.from(pageEl.querySelectorAll('img'));
      if (imgs.length > 0) {
        await Promise.all(
          imgs.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((res) => {
              img.onload = res;
              img.onerror = res;
              setTimeout(res, 500);
            });
          })
        );
      }

      // Capture this page
      const canvas = await h2c(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      const pageImgData = canvas.toDataURL('image/jpeg', 0.95);

      if (pageIdx > 0) {
        pdf.addPage(formatKey, isLandscape ? 'l' : 'p');
      }

      pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfPageWidth, pdfPageHeight);
    }

    const blob = pdf.output('blob');
    return { blob, pdf };
  } finally {
    stage.remove();
  }
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
      const base64 = parts[1];
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:')) {
      const res = await fetch(src);
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      return new Uint8Array(buffer);
    }
  } catch (err) {
    console.warn('Could not extract image for DOCX export:', err?.message);
  }

  return null;
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
    PageOrientation,
    HorizontalPositionAlign,
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
  const headingColor = normalizeExportColor(design.heading || design.accent || '#c9a84c', true) || 'C9A84C';
  const lineSpacingMultiplier = Number(design.spacing || '1.7') || 1.7;
  const wordLineSpacing = Math.round(lineSpacingMultiplier * 240); // 240 = 1.0 single spacing in docx

  const cleanHtml = prepareExportHtml(rawHtml, options);
  const div = document.createElement('div');
  div.innerHTML = cleanHtml;

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

  // Paragraph spacing from the element's inline style (line-height, margin-top/bottom),
  // falling back to the document defaults. A unitless line-height is a line multiple.
  const paragraphSpacing = (el, fallback) => {
    const style = el?.style;
    if (!style) return fallback;
    const spacing = { ...fallback };
    const lineHeight = String(style.lineHeight || '').trim();
    if (/^\d*\.?\d+$/.test(lineHeight)) {
      spacing.line = Math.round(Number(lineHeight) * 240);
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
    probe.onload = () => resolve({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.onerror = () => resolve(null);
    probe.src = src;
  });

  const imageData = new Map();
  await Promise.all(Array.from(div.querySelectorAll('img')).map(async (img) => {
    const src = img.getAttribute('src');
    const [bytes, natural] = await Promise.all([extractImageBytes(src), loadNaturalSize(src)]);
    if (bytes) imageData.set(img, { bytes, natural });
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
    const transformation = imageSize(img, data.natural);
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

  // Helper to extract styled TextRuns recursively from inline nodes
  const parseInlineNodes = (node, inheritedProps = {}) => {
    const runs = [];

    const walkInline = (currNode, currProps) => {
      if (currNode.nodeType === 3) {
        const txt = currNode.textContent;
        if (txt) {
          runs.push(new TextRun({ text: txt, font: bodyFont, ...currProps }));
        }
        return;
      }

      if (currNode.nodeType !== 1) return;

      const tag = currNode.tagName.toLowerCase();
      const style = currNode.style || {};
      const nextProps = { font: bodyFont, ...currProps };

      if (tag === 'strong' || tag === 'b' || style.fontWeight === 'bold' || parseInt(style.fontWeight, 10) >= 700) {
        nextProps.bold = true;
      }
      if (tag === 'em' || tag === 'i' || style.fontStyle === 'italic') {
        nextProps.italics = true;
      }
      if (tag === 'u' || style.textDecoration?.includes('underline')) {
        nextProps.underline = {};
      }
      if (tag === 's' || tag === 'strike' || tag === 'del' || style.textDecoration?.includes('line-through')) {
        nextProps.strike = true;
      }
      if (tag === 'code') {
        nextProps.font = 'Courier New';
      }
      if (tag === 'br') {
        runs.push(new TextRun({ break: 1, ...currProps }));
        return;
      }
      if (tag === 'img') {
        const imageRun = buildImageRun(currNode);
        if (imageRun) runs.push(imageRun);
        return;
      }

      // Font size in half-points; the editor stores pt, pasted content may use px.
      if (style.fontSize) {
        const n = parseFloat(style.fontSize);
        const pt = String(style.fontSize).trim().endsWith('px') ? n * 0.75 : n;
        if (pt > 0) nextProps.size = Math.min(144, Math.max(12, Math.round(pt * 2)));
      }

      // Color normalization: must be 6-char hex without #
      const colorVal = style.color || currNode.getAttribute('color');
      if (colorVal) {
        const hex = normalizeExportColor(colorVal, true);
        if (hex) nextProps.color = hex;
      }

      // Font family
      if (style.fontFamily) {
        const mappedFont = mapFontForDocx(style.fontFamily);
        if (mappedFont) nextProps.font = mappedFont;
      }

      if (tag === 'a' && currNode.getAttribute('href')) {
        const href = currNode.getAttribute('href');
        const linkRuns = [];
        currNode.childNodes.forEach((child) => {
          if (child.nodeType === 3) {
            linkRuns.push(new TextRun({
              text: child.textContent || '',
              color: '0563C1',
              underline: {},
              font: bodyFont,
              ...nextProps,
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
    };

    node.childNodes.forEach((child) => walkInline(child, inheritedProps));

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
          if (isHeader) {
            shading = { fill: 'F7F7F7', type: ShadingType.CLEAR };
          } else if (cell.style?.backgroundColor) {
            const hex = normalizeExportColor(cell.style.backgroundColor, true);
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
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
          }));
        }
        if (cells.length) {
          rows.push(new TableRow({ children: cells }));
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
  if (headerFooter.pageNumberEnabled || !headerFooter.footerText) {
    if (headerFooter.footerText) {
      footerRuns.push(new TextRun({ text: ' — Page ', font: bodyFont, size: 18, color: '71717A' }));
    }
    footerRuns.push(new TextRun({ children: [PageNumber.CURRENT], font: bodyFont, size: 18, color: '71717A' }));
  }

  const footerChildren = [
    new Paragraph({
      alignment: footerAlignmentType,
      children: footerRuns.length ? footerRuns : [new TextRun({ text: '', font: bodyFont })],
      spacing: { before: 120 },
    }),
  ];

  const doc = new Document({
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
            size: 24,
            color: '1A1A1A',
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
          page: {
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
