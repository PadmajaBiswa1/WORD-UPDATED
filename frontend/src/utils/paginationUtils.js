/**
 * Document Pagination Utilities
 * Calculates accurate page breaks and layout metrics for mixed content
 */
import { PAGE_SIZES, MARGIN_MAP, PAGE_GAP, PAGE_BORDER_WIDTH, getLayoutMetrics } from './pageLayout';

export { PAGE_SIZES, MARGIN_MAP, PAGE_GAP, PAGE_BORDER_WIDTH };

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
 * Calculate page breaks for document content with browser-exact margin collapsing
 * Returns an array of page indices and their content ranges
 */
export function calculatePageBreaks(content, pageSettings = {}) {
  const { size = 'a4', margin = 'normal', orientation = 'portrait' } = pageSettings;
  const metrics = getLayoutMetrics({ size, orientation, margin });
  const contentHeight = Math.max(1, metrics.contentHeight - (PAGE_BORDER_WIDTH * 2));
  const pageStep = metrics.pageHeight + PAGE_GAP;

  if (!content) return [];

  const pages = [];
  const blocks = Array.from(content.children || []);
  if (!blocks.length) return [];

  let currentPage = 0;
  let currentY = 0;
  let prevBottomMargin = 0;
  let pageHasContent = false;
  let pageStartBlockIndex = 0;

  blocks.forEach((block, index) => {
    const isPageBreak = block.classList?.contains('etherx-page-break') ||
                        block.dataset?.pageBreak === 'true' ||
                        block.style?.pageBreakAfter === 'always' ||
                        block.style?.pageBreakBefore === 'always';

    if (isPageBreak) {
      if (pageHasContent) {
        pages.push({
          pageNumber: currentPage + 1,
          startBlockIndex: pageStartBlockIndex,
          endBlockIndex: Math.max(pageStartBlockIndex, index - 1),
          heightUsed: currentY - (currentPage * pageStep),
        });
        currentPage += 1;
      }
      currentY = currentPage * pageStep;
      prevBottomMargin = 0;
      pageHasContent = false;
      pageStartBlockIndex = index + 1;
      return;
    }

    let blockHeight = 0;
    let marginTop = 0;
    let marginBottom = 10;

    try {
      const rect = block.getBoundingClientRect ? block.getBoundingClientRect() : null;
      blockHeight = (rect && rect.height) ? rect.height : (block.offsetHeight || 32);
      const cs = window.getComputedStyle(block);
      marginTop = parseFloat(cs.marginTop) || 0;
      marginBottom = parseFloat(cs.marginBottom) || 0;
    } catch {
      blockHeight = block.offsetHeight || 32;
    }

    const effectiveMarginTop = pageHasContent ? Math.max(prevBottomMargin, marginTop) : 0;
    const proposedBottom = currentY + effectiveMarginTop + blockHeight;
    const pageContentLimit = currentPage * pageStep + contentHeight;

    if (pageHasContent && proposedBottom > pageContentLimit) {
      pages.push({
        pageNumber: currentPage + 1,
        startBlockIndex: pageStartBlockIndex,
        endBlockIndex: Math.max(pageStartBlockIndex, index - 1),
        heightUsed: currentY - (currentPage * pageStep),
      });
      currentPage += 1;
      currentY = currentPage * pageStep;
      prevBottomMargin = 0;
      pageHasContent = false;
      pageStartBlockIndex = index;
    }

    currentY = (pageHasContent ? currentY + effectiveMarginTop : currentY) + blockHeight;
    prevBottomMargin = marginBottom;
    pageHasContent = true;
  });

  if (pageHasContent || pages.length === 0) {
    pages.push({
      pageNumber: currentPage + 1,
      startBlockIndex: pageStartBlockIndex,
      endBlockIndex: Math.max(0, blocks.length - 1),
      heightUsed: currentY - (currentPage * pageStep),
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
  const metrics = getLayoutMetrics({ size, orientation, margin });

  pageElements.forEach((pageEl) => {
    pageEl.style.width = `${metrics.pageWidth}px`;
    pageEl.style.minHeight = `${metrics.pageHeight}px`;
    pageEl.style.boxSizing = 'border-box';
    pageEl.style.position = 'relative';
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
  if (!contentElement) return { pages: [], totalPages: 1 };

  const pages = calculatePageBreaks(contentElement, pageSettings);
  return {
    pages,
    totalPages: Math.max(1, pages.length),
  };
}
