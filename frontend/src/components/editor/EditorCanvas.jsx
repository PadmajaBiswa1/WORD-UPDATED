import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EditorContent } from '@tiptap/react';
import { useEditorSetup } from '@/hooks/useEditorSetup';
import { useThumbnailGenerator } from '@/hooks/useThumbnailGenerator';
import { useImageResizeAndDrag } from '@/hooks/useImageResizeAndDrag';
import { HorizontalRuler } from './HorizontalRuler';
import { FloatingFormatToolbar } from './FloatingFormatToolbar';
import { PictureFormatToolbar } from './PictureFormatToolbar';
import { InlinePragnaTrigger } from './InlinePragnaTrigger';
import { useUIStore, useDocumentStore, useCollaborationStore } from '@/store';
import { getLayoutMetrics, PAGE_GAP, PAGE_BORDER_WIDTH } from '@/utils/pageLayout';

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
  if (color && (design.pageColorMode === 'custom' || !isThemeDefaultPageColor(color))) {
    return color;
  }
  return color || 'var(--bg-page)';
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
  const { zoom, setActivePage, rulerVisible, pageSize, pageOrientation, pageMargin, pageColumns, watermarkText }  = useUIStore();
  const design = useDocumentStore((s) => s.design);
  const documentId = useDocumentStore((s) => s.id);
  const { setStats, headerFooter, setHeaderFooter } = useDocumentStore();
  const collaborators = useCollaborationStore((s) => s.collaborators);
  const sessionId = useCollaborationStore((s) => s.sessionId);
  const scale     = zoom / 100;
  const wrapRef   = useRef();
  const scrollRef = useRef();
  const contentScale = 1 / scale;
  const [pageCount, setPageCount] = useState(1);
  const [remoteCarets, setRemoteCarets] = useState([]);
  const [remoteSelections, setRemoteSelections] = useState([]);
  const overflowTimer = useRef(null);

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
    pageHeight: layoutMetrics.pageHeight * scale,
    pageWidth: layoutMetrics.pageWidth * scale,
    padding: layoutMetrics.padding * scale,
    naturalPadding: layoutMetrics.padding,
    pageGap: PAGE_GAP * scale,
    pageStep: (layoutMetrics.pageHeight + PAGE_GAP) * scale,
    contentHeight: Math.max(1, layoutMetrics.contentHeight - (PAGE_BORDER_WIDTH * 2)),
    scrollPaddingY: 40 * scale,
    scrollPaddingX: 20 * scale,
  }), [layoutMetrics, scale]);

  const recalcPages = useCallback(() => {
    clearTimeout(overflowTimer.current);
    overflowTimer.current = setTimeout(() => {
      const proseEl = wrapRef.current?.querySelector('.ProseMirror');
      if (!proseEl) return;
      const contentHeight = scaledDimensions.contentHeight || 1;
      const heightBased = Math.max(1, Math.min(500, Math.ceil(proseEl.scrollHeight / contentHeight)));
      const markerEls = wrapRef.current?.querySelectorAll('div[data-page-break="true"], .etherx-page-break');
      const markerCount = markerEls ? markerEls.length : 0;
      const pages = markerCount > 0 ? Math.max(1, Math.min(500, markerCount + 1)) : heightBased;
      const text = proseEl.innerText || '';
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      setPageCount(pages);
      setStats({ wordCount: words, charCount: text.length, pageCount: pages });
    }, 120);
  }, [setStats, scaledDimensions]);

  useEffect(() => {
    if (!editor) return;
    editor.on('update', recalcPages);
    return () => editor.off('update', recalcPages);
  }, [editor, recalcPages]);

  useEffect(() => {
    recalcPages();
  }, [recalcPages, zoom]);

  useEffect(() => {
    const page = wrapRef.current;
    if (!page || !design) return;
    const pageFill = getResolvedPageFill(design);
    const pageColorMode = pageFill === 'var(--bg-page)' ? 'theme' : 'custom';
    page.dataset.pageColorMode = pageColorMode;
    page.dataset.pageColor = pageColorMode === 'theme' ? getThemePageColor() : pageFill;
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
    const subtleColor = design.subtle || '#444444';
    const lineSpacing = String(design.spacing || '1.7');
    const paragraphGap = Math.max(0.35, ((Number(lineSpacing) || 1.7) - 1) * 0.62);

    document.documentElement.style.setProperty('--gold', accentColor);
    document.documentElement.style.setProperty('--design-heading', headingColor);
    document.documentElement.style.setProperty('--design-subtle', subtleColor);
    document.documentElement.style.setProperty('--design-heading-font', `'${headingFont}', serif`);
    document.documentElement.style.setProperty('--design-font', `'${bodyFont}', serif`);
    document.documentElement.style.setProperty('--design-spacing', lineSpacing);
    document.documentElement.style.setProperty('--design-paragraph-gap', `${paragraphGap.toFixed(2)}em`);

    const proseEl = page.querySelector('.ProseMirror');
    if (proseEl) {
      proseEl.style.fontFamily = `'${bodyFont}', serif`;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {rulerVisible && (
        <div id="etherx-ruler" style={{ borderBottom: '1px solid var(--border)', display: 'flex' }}>
          <HorizontalRuler />
        </div>
      )}
      <div
        ref={scrollRef}
        id="editor-scroll-area"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          background: 'var(--bg-app)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${scaledDimensions.scrollPaddingY}px ${scaledDimensions.scrollPaddingX}px`,
          scrollBehavior: 'smooth',
        }}
      >
        <div
          ref={wrapRef}
          id="document-page-0"
          style={{
            boxSizing: 'border-box',
            width: scaledDimensions.pageWidth,
            minHeight: Math.min(100000, scaledDimensions.pageStep * Math.max(1, pageCount) + scaledDimensions.pageGap),
            background: 'transparent',
            borderRadius: 2,
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
                  left: -scaledDimensions.padding,
                  width: `calc(100% + ${scaledDimensions.padding * 2}px)`,
                  height: scaledDimensions.pageHeight,
                  background: 'var(--etherx-page-fill, var(--bg-page))',
                  backgroundImage: 'var(--etherx-page-fill-image, none)',
                  borderRadius: 2,
                }}
              >
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
                  left: -scaledDimensions.padding,
                  width: `calc(100% + ${scaledDimensions.padding * 2}px)`,
                  height: scaledDimensions.pageGap,
                  background: 'transparent',
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
          <div style={{ position: 'relative', zIndex: 1, transform: `scale(${contentScale})`, transformOrigin: 'top left', width: `${100 * scale}%` }}>
            <EditorContent editor={editor} />
          </div>
          <FloatingFormatToolbar editor={editor} scrollContainerRef={scrollRef} />
          <PictureFormatToolbar editor={editor} scrollContainerRef={scrollRef} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
            {Array.from({ length: pageCount }).map((_, i) => (
              <div
                key={`page-frame-overlay-${i}`}
                data-etherx-page-surface="overlay"
                style={{
                  position: 'absolute',
                  top: i * scaledDimensions.pageStep,
                  left: -scaledDimensions.padding,
                  width: `calc(100% + ${scaledDimensions.padding * 2}px)`,
                  height: scaledDimensions.pageHeight,
                  background: 'transparent',
                  border: 'var(--etherx-page-border-width, 1px) var(--etherx-page-border-style, solid) var(--etherx-page-border-color, var(--page-border))',
                  boxShadow: 'var(--etherx-page-shadow, var(--shadow-page))',
                  borderRadius: 2,
                  boxSizing: 'border-box',
                }}
              />
            ))}
            {Array.from({ length: pageCount }).map((_, i) => (
              <div
                key={`page-index-${i}`}
                style={{
                  position: 'absolute',
                  top: i * scaledDimensions.pageStep + scaledDimensions.pageHeight - Math.max(24, scaledDimensions.padding * 0.25),
                  left: -scaledDimensions.padding,
                  right: -scaledDimensions.padding,
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
            ))}
            {headerFooter?.headerText ? Array.from({ length: pageCount }).map((_, i) => (
              <div key={`header-${i}`} style={{ position: 'absolute', top: i * scaledDimensions.pageStep + Math.max(16, scaledDimensions.padding * 0.22), left: 0, right: 0, textAlign: String(headerFooter.headerAlign || 'Center').toLowerCase(), fontSize: 10 * scale, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', pointerEvents: 'none', userSelect: 'none', borderBottom: '1px solid rgba(140,140,140,0.45)', paddingBottom: 6 }}>
                {headerFooter.headerText}
              </div>
            )) : null}
            {headerFooter?.footerText ? Array.from({ length: pageCount }).map((_, i) => (
              <div key={`footer-${i}`} style={{ position: 'absolute', top: i * scaledDimensions.pageStep + scaledDimensions.pageHeight - Math.max(32, scaledDimensions.padding * 0.3), left: 0, right: 0, textAlign: String(headerFooter.footerAlign || 'Center').toLowerCase(), fontSize: 10 * scale, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', pointerEvents: 'none', userSelect: 'none', borderTop: '1px solid rgba(140,140,140,0.45)', paddingTop: 6 }}>
                {headerFooter.footerText}
              </div>
            )) : null}
            {headerFooter?.pageNumberEnabled ? Array.from({ length: pageCount }).map((_, i) => {
              const [vpos, halign] = String(headerFooter.pageNumberStyle || 'bottom-center').split('-');
              const isTop = vpos === 'top';
              const pageNumber = Number(headerFooter.pageNumberStart || 1) + i;
              return (
                <div key={`pagenum-${i}`} style={{ position: 'absolute', top: isTop ? (i * scaledDimensions.pageStep + Math.max(32, scaledDimensions.padding * 0.3)) : (i * scaledDimensions.pageStep + scaledDimensions.pageHeight - Math.max(28, scaledDimensions.padding * 0.25)), left: 0, right: 0, textAlign: halign, fontSize: 10 * scale, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', pointerEvents: 'none', userSelect: 'none' }}>
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
  );
}