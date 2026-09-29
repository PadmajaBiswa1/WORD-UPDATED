// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Export Service (client-side)
// ═══════════════════════════════════════════════════════════════
import { saveAs } from 'file-saver';
import { PAGE_SIZES, MARGIN_MAP } from '@/utils/pageLayout';
import { useDocumentStore, useUIStore } from '@/store';

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

  let html = rawHtml
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
    th, td {
      border: 1px solid #d0d0d0;
      padding: 8px 12px;
      text-align: left;
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
        tbl.style.width = '100%';
        tbl.style.margin = '12pt 0';
      });
      contentEl.querySelectorAll('th, td').forEach((cell) => {
        cell.style.border = '1px solid #d0d0d0';
        cell.style.padding = '6px 10px';
      });
      contentEl.querySelectorAll('th').forEach((th) => {
        th.style.backgroundColor = '#f7f7f7';
        th.style.fontWeight = '600';
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
    ThematicBreak,
    PageBreak,
    Header,
    Footer,
    PageNumber,
    ImageRun,
    PageOrientation,
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

      // Font size in half-points
      if (style.fontSize) {
        const px = parseInt(style.fontSize, 10);
        if (px && px > 0) nextProps.size = Math.min(144, Math.max(12, px * 2));
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

  const parseBlockElement = async (node) => {
    if (node.nodeType === 3) {
      const text = (node.textContent || '').trim();
      if (text) {
        return new Paragraph({
          children: [new TextRun({ text, font: bodyFont })],
          spacing: { line: wordLineSpacing, after: 200 },
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
    const style = node.style || {};

    // Images
    if (tag === 'img') {
      const src = node.getAttribute('src');
      const imageBytes = await extractImageBytes(src);
      if (imageBytes) {
        let width = parseInt(node.getAttribute('width') || style.width, 10);
        let height = parseInt(node.getAttribute('height') || style.height, 10);

        if (!width || width <= 0) width = 500;
        if (!height || height <= 0) height = 300;

        // Cap to printable width in Word (~560px for A4 Normal margins)
        if (width > 560) {
          const ratio = height / width;
          width = 560;
          height = Math.round(width * ratio);
        }

        return new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: imageBytes,
              transformation: { width, height },
            }),
          ],
          spacing: { after: 200 },
        });
      }
      return null;
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
        children: headingRuns,
        spacing: { before: 240, after: 120 },
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
        children: parseInlineNodes(node, { italics: true, color: '555555', font: bodyFont }),
        spacing: { line: wordLineSpacing, after: 200 },
      });
    }

    // Lists
    if (tag === 'ul' || tag === 'ol') {
      const listParas = [];
      node.querySelectorAll(':scope > li').forEach((li) => {
        listParas.push(new Paragraph({
          bullet: tag === 'ul' ? { level: 0 } : undefined,
          children: parseInlineNodes(li, { font: bodyFont }),
          spacing: { line: wordLineSpacing, after: 100 },
        }));
      });
      return listParas;
    }

    // Tables
    if (tag === 'table') {
      const rows = [];
      const trs = node.querySelectorAll('tr');
      for (const tr of Array.from(trs)) {
        const cells = [];
        for (const cell of Array.from(tr.querySelectorAll('td, th'))) {
          const isHeader = cell.tagName.toLowerCase() === 'th';
          const cellParas = [];
          if (cell.children.length > 0) {
            for (const child of Array.from(cell.childNodes)) {
              const res = await parseBlockElement(child);
              if (Array.isArray(res)) cellParas.push(...res);
              else if (res) cellParas.push(res);
            }
          }
          if (!cellParas.length) {
            cellParas.push(new Paragraph({
              children: parseInlineNodes(cell, isHeader ? { bold: true, font: bodyFont } : { font: bodyFont }),
              spacing: { after: 60 },
            }));
          }
          cells.push(new TableCell({ children: cellParas }));
        }
        if (cells.length) {
          rows.push(new TableRow({ children: cells }));
        }
      }
      if (rows.length) {
        return new Table({ rows });
      }
      return null;
    }

    // Divs / Containers: Check if it contains block children or just inline text
    if (tag === 'div') {
      // Check for nested image
      const nestedImg = node.querySelector(':scope > img');
      if (nestedImg && node.children.length === 1) {
        return await parseBlockElement(nestedImg);
      }

      const hasBlockChildren = Array.from(node.children).some((c) =>
        /^(p|div|h[1-6]|ul|ol|table|blockquote|hr)$/i.test(c.tagName)
      );
      if (hasBlockChildren) {
        const innerBlocks = [];
        for (const child of Array.from(node.childNodes)) {
          const res = await parseBlockElement(child);
          if (Array.isArray(res)) innerBlocks.push(...res);
          else if (res) innerBlocks.push(res);
        }
        return innerBlocks;
      }
    }

    // Standard Paragraph: check if contains an image
    const singleImg = node.querySelector(':scope > img');
    if (singleImg && node.childNodes.length === 1) {
      return await parseBlockElement(singleImg);
    }

    const runs = parseInlineNodes(node, { font: bodyFont });
    let alignment = undefined;
    const textAlign = style.textAlign || node.getAttribute('align');
    if (textAlign === 'center') alignment = AlignmentType.CENTER;
    else if (textAlign === 'right') alignment = AlignmentType.RIGHT;
    else if (textAlign === 'justify') alignment = AlignmentType.JUSTIFIED;

    return new Paragraph({
      alignment,
      children: runs.length ? runs : [new TextRun({ text: '', font: bodyFont })],
      spacing: { line: wordLineSpacing, after: 200 },
    });
  };

  for (const node of Array.from(div.childNodes)) {
    const result = await parseBlockElement(node);
    if (Array.isArray(result)) {
      result.forEach((b) => b && children.push(b));
    } else if (result) {
      children.push(result);
    }
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
