import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '@/store';
import { PictureFormatTab } from '@/components/toolbar/tabs/PictureFormatTab';
import { getSelectedImageElement, isImageSelection } from '@/utils/imageSelection';

function isFocusablePictureField(target) {
  return Boolean(target?.closest?.('input, select, textarea, [contenteditable="true"]'));
}

function getImageBounds(editor) {
  const img = getSelectedImageElement(editor);
  if (img) {
    const rect = img.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };
  }

  if (!editor?.view?.dom) return null;
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!editor.view.dom.contains(range.commonAncestorContainer)) return null;

  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
  if (!rects.length) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const top = Math.min(...rects.map((rect) => rect.top));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return {
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

const MARGIN = 12;
const PADDING = 20; // keeps the toolbar away from the extreme edge/corner of the viewport
const MIN_SIDE_WIDTH = 190; // don't try to squeeze the box into a sliver
const MIN_USABLE_HEIGHT = 90;
const MAX_BOX_WIDTH = 260; // small, compact panel — matches the stacked PictureFormatTab layout

export function PictureFormatToolbar({ editor, scrollContainerRef }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [anchor, setAnchor] = useState(null);
  // top/left are always the box's TOP-LEFT CORNER in fixed-position pixels
  // (never a center point), so drag math and clamp math stay consistent.
  const [style, setStyle] = useState({ top: 0, left: 0, maxWidth: MAX_BOX_WIDTH, maxHeight: '50vh' });
  const [isImageOperationActive, setIsImageOperationActive] = useState(false);
  const toolbarRef = useRef(null);
  const hideTimerRef = useRef(null);
  const anchorRef = useRef(null);
  const styleRef = useRef(style);
  // Once the user drags the panel, we stop auto-repositioning it relative to
  // the image and just keep it clamped inside the viewport. Reset whenever
  // the toolbar fully closes and reopens for a fresh selection.
  const userMovedRef = useRef(false);
  const dragStateRef = useRef(null);

  useEffect(() => {
    anchorRef.current = anchor;
  }, [anchor]);

  useEffect(() => {
    styleRef.current = style;
  }, [style]);

  const hideToolbar = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setVisible(false);
    hideTimerRef.current = setTimeout(() => {
      setMounted(false);
      setAnchor(null);
      userMovedRef.current = false; // next open should auto-position again
    }, 160);
  }, []);

  useEffect(() => {
    const handleStart = () => {
      setIsImageOperationActive(true);
      hideToolbar();
    };
    const handleEnd = () => setIsImageOperationActive(false);
    window.addEventListener('image-drag-start', handleStart);
    window.addEventListener('image-drag-end', handleEnd);
    return () => {
      window.removeEventListener('image-drag-start', handleStart);
      window.removeEventListener('image-drag-end', handleEnd);
    };
  }, [hideToolbar]);

  const showToolbar = useCallback(() => {
    if (!editor) return;
    if (!isImageSelection(editor)) {
      hideToolbar();
      return;
    }
    const nextAnchor = getImageBounds(editor);
    if (!nextAnchor) {
      hideToolbar();
      return;
    }
    setAnchor(nextAnchor);
    setMounted(true);
  }, [editor, hideToolbar]);

  // Recompute position from the toolbar's REAL measured size, placed beside
  // the image, then ALWAYS clamp the final box fully inside the viewport.
  // That final clamp is what guarantees the panel can never end up stuck
  // off-screen in a corner, no matter how large the selected image is.
  const positionToolbar = useCallback(() => {
    const el = toolbarRef.current;
    const currentAnchor = anchorRef.current;
    if (!el || !currentAnchor) return;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    if (userMovedRef.current) {
      // Respect the user's manual placement — just keep it on-screen if the
      // window was resized since they moved it.
      setStyle((prev) => {
        const maxWidth = Math.min(prev.maxWidth, viewportW - PADDING * 2);
        const maxHeight = Math.min(prev.maxHeight, viewportH - PADDING * 2);
        const maxLeft = Math.max(PADDING, viewportW - maxWidth - PADDING);
        const maxTop = Math.max(PADDING, viewportH - maxHeight - PADDING);
        return {
          ...prev,
          maxWidth,
          maxHeight,
          left: Math.min(Math.max(prev.left, PADDING), maxLeft),
          top: Math.min(Math.max(prev.top, PADDING), maxTop),
        };
      });
      return;
    }

    const naturalWidth = el.scrollWidth;
    const naturalHeight = el.scrollHeight;

    const spaceRight = viewportW - currentAnchor.right - MARGIN - PADDING;
    const spaceLeft = currentAnchor.left - MARGIN - PADDING;
    const spaceBelow = viewportH - currentAnchor.bottom - MARGIN - PADDING;
    const spaceAbove = currentAnchor.top - MARGIN - PADDING;

    const fitsRight = spaceRight >= Math.min(naturalWidth, MIN_SIDE_WIDTH);
    const fitsLeft = spaceLeft >= Math.min(naturalWidth, MIN_SIDE_WIDTH);

    let placement;
    if (fitsRight || (!fitsLeft && spaceRight >= spaceLeft)) {
      placement = 'right';
    } else if (fitsLeft) {
      placement = 'left';
    } else if (spaceBelow >= Math.min(naturalHeight, MIN_USABLE_HEIGHT) || spaceBelow >= spaceAbove) {
      placement = 'below';
    } else {
      placement = 'above';
    }

    let maxWidth;
    let maxHeight;
    let boxTop;
    let boxLeft;

    if (placement === 'right' || placement === 'left') {
      const availableWidth = placement === 'right' ? spaceRight : spaceLeft;
      maxWidth = Math.max(160, Math.min(naturalWidth, availableWidth > 0 ? availableWidth : naturalWidth, MAX_BOX_WIDTH));
      maxHeight = Math.min(naturalHeight, viewportH - PADDING * 2, viewportH * 0.7);
      boxTop = currentAnchor.centerY - maxHeight / 2;
      boxLeft = placement === 'right'
        ? currentAnchor.right + MARGIN
        : currentAnchor.left - MARGIN - maxWidth;
    } else {
      const availableHeight = placement === 'below' ? spaceBelow : spaceAbove;
      maxHeight = Math.max(60, Math.min(naturalHeight, availableHeight > 0 ? availableHeight : naturalHeight, viewportH * 0.6));
      maxWidth = Math.min(naturalWidth, viewportW - PADDING * 2, MAX_BOX_WIDTH);
      boxLeft = currentAnchor.centerX - maxWidth / 2;
      boxTop = placement === 'below'
        ? currentAnchor.bottom + MARGIN
        : currentAnchor.top - MARGIN - maxHeight;
    }

    // Final safety clamp: no matter what the image's size/position did to
    // the numbers above, the box must end up fully inside the viewport.
    const maxLeft = Math.max(PADDING, viewportW - maxWidth - PADDING);
    const maxTop = Math.max(PADDING, viewportH - maxHeight - PADDING);
    boxLeft = Math.min(Math.max(boxLeft, PADDING), maxLeft);
    boxTop = Math.min(Math.max(boxTop, PADDING), maxTop);

    setStyle({ top: boxTop, left: boxLeft, maxWidth, maxHeight, placement });
  }, []);

  // Measure + reposition whenever the toolbar's actual rendered size changes
  // (covers async icon loads, font swaps, content changes — not just mount).
  useLayoutEffect(() => {
    if (!mounted || !toolbarRef.current) return undefined;

    positionToolbar();

    const observer = new ResizeObserver(() => {
      positionToolbar();
    });
    observer.observe(toolbarRef.current);

    const raf = requestAnimationFrame(() => setVisible(true));

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [mounted, positionToolbar]);

  useEffect(() => {
    if (!editor) return undefined;

    const syncFromSelection = () => {
      if (!isImageSelection(editor)) {
        hideToolbar();
        return;
      }
      showToolbar();
    };

    const handleWindowInteraction = () => {
      if (!mounted) return;
      positionToolbar();
    };

    syncFromSelection();
    editor.on('selectionUpdate', syncFromSelection);
    editor.on('update', syncFromSelection);
    // Losing focus entirely (clicking outside the editor's own DOM, e.g. a
    // sidebar or blank page area) doesn't always fire selectionUpdate.
    editor.on('blur', syncFromSelection);
    document.addEventListener('selectionchange', syncFromSelection);
    window.addEventListener('resize', handleWindowInteraction);

    const scrollEl = scrollContainerRef?.current;
    if (scrollEl) scrollEl.addEventListener('scroll', handleWindowInteraction, { passive: true });

    return () => {
      editor.off('selectionUpdate', syncFromSelection);
      editor.off('update', syncFromSelection);
      editor.off('blur', syncFromSelection);
      document.removeEventListener('selectionchange', syncFromSelection);
      window.removeEventListener('resize', handleWindowInteraction);
      if (scrollEl) scrollEl.removeEventListener('scroll', handleWindowInteraction);
    };
  }, [editor, hideToolbar, mounted, positionToolbar, scrollContainerRef, showToolbar]);

  // Close when the user clicks anywhere outside the toolbar and outside the
  // selected image. We re-check on the next animation frame rather than
  // synchronously on mousedown-capture, because ProseMirror can update its
  // selection (and the `.ProseMirror-selectednode` class) a moment after the
  // native mousedown fires — checking too early was letting stale "still
  // selected" state slip through and keep the toolbar open.
  useEffect(() => {
    if (!mounted) return undefined;

    const handleOutsidePointerDown = (event) => {
      const target = event.target;
      if (toolbarRef.current?.contains(target)) return;
      if (target?.closest?.('[data-select-menu="true"]')) return;

      // A node selection can remain active in ProseMirror after the editor
      // loses focus. Convert it to a regular text selection before blurring so
      // the selection event cannot immediately reopen this portal.
      const image = getSelectedImageElement(editor);
      if (image?.contains(target)) return;

      const selection = editor?.state?.selection;
      if (selection?.node?.type?.name === 'image') {
        const position = Math.max(1, Math.min(editor.state.doc.content.size, selection.from));
        editor.chain().setTextSelection(position).blur().run();
      }
      hideToolbar();
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
  }, [editor, mounted, hideToolbar]);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  // ---- Drag-to-move ----
  const handleDragPointerMove = useCallback((event) => {
    const ds = dragStateRef.current;
    const el = toolbarRef.current;
    if (!ds || !el) return;
    const width = el.offsetWidth || styleRef.current.maxWidth;
    const height = el.offsetHeight || styleRef.current.maxHeight;
    const maxLeft = Math.max(PADDING, window.innerWidth - width - PADDING);
    const maxTop = Math.max(PADDING, window.innerHeight - height - PADDING);
    const nextLeft = Math.min(Math.max(ds.startLeft + (event.clientX - ds.startX), PADDING), maxLeft);
    const nextTop = Math.min(Math.max(ds.startTop + (event.clientY - ds.startY), PADDING), maxTop);
    setStyle((prev) => ({ ...prev, left: nextLeft, top: nextTop }));
  }, []);

  const handleDragPointerUp = useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
    window.removeEventListener('pointermove', handleDragPointerMove);
    window.removeEventListener('pointerup', handleDragPointerUp);
  }, [handleDragPointerMove]);

  const handleDragPointerDown = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    userMovedRef.current = true;
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: styleRef.current.left,
      startTop: styleRef.current.top,
    };
    setIsDragging(true);
    window.addEventListener('pointermove', handleDragPointerMove);
    window.addEventListener('pointerup', handleDragPointerUp);
  }, [handleDragPointerMove, handleDragPointerUp]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', handleDragPointerMove);
    window.removeEventListener('pointerup', handleDragPointerUp);
  }, [handleDragPointerMove, handleDragPointerUp]);

  if (!mounted || !editor || isImageOperationActive) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        top: style.top,
        left: style.left,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.98)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: isDragging ? 'none' : 'opacity 160ms ease, transform 160ms ease',
        zIndex: 5200,
        width: style.maxWidth,
      }}
    >
      <div
        style={{
           border: '1px solid var(--border-gold)',
           borderRadius: 10,
           background: 'rgba(24, 24, 24, 0.97)',
           color: 'var(--text-primary)',
           boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(12px)',
          overflow: 'hidden',
          maxHeight: style.maxHeight,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drag handle — grab and move the panel anywhere on screen. */}
        <div
          onPointerDown={handleDragPointerDown}
          title="Drag to move"
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '4px 0',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            fontSize: 11,
            letterSpacing: '.08em',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            touchAction: 'none',
          }}
        >
          <span style={{ fontSize: 12, lineHeight: 1 }}>⋮⋮</span>
          <span>Move</span>
        </div>
        <div
          onMouseDown={(event) => {
            // Keep the ProseMirror node selection while toolbar buttons run
            // image commands. Native inputs/selects still receive focus.
            if (!isFocusablePictureField(event.target)) event.preventDefault();
          }}
          style={{
            padding: '8px 10px',
            overflowX: 'hidden',
            overflowY: 'auto',
          }}
        >
          <PictureFormatTab />
        </div>
      </div>
    </div>,
    document.body,
  );
}