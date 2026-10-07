import { TextSelection } from '@tiptap/pm/state';

/**
 * Places the text cursor in an editable paragraph below a table, image/drawing, or at the document end.
 *
 * @param {import('@tiptap/core').Editor|import('@tiptap/pm/view').EditorView} editorOrView - TipTap editor instance or ProseMirror EditorView
 * @param {number} clickX - Viewport clientX of click
 * @param {number} clickY - Viewport clientY of click
 * @returns {boolean} Whether cursor placement was handled
 */
export function focusBelowBlockOrDocEnd(editorOrView, clickX, clickY) {
  if (!editorOrView) return false;
  const view = editorOrView.view || editorOrView;
  const state = view?.state;
  if (!view || !state || !view.dom) return false;

  const proseEl = view.dom;
  const children = Array.from(proseEl.children).filter(
    (el) => el.nodeType === 1 && !el.classList?.contains('ProseMirror-gapcursor')
  );

  if (children.length === 0) {
    try {
      const endPos = state.doc.content.size;
      const tr = state.tr.insert(endPos, state.schema.nodes.paragraph.create());
      tr.setSelection(TextSelection.create(tr.doc, endPos + 1));
      view.dispatch(tr);
      view.focus();
      return true;
    } catch {
      return false;
    }
  }

  const lastChild = children[children.length - 1];
  const lastRect = lastChild.getBoundingClientRect();

  // 1. If click is anywhere below the bottom of the last element in the document
  if (clickY >= lastRect.bottom - 4) {
    const lastNode = state.doc.lastChild;
    // If the last node in the document is already an empty paragraph, focus into it
    if (lastNode && lastNode.type.name === 'paragraph' && lastNode.content.size === 0) {
      try {
        const endPos = state.doc.content.size - 1;
        const tr = state.tr.setSelection(TextSelection.create(state.doc, endPos));
        view.dispatch(tr);
        view.focus();
        return true;
      } catch {
        // Fallback
      }
    }

    // Otherwise append a new paragraph at the end of the document and focus it
    try {
      const endPos = state.doc.content.size;
      const tr = state.tr.insert(endPos, state.schema.nodes.paragraph.create());
      tr.setSelection(TextSelection.create(tr.doc, endPos + 1));
      view.dispatch(tr);
      view.focus();
      return true;
    } catch {
      return false;
    }
  }

  // 2. Click is within the vertical bounds of the document
  // Find the top-level block immediately above the click
  let targetBlockEl = null;
  let targetIndex = -1;

  for (let i = 0; i < children.length; i++) {
    const rect = children[i].getBoundingClientRect();
    if (clickY >= rect.top) {
      targetBlockEl = children[i];
      targetIndex = i;
    }
  }

  if (!targetBlockEl) {
    try {
      const tr = state.tr.setSelection(TextSelection.create(state.doc, 1));
      view.dispatch(tr);
      view.focus();
      return true;
    } catch {
      return false;
    }
  }

  const targetRect = targetBlockEl.getBoundingClientRect();
  const isTable = targetBlockEl.tagName === 'TABLE' || Boolean(targetBlockEl.querySelector('table'));
  const isImageOrDrawing = targetBlockEl.tagName === 'IMG' || Boolean(targetBlockEl.querySelector('img'));

  // If the target block is a table or image/drawing and the click is below its bottom edge
  if ((isTable || isImageOrDrawing) && clickY >= targetRect.bottom - 4) {
    const nextBlockEl = targetIndex + 1 < children.length ? children[targetIndex + 1] : null;

    if (!nextBlockEl) {
      // It's the last block, append and focus
      try {
        const endPos = state.doc.content.size;
        const tr = state.tr.insert(endPos, state.schema.nodes.paragraph.create());
        tr.setSelection(TextSelection.create(tr.doc, endPos + 1));
        view.dispatch(tr);
        view.focus();
        return true;
      } catch {
        return false;
      }
    }

    // Check if the next block is an empty paragraph
    let nextPos = null;
    try {
      nextPos = view.posAtDOM(nextBlockEl, 0);
    } catch {}

    if (nextPos != null) {
      const nextNode = state.doc.nodeAt(nextPos);
      if (nextNode && nextNode.type.name === 'paragraph' && nextNode.content.size === 0) {
        try {
          const tr = state.tr.setSelection(TextSelection.create(state.doc, nextPos + 1));
          view.dispatch(tr);
          view.focus();
          return true;
        } catch {}
      }
    }

    // Next block is not empty or not a paragraph, so insert an empty paragraph after this table/image
    let targetPos = null;
    try {
      targetPos = view.posAtDOM(targetBlockEl, 0);
    } catch {}

    if (targetPos != null) {
      try {
        const targetNode = state.doc.nodeAt(targetPos);
        const afterPos = targetPos + (targetNode ? targetNode.nodeSize : 0);
        const tr = state.tr.insert(afterPos, state.schema.nodes.paragraph.create());
        tr.setSelection(TextSelection.create(tr.doc, afterPos + 1));
        view.dispatch(tr);
        view.focus();
        return true;
      } catch {}
    }
  }

  return false;
}
