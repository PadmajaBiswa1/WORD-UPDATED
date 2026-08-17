import { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useUIStore, useDocumentStore, useEditorStore } from '@/store';
import { getLayoutMetrics, PAGE_GAP } from '@/utils/pageLayout';

async function renderContentToThumbnail(htmlContent, pageIndex, metrics) {
  return new Promise((resolve) => {
    try {
      const tempDiv = document.createElement('div');
      // Create a container that mimics the actual page layout
      // Use the actual dimensions from metrics
      tempDiv.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: ${metrics.pageWidth}px;
        min-height: ${metrics.pageHeight}px;
        padding: ${metrics.padding}px;
         background: #1a1a1a;
         color: #e8e0d0;
        font-family: 'Crimson Pro', Georgia, serif;
        font-size: 12pt;
        line-height: 1.7;
        overflow: hidden;
        word-wrap: break-word;
        box-sizing: border-box;
      `;
      
      // We need to wrap content in a ProseMirror-like class to preserve styles from global.css
      tempDiv.innerHTML = `<div class="ProseMirror">${htmlContent || '<p></p>'}</div>`;
      document.body.appendChild(tempDiv);

      // Wait for any images to load or styles to apply
      setTimeout(async () => {
        try {
          const canvas = await html2canvas(tempDiv, {
            width: metrics.pageWidth,
            height: metrics.pageHeight,
            scale: 0.25, // Scale down for thumbnail
             backgroundColor: '#1a1a1a',
            logging: false,
            useCORS: true,
            allowTaint: true,
          });

          const dataUrl = canvas.toDataURL('image/png', 0.8);
          document.body.removeChild(tempDiv);
          resolve(dataUrl);
        } catch (err) {
          console.error('Error rendering thumbnail:', err);
          if (document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
          resolve(null);
        }
      }, 150);
    } catch (err) {
      console.error('Error creating thumbnail:', err);
      resolve(null);
    }
  });
}

export function useThumbnailGenerator() {
  const editor = useEditorStore(s => s.editor);
  const { pageSize, pageOrientation, pageMargin, zoom } = useUIStore();
  const { setThumbnail, pageCount } = useDocumentStore();
  const updateTimer = useRef(null);
  const isRendering = useRef(false);
  const lastContentMap = useRef({}); // To track changes per page

  const metrics = getLayoutMetrics({ size: pageSize, orientation: pageOrientation, margin: pageMargin });

  useEffect(() => {
    if (!editor) return;

    const updateThumbnails = () => {
      clearTimeout(updateTimer.current);
      updateTimer.current = setTimeout(async () => {
        const pageContainer = document.getElementById('document-page-0');
        if (!pageContainer) return;

        const proseMirror = pageContainer.querySelector('.ProseMirror');
        if (!proseMirror) return;

        // Use the same scale and step logic as EditorCanvas.jsx
        const scale = zoom / 100;
        const pageStep = (metrics.pageHeight + PAGE_GAP) * scale;

        const children = Array.from(proseMirror.children);
        const pagesToRender = [];
        let currentPageIndex = 0;
        let currentPageHTML = '';

        children.forEach(child => {
          // Determine which page this child belongs to based on its offsetTop
          const estimatedPage = Math.min(Math.floor(child.offsetTop / pageStep), pageCount - 1);

          if (estimatedPage > currentPageIndex && currentPageHTML) {
            pagesToRender.push({ index: currentPageIndex, html: currentPageHTML });
            currentPageIndex = estimatedPage;
            currentPageHTML = '';
          }
          currentPageHTML += child.outerHTML;
        });

        if (currentPageHTML) {
          pagesToRender.push({ index: currentPageIndex, html: currentPageHTML });
        }

        // Process rendering
        if (isRendering.current) return;
        isRendering.current = true;

        try {
          for (const page of pagesToRender) {
            // Only re-render if content changed for this bucket
            if (lastContentMap.current[page.index] === page.html) continue;
            
            const thumbnail = await renderContentToThumbnail(page.html, page.index, metrics);
            if (thumbnail) {
              setThumbnail(page.index, thumbnail);
              lastContentMap.current[page.index] = page.html;
            }
          }
        } catch (err) {
          console.error('Thumbnail generation loop failed:', err);
        } finally {
          isRendering.current = false;
        }
      }, 300);
    };

    editor.on('update', updateThumbnails);
    updateThumbnails();
    
    return () => {
      editor.off('update', updateThumbnails);
      clearTimeout(updateTimer.current);
    };
  }, [editor, pageSize, pageOrientation, pageMargin, zoom, pageCount, setThumbnail]);
}
