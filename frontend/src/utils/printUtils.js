/**
 * printUtils.js
 * Printing that follows the document's page setup (paper size, orientation,
 * margins, columns), plus suppression of the browser's title header.
 */
import DOMPurify from 'dompurify';
import { PAGE_SIZES, MARGIN_MAP } from './pageLayout';
import { useDocumentStore } from '../store';
import { acceptSuggestionsInHtml } from '@/services/suggestionHtml';

// CSS @page rule for a document layout, e.g. "@page { size: A4 landscape; margin: 48px; }".
export function pageRule(layout = {}) {
  const size = (PAGE_SIZES[layout?.pageSize] || PAGE_SIZES.a4).label;
  const orientation = layout?.pageOrientation === 'landscape' ? 'landscape' : 'portrait';
  const margin = MARGIN_MAP[layout?.pageMargin] ?? MARGIN_MAP.normal;
  return `@page { size: ${size} ${orientation}; margin: ${margin}px; }`;
}

const escapeHtml = (text = '') => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PRINT_CSS = `
  body { margin: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #111; line-height: 1.6; }
  h1, h2, h3, h4, h5, h6 { color: #111; margin-top: 1.2em; margin-bottom: 0.4em; }
  p { margin: 0 0 1em; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; }
  [data-page-break] { height: 0 !important; margin: 0 !important; break-after: page; }
`;

// Document HTML made safe to render outside the editor: pending suggestions are
// shown as accepted and anything executable is stripped (shared documents and
// mail-merge data are untrusted).
export function printableHtml(html = '') {
  return DOMPurify.sanitize(acceptSuggestionsInHtml(html || ''));
}

// Print HTML in its own window, laid out with the document's page setup.
// Returns false when the popup was blocked.
export function printHtml(html, { layout = {}, title = '' } = {}) {
  const popup = window.open('', '_blank', 'width=980,height=760');
  if (!popup) return false;
  const columns = Number(layout?.pageColumns) > 1 ? `column-count: ${Number(layout.pageColumns)}; column-gap: 0.5in;` : '';
  popup.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title) || '&nbsp;'}</title><style>
    ${pageRule(layout)}
    ${PRINT_CSS}
    .print-document-content { ${columns} }
  </style></head><body><div class="print-document-content">${printableHtml(html) || '<p></p>'}</div></body></html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => {
    popup.print();
    popup.close();
  }, 250);
  return true;
}

export function printDocument() {
  const prevTitle = document.title;
  try {
    document.title = ' ';
    window.print();
  } finally {
    setTimeout(() => {
      document.title = prevTitle;
    }, 600);
  }
}

// Printing the editor itself (Ctrl+P, the browser menu) uses the open document's
// page setup instead of the stylesheet's default page.
export function initGlobalPrintHandler() {
  if (typeof window === 'undefined') return;

  let savedTitle = '';
  let pageStyle = null;
  window.addEventListener('beforeprint', () => {
    savedTitle = document.title;
    document.title = ' ';
    pageStyle = document.createElement('style');
    pageStyle.textContent = pageRule(useDocumentStore.getState().layout);
    document.head.appendChild(pageStyle);
  });

  window.addEventListener('afterprint', () => {
    if (savedTitle) {
      document.title = savedTitle;
    }
    pageStyle?.remove();
    pageStyle = null;
  });
}
