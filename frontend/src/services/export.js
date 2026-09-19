// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Export Service (client-side)
// ═══════════════════════════════════════════════════════════════
import { saveAs } from 'file-saver';

export function sanitizeFilename(name) {
  return (name || 'document').replace(/[^a-z0-9_\-\s]/gi, '_').trim() || 'document';
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
 * Cleans up raw editor HTML for external exports.
 * Removes internal auto-break spacers, cleans trailing empty paragraphs, and normalizes inline color tags.
 */
export function prepareExportHtml(rawHtml = '') {
  if (!rawHtml || typeof rawHtml !== 'string') return '<p></p>';

  let html = rawHtml
    // Remove auto-page-break divs inserted for editor pagination
    .replace(/<div[^>]*class="[^"]*(?:etherx-page-break|etherx-auto-page-break)[^"]*"[^>]*><\/div>/gi, '')
    .replace(/<div[^>]*data-page-break="true"[^>]*><\/div>/gi, '')
    .replace(/<div[^>]*data-etherx-auto-break="true"[^>]*><\/div>/gi, '')
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

/* ── HTML ───────────────────────────────────────────────────── */

export function buildHtmlDocument(title, rawHtml) {
  const cleanTitle = (title || 'Untitled Document').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const content = prepareExportHtml(rawHtml);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${cleanTitle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 15px;
      line-height: 1.7;
      color: #1a1a1a;
      background-color: #ffffff;
      max-width: 820px;
      margin: 40px auto;
      padding: 0 32px;
      word-break: break-word;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #111111;
      line-height: 1.3;
      margin-top: 1.4em;
      margin-bottom: 0.5em;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eaeaea; padding-bottom: 8px; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    p { margin: 0 0 1em 0; }
    a { color: #0563c1; text-decoration: underline; }
    blockquote {
      border-left: 4px solid #d4af37;
      margin: 1.2em 0;
      padding-left: 16px;
      color: #555555;
      font-style: italic;
    }
    ul, ol { padding-left: 28px; margin: 0 0 1em 0; }
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
    img { max-width: 100%; height: auto; border-radius: 4px; }
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
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

export function buildHtmlBlob(title, html) {
  const doc = buildHtmlDocument(title, html);
  return new Blob([doc], { type: 'text/html;charset=utf-8' });
}

export function exportToHtml(title, html) {
  const blob = buildHtmlBlob(title, html);
  saveAs(blob, `${sanitizeFilename(title)}.html`);
  return blob;
}

/* ── PDF (via jsPDF + html2canvas) ─────────────────────────── */

export async function buildPdfBlob(title, htmlOrEl, pageSettings = {}) {
  const [{ default: jsPDF }, { default: h2c }] = await Promise.all([
    import('jspdf'), import('html2canvas'),
  ]);

  const orientation = pageSettings.orientation || 'portrait';
  const format = pageSettings.format || 'a4';
  const formatMap = {
    a4: 'a4',
    letter: 'letter',
    legal: 'legal',
    a3: 'a3',
  };
  const selectedFormat = formatMap[format] || 'a4';

  let container = null;
  let targetEl = htmlOrEl;

  if (typeof htmlOrEl === 'string') {
    container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.minHeight = '1123px';
    container.style.padding = '48px';
    container.style.background = '#ffffff';
    container.style.color = '#1a1a1a';
    container.style.fontFamily = 'Calibri, Arial, sans-serif';
    container.style.lineHeight = '1.6';
    container.style.zIndex = '-9999';
    container.style.opacity = '1';
    container.style.pointerEvents = 'none';
    container.style.boxSizing = 'border-box';
    container.innerHTML = prepareExportHtml(htmlOrEl);

    // Enforce dark text contrast on all children
    const allTextEls = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, li, td, th, div');
    allTextEls.forEach((el) => {
      const currentColor = el.style.color;
      if (currentColor) {
        const norm = normalizeExportColor(currentColor, false);
        el.style.color = norm || '#1a1a1a';
      } else {
        el.style.color = '#1a1a1a';
      }
    });

    document.body.appendChild(container);
    targetEl = container;
  }

  try {
    const canvas = await h2c(targetEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
    });

    const pdf = new jsPDF({
      orientation: orientation === 'landscape' ? 'l' : 'p',
      unit: 'mm',
      format: selectedFormat,
    });

    const pw = pdf.internal.pageSize.getWidth() - 20;
    const ph = pdf.internal.pageSize.getHeight() - 20;
    const imgH = (canvas.height * pw) / (canvas.width || 1);
    let remaining = imgH;
    let imgPos = 0;
    let y = 10;

    while (remaining > 0) {
      const startY = (imgPos / imgH) * canvas.height;
      const endY = startY + (ph / imgH) * canvas.height;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.max(1, endY - startY);
      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, -startY, canvas.width, canvas.height);

      const pageImgData = pageCanvas.toDataURL('image/png');
      pdf.addImage(pageImgData, 'PNG', 10, y, pw, (ph * (endY - startY)) / canvas.height);

      remaining -= ph;
      if (remaining > 0) {
        pdf.addPage();
        y = 10;
      }
      imgPos += ph;
    }

    const blob = pdf.output('blob');
    return { blob, pdf };
  } finally {
    if (container) container.remove();
  }
}

export async function exportToPdf(title, htmlOrEl, pageSettings = {}) {
  const { blob } = await buildPdfBlob(title, htmlOrEl, pageSettings);
  saveAs(blob, `${sanitizeFilename(title)}.pdf`);
  return blob;
}

/* ── DOCX (via docx library) ────────────────────────────────── */

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
  } = await import('docx');

  const cleanHtml = prepareExportHtml(rawHtml);
  const div = document.createElement('div');
  div.innerHTML = cleanHtml;

  // Helper to extract styled TextRuns recursively from inline nodes
  const parseInlineNodes = (node, inheritedProps = {}) => {
    const runs = [];

    const walkInline = (currNode, currProps) => {
      if (currNode.nodeType === 3) {
        const txt = currNode.textContent;
        if (txt) {
          runs.push(new TextRun({ text: txt, ...currProps }));
        }
        return;
      }

      if (currNode.nodeType !== 1) return;

      const tag = currNode.tagName.toLowerCase();
      const style = currNode.style || {};

      const nextProps = { ...currProps };

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

      // Font size
      if (style.fontSize) {
        const px = parseInt(style.fontSize, 10);
        if (px && px > 0) nextProps.size = Math.min(144, Math.max(12, px * 2)); // half-points
      }

      // Color normalization: must be 6-char hex without #
      const colorVal = style.color || currNode.getAttribute('color');
      if (colorVal) {
        const hex = normalizeExportColor(colorVal, true);
        if (hex) nextProps.color = hex;
      }

      // Font family
      if (style.fontFamily) {
        const cleanFont = style.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
        if (cleanFont) nextProps.font = cleanFont;
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
              ...nextProps,
            }));
          } else {
            walkInline(child, { color: '0563C1', underline: {}, ...nextProps });
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

    // Fallback if node has direct text and no children were parsed
    if (!runs.length && node.textContent) {
      runs.push(new TextRun({ text: node.textContent, ...inheritedProps }));
    }

    return runs;
  };

  const children = [];

  const parseBlockElement = (node) => {
    if (node.nodeType === 3) {
      const text = (node.textContent || '').trim();
      if (text) {
        return new Paragraph({ children: [new TextRun({ text })] });
      }
      return null;
    }

    if (node.nodeType !== 1) return null;

    const tag = node.tagName.toLowerCase();
    const style = node.style || {};

    // Headings
    if (tag === 'h1') return new Paragraph({ heading: HeadingLevel.HEADING_1, children: parseInlineNodes(node) });
    if (tag === 'h2') return new Paragraph({ heading: HeadingLevel.HEADING_2, children: parseInlineNodes(node) });
    if (tag === 'h3') return new Paragraph({ heading: HeadingLevel.HEADING_3, children: parseInlineNodes(node) });
    if (tag === 'h4') return new Paragraph({ heading: HeadingLevel.HEADING_4, children: parseInlineNodes(node) });
    if (tag === 'h5') return new Paragraph({ heading: HeadingLevel.HEADING_5, children: parseInlineNodes(node) });
    if (tag === 'h6') return new Paragraph({ heading: HeadingLevel.HEADING_6, children: parseInlineNodes(node) });

    // Horizontal Rule
    if (tag === 'hr') {
      return new Paragraph({ thematicBreak: true });
    }

    // Blockquote
    if (tag === 'blockquote') {
      return new Paragraph({
        indent: { left: 720 },
        children: parseInlineNodes(node, { italics: true, color: '555555' }),
      });
    }

    // Lists
    if (tag === 'ul' || tag === 'ol') {
      const listParas = [];
      node.querySelectorAll(':scope > li').forEach((li) => {
        listParas.push(new Paragraph({
          bullet: tag === 'ul' ? { level: 0 } : undefined,
          children: parseInlineNodes(li),
        }));
      });
      return listParas;
    }

    // Tables
    if (tag === 'table') {
      const rows = [];
      const trs = node.querySelectorAll('tr');
      trs.forEach((tr) => {
        const cells = [];
        tr.querySelectorAll('td, th').forEach((cell) => {
          const isHeader = cell.tagName.toLowerCase() === 'th';
          const cellParas = [];
          if (cell.children.length > 0) {
            cell.childNodes.forEach((child) => {
              const res = parseBlockElement(child);
              if (Array.isArray(res)) cellParas.push(...res);
              else if (res) cellParas.push(res);
            });
          }
          if (!cellParas.length) {
            cellParas.push(new Paragraph({ children: parseInlineNodes(cell, isHeader ? { bold: true } : {}) }));
          }
          cells.push(new TableCell({ children: cellParas }));
        });
        if (cells.length) {
          rows.push(new TableRow({ children: cells }));
        }
      });
      if (rows.length) {
        return new Table({ rows });
      }
      return null;
    }

    // Divs: check if it contains block children or just inline text
    if (tag === 'div') {
      const hasBlockChildren = Array.from(node.children).some((c) =>
        /^(p|div|h[1-6]|ul|ol|table|blockquote|hr)$/i.test(c.tagName)
      );
      if (hasBlockChildren) {
        const innerBlocks = [];
        node.childNodes.forEach((child) => {
          const res = parseBlockElement(child);
          if (Array.isArray(res)) innerBlocks.push(...res);
          else if (res) innerBlocks.push(res);
        });
        return innerBlocks;
      }
    }

    // Standard Paragraph
    const runs = parseInlineNodes(node);
    let alignment = undefined;
    const textAlign = style.textAlign || node.getAttribute('align');
    if (textAlign === 'center') alignment = AlignmentType.CENTER;
    else if (textAlign === 'right') alignment = AlignmentType.RIGHT;
    else if (textAlign === 'justify') alignment = AlignmentType.JUSTIFIED;

    return new Paragraph({
      alignment,
      children: runs.length ? runs : [new TextRun({ text: '' })],
    });
  };

  div.childNodes.forEach((node) => {
    const result = parseBlockElement(node);
    if (Array.isArray(result)) {
      result.forEach((b) => b && children.push(b));
    } else if (result) {
      children.push(result);
    }
  });

  // Guarantee at least one valid paragraph so the document is never blank/corrupt
  if (!children.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function exportToDocx(title, html) {
  const blob = await buildDocxBlob(html);
  saveAs(blob, `${sanitizeFilename(title)}.docx`);
  return blob;
}

/* ── Markdown & EPUB ──────────────────────────────────────────── */
export { exportToMarkdown, downloadMarkdown, buildMarkdownBlob } from './markdownExport';
export { exportToEpub, buildEpubBlob } from './epubExport';


