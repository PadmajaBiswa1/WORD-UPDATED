/**
 * Document Pagination Utilities
 * Calculates accurate page breaks for mixed content
 */

const PAGE_SIZES = {
  a4: { w: 794, h: 1123 },
  letter: { w: 816, h: 1056 },
  legal: { w: 816, h: 1344 },
  a3: { w: 1123, h: 1587 },
};

const MARGIN_MAP = {
  normal: 96,
  narrow: 48,
  moderate: 72,
  wide: 144,
};

/**
 * Calculate the height of an HTML element as if it were rendered
 */
export function estimateElementHeight(element, containerWidth = 794) {
  if (!element) return 0;

  const clone = element.cloneNode(true);
  clone.style.position = 'absolute';
  clone.style.visibility = 'hidden';
  clone.style.width = containerWidth + 'px';
  clone.style.height = 'auto';
  document.body.appendChild(clone);

  const height = clone.offsetHeight;
  document.body.removeChild(clone);

  return height || 0;
}

/**
 * Calculate page breaks for document content
 * Returns an array of page indices and their content ranges
 */
export function calculatePageBreaks(content, pageSettings = {}) {
  const { size = 'a4', margin = 'normal', orientation = 'portrait' } = pageSettings;
  
  const dims = PAGE_SIZES[size] || PAGE_SIZES.a4;
  const pad = MARGIN_MAP[margin] || 96;
  
  // Calculate usable page height
  const pageWidth = orientation === 'landscape' ? dims.h : dims.w;
  const pageHeight = orientation === 'landscape' ? dims.w : dims.h;
  const usableHeight = pageHeight - (pad * 2);

  if (!content) return [];

  const pages = [];
  let currentPageStartOffset = 0;
  let currentPageHeight = 0;
  let pageNumber = 0;

  // Get all block elements (paragraphs, headings, tables, images, etc.)
  const blocks = Array.from(content.children || []);

  blocks.forEach((block, blockIndex) => {
    // Check if this block is a page break
    const isPageBreak = block.classList?.contains('etherx-page-break') ||
                       block.style?.pageBreakAfter === 'always' ||
                       block.style?.pageBreakBefore === 'always';

    // Estimate block height
    let blockHeight = 0;
    try {
      blockHeight = estimateElementHeight(block, pageWidth - (pad * 2));
    } catch {
      // Fallback: use offsetHeight or estimate
      blockHeight = block.offsetHeight || 40;
    }

    // Add padding for spacing
    blockHeight += 8;

    // Check if block should start on a new page
    if (isPageBreak || (currentPageHeight + blockHeight > usableHeight && currentPageHeight > 0)) {
      // Save current page
      if (currentPageHeight > 0) {
        pages.push({
          pageNumber: pageNumber + 1,
          startBlockIndex: currentPageStartOffset,
          endBlockIndex: blockIndex - 1,
          heightUsed: currentPageHeight,
        });
        pageNumber++;
      }

      // Start new page
      currentPageStartOffset = blockIndex;
      currentPageHeight = 0;

      // If this is a page break element itself, skip it
      if (isPageBreak) {
        currentPageStartOffset = blockIndex + 1;
        return;
      }
    }

    currentPageHeight += blockHeight;
  });

  // Add final page
  if (currentPageHeight > 0 || blocks.length > 0) {
    pages.push({
      pageNumber: pageNumber + 1,
      startBlockIndex: currentPageStartOffset,
      endBlockIndex: blocks.length - 1,
      heightUsed: currentPageHeight,
    });
  }

  return pages;
}

/**
 * Apply pagination styling to document pages
 */
export function applyPaginationStyles(pageElements, pageSettings = {}) {
  if (!pageElements || pageElements.length === 0) return;

  const { size = 'a4', margin = 'normal', orientation = 'portrait' } = pageSettings;
  
  const dims = PAGE_SIZES[size] || PAGE_SIZES.a4;
  const pad = MARGIN_MAP[margin] || 96;
  
  const pageWidth = orientation === 'landscape' ? dims.h : dims.w;
  const pageHeight = orientation === 'landscape' ? dims.w : dims.h;

  pageElements.forEach((pageEl) => {
    pageEl.style.width = pageWidth + 'px';
    pageEl.style.minHeight = pageHeight + 'px';
    pageEl.style.padding = pad + 'px';
    pageEl.style.boxSizing = 'border-box';
    pageEl.style.pageBreakAfter = 'always';
    pageEl.style.position = 'relative';
    pageEl.style.overflow = 'hidden';
  });
}

/**
 * Get current page number from cursor position
 */
export function getPageFromCursor(editor, pageElements = []) {
  if (!editor || !pageElements.length) return 1;

  const { from } = editor.state.selection;
  let charCount = 0;

  for (let i = 0; i < pageElements.length; i++) {
    const pageEl = pageElements[i];
    const pageText = pageEl.textContent || '';
    const pageLength = pageText.length;

    if (charCount + pageLength >= from) {
      return i + 1;
    }

    charCount += pageLength;
  }

  return pageElements.length;
}

/**
 * Recalculate and update all pages
 */
export function recalculatePages(contentElement, pageSettings = {}) {
  if (!contentElement) return { pages: [], totalPages: 0 };

  const pages = calculatePageBreaks(contentElement, pageSettings);
  
  // Apply styling to visible page elements
  const pageElements = Array.from(
    contentElement.querySelectorAll('[id^="document-page-"]')
  );
  
  applyPaginationStyles(pageElements, pageSettings);

  return {
    pages,
    totalPages: Math.max(pages.length, pageElements.length || 1),
  };
}
