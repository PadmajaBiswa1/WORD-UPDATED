/**
 * Enhanced Clipboard Service
 * Handles copy/paste with formatting preservation
 */

export class ClipboardService {
  /**
   * Copy editor content with formatting
   */
  static async copyToClipboard(editor, format = 'html') {
    if (!editor) return false;

    try {
      const html = editor.getHTML();
      const text = editor.state.doc.textContent;

      // Get DOM content for richer formatting
      const dom = editor.view.dom;
      const range = document.createRange();
      range.selectNodeContents(dom);

      if (format === 'html' || format === 'both') {
        const blob = new Blob([html], { type: 'text/html' });
        const data = [
          new ClipboardItem({
            'text/html': blob,
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ];
        await navigator.clipboard.write(data);
        return true;
      } else {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.error('Copy failed:', err);
      return false;
    }
  }

  /**
   * Paste from clipboard with formatting preservation
   */
  static async pasteFromClipboard(editor, options = {}) {
    if (!editor) return false;

    const { preserveFormatting = true, mergeStyles = false } = options;

    try {
      const items = await navigator.clipboard.read();

      for (const item of items) {
        // Try HTML first if preserving formatting
        if (preserveFormatting && item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const html = await blob.text();
          editor.chain().focus().insertContent(html).run();
          return true;
        }

        // Fall back to plain text
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = await blob.text();
          editor.chain().focus().insertContent(text).run();
          return true;
        }
      }

      return false;
    } catch (err) {
      console.error('Paste failed:', err);

      // Fallback: try the older API
      try {
        const text = await navigator.clipboard.readText();
        editor.chain().focus().insertContent(text).run();
        return true;
      } catch (fallbackErr) {
        console.error('Fallback paste also failed:', fallbackErr);
        return false;
      }
    }
  }

  /**
   * Copy specific selection with formatting
   */
  static copySelection(editor) {
    if (!editor || editor.state.selection.empty) {
      return false;
    }

    const { from, to } = editor.state.selection;
    const selectedContent = editor.getJSON();

    // Store in session for cross-window paste
    sessionStorage.setItem('etherx_clipboard', JSON.stringify({
      content: editor.getHTML(),
      json: selectedContent,
      timestamp: Date.now(),
    }));

    // Also try browser clipboard
    return this.copyToClipboard(editor, 'html');
  }

  /**
   * Paste with format painter style (copy formatting from one element to another)
   */
  static pasteWithStyle(editor, sourceElement, targetElement) {
    if (!editor || !sourceElement || !targetElement) return false;

    try {
      // Extract styles from source
      const sourceStyles = window.getComputedStyle(sourceElement);
      const stylesToApply = [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'color',
        'backgroundColor',
        'textDecoration',
        'textAlign',
      ];

      // Apply styles to target
      stylesToApply.forEach((style) => {
        const value = sourceStyles.getPropertyValue(style.toLowerCase().replace(/([A-Z])/g, '-$1'));
        if (value) {
          targetElement.style[style] = value;
        }
      });

      return true;
    } catch (err) {
      console.error('Paste with style failed:', err);
      return false;
    }
  }

  /**
   * Handle drag-and-drop paste
   */
  static async handleDropEvent(event, editor) {
    if (!editor) return;

    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files || [];
    const items = event.dataTransfer?.items || [];

    // Handle file drops (images, documents)
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          editor.chain().focus().insertContent({
            type: 'image',
            attrs: {
              src: e.target.result,
            },
          }).run();
        };
        reader.readAsDataURL(file);
      }
    }

    // Handle text/HTML drops
    for (const item of items) {
      if (item.kind === 'string') {
        if (item.type === 'text/html') {
          item.getAsString((html) => {
            editor.chain().focus().insertContent(html).run();
          });
        } else if (item.type === 'text/plain') {
          item.getAsString((text) => {
            editor.chain().focus().insertContent(text).run();
          });
        }
      }
    }
  }
}

export default ClipboardService;
