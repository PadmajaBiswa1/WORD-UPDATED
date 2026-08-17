/**
 * Layout Features Service
 * Handles columns, section breaks, headers/footers, bookmarks, cross-references
 */

export class LayoutFeaturesService {
  /**
   * Set document columns
   */
  static setColumns(editorDom, columnCount = 1, columnGap = 40) {
    if (!editorDom) return false;

    try {
      if (columnCount > 1) {
        editorDom.style.columnCount = String(columnCount);
        editorDom.style.columnGap = `${columnGap}px`;
        editorDom.style.columnRule = '1px solid #e0e0e0';
      } else {
        editorDom.style.columnCount = '';
        editorDom.style.columnGap = '';
        editorDom.style.columnRule = '';
      }

      editorDom.setAttribute('data-columns', columnCount);
      return true;
    } catch (err) {
      console.error('Set columns failed:', err);
      return false;
    }
  }

  /**
   * Insert a section break
   */
  static insertSectionBreak(editor) {
    if (!editor) return false;

    try {
      const breakElement = document.createElement('div');
      breakElement.className = 'etherx-section-break';
      breakElement.setAttribute('data-section-break', 'true');
      breakElement.style.pageBreakAfter = 'always';
      breakElement.style.height = '0px';

      editor.chain().focus().insertContent({
        type: 'paragraph',
        attrs: {
          class: 'etherx-section-break',
        },
      }).run();

      return true;
    } catch (err) {
      console.error('Insert section break failed:', err);
      return false;
    }
  }

  /**
   * Set header/footer content
   */
  static setHeaderContent(headerElement, content) {
    if (!headerElement) return false;

    try {
      headerElement.setAttribute('data-header', 'true');
      headerElement.innerHTML = content || '';
      headerElement.className = 'etherx-header';
      headerElement.style.paddingBottom = '12px';
      headerElement.style.borderBottom = '1px solid #e0e0e0';
      headerElement.style.marginBottom = '12px';
      headerElement.style.minHeight = '36px';

      return true;
    } catch (err) {
      console.error('Set header content failed:', err);
      return false;
    }
  }

  /**
   * Set footer/header content
   */
  static setFooterContent(footerElement, content) {
    if (!footerElement) return false;

    try {
      footerElement.setAttribute('data-footer', 'true');
      footerElement.innerHTML = content || '';
      footerElement.className = 'etherx-footer';
      footerElement.style.paddingTop = '12px';
      footerElement.style.borderTop = '1px solid #e0e0e0';
      footerElement.style.marginTop = '12px';
      footerElement.style.minHeight = '36px';

      return true;
    } catch (err) {
      console.error('Set footer content failed:', err);
      return false;
    }
  }

  /**
   * Create and store a bookmark
   */
  static createBookmark(editor, bookmarkName) {
    if (!editor || editor.state.selection.empty) return false;

    try {
      const { from, to } = editor.state.selection;
      const bookmarkId = `bookmark-${bookmarkName.replace(/\s+/g, '-')}-${Date.now()}`;

      const selectedText = editor.state.doc.textBetween(from, to);

      editor
        .chain()
        .focus()
        .setMeta('addedToHistory', false)
        .updateAttributes('text', {
          'data-bookmark-id': bookmarkId,
          'data-bookmark-name': bookmarkName,
        })
        .run();

      // Store bookmark location
      const bookmark = {
        id: bookmarkId,
        name: bookmarkName,
        from,
        to,
        text: selectedText,
        createdAt: new Date().toISOString(),
      };

      return bookmark;
    } catch (err) {
      console.error('Create bookmark failed:', err);
      return false;
    }
  }

  /**
   * Navigate to a bookmark
   */
  static navigateToBookmark(editor, bookmarkName) {
    if (!editor) return false;

    try {
      const dom = editor.view.dom;
      const bookmarks = dom.querySelectorAll(`[data-bookmark-name="${bookmarkName}"]`);

      if (bookmarks.length === 0) return false;

      const bookmark = bookmarks[0];
      bookmark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      bookmark.classList.add('etherx-bookmark-highlight');

      setTimeout(() => {
        bookmark.classList.remove('etherx-bookmark-highlight');
      }, 2000);

      return true;
    } catch (err) {
      console.error('Navigate to bookmark failed:', err);
      return false;
    }
  }

  /**
   * Insert a cross-reference
   */
  static insertCrossReference(editor, referenceTarget, referenceType = 'heading') {
    if (!editor) return false;

    try {
      const refId = `ref-${referenceTarget}-${Date.now()}`;

      const refElement = document.createElement('a');
      refElement.href = `#${referenceTarget}`;
      refElement.className = 'etherx-cross-reference';
      refElement.setAttribute('data-ref-type', referenceType);
      refElement.setAttribute('data-ref-target', referenceTarget);
      refElement.style.color = 'var(--link)';
      refElement.style.textDecoration = 'underline';
      refElement.textContent = `See ${referenceType} "${referenceTarget}"`;

      editor.chain().focus().insertContent(refElement.outerHTML).run();

      return true;
    } catch (err) {
      console.error('Insert cross-reference failed:', err);
      return false;
    }
  }

  /**
   * Update cross-references when target changes
   */
  static updateCrossReferences(editorDom, targetName, newContent) {
    if (!editorDom) return false;

    try {
      const references = editorDom.querySelectorAll(`[data-ref-target="${targetName}"]`);

      references.forEach((ref) => {
        ref.textContent = newContent || `See "${targetName}"`;
      });

      return true;
    } catch (err) {
      console.error('Update cross-references failed:', err);
      return false;
    }
  }

  /**
   * Get all bookmarks and cross-references
   */
  static getLayoutElements(editorDom) {
    if (!editorDom) return { bookmarks: [], references: [], sections: [] };

    try {
      const bookmarks = Array.from(editorDom.querySelectorAll('[data-bookmark-name]')).map((b) => ({
        name: b.getAttribute('data-bookmark-name'),
        id: b.getAttribute('data-bookmark-id'),
        text: b.textContent,
      }));

      const references = Array.from(editorDom.querySelectorAll('[data-ref-target]')).map((r) => ({
        target: r.getAttribute('data-ref-target'),
        type: r.getAttribute('data-ref-type'),
        text: r.textContent,
      }));

      const sections = Array.from(editorDom.querySelectorAll('[data-section-break]')).length;

      return { bookmarks, references, sections };
    } catch (err) {
      console.error('Get layout elements failed:', err);
      return { bookmarks: [], references: [], sections: 0 };
    }
  }
}

export default LayoutFeaturesService;
