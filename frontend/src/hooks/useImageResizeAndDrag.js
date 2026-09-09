import { useEffect, useRef } from 'react';
import { getSelectedImageElement, isImageSelection } from '@/utils/imageSelection';

const parseCssStyle = (style = '') => {
  const out = {};
  String(style).split(';').forEach((pair) => {
    const separator = pair.indexOf(':');
    if (separator < 0) return;
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (key && value) out[key] = value;
  });
  return out;
};

const toCssStyle = (styles) => Object.entries(styles)
  .filter(([, value]) => value !== undefined && value !== null && value !== '')
  .map(([key, value]) => `${key}:${value}`)
  .join(';');

// Larger hit-area (18px) for better grabbability
const getResizeDirection = (clientX, clientY, rect) => {
  const handleSize = 18;
  const nearLeft = Math.abs(clientX - rect.left) < handleSize;
  const nearRight = Math.abs(clientX - rect.right) < handleSize;
  const nearTop = Math.abs(clientY - rect.top) < handleSize;
  const nearBottom = Math.abs(clientY - rect.bottom) < handleSize;

  if (nearLeft && nearTop) return 'nw';
  if (nearRight && nearTop) return 'ne';
  if (nearLeft && nearBottom) return 'sw';
  if (nearRight && nearBottom) return 'se';
  if (nearLeft) return 'w';
  if (nearRight) return 'e';
  if (nearTop) return 'n';
  if (nearBottom) return 's';

  return null;
};

const DIR_CURSORS = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  e: 'ew-resize', w: 'ew-resize',
  n: 'ns-resize', s: 'ns-resize',
};

// Handle positions: [top%, left%, cursor]
const HANDLE_DEFS = [
  { dir: 'nw', top: -1, left: -1 },
  { dir: 'n',  top: -1, left: 50 },
  { dir: 'ne', top: -1, left: 101 },
  { dir: 'w',  top: 50, left: -1 },
  { dir: 'e',  top: 50, left: 101 },
  { dir: 'sw', top: 101, left: -1 },
  { dir: 's',  top: 101, left: 50 },
  { dir: 'se', top: 101, left: 101 },
];

const HANDLE_VISUAL = 9;   // visible square size in px
const HANDLE_HIT   = 20;  // total hit area (visual + transparent padding) in px

// ── Dimension label ─────────────────────────────────────────────
let _dimLabel = null;

function getDimLabel() {
  if (!_dimLabel) {
    _dimLabel = document.createElement('div');
    _dimLabel.setAttribute('data-etherx-dim-label', 'true');
    _dimLabel.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'background:rgba(0,0,0,0.72)',
      'color:#fff',
      'font-family:var(--font-ui,monospace)',
      'font-size:11px',
      'padding:2px 7px',
      'border-radius:4px',
      'z-index:9999',
      'display:none',
      'white-space:nowrap',
      'transform:translate(-50%,-130%)',
    ].join(';');
    document.body.appendChild(_dimLabel);
  }
  return _dimLabel;
}

function updateDimensionLabel(img, w, h) {
  const lbl = getDimLabel();
  const rect = img.getBoundingClientRect();
  lbl.textContent = `${w} × ${h}`;
  lbl.style.left = `${rect.left + rect.width / 2}px`;
  lbl.style.top  = `${rect.top}px`;
  lbl.style.display = 'block';
}

function hideDimensionLabel() {
  if (_dimLabel) _dimLabel.style.display = 'none';
}

// ── Visible resize handles ──────────────────────────────────────
let _handleContainer = null;

function getHandleContainer() {
  if (!_handleContainer) {
    _handleContainer = document.createElement('div');
    _handleContainer.setAttribute('data-etherx-handles', 'true');
    _handleContainer.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:9990',
      'display:none',
    ].join(';');
    document.body.appendChild(_handleContainer);

    HANDLE_DEFS.forEach((def) => {
      const h = document.createElement('div');
      h.setAttribute('data-etherx-handle', def.dir);
      h.style.cssText = [
        'position:absolute',
        `width:${HANDLE_HIT}px`,
        `height:${HANDLE_HIT}px`,
        `cursor:${DIR_CURSORS[def.dir]}`,
        'pointer-events:auto',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'transform:translate(-50%,-50%)',
        'z-index:9995',
      ].join(';');

      const dot = document.createElement('div');
      dot.style.cssText = [
        `width:${HANDLE_VISUAL}px`,
        `height:${HANDLE_VISUAL}px`,
        'border-radius:2px',
        'background:#fff',
        'border:1.5px solid #1a73e8',
        'box-shadow:0 1px 4px rgba(0,0,0,0.35)',
        'pointer-events:none',
      ].join(';');
      h.appendChild(dot);
      _handleContainer.appendChild(h);
    });
  }
  return _handleContainer;
}

function repositionHandles(img) {
  const container = getHandleContainer();
  if (!img) { container.style.display = 'none'; return; }
  const rect = img.getBoundingClientRect();
  container.style.display = 'block';
  container.style.left  = `${rect.left}px`;
  container.style.top   = `${rect.top}px`;
  container.style.width = `${rect.width}px`;
  container.style.height= `${rect.height}px`;

  HANDLE_DEFS.forEach((def) => {
    const h = container.querySelector(`[data-etherx-handle="${def.dir}"]`);
    if (!h) return;
    const leftPct = def.left === -1 ? 0 : def.left === 101 ? 100 : 50;
    const topPct  = def.top  === -1 ? 0 : def.top  === 101 ? 100 : 50;
    h.style.left = `${leftPct}%`;
    h.style.top  = `${topPct}%`;
  });
}

function hideHandles() {
  if (_handleContainer) _handleContainer.style.display = 'none';
}

// ── Selection overlay border ────────────────────────────────────
let _selectionBorder = null;

function getSelectionBorder() {
  if (!_selectionBorder) {
    _selectionBorder = document.createElement('div');
    _selectionBorder.setAttribute('data-etherx-sel-border', 'true');
    _selectionBorder.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:9989',
      'border:2px solid #1a73e8',
      'border-radius:2px',
      'display:none',
      'box-sizing:border-box',
    ].join(';');
    document.body.appendChild(_selectionBorder);
  }
  return _selectionBorder;
}

function showSelectionBorder(img) {
  const el = getSelectionBorder();
  if (!img) { el.style.display = 'none'; return; }
  const rect = img.getBoundingClientRect();
  el.style.display = 'block';
  el.style.left   = `${rect.left}px`;
  el.style.top    = `${rect.top}px`;
  el.style.width  = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
}

function hideSelectionBorder() {
  if (_selectionBorder) _selectionBorder.style.display = 'none';
}

const createIdleDragState = () => ({
  isDragging: false,
  isResizing: false,
  resizeDir: null,
  img: null,
  startX: 0,
  startY: 0,
  initialWidth: 0,
  initialHeight: 0,
  initialMarginLeft: 0,
  initialMarginTop: 0,
});

export function useImageResizeAndDrag(editor, editorRef) {
  const dragStateRef = useRef(createIdleDragState());

  useEffect(() => {
    if (!editor || !editorRef?.current) return undefined;

    const editorElement = editorRef.current;
    const proseMirrorEl = editorElement.querySelector('.ProseMirror');
    if (!proseMirrorEl) return undefined;

    const persistImageGeometry = (state) => {
      const img = state.img;
      if (!img || editor.isDestroyed) return;

      const attrs = editor.getAttributes('image') || {};
      const css = parseCssStyle(attrs.style || '');
      const computed = window.getComputedStyle(img);
      const width = Math.max(20, Math.round(Number.parseFloat(computed.width) || img.getBoundingClientRect().width));
      const height = Math.max(20, Math.round(Number.parseFloat(computed.height) || img.getBoundingClientRect().height));

      css.width = `${width}px`;
      css.height = `${height}px`;
      if (state.isDragging || state.isResizing) {
        if (img.style.marginLeft) css['margin-left'] = img.style.marginLeft;
        if (img.style.marginTop) css['margin-top'] = img.style.marginTop;
      }

      editor.chain().focus().updateAttributes('image', {
        width: String(width),
        height: String(height),
        style: toCssStyle(css),
      }).run();
    };

    // Show/hide handles based on selection
    const syncHandlesToSelection = () => {
      if (!isImageSelection(editor)) {
        hideHandles();
        hideSelectionBorder();
        return;
      }
      const img = getSelectedImageElement(editor);
      repositionHandles(img);
      showSelectionBorder(img);
    };

    const handleMouseDown = (event) => {
      // Allow clicks on handle elements (they are fixed-positioned children)
      const handleEl = event.target.closest?.('[data-etherx-handle]');
      if (handleEl) {
        const dir = handleEl.getAttribute('data-etherx-handle');
        const img = getSelectedImageElement(editor);
        if (!img) return;
        const rect = img.getBoundingClientRect();
        const computed = window.getComputedStyle(img);
        dragStateRef.current = {
          ...createIdleDragState(),
          isDragging: false,
          isResizing: true,
          resizeDir: dir,
          img,
          startX: event.clientX,
          startY: event.clientY,
          initialWidth: rect.width,
          initialHeight: rect.height,
          initialMarginLeft: Number.parseFloat(computed.marginLeft) || 0,
          initialMarginTop: Number.parseFloat(computed.marginTop) || 0,
        };
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent('image-drag-start'));
        return;
      }

      const img = event.target.closest?.('img');
      if (!img || !proseMirrorEl.contains(img)) return;

      const selected = img.classList.contains('ProseMirror-selectednode')
        || img.parentElement?.classList.contains('ProseMirror-selectednode')
        || (isImageSelection(editor) && getSelectedImageElement(editor) === img);
      if (!selected) return;

      const rect = img.getBoundingClientRect();
      const computed = window.getComputedStyle(img);

      const dir = getResizeDirection(event.clientX, event.clientY, rect);
      const isResizeHandle = dir !== null;

      dragStateRef.current = {
        ...createIdleDragState(),
        isDragging: !isResizeHandle,
        isResizing: isResizeHandle,
        resizeDir: dir,
        img,
        startX: event.clientX,
        startY: event.clientY,
        initialWidth: rect.width,
        initialHeight: rect.height,
        initialMarginLeft: Number.parseFloat(computed.marginLeft) || 0,
        initialMarginTop: Number.parseFloat(computed.marginTop) || 0,
      };

      event.preventDefault();

      if (isResizeHandle) {
        img.style.cursor = DIR_CURSORS[dir] || 'nwse-resize';
      } else {
        img.style.cursor = 'grabbing';
      }

      window.dispatchEvent(new CustomEvent('image-drag-start'));
    };

    const handleMouseMove = (event) => {
      const state = dragStateRef.current;
      const { isDragging, isResizing, resizeDir, img } = state;
      if ((!isDragging && !isResizing) || !img) return;

      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;

      if (isResizing && resizeDir) {
        let newWidth = state.initialWidth;
        let newHeight = state.initialHeight;
        let newMarginLeft = state.initialMarginLeft;
        let newMarginTop = state.initialMarginTop;

        const aspectRatio = state.initialHeight / Math.max(state.initialWidth, 1);

        const isCorner = ['se', 'sw', 'ne', 'nw'].includes(resizeDir);
        const freeAspect = event.shiftKey; // Shift allows free (non-proportional) corner drag; default is proportional

        if (resizeDir === 'e') {
          newWidth = Math.max(20, state.initialWidth + deltaX);
        } else if (resizeDir === 'w') {
          newWidth = Math.max(20, state.initialWidth - deltaX);
          newMarginLeft = state.initialMarginLeft + deltaX;
        } else if (resizeDir === 's') {
          newHeight = Math.max(20, state.initialHeight + deltaY);
        } else if (resizeDir === 'n') {
          newHeight = Math.max(20, state.initialHeight - deltaY);
          newMarginTop = state.initialMarginTop + deltaY;
        } else if (resizeDir === 'se') {
          newWidth = Math.max(20, state.initialWidth + deltaX);
          newHeight = freeAspect ? Math.max(20, state.initialHeight + deltaY) : newWidth * aspectRatio;
        } else if (resizeDir === 'sw') {
          newWidth = Math.max(20, state.initialWidth - deltaX);
          newHeight = freeAspect ? Math.max(20, state.initialHeight + deltaY) : newWidth * aspectRatio;
          newMarginLeft = state.initialMarginLeft + deltaX;
        } else if (resizeDir === 'ne') {
          newWidth = Math.max(20, state.initialWidth + deltaX);
          newHeight = freeAspect ? Math.max(20, state.initialHeight - deltaY) : newWidth * aspectRatio;
          newMarginTop = state.initialMarginTop + (state.initialHeight - newHeight);
        } else if (resizeDir === 'nw') {
          newWidth = Math.max(20, state.initialWidth - deltaX);
          newHeight = freeAspect ? Math.max(20, state.initialHeight - deltaY) : newWidth * aspectRatio;
          newMarginLeft = state.initialMarginLeft + deltaX;
          newMarginTop = state.initialMarginTop + (state.initialHeight - newHeight);
        }

        img.style.width = `${newWidth}px`;
        img.style.height = `${newHeight}px`;
        img.style.marginLeft = `${newMarginLeft}px`;
        img.style.marginTop = `${newMarginTop}px`;

        const roundedW = Math.round(newWidth);
        const roundedH = Math.round(newHeight);
        updateDimensionLabel(img, roundedW, roundedH);
        window.dispatchEvent(new CustomEvent('image-resize-live', { detail: { width: roundedW, height: roundedH } }));
      } else {
        img.style.marginLeft = `${state.initialMarginLeft + deltaX}px`;
        img.style.marginTop = `${state.initialMarginTop + deltaY}px`;
      }

      repositionHandles(img);
      showSelectionBorder(img);
    };

    const handleHoverMove = (event) => {
      const state = dragStateRef.current;
      if (state.isDragging || state.isResizing) return;

      const img = event.target.closest?.('img');
      if (!img || !proseMirrorEl.contains(img)) return;

      const selected = img.classList.contains('ProseMirror-selectednode')
        || img.parentElement?.classList.contains('ProseMirror-selectednode')
        || (isImageSelection(editor) && getSelectedImageElement(editor) === img);
      if (!selected) return;

      const rect = img.getBoundingClientRect();
      const dir = getResizeDirection(event.clientX, event.clientY, rect);

      img.style.cursor = dir ? (DIR_CURSORS[dir] || 'pointer') : 'move';
    };

    const handleMouseUp = () => {
      const state = dragStateRef.current;
      if (state.img) {
        persistImageGeometry(state);
        state.img.style.cursor = 'move';
        hideDimensionLabel();
        // Re-sync handles after persistence (size may have changed)
        requestAnimationFrame(() => {
          const img = getSelectedImageElement(editor);
          repositionHandles(img);
          showSelectionBorder(img);
        });
      }
      dragStateRef.current = createIdleDragState();
      window.dispatchEvent(new CustomEvent('image-drag-end'));
    };

    const handleKeyDown = (event) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      if (!isImageSelection(editor)) return;

      event.preventDefault();
      hideHandles();
      hideSelectionBorder();
      editor.chain().focus().deleteSelection().run();
    };

    // Sync handles whenever selection changes
    editor.on('selectionUpdate', syncHandlesToSelection);

    // Reposition handles on scroll/resize
    const scrollEl = document.getElementById('editor-scroll-area');
    const onScrollOrResize = () => {
      if (!isImageSelection(editor)) return;
      const img = getSelectedImageElement(editor);
      repositionHandles(img);
      showSelectionBorder(img);
    };
    if (scrollEl) scrollEl.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('image-reposition-handles', onScrollOrResize);

    editorElement.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousedown', handleMouseDown);  // catch handle clicks (fixed-pos)
    proseMirrorEl.addEventListener('mousemove', handleHoverMove);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    proseMirrorEl.addEventListener('keydown', handleKeyDown);

    return () => {
      editor.off('selectionUpdate', syncHandlesToSelection);
      editorElement.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousedown', handleMouseDown);
      proseMirrorEl.removeEventListener('mousemove', handleHoverMove);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      proseMirrorEl.removeEventListener('keydown', handleKeyDown);
      if (scrollEl) scrollEl.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('image-reposition-handles', onScrollOrResize);
      hideHandles();
      hideSelectionBorder();
      hideDimensionLabel();
      dragStateRef.current = createIdleDragState();
    };
  }, [editor, editorRef]);
}
