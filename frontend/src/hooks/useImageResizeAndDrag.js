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

const getResizeDirection = (clientX, clientY, rect) => {
  const handleSize = 12; // buffer around edges and corners in pixels
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

    const handleMouseDown = (event) => {
      const img = event.target.closest?.('img');
      if (!img || !proseMirrorEl.contains(img)) return;

      // Dragging/resizing starts only after ProseMirror has selected the image.
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
        if (dir === 'nw' || dir === 'se') {
          img.style.cursor = 'nwse-resize';
        } else if (dir === 'ne' || dir === 'sw') {
          img.style.cursor = 'nesw-resize';
        } else if (dir === 'e' || dir === 'w') {
          img.style.cursor = 'ew-resize';
        } else if (dir === 'n' || dir === 's') {
          img.style.cursor = 'ns-resize';
        }
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
          newHeight = newWidth * aspectRatio;
        } else if (resizeDir === 'sw') {
          newWidth = Math.max(20, state.initialWidth - deltaX);
          newHeight = newWidth * aspectRatio;
          newMarginLeft = state.initialMarginLeft + deltaX;
        } else if (resizeDir === 'ne') {
          newWidth = Math.max(20, state.initialWidth + deltaX);
          newHeight = newWidth * aspectRatio;
          newMarginTop = state.initialMarginTop + (state.initialHeight - newHeight);
        } else if (resizeDir === 'nw') {
          newWidth = Math.max(20, state.initialWidth - deltaX);
          newHeight = newWidth * aspectRatio;
          newMarginLeft = state.initialMarginLeft + deltaX;
          newMarginTop = state.initialMarginTop + (state.initialHeight - newHeight);
        }

        img.style.width = `${newWidth}px`;
        img.style.height = `${newHeight}px`;
        img.style.marginLeft = `${newMarginLeft}px`;
        img.style.marginTop = `${newMarginTop}px`;
      } else {
        img.style.marginLeft = `${state.initialMarginLeft + deltaX}px`;
        img.style.marginTop = `${state.initialMarginTop + deltaY}px`;
      }
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
      
      if (dir === 'nw' || dir === 'se') {
        img.style.cursor = 'nwse-resize';
      } else if (dir === 'ne' || dir === 'sw') {
        img.style.cursor = 'nesw-resize';
      } else if (dir === 'e' || dir === 'w') {
        img.style.cursor = 'ew-resize';
      } else if (dir === 'n' || dir === 's') {
        img.style.cursor = 'ns-resize';
      } else {
        img.style.cursor = 'move';
      }
    };

    const handleMouseUp = () => {
      const state = dragStateRef.current;
      if (state.img) {
        persistImageGeometry(state);
        state.img.style.cursor = 'move';
      }
      dragStateRef.current = createIdleDragState();
      window.dispatchEvent(new CustomEvent('image-drag-end'));
    };

    const handleKeyDown = (event) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      if (!isImageSelection(editor)) return;

      event.preventDefault();
      editor.chain().focus().deleteSelection().run();
    };

    editorElement.addEventListener('mousedown', handleMouseDown);
    proseMirrorEl.addEventListener('mousemove', handleHoverMove);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    proseMirrorEl.addEventListener('keydown', handleKeyDown);

    return () => {
      editorElement.removeEventListener('mousedown', handleMouseDown);
      proseMirrorEl.removeEventListener('mousemove', handleHoverMove);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      proseMirrorEl.removeEventListener('keydown', handleKeyDown);
      dragStateRef.current = createIdleDragState();
    };
  }, [editor, editorRef]);
}
