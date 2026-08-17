import { useEffect } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { recalculatePages } from '@/utils/paginationUtils';

export function usePagination() {
  const { editor } = useEditorStore();
  const { pageSize, pageOrientation, pageMargin } = useUIStore();

  useEffect(() => {
    if (!editor) return;

    const updatePagination = () => {
      const pm = document.querySelector('.ProseMirror');
      if (!pm) return;

      try {
        const result = recalculatePages(pm, {
          size: pageSize,
          orientation: pageOrientation,
          margin: pageMargin,
        });

        // Update status bar if it exists
        const statusBar = document.querySelector('[data-status="pageCount"]');
        if (statusBar) {
          statusBar.textContent = `Page ${Math.max(1, Math.ceil(pm.offsetHeight / 1123))} of ${result.totalPages}`;
        }
      } catch (err) {
        // Silent fail - pagination calculation is non-critical
        console.debug('Pagination update skipped:', err?.message);
      }
    };

    // Recalculate on content updates
    editor.on('update', updatePagination);
    editor.on('selectionUpdate', updatePagination);

    // Initial calculation
    updatePagination();

    return () => {
      editor.off('update', updatePagination);
      editor.off('selectionUpdate', updatePagination);
    };
  }, [editor, pageSize, pageOrientation, pageMargin]);
}
