import { Node, mergeAttributes } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { getLayoutMetrics, PAGE_SIZES, PAGE_GAP } from '@/utils/pageLayout';
import { useUIStore } from '@/store';

export const PAGE_H    = 1123;
export const MARGIN_Y  = 96;
export const MARGIN_X  = 96;
export const PAGE_BORDER_WIDTH = 1;
export const CONTENT_H = PAGE_H - MARGIN_Y * 2 - (PAGE_BORDER_WIDTH * 2); // usable per page

const AUTO_PAGINATION_KEY = new PluginKey('etherxAutoPagination');

function isPageBreakNode(node) {
  return node?.type?.name === 'pageBreak';
}

function isAutoPageBreak(node) {
  return isPageBreakNode(node) && Boolean(node?.attrs?.auto);
}

function isManualPageBreak(node) {
  return isPageBreakNode(node) && !node?.attrs?.auto;
}

function isKeepWithNextBlock(node) {
  return ['heading'].includes(node?.type?.name);
}

function estimateNodeHeight(node) {
  if (!node) return 0;

  switch (node.type.name) {
    case 'image':
      return Number(node.attrs?.height) || 220;
    case 'table':
      return 180;
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return Math.max(56, node.childCount * 28);
    case 'blockquote':
      return 64;
    case 'heading':
      return 44;
    case 'horizontalRule':
      return 28;
    case 'codeBlock':
      return 96;
    case 'paragraph':
      return 28;
    default:
      return 32;
  }
}

function getNodeHeight(view, node, dom) {
  if (dom) {
    const rect = dom.getBoundingClientRect();
    if (Number.isFinite(rect.height) && rect.height > 0) {
      // Divide by contentScale (multiply by scale) to get natural pixels
      const scale = useUIStore.getState().zoom / 100;
      return rect.height * scale;
    }
  }
  return estimateNodeHeight(node);
}

function getContentHeightPx() {
  const { pageSize, pageOrientation, pageMargin } = useUIStore.getState();
  const metrics = getLayoutMetrics({ size: pageSize, orientation: pageOrientation, margin: pageMargin });
  // Content is counter-scaled so we use natural (unscaled) content height
  return Math.max(1, metrics.contentHeight - (PAGE_BORDER_WIDTH * 2));
}

function getNodeHash(node) {
  try { return JSON.stringify(node.toJSON()); } catch { return String(node.nodeSize); }
}

function paginateDocument(view, heightCache) {
  if (!view?.state?.doc || view.isDestroyed) return false;

  const { doc, schema } = view.state;
  const pageBreakType = schema.nodes.pageBreak;
  if (!pageBreakType) return false;

  const contentHeight = getContentHeightPx();
  const { pageSize, pageOrientation } = useUIStore.getState();
  const dims = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
  const pageHeight = pageOrientation === 'landscape' ? dims.w : dims.h;
  const pageStep = pageHeight + PAGE_GAP;

  const sourceBlocks = [];
  doc.forEach((node, pos) => {
    if (isAutoPageBreak(node)) return;
    sourceBlocks.push({
      node,
      pos,
      dom: view.nodeDOM(pos),
    });
  });

  // Track selection before replacing nodes
  const oldSelection = view.state.selection;
  const oldPos = oldSelection.$from.pos;
  let targetBlockIndex = -1;
  let offsetInBlock = 0;

  for (let i = 0; i < sourceBlocks.length; i++) {
    const block = sourceBlocks[i];
    const blockStart = block.pos;
    const blockEnd = block.pos + block.node.nodeSize;
    if (oldPos >= blockStart && oldPos <= blockEnd) {
      targetBlockIndex = i;
      offsetInBlock = oldPos - blockStart;
      break;
    }
  }

  const nextNodes = [];
  let pageAccumHeight = 0;
  let pageHasContent = false;
  
  // Spacing after each block: 10pt = 13.33px in 96dpi
  const blockSpacing = 13.33;

  for (let index = 0; index < sourceBlocks.length; index += 1) {
    const current = sourceBlocks[index];
    const { node, dom } = current;

    if (isManualPageBreak(node)) {
      if (nextNodes[nextNodes.length - 1]?.type?.name !== 'pageBreak') {
        nextNodes.push(node);
      }
      pageAccumHeight = 0;
      pageHasContent = false;
      continue;
    }

    // Use height cache to avoid re-measuring unchanged blocks
    let nodeHeight;
    if (heightCache) {
      const cacheKey = String(current.pos);
      const hash = getNodeHash(node);
      const cached = heightCache.get(cacheKey);
      if (cached && cached.hash === hash) {
        nodeHeight = cached.height;
      } else {
        nodeHeight = Math.max(1, getNodeHeight(view, node, dom));
        heightCache.set(cacheKey, { hash, height: nodeHeight });
      }
    } else {
      nodeHeight = Math.max(1, getNodeHeight(view, node, dom));
    }
    const isHeading = ['heading'].includes(node.type.name);
    
    // Heading margins (Word presets converted to pixels @ 96dpi)
    let spaceBefore = 0;
    if (isHeading) {
      const level = node.attrs?.level || 1;
      spaceBefore = level === 1 ? 32 : 18.6;
    }
    
    let spaceAfter = blockSpacing;
    if (isHeading) {
      const level = node.attrs?.level || 1;
      spaceAfter = level === 1 ? 8 : (level === 2 ? 5.3 : 2.6);
    }

    const totalNodeHeight = nodeHeight + spaceBefore + spaceAfter;
    const next = sourceBlocks[index + 1];

    const fitsCurrentPage = (pageAccumHeight + totalNodeHeight) <= contentHeight;
    const shouldKeepWithNext = isKeepWithNextBlock(node) && next && !isPageBreakNode(next.node);
    
    let nextWouldOverflow = false;
    if (shouldKeepWithNext && next) {
      const nextHeight = Math.max(1, getNodeHeight(view, next.node, next.dom));
      const nextIsHeading = ['heading'].includes(next.node.type.name);
      let nextSpaceBefore = 0;
      if (nextIsHeading) {
        const level = next.node.attrs?.level || 1;
        nextSpaceBefore = level === 1 ? 32 : 18.6;
      }
      let nextSpaceAfter = blockSpacing;
      if (nextIsHeading) {
        const level = next.node.attrs?.level || 1;
        nextSpaceAfter = level === 1 ? 8 : (level === 2 ? 5.3 : 2.6);
      }
      const totalNextHeight = nextHeight + nextSpaceBefore + nextSpaceAfter;
      nextWouldOverflow = (pageAccumHeight + totalNodeHeight + totalNextHeight) > contentHeight;
    }

    if (pageHasContent && (!fitsCurrentPage || nextWouldOverflow)) {
      if (nextNodes[nextNodes.length - 1]?.type?.name !== 'pageBreak') {
        const fillHeight = Math.max(1, pageStep - pageAccumHeight);
        nextNodes.push(pageBreakType.create({ auto: true, fillHeight }));
      }
      pageAccumHeight = 0;
      pageHasContent = false;
    }

    nextNodes.push(node);
    pageAccumHeight += totalNodeHeight;
    pageHasContent = true;
  }

  const currentNodes = [];
  doc.forEach((node) => {
    currentNodes.push(node);
  });

  if (currentNodes.length === nextNodes.length && currentNodes.every((node, index) => node.eq(nextNodes[index]))) {
    return false;
  }

  const tr = view.state.tr.replaceWith(0, doc.content.size, Fragment.fromArray(nextNodes));

  // Restore selection position dynamically mapping it to the new document layout
  if (targetBlockIndex !== -1) {
    let currentPos = 0;
    let blockCount = 0;
    let newSelectionPos = 1;
    for (let i = 0; i < nextNodes.length; i++) {
      const node = nextNodes[i];
      if (isPageBreakNode(node)) {
        currentPos += node.nodeSize;
      } else {
        if (blockCount === targetBlockIndex) {
          newSelectionPos = currentPos + offsetInBlock;
          break;
        }
        currentPos += node.nodeSize;
        blockCount++;
      }
    }
    const resolvedPos = tr.doc.resolve(Math.min(tr.doc.content.size - 1, Math.max(1, newSelectionPos)));
    tr.setSelection(oldSelection.constructor.near(resolvedPos));
  }

  tr.setMeta('addToHistory', false);
  tr.setMeta(AUTO_PAGINATION_KEY, true);
  view.dispatch(tr);
  return true;
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  isolating: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      fillHeight: { default: CONTENT_H },
      auto: { default: false },
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-page-break]',
      getAttrs: (element) => ({
        auto: element?.getAttribute?.('data-etherx-auto-break') === 'true',
      }),
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const isAuto = Boolean(HTMLAttributes.auto);
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-page-break': 'true',
      'data-etherx-auto-break': isAuto ? 'true' : 'false',
      'class': isAuto ? 'etherx-page-break etherx-auto-page-break' : 'etherx-page-break',
      'contenteditable': 'false',
      // Keep this as an intra-document marker (avoid adding extra page-to-page spacing).
      style: isAuto
        ? `height:${Math.max(1, Number(HTMLAttributes.fillHeight) || CONTENT_H)}px; margin:0; pointer-events:none; user-select:none; position:relative; cursor:default; opacity:0; overflow:hidden;`
        : 'height:1px; margin:0; pointer-events:auto; user-select:none; position:relative; cursor:default;',
    })];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-page-break', 'true');
      dom.setAttribute('data-etherx-auto-break', node.attrs?.auto ? 'true' : 'false');
      dom.setAttribute('class', node.attrs?.auto ? 'etherx-page-break etherx-auto-page-break' : 'etherx-page-break');
      dom.setAttribute('contenteditable', 'false');
      dom.setAttribute('tabindex', '-1');
      dom.setAttribute('aria-hidden', 'true');
      dom.style.cssText = [
        `height:${node.attrs?.auto ? Math.max(1, Number(node.attrs?.fillHeight) || CONTENT_H) : 1}px`,
        'margin:0',
        `pointer-events:${node.attrs?.auto ? 'none' : 'auto'}`,
        'user-select:none',
        'position:relative',
        'display:block',
        `overflow:${node.attrs?.auto ? 'hidden' : 'visible'}`,
        `opacity:${node.attrs?.auto ? '0' : '1'}`,
        'cursor:default',
      ].join(';');

      if (node.attrs?.auto) {
        return {
          dom,
          stopEvent: () => true,
          ignoreMutation: () => true,
        };
      }

      const line = document.createElement('div');
      line.style.cssText = [
        'position:absolute',
        'top:0',
        'left:0',
        'right:0',
        'height:1px',
        'background:rgba(212,175,55,0.28)',
        'pointer-events:none',
      ].join(';');
      dom.appendChild(line);

      const label = document.createElement('span');
      label.textContent = 'Page Break';
      label.style.cssText = [
        'position:absolute',
        'top:0',
        'left:50%',
        'transform:translate(-50%, -100%)',
        'font-size:10px',
        'letter-spacing:0.08em',
        'text-transform:uppercase',
        'padding:0 8px',
        'color:rgba(212,175,55,0.55)',
        'background:var(--bg-page)',
        'pointer-events:none',
      ].join(';');
      dom.appendChild(label);

      return {
        dom,
        stopEvent: () => true,
        ignoreMutation: () => true,
      };
    };
  },

  addCommands() {
    return {
      insertPageBreak: () => ({ commands }) => {
        // Use the live content height so the filler node is sized correctly
        // for whatever page size + margin the user currently has selected.
        const fillHeight = getContentHeightPx();
        return commands.insertContent({ type: 'pageBreak', attrs: { fillHeight, auto: false } });
      },
    };
  },

  addProseMirrorPlugins() {
    const pageBreakKey = new PluginKey('pageBreakCursorGuard');

    const isPageBreakNode = (node) => node?.type?.name === 'pageBreak';

    const findNearestValidPos = (doc, $pos) => {
      // If cursor is exactly on pageBreak, move it after the node.
      const nodeAt = doc.nodeAt($pos.pos);
      if (isPageBreakNode(nodeAt)) {
        return Math.min(doc.content.size, $pos.pos + nodeAt.nodeSize);
      }

      // If selection is inside the pageBreak node view context (parent), move after.
      if ($pos.parent?.type?.name === 'pageBreak') {
        return Math.min(doc.content.size, $pos.after());
      }

      // Otherwise, keep current.
      return $pos.pos;
    };

    const guardSelectionAwayFromPageBreak = (state) => {
      const { doc, selection } = state;
      if (!selection) return null;

      const { $from } = selection;
      const nextPos = findNearestValidPos(doc, $from);

      // If already valid, do nothing.
      if (nextPos === $from.pos) return null;

      const tr = state.tr;
      tr.setSelection(selection.constructor.near(doc.resolve(nextPos)));
      return tr;
    };

    return [
      new Plugin({
        key: pageBreakKey,
          props: {
          handleClick: (view, _pos, event) => {
            if (event.target.closest('[data-page-break]')) {
              event.preventDefault();
              event.stopPropagation();
              return true;
            }
            return false;
          },

          // Block any attempt to input text at/inside the page break.
          handleTextInput: (view) => {
            const { selection } = view.state;
            const { $from } = selection;
            const nodeAt = view.state.doc.nodeAt($from.pos);
            if (isPageBreakNode(nodeAt) || $from.parent?.type?.name === 'pageBreak') return true;
            return false;
          },
          handlePaste: (view) => {
            const { selection } = view.state;
            const { $from } = selection;
            const nodeAt = view.state.doc.nodeAt($from.pos);
            if (isPageBreakNode(nodeAt) || $from.parent?.type?.name === 'pageBreak') return true;
            return false;
          },
          handleDOMEvents: {
            beforeinput: (view, event) => {
              // If user/browser is trying to insert characters into the editor,
              // block it when selection is on/inside a pageBreak.
              // (Most browsers route typing through beforeinput.)
              const tr = guardSelectionAwayFromPageBreak(view.state);
              if (tr) view.dispatch(tr);

              const { selection } = view.state;
              const { $from } = selection;
              const nodeAt = view.state.doc.nodeAt($from.pos);
              if (isPageBreakNode(nodeAt) || $from.parent?.type?.name === 'pageBreak') {
                event.preventDefault();
                return true;
              }
              return false;
            },

            keydown: (view, event) => {
              const { selection } = view.state;
              const { $from } = selection;
              const nodeAt = view.state.doc.nodeAt($from.pos);

              if (isPageBreakNode(nodeAt) || $from.parent?.type?.name === 'pageBreak') {
                // Prevent deletion or character insertion when caret is at the break.
                const key = event.key;
                const blockedKeys = new Set([
                  'Backspace',
                  'Delete',
                ]);

                if (blockedKeys.has(key) || key.length === 1 || event.inputType) {
                  event.preventDefault();
                  event.stopPropagation();
                  // Ensure caret moves away so user can keep typing.
                  const tr = guardSelectionAwayFromPageBreak(view.state);
                  if (tr) view.dispatch(tr);
                  return true;
                }
              }

              return false;
            },
          },

          // Belt-and-suspenders: prohibit drop into page break.
          handleDrop: () => true,
        },

        appendTransaction: (transactions, oldState, newState) => {
          const hasSelectionChange = transactions.some((tr) => tr.selectionSet || tr.docChanged);
          if (!hasSelectionChange) return null;

          const tr = guardSelectionAwayFromPageBreak(newState);
          return tr;
        },
      }),
      new Plugin({
        key: AUTO_PAGINATION_KEY,
        view: () => {
          let debounceTimer = null;
          // Cache: pos (string) -> { nodeHash, height }
          // nodeHash is a cheap fingerprint of the node JSON to detect changes.
          const heightCache = new Map();

          const getNodeHash = (node) => {
            try { return JSON.stringify(node.toJSON()); } catch { return String(node.nodeSize); }
          };

          const schedule = (view, force = false) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              debounceTimer = null;
              paginateDocument(view, force ? null : heightCache);
            }, 200);
          };

          const storeUnsubscribe = useUIStore.subscribe((state, prevState) => {
            if (
              state.zoom !== prevState.zoom ||
              state.pageSize !== prevState.pageSize ||
              state.pageOrientation !== prevState.pageOrientation ||
              state.pageMargin !== prevState.pageMargin
            ) {
              // Page size / zoom change: bust the entire height cache
              heightCache.clear();
              schedule(view, true);
            }
          });

          return {
            update(view, prevState) {
              if (!view?.state) return;
              // Skip if only the selection changed — no content was modified
              if (view.state.doc === prevState.doc) return;
              schedule(view);
            },
            destroy() {
              clearTimeout(debounceTimer);
              storeUnsubscribe();
              heightCache.clear();
            },
          };
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.insertPageBreak(),
    };
  },
});
