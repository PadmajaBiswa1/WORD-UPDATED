import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EditorContent } from '@tiptap/react';
import { useEditorSetup } from '@/hooks/useEditorSetup';
import { useThumbnailGenerator } from '@/hooks/useThumbnailGenerator';
import { useImageResizeAndDrag } from '@/hooks/useImageResizeAndDrag';
import { HorizontalRuler } from './HorizontalRuler';
import { FloatingFormatToolbar } from './FloatingFormatToolbar';
import { PictureFormatToolbar } from './PictureFormatToolbar';
import { TableResizeControls } from './TableResizeControls';
import { ImageCropModal } from './ImageCropModal';
import { ImageContextMenu } from './ImageContextMenu';
import { InlinePragnaTrigger } from './InlinePragnaTrigger';
import { PageSpread } from './PageSpread';
import { SidePane } from './SidePane';
import { useUIStore, useDocumentStore, useCollaborationStore } from '@/store';
import { getLayoutMetrics, PAGE_GAP, PAGE_BORDER_WIDTH } from '@/utils/pageLayout';
import { focusBelowBlockOrDocEnd } from '@/utils/editorCursorPlacement';
import { useNavigate, useLocation } from 'react-router-dom';
import { CanvasStartersView, CanvasStartersLightView } from '@/components/design/DesignViews';

const HEADER_FOOTER_STORAGE_KEY = 'etherx-header-footer-meta';
const THEME_DEFAULT_PAGE_COLORS = new Set(['#ffffff', '#fff', '#fdfbf7', '#1a1a1a']);

function normalizeColor(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isThemeDefaultPageColor(value) {
  return THEME_DEFAULT_PAGE_COLORS.has(normalizeColor(value));
}

function getThemePageColor() {
  return '#1a1a1a';
}

function getResolvedPageFill(design = {}) {
  const color = normalizeColor(design.pageColor);
  if (design.pageColorMode === 'custom' && color) {
    return color;
  }
  if (color && !isThemeDefaultPageColor(color)) {
    return color;
  }
  return 'var(--bg-page)';
}

function colorFromString(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    stroke: `hsl(${hue}, 75%, 45%)`,
    fill: `hsla(${hue}, 85%, 42%, 0.18)`,
  };
}

export function EditorCanvas() {
  const editor    = useEditorSetup();
  const { zoom, setActivePage, rulerVisible, gridlinesVisible, pageSize, pageOrientation, pageMargin, pageColumns, watermarkText }  = useUIStore();
  const design = useDocumentStore((s) => s.design);
  const documentTitle = useDocumentStore((s) => s.title);
  const documentId = useDocumentStore((s) => s.id);
  const { setStats, headerFooter, setHeaderFooter } = useDocumentStore();
  const collaborators = useCollaborationStore((s) => s.collaborators);
  const sessionId = useCollaborationStore((s) => s.sessionId);
  const scale     = zoom / 100;
  const wrapRef   = useRef();
  const scrollRef = useRef();
  const rulerContainerRef = useRef(null);
  const contentScale = 1 / scale;
  const [pageCount, setPageCount] = useState(1);
  const [remoteCarets, setRemoteCarets] = useState([]);
  const [remoteSelections, setRemoteSelections] = useState([]);
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, imgElement: null });
  const [cropModal, setCropModal] = useState({ isOpen: false, imgElement: null });
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const overflowTimer = useRef(null);
  const [docEmpty, setDocEmpty] = useState(true);

  useEffect(() => {
    if (!editor) return undefined;
    // 'transaction', not 'update': setContent (document load) does not emit update.
    const sync = () => setDocEmpty(editor.isEmpty);
    sync();
    editor.on('transaction', sync);
    return () => editor.off('transaction', sync);
  }, [editor]);

  // Line numbers and hyphenation are saved in the layout; draw them from it so
  // they show again after a reload or when another document opens.
  const lineNumbers = useDocumentStore((s) => Boolean(s.layout?.lineNumbers));
  const hyphenation = useDocumentStore((s) => Boolean(s.layout?.hyphenation));
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom;
    dom.classList.toggle('etherx-line-numbers', lineNumbers);
    dom.style.hyphens = hyphenation ? 'auto' : 'manual';
    dom.lang = hyphenation ? 'en' : '';
  }, [editor, lineNumbers, hyphenation]);

  // Read Mode is read-only, as in Word. Leaving it restores whatever editability
  // the document had, so a Restrict Editing lock survives a trip through Read Mode.
  const viewMode = useUIStore((s) => s.viewMode);
  const pageView = useUIStore((s) => s.pageView);
  const setPageView = useUIStore((s) => s.setPageView);
  const sidePane = useUIStore((s) => s.sidePane);
  const paneRatio = useUIStore((s) => s.paneRatio);
  useEffect(() => {
    if (!editor || viewMode !== 'read') return undefined;
    const wasEditable = editor.isEditable;
    editor.setEditable(false, false);
    return () => { if (!editor.isDestroyed) editor.setEditable(wasEditable, false); };
  }, [editor, viewMode]);

  useEffect(() => {
    const handleOpenContextMenu = (e) => {
      const { img, x, y } = e.detail || {};
      if (img) {
        setContextMenu({ isOpen: true, x: x || 100, y: y || 100, imgElement: img });
      }
    };

    const handleOpenCrop = (e) => {
      const img = e.detail?.img || editor?.view?.dom?.querySelector('.ProseMirror-selectednode img, img.ProseMirror-selectednode');
      if (img && editor) {
        // Capture the node's position so we can target it after focus is lost
        let pos = null;
        try {
          const sel = editor.state.selection;
          if (sel?.node?.type?.name === 'image') {
            pos = sel.from;
          } else {
            pos = editor.view.posAtDOM(img, 0);
          }
        } catch (_) { /* ignore */ }
        setCropModal({ isOpen: true, imgElement: img, pos });
      }
    };

    window.addEventListener('open-image-context-menu', handleOpenContextMenu);
    window.addEventListener('open-image-crop-modal', handleOpenCrop);

    return () => {
      window.removeEventListener('open-image-context-menu', handleOpenContextMenu);
      window.removeEventListener('open-image-crop-modal', handleOpenCrop);
    };
  }, [editor]);

  useEffect(() => {
    if (!documentId) return;
    try {
      const raw = window.localStorage.getItem(`${HEADER_FOOTER_STORAGE_KEY}:${documentId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setHeaderFooter(parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, [documentId, setHeaderFooter]);

  useThumbnailGenerator();
  useImageResizeAndDrag(editor, wrapRef);

  const layoutMetrics = useMemo(() => getLayoutMetrics({ size: pageSize, orientation: pageOrientation, margin: pageMargin }), [pageSize, pageOrientation, pageMargin]);

  const scaledDimensions = useMemo(() => ({
    pageHeight: layoutMetrics.pageHeight * (720 / 794) * scale,
    pageWidth: layoutMetrics.pageWidth * (720 / 794) * scale,
    padding: layoutMetrics.padding * (docEmpty ? (92 / 96) : (720 / 794)) * scale,
    naturalPadding: layoutMetrics.padding,
    pageGap: PAGE_GAP * scale,
    pageStep: (layoutMetrics.pageHeight * (720 / 794) + PAGE_GAP) * scale,
    contentHeight: Math.max(1, layoutMetrics.contentHeight - (PAGE_BORDER_WIDTH * 2)),
    scrollPaddingY: 12 * scale,
    scrollPaddingX: 20 * scale,
  }), [layoutMetrics, scale, docEmpty]);

  const borderMetrics = useMemo(() => {
    const isBorderConfigured = Boolean(
      design?.borderStyle &&
      design.borderStyle !== 'none' &&
      design?.borderSetting &&
      design.borderSetting !== 'none' &&
      design?.borderColor &&
      design.borderColor !== 'transparent'
    );
    const borderSides = design?.borderSides;
    const hasSides = isBorderConfigured && (borderSides
      ? Boolean(borderSides.top || borderSides.right || borderSides.bottom || borderSides.left)
      : true);
    const hasBorder = isBorderConfigured && hasSides;
    const activeSides = borderSides || { top: true, right: true, bottom: true, left: true };
    const borderWidthPx = hasBorder ? Math.max(1, Number(design.borderWidth || 2) * (96 / 72) * scale) : 0;
    const bStyle = design?.borderStyle || 'solid';
    const bColor = design?.borderColor || '#6f5320';
    const bInset = hasBorder
      ? Math.round(Math.max(14 * scale, Math.min(scaledDimensions.padding - borderWidthPx - 4, Number(design?.borderDistance ?? 24) * (96 / 72) * scale)))
      : 0;

    const topBorderEdge = (hasBorder && activeSides.top !== false) ? (bInset + borderWidthPx) : 0;
    const bottomBorderEdge = (hasBorder && activeSides.bottom !== false) ? (bInset + borderWidthPx) : 0;
    const leftBorderEdge = (hasBorder && activeSides.left !== false) ? (bInset + borderWidthPx) : 0;
    const rightBorderEdge = (hasBorder && activeSides.right !== false) ? (bInset + borderWidthPx) : 0;

    // Header top offset: sits safely inside the page, clearing the top border frame and properly spaced above body content
    const availableTopSpace = Math.max(16 * scale, scaledDimensions.padding - topBorderEdge);
    const headerTopOffset = topBorderEdge > 0
      ? Math.round(topBorderEdge + availableTopSpace * 0.25)
      : Math.max(Math.round(28 * scale), Math.round(scaledDimensions.padding * 0.40));

    // Footer offset from page bottom: sits safely inside the page, clearing the bottom border frame and properly spaced below body content
    const availableBottomSpace = Math.max(20 * scale, scaledDimensions.padding - bottomBorderEdge);
    const footerTopOffsetFromBottom = bottomBorderEdge > 0
      ? Math.round(bottomBorderEdge + availableBottomSpace * 0.55)
      : Math.max(Math.round(36 * scale), Math.round(scaledDimensions.padding * 0.55));

    // Horizontal margins to ensure header/footer stay comfortably inside both page margins and page borders
    const horizontalMargin = Math.max(
      scaledDimensions.padding,
      Math.max(leftBorderEdge, rightBorderEdge) + Math.round(12 * scale)
    );

    return {
      hasBorder,
      activeSides,
      borderWidthPx,
      bStyle,
      bColor,
      bInset,
      topBorderEdge,
      bottomBorderEdge,
      headerTopOffset,
      footerTopOffsetFromBottom,
      horizontalMargin,
    };
  }, [design, scale, scaledDimensions.padding]);

  const recalcPages = useCallback(() => {
    clearTimeout(overflowTimer.current);
    overflowTimer.current = setTimeout(() => {
      const proseEl = wrapRef.current?.querySelector('.ProseMirror');
      if (!proseEl) return;
      const markerEls = wrapRef.current?.querySelectorAll('div[data-page-break="true"], .etherx-page-break');
      const markerCount = markerEls ? markerEls.length : 0;
      let pages = markerCount + 1;

      // Check if trailing content overflows beyond the current page count
      const lastChild = proseEl.lastElementChild;
      if (lastChild) {
        const proseRect = proseEl.getBoundingClientRect();
        // Bottom of the content in layout px: the editor is CSS-scaled, so screen
        // px are converted with its rendered-to-layout ratio. The bottom of the
        // whole editor counts too: with page columns the last block can sit in an
        // earlier column than the tallest one.
        const ratio = proseEl.offsetHeight ? proseRect.height / proseEl.offsetHeight : 1;
        const lastBottom = Math.max(lastChild.getBoundingClientRect().bottom - proseRect.top, proseRect.height, proseEl.scrollHeight * (ratio || 1)) / (ratio || 1);
        const pageStep = layoutMetrics.pageHeight + PAGE_GAP;
        const contentHeight = layoutMetrics.contentHeight;
        const currentLimit = (pages - 1) * pageStep + contentHeight;
        if (lastBottom > currentLimit + 10) {
          pages += Math.max(1, Math.ceil((lastBottom - currentLimit) / pageStep));
        }
      }

      pages = Math.max(1, Math.min(500, pages));
      const text = proseEl.innerText || '';
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      setPageCount(pages);
      setStats({ wordCount: words, charCount: text.length, pageCount: pages });
    }, 120);
  }, [setStats, layoutMetrics, scale]);

  useEffect(() => {
    if (!editor) return;
    editor.on('update', recalcPages);
    const frame = requestAnimationFrame(recalcPages);
    // Content height also changes without document edits (pagination spacers, images loading).
    const proseEl = wrapRef.current?.querySelector('.ProseMirror');
    const resizeObserver = proseEl && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recalcPages) : null;
    resizeObserver?.observe(proseEl);
    return () => {
      cancelAnimationFrame(frame);
      editor.off('update', recalcPages);
      resizeObserver?.disconnect();
    };
  }, [editor, recalcPages]);

  useEffect(() => {
    recalcPages();

    if (typeof document !== 'undefined' && document.fonts) {
      if (document.fonts.ready) {
        document.fonts.ready.then(recalcPages).catch(() => {});
      }
      document.fonts.addEventListener?.('loadingdone', recalcPages);
      return () => {
        document.fonts.removeEventListener?.('loadingdone', recalcPages);
      };
    }
  }, [recalcPages, zoom]);

  useEffect(() => {
    const page = wrapRef.current;
    if (!page || !design) return;
    const pageFill = getResolvedPageFill(design);
    const isTheme = pageFill === 'var(--bg-page)' || pageFill === '#1a1a1a';
    const pageColorMode = isTheme ? 'theme' : (design.pageColorMode || 'custom');
    page.dataset.pageColorMode = pageColorMode;
    page.dataset.pageColor = isTheme ? getThemePageColor() : pageFill;
    page.style.setProperty('--etherx-page-fill', pageFill);
    page.style.setProperty('--etherx-page-fill-image', design.pageFillImage || 'none');
    page.style.setProperty('--etherx-page-border-style', design.borderStyle || 'solid');
    page.style.setProperty('--etherx-page-border-color', design.borderColor || 'transparent');
    page.style.setProperty('--etherx-page-border-width', `${Number(design.borderWidth ?? 1)}px`);
    page.style.setProperty('--etherx-page-shadow', design.pageShadow || 'var(--shadow-page)');

    const headingFont = design.headingFont || design.font || 'Crimson Pro';
    const bodyFont = design.bodyFont || design.font || 'Crimson Pro';
    const accentColor = design.accent || '#c9a84c';
    const headingColor = design.heading || accentColor;
    // The stored defaults mean "default ink": follow the paper (--text-doc is set per UI theme).
    const DEFAULT_INK = ['#444444', '#f5f1e8'];
    const subtleColor = design.subtle && !DEFAULT_INK.includes(String(design.subtle).toLowerCase()) ? design.subtle : 'var(--text-doc)';
    const lineSpacing = String(design.spacing || '1.7');
    const paragraphGap = Math.max(0.35, ((Number(lineSpacing) || 1.7) - 1) * 0.62);

    page.style.setProperty('--design-heading', headingColor);
    page.style.setProperty('--design-subtle', subtleColor);
    page.style.setProperty('--design-heading-font', `'${headingFont}', serif`);
    page.style.setProperty('--design-font', `'${bodyFont}', serif`);
    page.style.setProperty('--design-spacing', lineSpacing);
    page.style.setProperty('--design-paragraph-gap', `${paragraphGap.toFixed(2)}em`);

    const proseEl = page.querySelector('.ProseMirror');
    if (proseEl) {
      proseEl.style.fontFamily = `'${bodyFont}', serif`;
      proseEl.style.fontSize = `${Number(design.fontSize) || 12}pt`;
      proseEl.style.lineHeight = lineSpacing;
      proseEl.style.setProperty('--design-paragraph-gap', `${paragraphGap.toFixed(2)}em`);
      proseEl.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
        h.style.fontFamily = `'${headingFont}', serif`;
        h.style.color = headingColor;
      });
    }

    if (design.effect === 'soft') {
      page.style.filter = 'contrast(1.02) saturate(1.03)';
    } else if (design.effect === 'strong') {
      page.style.filter = 'contrast(1.08) saturate(1.10)';
    } else {
      page.style.filter = '';
    }
  }, [design]);

  useEffect(() => {
    const onResize = () => recalcPages();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recalcPages]);

  useEffect(() => {
    if (!editor || !wrapRef.current) {
      setRemoteCarets([]);
      setRemoteSelections([]);
      return undefined;
    }
    const syncRemoteCarets = () => {
      const container = wrapRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const docSize = editor.state.doc.content.size;
      const nextCarets = collaborators
        .filter((person) => person?.sessionId && person.sessionId !== sessionId)
        .map((person) => {
          const rawCursor = Number(person?.cursor?.cursor ?? person?.cursor);
          if (!Number.isFinite(rawCursor)) return null;
          const safePos = Math.max(1, Math.min(docSize, Math.floor(rawCursor)));
          try {
            const coords = editor.view.coordsAtPos(safePos);
            const palette = colorFromString(person.sessionId || person.name || 'user');
            return { id: person.sessionId, name: person.name || 'Guest', top: coords.top - containerRect.top, left: coords.left - containerRect.left, stroke: palette.stroke, fill: palette.fill };
          } catch { return null; }
        })
        .filter(Boolean);
      const nextSelections = collaborators
        .filter((person) => person?.sessionId && person.sessionId !== sessionId)
        .map((person) => {
          const rawFrom = Number(person?.cursor?.from);
          const rawTo = Number(person?.cursor?.to);
          if (!Number.isFinite(rawFrom) || !Number.isFinite(rawTo)) return null;
          const from = Math.max(1, Math.min(docSize, Math.floor(rawFrom)));
          const to = Math.max(1, Math.min(docSize, Math.floor(rawTo)));
          if (from === to) return null;
          const start = Math.min(from, to);
          const end = Math.max(from, to);
          try {
            const fromDOM = editor.view.domAtPos(start);
            const toDOM = editor.view.domAtPos(end);
            const range = document.createRange();
            range.setStart(fromDOM.node, fromDOM.offset);
            range.setEnd(toDOM.node, toDOM.offset);
            const palette = colorFromString(person.sessionId || person.name || 'user');
            const rects = Array.from(range.getClientRects());
            if (!rects.length) return null;
            return rects.map((rect, index) => ({ id: `${person.sessionId}-${start}-${end}-${index}`, top: rect.top - containerRect.top, left: rect.left - containerRect.left, width: Math.max(2, rect.width), height: Math.max(12, rect.height), fill: palette.fill, stroke: palette.stroke }));
          } catch { return null; }
        })
        .flat()
        .filter(Boolean);
      setRemoteCarets(nextCarets);
      setRemoteSelections(nextSelections);
    };
    syncRemoteCarets();
    editor.on('selectionUpdate', syncRemoteCarets);
    editor.on('update', syncRemoteCarets);
    const onWindowResize = () => syncRemoteCarets();
    window.addEventListener('resize', onWindowResize);
    const scrollEl = scrollRef.current;
    if (scrollEl) scrollEl.addEventListener('scroll', syncRemoteCarets, { passive: true });
    return () => {
      editor.off('selectionUpdate', syncRemoteCarets);
      editor.off('update', syncRemoteCarets);
      window.removeEventListener('resize', onWindowResize);
      if (scrollEl) scrollEl.removeEventListener('scroll', syncRemoteCarets);
    };
  }, [collaborators, editor, sessionId]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const onScroll = () => {
      if (rulerContainerRef.current) {
        rulerContainerRef.current.scrollLeft = scrollEl.scrollLeft;
      }
      const approx = Math.floor((scrollEl.scrollTop + scaledDimensions.pageHeight * 0.35) / scaledDimensions.pageStep);
      const clamped = Math.max(0, Math.min(pageCount - 1, approx));
      setActivePage(clamped);
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [scaledDimensions.pageHeight, scaledDimensions.pageStep, pageCount, setActivePage]);

  useEffect(() => {
    return () => clearTimeout(overflowTimer.current);
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const updateScrollbar = () => {
      const sbWidth = Math.max(0, scrollEl.offsetWidth - scrollEl.clientWidth);
      setScrollbarWidth(sbWidth);
    };
    updateScrollbar();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateScrollbar);
      ro.observe(scrollEl);
    }
    window.addEventListener('resize', updateScrollbar);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateScrollbar);
    };
  }, [rulerVisible, pageCount, zoom]);

  const handlePaperClick = useCallback((e) => {
    if (!editor?.isEditable) return;

    if (
      e.target.closest(
        'button, input, select, textarea, [data-resize-handle], .picture-format-toolbar, .floating-format-toolbar, [role="dialog"], [role="menu"], [data-picture-format-toolbar="true"]'
      )
    ) {
      return;
    }

    if (e.target.tagName === 'IMG' || e.target.closest('td, th')) {
      return;
    }

    const textBlock = e.target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    if (textBlock && textBlock.textContent.trim().length > 0) {
      return;
    }

    focusBelowBlockOrDocEnd(editor, e.clientX, e.clientY);
  }, [editor]);

  const handlePaperMouseDown = useCallback((e) => {
    if (!editor?.isEditable) return;

    if (
      e.target.closest(
        '.ProseMirror, button, input, select, textarea, [data-resize-handle], .picture-format-toolbar, .floating-format-toolbar, [role="dialog"], [role="menu"]'
      )
    ) {
      return;
    }

    e.preventDefault();
    focusBelowBlockOrDocEnd(editor, e.clientX, e.clientY);
  }, [editor]);

  return (
    <div className="studio-canvas" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative', paddingRight: sidePane ? `${(1 - paneRatio) * 100}%` : 0 }}>
      <TableResizeControls editor={editor} scrollContainerRef={scrollRef} />
      {rulerVisible && (
        <div
          ref={rulerContainerRef}
          id="etherx-ruler"
          style={{
            background: 'var(--t1)',
            overflowX: 'hidden',
            overflowY: 'hidden',
            width: '100%',
            height: 42,
            flexShrink: 0,
            boxSizing: 'border-box',
            paddingRight: scrollbarWidth,
          }}
        >
          <div
            id="editor-ruler-align-wrapper"
            style={{
              minWidth: '100%',
              width: 'max-content',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: `20px ${scaledDimensions.scrollPaddingX}px 0`,
              boxSizing: 'border-box',
            }}
          >
            <HorizontalRuler pageWidth={scaledDimensions.pageWidth} />
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        id="editor-scroll-area"
        onClick={(e) => {
          if (e.target === scrollRef.current) {
            handlePaperClick(e);
          }
        }}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          backgroundColor: 'var(--t1,#0e0e10)',
          backgroundImage: 'radial-gradient(rgba(var(--ink,255,255,255),0.04) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          scrollBehavior: 'smooth',
        }}
      >
        <div
          id="editor-canvas-align-wrapper"
          onClick={(e) => {
            if (e.target.id === 'editor-canvas-align-wrapper') {
              handlePaperClick(e);
            }
          }}
          style={{
            minWidth: '100%',
            width: 'max-content',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: `${scaledDimensions.scrollPaddingY}px ${scaledDimensions.scrollPaddingX}px`,
            boxSizing: 'border-box',
          }}
        >
          <div
            ref={wrapRef}
            id="document-page-0"
            onClick={handlePaperClick}
            onMouseDown={handlePaperMouseDown}
            style={{
              boxSizing: 'border-box',
              width: scaledDimensions.pageWidth,
              minHeight: Math.min(100000, Math.max(scaledDimensions.pageHeight, (pageCount - 1) * scaledDimensions.pageStep + scaledDimensions.pageHeight)),
              background: 'transparent',
              borderRadius: 3,
              '--etherx-page-fill': 'var(--bg-page)',
              '--etherx-page-border-width': '1px',
              '--etherx-page-border-style': 'solid',
              '--etherx-page-border-color': 'var(--page-border)',
              '--etherx-page-shadow': 'var(--shadow-page)',
              '--etherx-page-content-height': `${scaledDimensions.contentHeight}px`,
              padding: `${scaledDimensions.padding}px`,
              position: 'relative',
              isolation: 'isolate',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              overflowX: 'hidden',
              transition: 'all 0.15s ease-out',
            }}
          >
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
              {Array.from({ length: pageCount }).map((_, i) => (
                <div
                  key={`page-frame-bg-${i}`}
                  data-etherx-page-frame="true"
                  data-etherx-page-surface="background"
                  style={{
                    position: 'absolute',
                    top: i * scaledDimensions.pageStep,
                    left: 0,
                    width: '100%',
                    height: scaledDimensions.pageHeight,
                    background: 'var(--etherx-page-fill, var(--bg-page))',
                    backgroundImage: 'var(--etherx-page-fill-image, none)',
                    border: '1px solid var(--page-border)',
                    boxShadow: 'var(--etherx-page-shadow, var(--shadow-page))',
                    borderRadius: 2,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  {/* Gridlines Overlay */}
                  {gridlinesVisible && (
                    <div
                      data-etherx-gridlines="true"
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        zIndex: 1,
                        backgroundImage: `
                          linear-gradient(to right, rgba(201, 168, 76, 0.16) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(201, 168, 76, 0.16) 1px, transparent 1px)
                        `,
                        backgroundSize: `${20 * scale}px ${20 * scale}px`,
                      }}
                    />
                  )}
                  {/* Inward Decorative Page Border (Word-style) */}
                  {borderMetrics.hasBorder && (
                    <div
                      data-etherx-page-border="true"
                      style={{
                        position: 'absolute',
                        top: borderMetrics.bInset,
                        left: borderMetrics.bInset,
                        right: borderMetrics.bInset,
                        bottom: borderMetrics.bInset,
                        maxWidth: '100%',
                        maxHeight: '100%',
                        pointerEvents: 'none',
                        borderTop: borderMetrics.activeSides.top !== false ? `${borderMetrics.borderWidthPx}px ${borderMetrics.bStyle} ${borderMetrics.bColor}` : 'none',
                        borderRight: borderMetrics.activeSides.right !== false ? `${borderMetrics.borderWidthPx}px ${borderMetrics.bStyle} ${borderMetrics.bColor}` : 'none',
                        borderBottom: borderMetrics.activeSides.bottom !== false ? `${borderMetrics.borderWidthPx}px ${borderMetrics.bStyle} ${borderMetrics.bColor}` : 'none',
                        borderLeft: borderMetrics.activeSides.left !== false ? `${borderMetrics.borderWidthPx}px ${borderMetrics.bStyle} ${borderMetrics.bColor}` : 'none',
                        boxSizing: 'border-box',
                        boxShadow: design?.borderSetting === 'shadow'
                          ? `${Math.max(2, Math.round(3 * scale))}px ${Math.max(2, Math.round(3 * scale))}px 0px rgba(0,0,0,0.35)`
                          : (design?.borderSetting === '3d' ? 'inset 1px 1px 0px rgba(255,255,255,0.4), 1px 1px 0px rgba(0,0,0,0.25)' : 'none'),
                        borderRadius: 1,
                      }}
                    />
                  )}
                {(design?.watermark || watermarkText) && (
                  <div
                    data-etherx-watermark="true"
                    style={{
                      position: 'absolute',
                      top: '45%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-28deg)',
                      fontSize: `${78 * scale}px`,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      opacity: 0.11,
                      color: '#6f5320',
                      pointerEvents: 'none',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {design?.watermark || watermarkText}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
            {Array.from({ length: Math.max(0, pageCount - 1) }).map((_, i) => (
              <div
                key={`page-gap-${i}`}
                style={{
                  position: 'absolute',
                  top: i * scaledDimensions.pageStep + scaledDimensions.pageHeight,
                  left: 0,
                  width: '100%',
                  height: scaledDimensions.pageGap,
                  background: 'var(--bg-app)',
                }}
              />
            ))}
          </div>
          {Array.from({ length: pageCount }).map((_, i) => (
            <div
              key={`anchor-${i}`}
              id={`document-page-${i}`}
              data-etherx-page-anchor="true"
              style={{ position: 'absolute', top: i * scaledDimensions.pageStep, left: 0, width: 1, height: 1, pointerEvents: 'none' }}
            />
          ))}
          <div style={{ position: 'relative', zIndex: 1, transform: `scale(${docEmpty ? contentScale : scale * (720 / 794)})`, transformOrigin: 'top left', width: `${docEmpty ? 100 * scale : 100 / (scale * (720 / 794))}%`, minHeight: scaledDimensions.contentHeight }}>
            {docEmpty && <div className="reference-empty-title" aria-hidden="true">{documentTitle || 'Untitled Document'}</div>}
            <EditorContent editor={editor} />
            {docEmpty && <EmptyPageStarters editor={editor} />}
          </div>
          {viewMode !== 'read' && <FloatingFormatToolbar editor={editor} scrollContainerRef={scrollRef} />}
          {viewMode !== 'read' && <PictureFormatToolbar editor={editor} scrollContainerRef={scrollRef} />}
          <ImageContextMenu
            isOpen={contextMenu.isOpen}
            x={contextMenu.x}
            y={contextMenu.y}
            imgElement={contextMenu.imgElement}
            onClose={() => setContextMenu({ isOpen: false, x: 0, y: 0, imgElement: null })}
            editor={editor}
            onOpenCrop={(img) => setCropModal({ isOpen: true, imgElement: img })}
          />
          <ImageCropModal
            isOpen={cropModal.isOpen}
            imgElement={cropModal.imgElement}
            onClose={() => setCropModal({ isOpen: false, imgElement: null, pos: null })}
            onApplyCrop={(dataUrl, width, height) => {
              if (editor) {
                const pos = cropModal.pos;
                let chain = editor.chain();
                if (pos != null) {
                  chain = chain.setNodeSelection(pos);
                } else {
                  chain = chain.focus();
                }
                chain.updateAttributes('image', {
                  src: dataUrl,
                  width: String(width),
                  height: String(height),
                  style: `width:${width}px;height:${height}px`,
                }).run();
                useUIStore.getState().toast('Image cropped successfully', 'success');
              }
            }}
          />
          {docEmpty && !headerFooter?.headerText && (
            <button
              className="reference-header-hint"
              type="button"
              onDoubleClick={() => { useUIStore.getState().setHeaderFooterTab('header'); useUIStore.getState().openDialog('headerFooter'); }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  useUIStore.getState().setHeaderFooterTab('header');
                  useUIStore.getState().openDialog('headerFooter');
                }
              }}
            >Double-click to add a header</button>
          )}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
            {(!headerFooter?.footerText && !headerFooter?.pageNumberEnabled) ? Array.from({ length: pageCount }).map((_, i) => (
              <div
                key={`page-index-${i}`}
                style={{
                  position: 'absolute',
                  top: i * scaledDimensions.pageStep + scaledDimensions.pageHeight - borderMetrics.footerTopOffsetFromBottom + Math.round(6 * scale),
                  left: borderMetrics.horizontalMargin,
                  right: borderMetrics.horizontalMargin,
                  boxSizing: 'border-box',
                  textAlign: 'center',
                  fontSize: 10 * scale,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {i + 1}
              </div>
            )) : null}
            {headerFooter?.headerText ? Array.from({ length: pageCount }).map((_, i) => (
              <div
                key={`header-${i}`}
                style={{
                  position: 'absolute',
                  top: i * scaledDimensions.pageStep + borderMetrics.headerTopOffset,
                  left: borderMetrics.horizontalMargin,
                  right: borderMetrics.horizontalMargin,
                  boxSizing: 'border-box',
                  textAlign: String(headerFooter.headerAlign || 'Center').toLowerCase(),
                  fontSize: 10 * scale,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {headerFooter.headerText}
              </div>
            )) : null}
            {headerFooter?.footerText ? Array.from({ length: pageCount }).map((_, i) => (
              <div
                key={`footer-${i}`}
                style={{
                  position: 'absolute',
                  top: i * scaledDimensions.pageStep + scaledDimensions.pageHeight - borderMetrics.footerTopOffsetFromBottom,
                  left: borderMetrics.horizontalMargin,
                  right: borderMetrics.horizontalMargin,
                  boxSizing: 'border-box',
                  textAlign: String(headerFooter.footerAlign || 'Center').toLowerCase(),
                  fontSize: 10 * scale,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {headerFooter.footerText}
              </div>
            )) : null}
            {headerFooter?.pageNumberEnabled ? Array.from({ length: pageCount }).map((_, i) => {
              const [vpos, halign] = String(headerFooter.pageNumberStyle || 'bottom-center').split('-');
              const isTop = vpos === 'top';
              const pageNumber = Number(headerFooter.pageNumberStart || 1) + i;
              return (
                <div
                  key={`pagenum-${i}`}
                  style={{
                    position: 'absolute',
                    top: isTop
                      ? (i * scaledDimensions.pageStep + borderMetrics.headerTopOffset)
                      : (i * scaledDimensions.pageStep + scaledDimensions.pageHeight - borderMetrics.footerTopOffsetFromBottom + Math.round(6 * scale)),
                    left: borderMetrics.horizontalMargin,
                    right: borderMetrics.horizontalMargin,
                    boxSizing: 'border-box',
                    textAlign: halign,
                    fontSize: 10 * scale,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-ui)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  Page {pageNumber}
                </div>
              );
            }) : null}
          </div>
          {remoteSelections.map((selection) => (
            <div key={selection.id} style={{ position: 'absolute', top: selection.top, left: selection.left, width: selection.width, height: selection.height, borderRadius: 3, background: selection.fill, outline: `1px solid ${selection.stroke}`, pointerEvents: 'none', zIndex: 6 }} />
          ))}
          {remoteCarets.map((caret) => (
            <div key={caret.id} style={{ position: 'absolute', top: caret.top, left: caret.left, width: 1, pointerEvents: 'none', zIndex: 8 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 20, background: caret.stroke, borderRadius: 1, boxShadow: `0 0 0 1px ${caret.fill}` }} />
              <div style={{ position: 'absolute', top: -18, left: 0, transform: 'translateX(-4px)', padding: '1px 6px', borderRadius: 999, fontFamily: 'var(--font-ui)', fontSize: 10, whiteSpace: 'nowrap', color: '#111', background: caret.stroke, border: `1px solid ${caret.stroke}` }}>
                {caret.name}
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
      {sidePane && (
        <SidePane pane={sidePane} source={wrapRef.current} editor={editor} mainScroll={scrollRef.current} pageWidth={scaledDimensions.pageWidth} />
      )}
      {/* After the editor in the DOM, so querySelector('.ProseMirror') still finds
          the live editor rather than a page copy. */}
      {pageView && (
        <PageSpread
          mode={pageView}
          source={wrapRef.current}
          editor={editor}
          pageCount={pageCount}
          pageWidth={scaledDimensions.pageWidth}
          pageHeight={scaledDimensions.pageHeight}
          pageStep={scaledDimensions.pageStep}
          onExit={() => setPageView(null)}
          onPick={(index) => {
            setPageView(null);
            requestAnimationFrame(() => {
              const scroll = scrollRef.current;
              if (!scroll || !wrapRef.current) return;
              const pageTop = wrapRef.current.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
              scroll.scrollTo({ top: pageTop + index * scaledDimensions.pageStep - 12, behavior: 'auto' });
              editor?.commands.focus();
            });
          }}
        />
      )}
    </div>
  );
}
const OUTLINE = [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Introduction' }] },
  { type: 'paragraph' },
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Main points' }] },
  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'First point' }] },
  { type: 'paragraph' },
  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Second point' }] },
  { type: 'paragraph' },
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Conclusion' }] },
  { type: 'paragraph' },
];

// "Or start with" cards the design shows under an empty page.
function EmptyPageStarters({ editor }) {
  const navigate = useNavigate();
  const location = useLocation();
  const openPragna = useUIStore((s) => s.openPragna);
  const openDialog = useUIStore((s) => s.openDialog);
  const light = typeof document !== 'undefined' && document.documentElement.getAttribute('data-ui-theme') === 'light';
  const v = {
    starters: [
      ['sparkles', 'Draft with Pragna', 'Describe it, get a first draft', () => openPragna('ask', 'Draft: ')],
      ['layout-template', 'Use a template', 'Letter, resume, proposal…', () => navigate('/home', { state: { returnTo: location.pathname, menu: 'new' } })],
      ['upload', 'Import a file', '.docx, .pdf, .md', () => openDialog('importDocx')],
      ['list-tree', 'Add an outline', 'Headings to fill in', () => editor?.chain().focus().setContent(OUTLINE).setTextSelection(1).run()],
    ].map(([icon, title, text, run]) => ({ key: title, icon, title, text, run })),
  };
  // Clicks here must not reach the page's click-to-focus handler.
  return (
    <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} contentEditable={false} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {light ? <CanvasStartersLightView v={v} /> : <CanvasStartersView v={v} />}
    </div>
  );
}
