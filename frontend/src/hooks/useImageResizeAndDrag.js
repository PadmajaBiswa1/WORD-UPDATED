import { useEffect, useRef } from 'react';
import { getSelectedImageElement, isImageSelection } from '@/utils/imageSelection';
import { useUIStore } from '@/store';

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

const DIR_CURSORS = {
  rot: 'grab',
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  e: 'ew-resize', w: 'ew-resize',
  n: 'ns-resize', s: 'ns-resize',
};

// Handle definitions: 4 corners (circles), 4 edges (pills), 1 rotation handle
const HANDLE_DEFS = [
  { dir: 'rot', type: 'rot' },
  { dir: 'nw',  type: 'corner', left: 0,   top: 0,   dirX: -1, dirY: -1 },
  { dir: 'n',   type: 'edge-h', left: 50,  top: 0,   dirX: 0,  dirY: -1 },
  { dir: 'ne',  type: 'corner', left: 100, top: 0,   dirX: 1,  dirY: -1 },
  { dir: 'w',   type: 'edge-v', left: 0,   top: 50,  dirX: -1, dirY: 0  },
  { dir: 'e',   type: 'edge-v', left: 100, top: 50,  dirX: 1,  dirY: 0  },
  { dir: 'sw',  type: 'corner', left: 0,   top: 100, dirX: -1, dirY: 1  },
  { dir: 's',   type: 'edge-h', left: 50,  top: 100, dirX: 0,  dirY: 1  },
  { dir: 'se',  type: 'corner', left: 100, top: 100, dirX: 1,  dirY: 1  },
];

const HANDLE_HIT = 22; // invisible hit area for easy touch / mouse grabbing
const MIN_SIZE = 28;   // minimum width and height in px

// ── Overlay Viewport (Clips overlays strictly to editor scroll area) ──
let _overlayViewport = null;
let _dimLabel = null;
let _handleContainer = null;
let _selectionBorder = null;

function getOverlayViewport() {
  if (!_overlayViewport) {
    _overlayViewport = document.createElement('div');
    _overlayViewport.setAttribute('data-etherx-overlay-viewport', 'true');
    _overlayViewport.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'overflow:hidden',
      'z-index:1500', // Above editor canvas, strictly below ribbon/dropdowns/modals
      'display:none',
    ].join(';');
    document.body.appendChild(_overlayViewport);
  }
  return _overlayViewport;
}

// ── Floating Dimension Pill Badge ────────────────────────────────
function getDimLabel() {
  if (!_dimLabel) {
    _dimLabel = document.createElement('div');
    _dimLabel.setAttribute('data-etherx-dim-label', 'true');
    _dimLabel.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'background:rgba(20, 24, 33, 0.90)',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'color:#f8fafc',
      'border:1px solid rgba(255,255,255,0.18)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,monospace',
      'font-size:11px',
      'font-weight:600',
      'letter-spacing:0.02em',
      'padding:3px 9px',
      'border-radius:6px',
      'box-shadow:0 4px 14px rgba(0,0,0,0.35)',
      'z-index:9999',
      'display:none',
      'white-space:nowrap',
      'transform:translate(-50%, 0)',
      'transition:opacity 0.15s ease',
      'user-select:none',
    ].join(';');
    getOverlayViewport().appendChild(_dimLabel);
  }
  return _dimLabel;
}

function hideDimensionLabel() {
  if (_dimLabel) _dimLabel.style.display = 'none';
}

// ── Visible Resize & Rotation Handles ────────────────────────────
function getHandleContainer() {
  if (!_handleContainer) {
    _handleContainer = document.createElement('div');
    _handleContainer.setAttribute('data-etherx-handles', 'true');
    _handleContainer.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'z-index:9990',
      'display:none',
    ].join(';');
    getOverlayViewport().appendChild(_handleContainer);

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
        'transform:translate(-50%, -50%)',
        'z-index:9995',
        'transition:transform 0.1s ease',
      ].join(';');

      if (def.dir === 'rot') {
        h.title = 'Drag to rotate (Shift: snap 15°)';
        // Rotation stem
        const stem = document.createElement('div');
        stem.style.cssText = 'position:absolute;top:10px;left:10.5px;width:1.5px;height:14px;background:#10b981;pointer-events:none;';
        h.appendChild(stem);

        // Rotation circular knob
        const dot = document.createElement('div');
        dot.style.cssText = [
          'width:12px',
          'height:12px',
          'border-radius:50%',
          'background:#10b981',
          'border:2px solid #ffffff',
          'box-shadow:0 1px 5px rgba(0,0,0,0.4)',
          'pointer-events:none',
        ].join(';');
        h.appendChild(dot);
      } else if (def.type === 'corner') {
        h.title = 'Drag to resize (Shift: free aspect, Alt: from center)';
        // Modern circular corner handle
        const dot = document.createElement('div');
        dot.style.cssText = [
          'width:10px',
          'height:10px',
          'border-radius:50%',
          'background:#ffffff',
          'border:1.5px solid #1a73e8',
          'box-shadow:0 1px 4px rgba(0,0,0,0.3)',
          'pointer-events:none',
          'transition:background 0.12s ease, transform 0.12s ease',
        ].join(';');
        h.appendChild(dot);
      } else if (def.type === 'edge-h') {
        h.title = 'Drag to resize height (Shift: lock aspect, Alt: from center)';
        // Horizontal edge pill
        const pill = document.createElement('div');
        pill.style.cssText = [
          'width:14px',
          'height:6px',
          'border-radius:3px',
          'background:#ffffff',
          'border:1.5px solid #1a73e8',
          'box-shadow:0 1px 4px rgba(0,0,0,0.3)',
          'pointer-events:none',
          'transition:background 0.12s ease, transform 0.12s ease',
        ].join(';');
        h.appendChild(pill);
      } else if (def.type === 'edge-v') {
        h.title = 'Drag to resize width (Shift: lock aspect, Alt: from center)';
        // Vertical edge pill
        const pill = document.createElement('div');
        pill.style.cssText = [
          'width:6px',
          'height:14px',
          'border-radius:3px',
          'background:#ffffff',
          'border:1.5px solid #1a73e8',
          'box-shadow:0 1px 4px rgba(0,0,0,0.3)',
          'pointer-events:none',
          'transition:background 0.12s ease, transform 0.12s ease',
        ].join(';');
        h.appendChild(pill);
      }

      // Handle hover visual effect
      h.addEventListener('mouseenter', () => {
        h.style.transform = 'translate(-50%, -50%) scale(1.22)';
        const child = h.firstElementChild;
        if (child && def.dir !== 'rot') child.style.background = '#e8f0fe';
      });
      h.addEventListener('mouseleave', () => {
        h.style.transform = 'translate(-50%, -50%)';
        const child = h.firstElementChild;
        if (child && def.dir !== 'rot') child.style.background = '#ffffff';
      });

      _handleContainer.appendChild(h);
    });
  }
  return _handleContainer;
}

function hideHandles() {
  if (_handleContainer) _handleContainer.style.display = 'none';
}

// ── Selection Overlay Border ────────────────────────────────────
function getSelectionBorder() {
  if (!_selectionBorder) {
    _selectionBorder = document.createElement('div');
    _selectionBorder.setAttribute('data-etherx-sel-border', 'true');
    _selectionBorder.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'z-index:9989',
      'border:1.5px solid #1a73e8',
      'box-shadow:0 0 0 1px rgba(26,115,232,0.18)',
      'border-radius:2px',
      'display:none',
      'box-sizing:border-box',
    ].join(';');
    getOverlayViewport().appendChild(_selectionBorder);
  }
  return _selectionBorder;
}

function hideSelectionBorder() {
  if (_selectionBorder) _selectionBorder.style.display = 'none';
}

// ── Master Bounds Synchronizer (Clips and positions all overlays) ──
function syncOverlayBounds(img, dimensionInfo = null) {
  const viewport = getOverlayViewport();
  if (!img) {
    viewport.style.display = 'none';
    hideHandles();
    hideSelectionBorder();
    hideDimensionLabel();
    return;
  }

  const scrollEl = document.getElementById('editor-scroll-area');
  if (!scrollEl) {
    viewport.style.display = 'none';
    return;
  }

  const scrollRect = scrollEl.getBoundingClientRect();
  const imgRect = img.getBoundingClientRect();

  // If the image is completely scrolled out of the editor viewport, hide everything
  if (
    imgRect.bottom <= scrollRect.top ||
    imgRect.top >= scrollRect.bottom ||
    imgRect.right <= scrollRect.left ||
    imgRect.left >= scrollRect.right
  ) {
    viewport.style.display = 'none';
    hideHandles();
    hideSelectionBorder();
    hideDimensionLabel();
    return;
  }

  // Clip the viewport strictly to the editor scroll area (never overlaps the ribbon/headers)
  viewport.style.display = 'block';
  viewport.style.left   = `${scrollRect.left}px`;
  viewport.style.top    = `${scrollRect.top}px`;
  viewport.style.width  = `${scrollRect.width}px`;
  viewport.style.height = `${scrollRect.height}px`;

  // Coordinates relative to the clipped overlay viewport
  const relLeft = imgRect.left - scrollRect.left;
  const relTop  = imgRect.top - scrollRect.top;
  const w = imgRect.width;
  const h = imgRect.height;

  // 1. Position selection border
  const border = getSelectionBorder();
  border.style.display = 'block';
  border.style.left   = `${relLeft}px`;
  border.style.top    = `${relTop}px`;
  border.style.width  = `${w}px`;
  border.style.height = `${h}px`;

  // 2. Position handles container
  const container = getHandleContainer();
  container.style.display = 'block';
  container.style.left   = `${relLeft}px`;
  container.style.top    = `${relTop}px`;
  container.style.width  = `${w}px`;
  container.style.height = `${h}px`;

  HANDLE_DEFS.forEach((def) => {
    const el = container.querySelector(`[data-etherx-handle="${def.dir}"]`);
    if (!el) return;
    if (def.dir === 'rot') {
      el.style.left = '50%';
      el.style.top  = '-22px';
      // If the rotation knob would stick out above the scroll viewport boundary, hide it cleanly
      if (relTop - 26 < 0) {
        el.style.display = 'none';
      } else {
        el.style.display = 'flex';
      }
      return;
    }
    el.style.left = `${def.left}%`;
    el.style.top  = `${def.top}%`;
  });

  // 3. Position dimension label (if requested during drag)
  if (dimensionInfo) {
    const lbl = getDimLabel();
    if (dimensionInfo.rotation !== null && typeof dimensionInfo.rotation === 'number') {
      lbl.innerHTML = `↻ ${dimensionInfo.rotation}°`;
    } else {
      const lockIcon = dimensionInfo.isProportional
        ? '<span style="opacity:0.75;margin-left:4px;font-size:10px;">🔒</span>'
        : '<span style="opacity:0.75;margin-left:4px;font-size:10px;">🔓</span>';
      lbl.innerHTML = `${dimensionInfo.w} × ${dimensionInfo.h} px${lockIcon}`;
    }

    const cx = relLeft + w / 2;
    // Position above if space allows inside the viewport, otherwise flip below
    if (relTop > 36) {
      lbl.style.top = `${relTop - 30}px`;
    } else if (relTop + h + 36 < scrollRect.height) {
      lbl.style.top = `${relTop + h + 8}px`;
    } else {
      lbl.style.top = `${Math.max(8, relTop + 8)}px`;
    }
    lbl.style.left = `${cx}px`;
    lbl.style.display = 'block';
  } else {
    hideDimensionLabel();
  }
}

const createIdleDragState = () => ({
  isDragging: false,
  isResizing: false,
  isRotating: false,
  currentRotation: 0,
  initialRotation: 0,
  resizeDir: null,
  img: null,
  startX: 0,
  startY: 0,
  lastClientX: 0,
  lastClientY: 0,
  shiftKey: false,
  altKey: false,
  scale: 1,
  initialWidth: 0,
  initialHeight: 0,
  aspectRatio: 1,
  initialMarginLeft: 0,
  initialMarginTop: 0,
  currentWidth: 0,
  currentHeight: 0,
  currentMarginLeft: 0,
  currentMarginTop: 0,
});

export function useImageResizeAndDrag(editor, editorRef) {
  const dragStateRef = useRef(createIdleDragState());
  const rafPendingRef = useRef(false);

  useEffect(() => {
    if (!editor || !editorRef?.current) return undefined;

    const editorElement = editorRef.current;
    const proseMirrorEl = editorElement.querySelector('.ProseMirror');
    if (!proseMirrorEl) return undefined;

    // Helper: Select image node in Tiptap
    const selectImageNode = (img) => {
      if (!editor || !img) return;
      try {
        const pos = editor.view.posAtDOM(img, 0);
        if (typeof pos === 'number' && pos >= 0) {
          editor.commands.setNodeSelection(pos);
        }
      } catch {
        // fallback
      }
    };

    // Helper: Persist geometry changes to Tiptap
    const persistImageGeometry = (state) => {
      const img = state.img;
      if (!img || editor.isDestroyed) return;

      const computed = window.getComputedStyle(img);
      const width = Math.max(MIN_SIZE, Math.round(Number.parseFloat(img.style.width) || Number.parseFloat(computed.width) || img.offsetWidth));
      const height = Math.max(MIN_SIZE, Math.round(Number.parseFloat(img.style.height) || Number.parseFloat(computed.height) || img.offsetHeight));

      const attrs = editor.getAttributes('image') || {};
      const css = parseCssStyle(attrs.style || '');

      css.width = `${width}px`;
      css.height = `${height}px`;
      if (img.style.marginLeft) css['margin-left'] = img.style.marginLeft;
      if (img.style.marginTop) css['margin-top'] = img.style.marginTop;

      const updateData = {
        width: String(width),
        height: String(height),
      };

      if (state.isRotating && typeof state.currentRotation === 'number') {
        const rot = state.currentRotation;
        css.transform = rot ? `rotate(${rot}deg)` : null;
        updateData.rotate = String(rot);
      }

      updateData.style = toCssStyle(css);

      // Re-ensure selection is targeting this image
      selectImageNode(img);

      // Update Tiptap in one single atomic transaction
      editor.chain().focus().updateAttributes('image', updateData).run();

      // Trigger recalculation of page breaks & layouts
      window.dispatchEvent(new CustomEvent('image-reposition-handles'));
    };

    // Sync handles and selection border to current selection
    const syncHandlesToSelection = () => {
      // If any dialog/modal is open, hide the overlay completely
      const uiState = useUIStore.getState();
      const anyDialogOpen = Object.values(uiState.dialogs || {}).some(Boolean);
      if (anyDialogOpen) {
        syncOverlayBounds(null);
        return;
      }
      if (!isImageSelection(editor)) {
        syncOverlayBounds(null);
        return;
      }
      const img = getSelectedImageElement(editor);
      syncOverlayBounds(img);
    };

    // Batch render updates using requestAnimationFrame
    const updateDragFrame = () => {
      rafPendingRef.current = false;
      const state = dragStateRef.current;
      const { isDragging, isResizing, isRotating, resizeDir, img } = state;
      if ((!isDragging && !isResizing && !isRotating) || !img) return;

      if (isRotating) {
        const rect = img.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let deg = Math.round(Math.atan2(state.lastClientY - centerY, state.lastClientX - centerX) * (180 / Math.PI) + 90);
        deg = ((deg % 360) + 360) % 360;
        if (state.shiftKey || Math.abs(deg % 45) < 4) {
          deg = Math.round(deg / 15) * 15;
        }
        img.style.transform = `rotate(${deg}deg)`;
        img.setAttribute('data-rotation', String(deg));
        state.currentRotation = deg;

        syncOverlayBounds(img, { w: Math.round(state.initialWidth), h: Math.round(state.initialHeight), isProportional: true, rotation: deg });
        return;
      }

      // Convert screen delta to document CSS pixels using current zoom scale
      const deltaX = (state.lastClientX - state.startX) / state.scale;
      const deltaY = (state.lastClientY - state.startY) / state.scale;

      if (isResizing && resizeDir) {
        const def = HANDLE_DEFS.find((d) => d.dir === resizeDir);
        const dirX = def?.dirX ?? 0;
        const dirY = def?.dirY ?? 0;
        const isCorner = def?.type === 'corner';
        const isAlt = state.altKey;       // Alt = symmetric resize from center
        const isFreeAspect = state.shiftKey; // Shift = free aspect ratio
        const aspect = state.aspectRatio || (state.initialWidth / state.initialHeight);

        let newWidth = state.initialWidth;
        let newHeight = state.initialHeight;

        if (isCorner) {
          const moveX = deltaX * dirX;
          const moveY = deltaY * dirY;

          if (isFreeAspect) {
            newWidth  = Math.max(MIN_SIZE, state.initialWidth + (isAlt ? moveX * 2 : moveX));
            newHeight = Math.max(MIN_SIZE, state.initialHeight + (isAlt ? moveY * 2 : moveY));
          } else {
            // Proportional corner resize tracking both X and Y movement along diagonal
            const projectedDeltaW = (moveX + moveY * aspect) / 2;
            newWidth  = Math.max(MIN_SIZE, state.initialWidth + (isAlt ? projectedDeltaW * 2 : projectedDeltaW));
            newHeight = Math.max(MIN_SIZE, Math.round(newWidth / aspect));
          }
        } else if (def?.type === 'edge-v') {
          // East / West edge
          const moveX = deltaX * dirX;
          newWidth = Math.max(MIN_SIZE, state.initialWidth + (isAlt ? moveX * 2 : moveX));
          newHeight = state.initialHeight;
        } else if (def?.type === 'edge-h') {
          // North / South edge
          const moveY = deltaY * dirY;
          newHeight = Math.max(MIN_SIZE, state.initialHeight + (isAlt ? moveY * 2 : moveY));
          newWidth = state.initialWidth;
        }

        // Margin handling if image has margins or is floating
        let newMarginLeft = state.initialMarginLeft;
        let newMarginTop = state.initialMarginTop;

        if (img.style.position === 'absolute' || state.initialMarginLeft !== 0) {
          if (dirX === -1 && !isAlt) {
            newMarginLeft = state.initialMarginLeft + (state.initialWidth - newWidth);
          }
        }
        if (img.style.position === 'absolute' || state.initialMarginTop !== 0) {
          if (dirY === -1 && !isAlt) {
            newMarginTop = state.initialMarginTop + (state.initialHeight - newHeight);
          }
        }

        const roundedW = Math.round(newWidth);
        const roundedH = Math.round(newHeight);

        state.currentWidth = roundedW;
        state.currentHeight = roundedH;
        state.currentMarginLeft = newMarginLeft;
        state.currentMarginTop = newMarginTop;

        img.style.width = `${roundedW}px`;
        img.style.height = `${roundedH}px`;
        if (newMarginLeft !== state.initialMarginLeft) img.style.marginLeft = `${newMarginLeft}px`;
        if (newMarginTop !== state.initialMarginTop)   img.style.marginTop  = `${newMarginTop}px`;

        syncOverlayBounds(img, { w: roundedW, h: roundedH, isProportional: !isFreeAspect, rotation: null });

        window.dispatchEvent(new CustomEvent('image-resize-live', { detail: { width: roundedW, height: roundedH } }));
      } else if (isDragging) {
        // Dragging image body
        const newMarginLeft = state.initialMarginLeft + deltaX;
        const newMarginTop = state.initialMarginTop + deltaY;
        img.style.marginLeft = `${newMarginLeft}px`;
        img.style.marginTop = `${newMarginTop}px`;

        syncOverlayBounds(img);
      }
    };

    // Pointer down handler for handles & images
    const handlePointerDown = (event) => {
      // 1. Handle element clicked
      const handleEl = event.target.closest?.('[data-etherx-handle]');
      if (handleEl) {
        const dir = handleEl.getAttribute('data-etherx-handle');
        const img = getSelectedImageElement(editor);
        if (!img) return;

        event.preventDefault();
        event.stopPropagation();

        const rect = img.getBoundingClientRect();
        const computed = window.getComputedStyle(img);

        // Effective zoom scale factor between screen and CSS pixels
        const zoomVal = useUIStore.getState().zoom || 100;
        const zoomScale = zoomVal / 100;
        const parsedW = Number.parseFloat(img.style.width) || Number.parseFloat(computed.width) || img.offsetWidth;
        const scale = parsedW > 0 ? (rect.width / parsedW) : zoomScale;

        const initW = Math.round(parsedW || rect.width / scale);
        const parsedH = Number.parseFloat(img.style.height) || Number.parseFloat(computed.height) || img.offsetHeight;
        const initH = Math.round(parsedH || rect.height / scale);
        const initAspect = initH > 0 ? initW / initH : 1;

        // Apply active resize class to body to disable transitions and lock user select
        document.body.classList.add('etherx-is-resizing');
        img.classList.add('etherx-is-resizing');
        document.body.style.cursor = DIR_CURSORS[dir] || 'default';

        if (dir === 'rot') {
          const rawRot = img.getAttribute('data-rotation') || '0';
          const initRot = parseInt(rawRot, 10) || 0;
          dragStateRef.current = {
            ...createIdleDragState(),
            isRotating: true,
            resizeDir: 'rot',
            img,
            startX: event.clientX,
            startY: event.clientY,
            lastClientX: event.clientX,
            lastClientY: event.clientY,
            scale,
            initialRotation: initRot,
            currentRotation: initRot,
            initialWidth: initW,
            initialHeight: initH,
            aspectRatio: initAspect,
          };
          syncOverlayBounds(img, { w: initW, h: initH, isProportional: true, rotation: initRot });
        } else {
          dragStateRef.current = {
            ...createIdleDragState(),
            isResizing: true,
            resizeDir: dir,
            img,
            startX: event.clientX,
            startY: event.clientY,
            lastClientX: event.clientX,
            lastClientY: event.clientY,
            scale,
            initialWidth: initW,
            initialHeight: initH,
            aspectRatio: initAspect,
            currentWidth: initW,
            currentHeight: initH,
            initialMarginLeft: Number.parseFloat(computed.marginLeft) || 0,
            initialMarginTop: Number.parseFloat(computed.marginTop) || 0,
          };
          syncOverlayBounds(img, { w: initW, h: initH, isProportional: !event.shiftKey, rotation: null });
        }

        window.dispatchEvent(new CustomEvent('image-drag-start'));
        return;
      }

      // 2. Direct click on an image in the editor
      const img = event.target.closest?.('img');
      if (!img || !proseMirrorEl.contains(img)) return;

      // Ensure the image is immediately selected in Tiptap
      selectImageNode(img);

      const rect = img.getBoundingClientRect();
      const computed = window.getComputedStyle(img);
      const zoomVal = useUIStore.getState().zoom || 100;
      const zoomScale = zoomVal / 100;
      const parsedW = Number.parseFloat(img.style.width) || Number.parseFloat(computed.width) || img.offsetWidth;
      const scale = parsedW > 0 ? (rect.width / parsedW) : zoomScale;

      const initW = Math.round(parsedW || rect.width / scale);
      const parsedH = Number.parseFloat(img.style.height) || Number.parseFloat(computed.height) || img.offsetHeight;
      const initH = Math.round(parsedH || rect.height / scale);

      dragStateRef.current = {
        ...createIdleDragState(),
        isDragging: true,
        img,
        startX: event.clientX,
        startY: event.clientY,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        scale,
        initialWidth: initW,
        initialHeight: initH,
        aspectRatio: initH > 0 ? initW / initH : 1,
        initialMarginLeft: Number.parseFloat(computed.marginLeft) || 0,
        initialMarginTop: Number.parseFloat(computed.marginTop) || 0,
      };

      document.body.classList.add('etherx-is-resizing');
      img.classList.add('etherx-is-resizing');
      document.body.style.cursor = 'grabbing';

      window.dispatchEvent(new CustomEvent('image-drag-start'));
    };

    // Pointer / mouse move
    const handlePointerMove = (event) => {
      const state = dragStateRef.current;
      if (!state.isResizing && !state.isRotating && !state.isDragging) return;

      state.lastClientX = event.clientX;
      state.lastClientY = event.clientY;
      state.shiftKey = event.shiftKey;
      state.altKey = event.altKey;

      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(updateDragFrame);
      }
    };

    // Pointer / mouse up
    const handlePointerUp = () => {
      const state = dragStateRef.current;
      if (state.img) {
        document.body.classList.remove('etherx-is-resizing');
        state.img.classList.remove('etherx-is-resizing');
        document.body.style.cursor = '';
        state.img.style.cursor = 'move';

        hideDimensionLabel();
        persistImageGeometry(state);

        requestAnimationFrame(() => {
          const img = getSelectedImageElement(editor);
          syncOverlayBounds(img);
        });
      }

      dragStateRef.current = createIdleDragState();
      window.dispatchEvent(new CustomEvent('image-drag-end'));
    };

    // Keyboard handlers (Escape to cancel, Delete/Backspace to remove)
    const handleKeyDown = (event) => {
      const state = dragStateRef.current;
      if (event.key === 'Escape' && (state.isResizing || state.isRotating || state.isDragging)) {
        event.preventDefault();
        // Cancel active resize and restore original size
        if (state.img) {
          state.img.style.width = `${state.initialWidth}px`;
          state.img.style.height = `${state.initialHeight}px`;
          state.img.style.marginLeft = `${state.initialMarginLeft}px`;
          state.img.style.marginTop = `${state.initialMarginTop}px`;
          if (state.isRotating) {
            state.img.style.transform = state.initialRotation ? `rotate(${state.initialRotation}deg)` : '';
          }
          document.body.classList.remove('etherx-is-resizing');
          state.img.classList.remove('etherx-is-resizing');
          document.body.style.cursor = '';
          hideDimensionLabel();
          syncOverlayBounds(state.img);
        }
        dragStateRef.current = createIdleDragState();
        window.dispatchEvent(new CustomEvent('image-drag-end'));
        return;
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && isImageSelection(editor)) {
        event.preventDefault();
        syncOverlayBounds(null);
        editor.chain().focus().deleteSelection().run();
      }
    };

    // Prevent browser native image drag
    const handleNativeDragStart = (event) => {
      if (event.target.tagName === 'IMG') {
        event.preventDefault();
      }
    };

    // Double click to open edit panel
    const handleDblClick = (event) => {
      const img = event.target.closest?.('img');
      if (!img || !proseMirrorEl.contains(img)) return;
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('open-image-edit-panel', { detail: { img } }));
    };

    // Context menu
    const handleContextMenu = (event) => {
      const img = event.target.closest?.('img');
      if (!img || !proseMirrorEl.contains(img)) return;
      event.preventDefault();
      selectImageNode(img);
      window.dispatchEvent(new CustomEvent('open-image-context-menu', {
        detail: { img, x: event.clientX, y: event.clientY },
      }));
    };

    // Deselect image when clicking outside
    const handleDocumentClick = (event) => {
      if (event.target.closest?.('[data-etherx-handle]') || event.target.closest?.('[data-etherx-handles]')) return;
      if (event.target.closest?.('img') && proseMirrorEl.contains(event.target.closest('img'))) return;
      if (event.target.closest?.('[data-etherx-dim-label]')) return;

      setTimeout(() => {
        if (!isImageSelection(editor)) {
          syncOverlayBounds(null);
        }
      }, 50);
    };

    // Selection sync
    editor.on('selectionUpdate', syncHandlesToSelection);

    // Scroll & resize positioning: capture scroll from ANY container
    const scrollEl = document.getElementById('editor-scroll-area');
    const onScrollOrResize = () => {
      if (!isImageSelection(editor)) return;
      const img = getSelectedImageElement(editor);
      syncOverlayBounds(img);
    };

    if (scrollEl) scrollEl.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('image-reposition-handles', onScrollOrResize);

    // Hide selection overlay immediately when any modal/dialog opens
    const hideOverlayNow = () => syncOverlayBounds(null);
    window.addEventListener('open-image-crop-modal', hideOverlayNow);
    window.addEventListener('open-drawing-for-edit', hideOverlayNow);

    const unsubUI = useUIStore.subscribe((state) => {
      const anyOpen = Object.values(state.dialogs || {}).some(Boolean);
      if (anyOpen) {
        syncOverlayBounds(null);
      }
    });

    // Event listeners
    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleDocumentClick);
    proseMirrorEl.addEventListener('dragstart', handleNativeDragStart);
    proseMirrorEl.addEventListener('dblclick', handleDblClick);
    proseMirrorEl.addEventListener('contextmenu', handleContextMenu);

    return () => {
      editor.off('selectionUpdate', syncHandlesToSelection);
      if (scrollEl) scrollEl.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, { capture: true });
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('image-reposition-handles', onScrollOrResize);
      window.removeEventListener('open-image-crop-modal', hideOverlayNow);
      window.removeEventListener('open-drawing-for-edit', hideOverlayNow);
      if (typeof unsubUI === 'function') unsubUI();

      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleDocumentClick);
      proseMirrorEl.removeEventListener('dragstart', handleNativeDragStart);
      proseMirrorEl.removeEventListener('dblclick', handleDblClick);
      proseMirrorEl.removeEventListener('contextmenu', handleContextMenu);

      document.body.classList.remove('etherx-is-resizing');
      document.body.style.cursor = '';
      syncOverlayBounds(null);
      dragStateRef.current = createIdleDragState();

      if (_overlayViewport && _overlayViewport.parentNode) {
        _overlayViewport.parentNode.removeChild(_overlayViewport);
      }
      _overlayViewport = null;
      _handleContainer = null;
      _selectionBorder = null;
      _dimLabel = null;
    };
  }, [editor, editorRef]);
}
