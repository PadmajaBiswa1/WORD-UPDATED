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

function getBlockDOM(view, pos) {
  if (!view?.dom) return null;
  try {
    const direct = view.nodeDOM(pos);
    if (direct && direct.nodeType === 1) return direct;
  } catch {}
  try {
    const domAt = view.domAtPos(pos + 1);
    if (domAt && domAt.node) {
      const el = domAt.node.nodeType === 1 ? domAt.node : domAt.node.parentElement;
      return el?.closest('.ProseMirror > *') || el;
    }
  } catch {}
  return null;
}

function estimateNodeHeight(node) {
  if (!node) return 0;

  switch (node.type.name) {
    case 'image':
      return Number(node.attrs?.height) || 220;
    case 'table':
      return Math.max(80, (node.childCount || 1) * 35);
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return Math.max(56, (node.childCount || 1) * 28);
    case 'blockquote':
      return Math.max(64, Math.ceil((node.textContent?.length || 1) / 60) * 24);
    case 'heading': {
      const level = node.attrs?.level || 1;
      return level === 1 ? 52 : (level === 2 ? 40 : 30);
    }
    case 'horizontalRule':
      return 28;
    case 'codeBlock':
      return Math.max(96, (node.textContent?.split('\n').length || 1) * 22);
    case 'paragraph': {
      const textLen = node.textContent?.length || 0;
      const estimatedLines = Math.max(1, Math.ceil(textLen / 70));
      return estimatedLines * 24;
    }
    default:
      return 32;
  }
}

function getNodeHeight(view, node, pos) {
  const dom = getBlockDOM(view, pos);
  if (dom) {
    const rect = dom.getBoundingClientRect();
    if (Number.isFinite(rect.height) && rect.height > 0) {
      const scale = useUIStore.getState().zoom / 100;
      const naturalHeight = rect.height * scale;
      let extraMargin = 0;
      try {
        const cs = window.getComputedStyle(dom);
        extraMargin = (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      } catch {}
      return Math.max(1, naturalHeight + extraMargin);
    }
  }
  return estimateNodeHeight(node);
}

function getContentHeightPx() {
  const { pageSize, pageOrientation, pageMargin } = useUIStore.getState();
  const metrics = getLayoutMetrics({ size: pageSize, orientation: pageOrientation, margin: pageMargin });
  return Math.max(1, metrics.contentHeight - (PAGE_BORDER_WIDTH * 2));
}

function getNodeHash(node) {
  try { return JSON.stringify(node.toJSON()); } catch { return String(node.nodeSize); }
}

let isPaginating = false;

function paginateDocument(view, heightCache) {
  if (!view?.state?.doc || view.isDestroyed || isPaginating) return false;

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

  for (let index = 0; index < sourceBlocks.length; index += 1) {
    const current = sourceBlocks[index];
    const { node, pos } = current;

    if (isManualPageBreak(node)) {
      const fillHeight = Math.max(1, pageStep - pageAccumHeight);
      nextNodes.push(pageBreakType.create({ auto: false, fillHeight }));
      pageAccumHeight = 0;
      pageHasContent = false;
      continue;
    }

    let nodeHeight;
    if (heightCache) {
      const cacheKey = String(current.pos);
      const hash = getNodeHash(node);
      const cached = heightCache.get(cacheKey);
      if (cached && cached.hash === hash) {
        nodeHeight = cached.height;
      } else {
        nodeHeight = Math.max(1, getNodeHeight(view, node, pos));
        heightCache.set(cacheKey, { hash, height: nodeHeight });
      }
    } else {
      nodeHeight = Math.max(1, getNodeHeight(view, node, pos));
    }

    const isHeading = ['heading'].includes(node.type.name);
    let spaceBefore = 0;
    if (isHeading) {
      const level = node.attrs?.level || 1;
      spaceBefore = level === 1 ? 24 : 16;
    }
    let spaceAfter = 8;
    if (isHeading) {
      const level = node.attrs?.level || 1;
      spaceAfter = level === 1 ? 8 : (level === 2 ? 6 : 4);
    }

    const totalNodeHeight = nodeHeight + spaceBefore + spaceAfter;
    const next = sourceBlocks[index + 1];

    const fitsCurrentPage = (pageAccumHeight + totalNodeHeight) <= contentHeight;
    const shouldKeepWithNext = isKeepWithNextBlock(node) && next && !isPageBreakNode(next.node);

    let nextWouldOverflow = false;
    if (shouldKeepWithNext && next) {
      const nextHeight = Math.max(1, getNodeHeight(view, next.node, next.pos));
      nextWouldOverflow = (pageAccumHeight + totalNodeHeight + nextHeight) > contentHeight;
    }

    if (pageHasContent && (!fitsCurrentPage || nextWouldOverflow)) {
      const availableSpace = contentHeight - pageAccumHeight;
      const isLongParagraph = node.type.name === 'paragraph' &&
                              node.childCount === 1 &&
                              node.firstChild.isText &&
                              node.textContent.length > 120 &&
                              availableSpace >= 96;

      if (isLongParagraph) {
        const fullText = node.textContent;
        const approxChars = Math.floor((availableSpace / totalNodeHeight) * fullText.length);
        let splitIdx = fullText.lastIndexOf(' ', Math.max(20, approxChars));
        if (splitIdx > 20 && splitIdx < fullText.length - 20) {
          const part1 = fullText.slice(0, splitIdx);
          const part2 = fullText.slice(splitIdx).trimStart();
          const p1 = schema.nodes.paragraph.create(node.attrs, schema.text(part1));
          const p2 = schema.nodes.paragraph.create(node.attrs, schema.text(part2));

          nextNodes.push(p1);
          const fillHeight = Math.max(1, pageStep - (pageAccumHeight + availableSpace));
          nextNodes.push(pageBreakType.create({ auto: true, fillHeight }));
          nextNodes.push(p2);

          const p2Height = Math.max(1, (nodeHeight * (part2.length / fullText.length)));
          pageAccumHeight = p2Height + spaceAfter;
          pageHasContent = true;
          continue;
        }
      }

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

  isPaginating = true;
  try {
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
            newSelectionPos = currentPos + Math.min(offsetInBlock, node.nodeSize - 1);
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
  } finally {
    setTimeout(() => {
      isPaginating = false;
    }, 60);
  }
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
    const fillHeight = Math.max(1, Number(HTMLAttributes.fillHeight) || CONTENT_H);
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-page-break': 'true',
      'data-etherx-auto-break': isAuto ? 'true' : 'false',
      'class': isAuto ? 'etherx-page-break etherx-auto-page-break' : 'etherx-page-break',
      'contenteditable': 'false',
      style: isAuto
        ? `height:${fillHeight}px; margin:0; pointer-events:none; user-select:none; position:relative; cursor:default; opacity:0; overflow:hidden;`
        : `height:${fillHeight}px; margin:0; pointer-events:auto; user-select:none; position:relative; cursor:default;`,
    })];
  },

  addNodeView() {
    return ({ node }) => {
      const isAuto = Boolean(node.attrs?.auto);
      const fillHeight = Math.max(1, Number(node.attrs?.fillHeight) || CONTENT_H);
      const dom = document.createElement('div');
      dom.setAttribute('data-page-break', 'true');
      dom.setAttribute('data-etherx-auto-break', isAuto ? 'true' : 'false');
      dom.setAttribute('class', isAuto ? 'etherx-page-break etherx-auto-page-break' : 'etherx-page-break');
      dom.setAttribute('contenteditable', 'false');
      dom.setAttribute('tabindex', '-1');
      dom.setAttribute('aria-hidden', 'true');
      dom.style.cssText = [
        `height:${fillHeight}px`,
        'margin:0',
        `pointer-events:${isAuto ? 'none' : 'auto'}`,
        'user-select:none',
        'position:relative',
        'display:block',
        `overflow:${isAuto ? 'hidden' : 'visible'}`,
        `opacity:${isAuto ? '0' : '1'}`,
        'cursor:default',
      ].join(';');

      if (isAuto) {
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
        view: (editorView) => {
          let debounceTimer = null;
          // Cache: pos (string) -> { nodeHash, height }
          // nodeHash is a cheap fingerprint of the node JSON to detect changes.
          const heightCache = new Map();

          const schedule = (view, force = false) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              debounceTimer = null;
              paginateDocument(view, force ? null : heightCache);
            }, 180);
          };

          // Schedule on mount so document paginates immediately on load
          setTimeout(() => {
            if (!editorView.isDestroyed) {
              schedule(editorView, true);
            }
          }, 80);

          const storeUnsubscribe = useUIStore.subscribe((state, prevState) => {
            if (
              state.zoom !== prevState.zoom ||
              state.pageSize !== prevState.pageSize ||
              state.pageOrientation !== prevState.pageOrientation ||
              state.pageMargin !== prevState.pageMargin
            ) {
              // Page size / zoom change: bust the entire height cache
              heightCache.clear();
              schedule(editorView, true);
            }
          });

          return {
            update(view, prevState) {
              if (!view?.state) return;
              if (isPaginating) return;
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
