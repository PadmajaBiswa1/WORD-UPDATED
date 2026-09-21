import { Node, mergeAttributes } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { getLayoutMetrics, PAGE_SIZES, PAGE_GAP } from '@/utils/pageLayout';
import { useUIStore, useDocumentStore } from '@/store';

export const PAGE_H    = 1123;
export const MARGIN_Y  = 96;
export const MARGIN_X  = 96;
export const PAGE_BORDER_WIDTH = 1;
export const CONTENT_H = PAGE_H - MARGIN_Y * 2 - (PAGE_BORDER_WIDTH * 2); // usable per page

const AUTO_PAGINATION_KEY = new PluginKey('etherxAutoPagination');

export function stripAutoPageBreaks(html) {
  if (!html || typeof html !== 'string') return html || '';
  // 1. Remove explicit auto-breaks
  let cleaned = html.replace(/<div\b[^>]*?(?:data-etherx-auto-break=["']true["']|class=["'][^"']*?etherx-auto-page-break[^"']*?["'])[^>]*>(?:&nbsp;|\s)*<\/div>/gi, '');
  // 2. Remove legacy page breaks saved without data-manual="true" and without etherx-manual-page-break
  cleaned = cleaned.replace(/<div\b(?=[^>]*\bdata-page-break=["']true["'])(?![^>]*\bdata-manual=["']true["'])(?![^>]*\betherx-manual-page-break\b)[^>]*>(?:&nbsp;|\s)*<\/div>/gi, '');
  return cleaned;
}

function isPageBreakNode(node) {
  return node?.type?.name === 'pageBreak';
}

function isAutoPageBreak(node) {
  if (!isPageBreakNode(node)) return false;
  if (node.attrs?.manual === true || node.attrs?.manual === 'true') return false;
  if (node.attrs?.auto === true || node.attrs?.auto === 'true' || node.attrs?.isAuto === true) return true;
  return !node.attrs?.manual;
}

function isManualPageBreak(node) {
  if (!isPageBreakNode(node)) return false;
  return Boolean(node.attrs?.manual === true || node.attrs?.manual === 'true');
}

function isKeepWithNextBlock(node) {
  return ['heading'].includes(node?.type?.name);
}

function getBlockDOM(view, pos) {
  if (!view?.dom) return null;
  try {
    const direct = view.nodeDOM(pos);
    if (direct && direct.nodeType === 1 && direct !== view.dom && !direct.classList?.contains('ProseMirror')) {
      return direct.closest('.ProseMirror > *') || direct;
    }
  } catch {}
  try {
    const safePos = Math.min(view.state.doc.content.size, Math.max(0, pos + 1));
    const domAt = view.domAtPos(safePos);
    if (domAt && domAt.node) {
      const el = domAt.node.nodeType === 1 ? domAt.node : domAt.node.parentElement;
      const topBlock = el?.closest('.ProseMirror > *');
      if (topBlock && topBlock !== view.dom && !topBlock.classList?.contains('ProseMirror')) {
        return topBlock;
      }
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

function measureBlock(view, node, pos) {
  const dom = getBlockDOM(view, pos);
  let height = 0;
  let marginTop = 0;
  let marginBottom = 10;
  let isEstimate = false;

  if (dom) {
    const rect = dom.getBoundingClientRect();
    if (Number.isFinite(rect.height) && rect.height > 0) {
      const scale = (useUIStore.getState().zoom || 100) / 100;
      height = Math.max(1, rect.height * scale);
    } else if (dom.offsetHeight > 0) {
      height = dom.offsetHeight;
    }
    try {
      const cs = window.getComputedStyle(dom);
      marginTop = parseFloat(cs.marginTop) || 0;
      marginBottom = parseFloat(cs.marginBottom) || 0;
    } catch {}
  }

  if (!height) {
    height = estimateNodeHeight(node);
    isEstimate = true;
  }

  return { height, marginTop, marginBottom, isEstimate };
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
  let currentPage = 0;
  let currentY = 0; // Relative to start of ProseMirror content (Page 0 starts at 0)
  let prevBottomMargin = 0;
  let pageHasContent = false;

  for (let index = 0; index < sourceBlocks.length; index += 1) {
    const current = sourceBlocks[index];
    const { node, pos } = current;

    // Handle Manual Page Breaks
    if (isManualPageBreak(node)) {
      const fillHeight = Math.max(1, (currentPage + 1) * pageStep - currentY);
      nextNodes.push(pageBreakType.create({ auto: false, manual: true, fillHeight }));
      currentPage += 1;
      currentY = currentPage * pageStep;
      prevBottomMargin = 0;
      pageHasContent = false;
      continue;
    }

    let measured;
    if (heightCache) {
      const cacheKey = String(current.pos);
      const hash = getNodeHash(node);
      const cached = heightCache.get(cacheKey);
      if (cached && cached.hash === hash) {
        measured = cached.measured;
      } else {
        measured = measureBlock(view, node, pos);
        if (!measured.isEstimate) {
          heightCache.set(cacheKey, { hash, measured });
        }
      }
    } else {
      measured = measureBlock(view, node, pos);
    }

    const { height: nodeHeight, marginTop, marginBottom } = measured;

    // CSS margin collapsing with previous block on the same page
    const effectiveMarginTop = pageHasContent ? Math.max(prevBottomMargin, marginTop) : 0;
    const proposedTop = currentY + effectiveMarginTop;
    const proposedBottom = proposedTop + nodeHeight;

    const pageContentLimit = currentPage * pageStep + contentHeight;
    const fitsCurrentPage = proposedBottom <= pageContentLimit;

    // "Keep with next" for headings so a heading doesn't sit orphaned at page bottom
    let keepWithNextOverflow = false;
    if (isKeepWithNextBlock(node) && sourceBlocks[index + 1]) {
      const nextBlock = sourceBlocks[index + 1];
      if (!isPageBreakNode(nextBlock.node)) {
        const nextMeasured = measureBlock(view, nextBlock.node, nextBlock.pos);
        const nextProposedBottom = proposedBottom + Math.max(marginBottom, nextMeasured.marginTop) + nextMeasured.height;
        keepWithNextOverflow = nextProposedBottom > pageContentLimit;
      }
    }

    if (pageHasContent && (!fitsCurrentPage || keepWithNextOverflow)) {
      // Must break to next page!
      // Fill remaining space on currentPage + dead zone to reach start of currentPage + 1
      const fillHeight = Math.max(1, (currentPage + 1) * pageStep - currentY);
      nextNodes.push(pageBreakType.create({ auto: true, manual: false, fillHeight }));

      // Advance to next page
      currentPage += 1;
      currentY = currentPage * pageStep;
      prevBottomMargin = 0;
      pageHasContent = false;

      // On new page, top margin is 0 because page top margin provides the spacing
      const newPageTop = currentY;
      const newPageBottom = newPageTop + nodeHeight;

      nextNodes.push(node);
      currentY = newPageBottom;
      prevBottomMargin = marginBottom;
      pageHasContent = true;
    } else {
      // Fits on current page (or forced because page is empty)
      nextNodes.push(node);
      currentY = proposedBottom;
      prevBottomMargin = marginBottom;
      pageHasContent = true;
    }
  }

  const currentNodes = [];
  doc.forEach((node) => {
    currentNodes.push(node);
  });

  if (
    currentNodes.length === nextNodes.length &&
    currentNodes.every((node, index) => {
      const next = nextNodes[index];
      if (isPageBreakNode(node) && isPageBreakNode(next)) {
        const hDiff = Math.abs(Number(node.attrs?.fillHeight || 0) - Number(next.attrs?.fillHeight || 0));
        return (
          hDiff < 1 &&
          Boolean(node.attrs?.auto) === Boolean(next.attrs?.auto) &&
          Boolean(node.attrs?.manual) === Boolean(next.attrs?.manual)
        );
      }
      return node.eq(next);
    })
  ) {
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
      fillHeight: {
        default: CONTENT_H,
        parseHTML: (element) => parseFloat(element.style?.height) || parseFloat(element.getAttribute?.('data-fill-height')) || CONTENT_H,
        renderHTML: (attributes) => ({
          'data-fill-height': attributes.fillHeight,
        }),
      },
      auto: {
        default: false,
        parseHTML: (element) => {
          const isExplicitManual =
            element.getAttribute?.('data-manual') === 'true' ||
            element.getAttribute?.('data-etherx-manual') === 'true' ||
            element.classList?.contains('etherx-manual-page-break');
          if (isExplicitManual) return false;
          return (
            element.getAttribute?.('data-etherx-auto-break') === 'true' ||
            element.getAttribute?.('data-auto') === 'true' ||
            element.classList?.contains('etherx-auto-page-break') ||
            element.dataset?.etherxAutoBreak === 'true' ||
            element.style?.opacity === '0' ||
            true
          );
        },
        renderHTML: (attributes) => ({
          'data-etherx-auto-break': attributes.auto ? 'true' : 'false',
        }),
      },
      manual: {
        default: false,
        parseHTML: (element) => (
          element.getAttribute?.('data-manual') === 'true' ||
          element.getAttribute?.('data-etherx-manual') === 'true' ||
          element.classList?.contains('etherx-manual-page-break')
        ),
        renderHTML: (attributes) => ({
          'data-manual': attributes.manual ? 'true' : 'false',
        }),
      },
    };
  },

  parseHTML() {
    const parseAttrs = (element) => {
      const isManual =
        element.getAttribute?.('data-manual') === 'true' ||
        element.getAttribute?.('data-etherx-manual') === 'true' ||
        element.classList?.contains('etherx-manual-page-break');
      const isExplicitAuto =
        element.getAttribute?.('data-etherx-auto-break') === 'true' ||
        element.getAttribute?.('data-auto') === 'true' ||
        element.classList?.contains('etherx-auto-page-break') ||
        element.dataset?.etherxAutoBreak === 'true' ||
        element.style?.opacity === '0';
      const fillHeight =
        parseFloat(element.style?.height) ||
        parseFloat(element.getAttribute?.('data-fill-height')) ||
        CONTENT_H;
      return {
        manual: isManual,
        auto: !isManual && (isExplicitAuto || true),
        fillHeight,
      };
    };

    return [
      {
        tag: 'div[data-page-break]',
        getAttrs: parseAttrs,
      },
      {
        tag: 'div.etherx-page-break',
        getAttrs: parseAttrs,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const isManual = Boolean(node?.attrs?.manual || HTMLAttributes?.['data-manual'] === 'true');
    const isAuto = !isManual && Boolean(node?.attrs?.auto || HTMLAttributes?.['data-etherx-auto-break'] === 'true' || HTMLAttributes?.auto);
    const fillHeight = Math.max(1, Number(node?.attrs?.fillHeight ?? HTMLAttributes?.fillHeight) || CONTENT_H);
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-page-break': 'true',
      'data-etherx-auto-break': isAuto ? 'true' : 'false',
      'data-manual': isManual ? 'true' : 'false',
      'class': isAuto ? 'etherx-page-break etherx-auto-page-break' : 'etherx-page-break etherx-manual-page-break',
      'contenteditable': 'false',
      style: isAuto
        ? `height:${fillHeight}px; margin:0; pointer-events:none; user-select:none; position:relative; cursor:default; opacity:0; overflow:hidden;`
        : `height:${fillHeight}px; margin:0; pointer-events:auto; user-select:none; position:relative; cursor:default;`,
    })];
  },

  addNodeView() {
    return ({ node }) => {
      const isManual = Boolean(node.attrs?.manual);
      const isAuto = !isManual && Boolean(node.attrs?.auto);
      const fillHeight = Math.max(1, Number(node.attrs?.fillHeight) || CONTENT_H);
      const dom = document.createElement('div');
      dom.setAttribute('data-page-break', 'true');
      dom.setAttribute('data-etherx-auto-break', isAuto ? 'true' : 'false');
      dom.setAttribute('data-manual', isManual ? 'true' : 'false');
      dom.setAttribute('class', isAuto ? 'etherx-page-break etherx-auto-page-break' : 'etherx-page-break etherx-manual-page-break');
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
          update: (updatedNode) => {
            if (updatedNode.type.name !== 'pageBreak') return false;
            const nextManual = Boolean(updatedNode.attrs?.manual);
            const nextAuto = !nextManual && Boolean(updatedNode.attrs?.auto);
            if (!nextAuto) return false;
            const nextHeight = Math.max(1, Number(updatedNode.attrs?.fillHeight) || CONTENT_H);
            dom.style.height = `${nextHeight}px`;
            dom.setAttribute('data-etherx-auto-break', 'true');
            dom.setAttribute('data-manual', 'false');
            dom.className = 'etherx-page-break etherx-auto-page-break';
            dom.style.opacity = '0';
            dom.style.pointerEvents = 'none';
            return true;
          },
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
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'pageBreak') return false;
          const nextManual = Boolean(updatedNode.attrs?.manual);
          if (!nextManual) return false;
          const nextHeight = Math.max(1, Number(updatedNode.attrs?.fillHeight) || CONTENT_H);
          dom.style.height = `${nextHeight}px`;
          dom.setAttribute('data-etherx-auto-break', 'false');
          dom.setAttribute('data-manual', 'true');
          dom.className = 'etherx-page-break etherx-manual-page-break';
          dom.style.opacity = '1';
          dom.style.pointerEvents = 'auto';
          return true;
        },
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
        return commands.insertContent({
          type: 'pageBreak',
          attrs: { fillHeight, auto: false, manual: true },
        });
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
          // Cache: pos (string) -> { hash, measured }
          const heightCache = new Map();

          const schedule = (view, force = false) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              debounceTimer = null;
              if (!view || view.isDestroyed) return;
              paginateDocument(view, force ? null : heightCache);
            }, 100);
          };

          // 1. Staggered multi-pass schedule on mount to measure before and after layout/fonts settle
          if (typeof window !== 'undefined') {
            requestAnimationFrame(() => {
              if (!editorView.isDestroyed) schedule(editorView, true);
            });
          }
          const t1 = setTimeout(() => {
            if (!editorView.isDestroyed) schedule(editorView, true);
          }, 150);
          const t2 = setTimeout(() => {
            if (!editorView.isDestroyed) {
              heightCache.clear();
              schedule(editorView, true);
            }
          }, 500);
          const t3 = setTimeout(() => {
            if (!editorView.isDestroyed) {
              heightCache.clear();
              schedule(editorView, true);
            }
          }, 1200);

          // 2. Re-measure as soon as document fonts are fully loaded & ready
          const onFontsReady = () => {
            if (!editorView.isDestroyed) {
              heightCache.clear();
              schedule(editorView, true);
            }
          };
          if (typeof document !== 'undefined' && document.fonts) {
            if (document.fonts.ready) {
              document.fonts.ready.then(onFontsReady).catch(() => {});
            }
            document.fonts.addEventListener?.('loadingdone', onFontsReady);
          }

          // 3. ResizeObserver on editor DOM to catch geometry changes (fonts, layout, images)
          let lastObservedWidth = 0;
          let lastObservedHeight = 0;
          const resizeObserver = typeof ResizeObserver !== 'undefined' && editorView.dom
            ? new ResizeObserver((entries) => {
                if (isPaginating) return;
                for (const entry of entries) {
                  const { width, height } = entry.contentRect || {};
                  if (Math.abs(width - lastObservedWidth) > 2 || Math.abs(height - lastObservedHeight) > 2) {
                    lastObservedWidth = width;
                    lastObservedHeight = height;
                    heightCache.clear();
                    schedule(editorView, true);
                  }
                }
              })
            : null;

          if (resizeObserver && editorView.dom) {
            resizeObserver.observe(editorView.dom);
          }

          // 4. Capture image loading events
          const onImgLoad = (e) => {
            if (e.target?.tagName === 'IMG' && !editorView.isDestroyed) {
              heightCache.clear();
              schedule(editorView, true);
            }
          };
          editorView.dom?.addEventListener('load', onImgLoad, true);

          // 5. Window resize listener
          const onWindowResize = () => {
            if (!editorView.isDestroyed) {
              heightCache.clear();
              schedule(editorView, true);
            }
          };
          window.addEventListener('resize', onWindowResize, { passive: true });

          // 6. UI Store subscription (page size, orientation, margin, columns, zoom)
          const storeUnsubscribe = useUIStore.subscribe((state, prevState) => {
            if (
              state.zoom !== prevState.zoom ||
              state.pageSize !== prevState.pageSize ||
              state.pageOrientation !== prevState.pageOrientation ||
              state.pageMargin !== prevState.pageMargin ||
              state.pageColumns !== prevState.pageColumns
            ) {
              // Page settings change: bust the entire height cache and force recalculation
              heightCache.clear();
              schedule(editorView, true);
            }
          });

          // 7. Document Store subscription (design changes, font family, line spacing, id switch)
          const docStoreUnsubscribe = useDocumentStore.subscribe((state, prevState) => {
            if (
              state.id !== prevState.id ||
              state.design !== prevState.design ||
              state.content !== prevState.content
            ) {
              heightCache.clear();
              schedule(editorView, true);
            }
          });

          return {
            update(view, prevState) {
              if (!view?.state) return;
              if (isPaginating) return;
              if (view.state.doc === prevState.doc) return;
              schedule(view);
            },
            destroy() {
              clearTimeout(debounceTimer);
              clearTimeout(t1);
              clearTimeout(t2);
              clearTimeout(t3);
              if (typeof document !== 'undefined' && document.fonts) {
                document.fonts.removeEventListener?.('loadingdone', onFontsReady);
              }
              if (resizeObserver) {
                resizeObserver.disconnect();
              }
              editorView.dom?.removeEventListener('load', onImgLoad, true);
              window.removeEventListener('resize', onWindowResize);
              storeUnsubscribe();
              docStoreUnsubscribe();
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
