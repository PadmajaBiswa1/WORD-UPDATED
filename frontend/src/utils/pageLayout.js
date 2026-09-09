import { useUIStore } from '../store';

// Page size definitions — pixel dimensions at 96 dpi (matches browser default)
// These match Microsoft Word's exact page sizes.
export const PAGE_SIZES = {
  a4:     { w: 794,  h: 1123, label: 'A4' },
  letter: { w: 816,  h: 1056, label: 'Letter' },
  legal:  { w: 816,  h: 1344, label: 'Legal' },
  a3:     { w: 1123, h: 1587, label: 'A3' },
};

// Margin presets — in pixels at 96 dpi (matches Word's margin presets exactly)
// Normal = 1", Narrow = 0.5", Moderate = 0.75", Wide = 1.5"
export const MARGIN_MAP = {
  normal:   96,   // 1 inch   (Word "Normal")
  narrow:   48,   // 0.5 inch (Word "Narrow")
  moderate: 72,   // 0.75 inch (Word "Moderate")
  wide:     144,  // 1.5 inch  (Word "Wide")
};

// Visual gap between page sheets in the scroll view (not a Word concept)
export const PAGE_GAP = 18;

// Border drawn around each page sheet (cosmetic only)
export const PAGE_BORDER_WIDTH = 1;

/**
 * Compute all layout metrics for a given page configuration.
 * All values are in natural (unscaled) pixels — zoom scaling is applied
 * externally in EditorCanvas.
 */
export function getLayoutMetrics({ size, orientation, margin } = {}) {
  const dims    = PAGE_SIZES[size] || PAGE_SIZES.a4;
  const pageWidth  = orientation === 'landscape' ? dims.h : dims.w;
  const pageHeight = orientation === 'landscape' ? dims.w : dims.h;
  const padding    = MARGIN_MAP[margin] || MARGIN_MAP.normal;

  // Usable text area height = page height minus top+bottom margins minus border
  const contentHeight = Math.max(1, pageHeight - padding * 2 - PAGE_BORDER_WIDTH * 2);

  return {
    pageWidth,
    pageHeight,
    padding,
    contentHeight,
  };
}


/**
 * Convenience: returns the usable text-column height in natural pixels for
 * the current store state. Used by PageBreak to size the invisible filler
 * node that pushes content to the next page.
 */
export function getCurrentContentHeight() {
  const { pageSize, pageOrientation, pageMargin } = useUIStore.getState();
  const metrics = getLayoutMetrics({ size: pageSize, orientation: pageOrientation, margin: pageMargin });
  return metrics.contentHeight;
}