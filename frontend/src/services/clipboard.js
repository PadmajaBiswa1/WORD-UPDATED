import { useProductivityStore } from '@/store';

export function selectionClipboardData(editor) {
  if (!editor || editor.state.selection.empty) return null;
  const { dom, text } = editor.view.serializeForClipboard(editor.state.selection.content());
  return { text, html: dom.innerHTML };
}

export function recordClipboardData(data) {
  if (!data || (!data.text && !data.html)) return;
  useProductivityStore.getState().addClipboardItem({ ...data, copiedAt: new Date().toISOString() });
}

export async function writeClipboardData(data) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined' && data.html) {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([data.html], { type: 'text/html' }),
      'text/plain': new Blob([data.text || ''], { type: 'text/plain' }),
    })]);
  } else if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(data.text || '');
  } else {
    throw new Error('Clipboard unavailable');
  }
  recordClipboardData(data);
}

export function pasteClipboardData(editor, data) {
  if (!editor || (!data?.html && !data?.text)) return false;
  // Use ProseMirror paste handlers so partial selections keep marks and open block edges.
  const event = typeof ClipboardEvent === 'function' ? new ClipboardEvent('paste') : new Event('paste');
  if (data.html) return editor.view.pasteHTML(data.html, event);
  return editor.view.pasteText(data.text, event);
}

/**
 * Enhanced Clipboard Service
 * Handles copy/paste with formatting preservation
 */

export class ClipboardService {
  /**
   * Copy editor content with formatting
   */
  static async copyToClipboard(editor, format = 'html') {
    const data = selectionClipboardData(editor);
    if (!data) return false;
    try {
      await writeClipboardData(format === 'text' ? { text: data.text } : data);
      return true;
    } catch {
      return false;
    }
  }

  static async pasteFromClipboard(editor, { preserveFormatting = true } = {}) {
    if (!editor) return false;
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        if (preserveFormatting) {
          for (const item of items) {
            if (!item.types.includes('text/html')) continue;
            const html = await (await item.getType('text/html')).text();
            const text = item.types.includes('text/plain') ? await (await item.getType('text/plain')).text() : '';
            recordClipboardData({ html, text });
            return pasteClipboardData(editor, { html, text });
          }
        }
        for (const item of items) {
          if (!item.types.includes('text/plain')) continue;
          const text = await (await item.getType('text/plain')).text();
          recordClipboardData({ text });
          return pasteClipboardData(editor, { text });
        }
      }
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        recordClipboardData({ text });
        return pasteClipboardData(editor, { text });
      }
    } catch {
      // The ribbon cannot bypass clipboard permissions; native Ctrl+V still works.
    }
    return false;
  }

  static copySelection(editor) {
    return this.copyToClipboard(editor);
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
