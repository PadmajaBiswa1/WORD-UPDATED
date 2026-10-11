import { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useUIStore, useDocumentStore, useEditorStore } from '@/store';
import { getLayoutMetrics, PAGE_GAP } from '@/utils/pageLayout';

// Shared style string for thumbnail rendering - MUST match EditorCanvas/ProseMirror styles exactly
const THUMBNAIL_STYLES = `
  position: fixed;
  top: -9999px;
  left: -9999px;
  width: ${0}px;
  min-height: ${0}px;
  padding: ${0}px;
  background: #1a1a1a;
  color: #e8e0d0;
  font-family: 'Crimson Pro', Georgia, serif;
  font-size: 12pt;
  line-height: 1.7;
  overflow: hidden;
  word-wrap: break-word;
  box-sizing: border-box;
`;

const THUMB_LEAF_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, pre, img';

// Single source of truth: get page content from live editor DOM split by page height
function splitEditorContentByPage(pageCount, metrics, zoom) {
  const count = Math.max(1, pageCount);
  const pages = Array.from({ length: count }, (_, i) => ({ index: i, html: '' }));
  
  const proseMirror = document.querySelector('#editor-scroll-area .ProseMirror') || document.querySelector('.ProseMirror');
  if (!proseMirror) return pages;
  
  const rawText = proseMirror.innerText?.trim();
  if (!rawText && !proseMirror.querySelector('img, table, svg')) {
    return pages;
  }

  const scale = (zoom || 100) / 100;
  const pageStep = (metrics.pageHeight + PAGE_GAP) * scale;
  const children = Array.from(proseMirror.children);

  // Each page shows every block overlapping its text area, at its real offset and clipped, so a
  // table or list split across pages appears on each page it covers.
  const items = Array.from({ length: count }, () => []);
  children.forEach((child) => {
    if (child.dataset?.pageBreak === 'true' || child.classList.contains('etherx-page-break')) {
      return;
    }
    const top = child.offsetTop;
    const bottom = top + child.offsetHeight;
    // The wrapper starts a new formatting context, so the block's own top margin would add again.
    const marginTop = parseFloat(window.getComputedStyle(child).marginTop) || 0;
    const first = Math.max(0, Math.min(Math.floor(top / (pageStep || 1)), count - 1));
    const last = Math.max(first, Math.min(Math.floor(Math.max(top, bottom - 1) / (pageStep || 1)), count - 1));
    if (first === last) {
      items[first].push({ html: child.outerHTML, top: (top - first * pageStep) / scale - marginTop });
      return;
    }

    // A block spanning pages (a long table or list): drawing the whole block for every page is
    // slow, so each page gets only the paragraphs that fall on it, placed at their exact position.
    const pmRect = proseMirror.getBoundingClientRect();
    const ratio = pmRect.height / (proseMirror.offsetHeight || 1) || 1;
    Array.from(child.querySelectorAll(THUMB_LEAF_SELECTOR)).forEach((leaf) => {
      if (leaf.parentElement?.closest(THUMB_LEAF_SELECTOR)) return; // drawn with its paragraph
      const rect = leaf.getBoundingClientRect();
      const leafTop = (rect.top - pmRect.top) / ratio;
      const page = Math.floor(leafTop / (metrics.pageHeight + PAGE_GAP));
      if (page < first || page > last || !rect.height) return;
      const leafMargin = parseFloat(window.getComputedStyle(leaf).marginTop) || 0;
      items[page].push({
        html: leaf.outerHTML,
        top: leafTop - page * (metrics.pageHeight + PAGE_GAP) - leafMargin,
        left: (rect.left - pmRect.left) / ratio,
        width: rect.width / ratio,
      });
    });
  });

  items.forEach((list, index) => {
    if (!list.length) return;
    pages[index].html = `<div style="position:relative;height:${metrics.contentHeight}px;overflow:hidden">${
      list.map(({ html, top, left, width }) => (width
        ? `<div style="position:absolute;left:${left}px;width:${width}px;top:${top}px">${html}</div>`
        : `<div style="position:absolute;left:0;right:0;top:${top}px">${html}</div>`)).join('')
    }</div>`;
  });

  return pages;
}

async function renderContentToThumbnail(htmlContent, pageWidth, pageHeight, padding, theme = {}) {
  if (!htmlContent || htmlContent.trim() === '' || htmlContent === '<p></p>') {
    return null;
  }

  const bgColor = theme.bgColor || '#1a1a1a';
  const textColor = theme.textColor || '#F5F1E8';
  const fontFamily = theme.fontFamily || "'Crimson Pro', Georgia, serif";
  const headingColor = theme.headingColor || '#d4af37';

  return new Promise((resolve) => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: ${pageWidth}px;
        min-height: ${pageHeight}px;
        padding: ${padding}px;
        background: ${bgColor};
        color: ${textColor};
        font-family: ${fontFamily};
        font-size: 12pt;
        line-height: 1.7;
        overflow: hidden;
        word-wrap: break-word;
        box-sizing: border-box;
      `;
      tempDiv.innerHTML = `
        <style>
          .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4 { color: ${headingColor}; }
          .ProseMirror table { border-collapse: collapse; width: 100%; }
        </style>
        <div class="ProseMirror">${htmlContent}</div>
      `;
      document.body.appendChild(tempDiv);

      setTimeout(async () => {
        try {
          const canvas = await html2canvas(tempDiv, {
            width: pageWidth,
            height: pageHeight,
            scale: 0.25,
            backgroundColor: bgColor,
            logging: false,
            useCORS: true,
            allowTaint: true,
            // Only the thumbnail page needs cloning, not the live editor and the rest of the app.
            ignoreElements: (el) => document.body.contains(el) && el !== document.body
              && !el.contains(tempDiv) && !tempDiv.contains(el),
          });
          const dataUrl = canvas.toDataURL('image/png', 0.8);
          if (document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
          resolve(dataUrl);
        } catch (err) {
          console.error('Error rendering thumbnail:', err);
          if (document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
          resolve(null);
        }
      }, 50);
    } catch (err) {
      console.error('Error creating thumbnail:', err);
      resolve(null);
    }
  });
}

export function useThumbnailGenerator() {
  const editor = useEditorStore((s) => s.editor);
  const { pageSize, pageOrientation, pageMargin, zoom } = useUIStore();
  const { setThumbnail, pageCount } = useDocumentStore();
  const updateTimer = useRef(null);
  const isRendering = useRef(false);
  const lastContentHash = useRef('');

  const metrics = getLayoutMetrics({ size: pageSize, orientation: pageOrientation, margin: pageMargin });

  useEffect(() => {
    if (!editor) return;

    const updateThumbnails = () => {
      clearTimeout(updateTimer.current);
      updateTimer.current = setTimeout(async () => {
        try {
          const fullHTML = editor.getHTML() || '<p></p>';
          const contentHash = fullHTML.slice(0, 500) + fullHTML.slice(-500) + `_p${pageCount}`;
          
          if (lastContentHash.current === contentHash) return;
          if (isRendering.current) return;
          isRendering.current = true;
          lastContentHash.current = contentHash;

          const design = useDocumentStore.getState().design || {};
          const theme = {
            bgColor: design.pageFill || '#1a1a1a',
            textColor: '#e8e0d0',
            fontFamily: design.bodyFont || design.font || "'Crimson Pro', Georgia, serif",
            headingColor: design.heading || design.accent || '#d4af37',
          };

          const pages = splitEditorContentByPage(pageCount, metrics, zoom);

          for (const page of pages) {
            if (!page.html || page.html.trim() === '' || page.html === '<p></p>') {
              setThumbnail(page.index, null);
              continue;
            }
            const thumbnail = await renderContentToThumbnail(
              page.html,
              metrics.pageWidth,
              metrics.pageHeight,
              metrics.padding,
              theme
            );
            setThumbnail(page.index, thumbnail);
          }
        } catch (err) {
          console.error('Thumbnail generation loop failed:', err);
        } finally {
          isRendering.current = false;
        }
      }, 350);
    };

    editor.on('update', updateThumbnails);
    updateThumbnails();
    
    return () => {
      editor.off('update', updateThumbnails);
      clearTimeout(updateTimer.current);
    };
  }, [editor, pageSize, pageOrientation, pageMargin, zoom, pageCount, setThumbnail, metrics]);
}
