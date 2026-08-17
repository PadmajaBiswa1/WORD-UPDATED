/**
 * Format Painter Service
 * Copy formatting from one element and apply to another
 */

export class FormatPainterService {
  static #sourceFormat = null;

  /**
   * Extract formatting from selected content
   */
  static pickFormat(editor) {
    if (!editor || editor.state.selection.empty) {
      return false;
    }

    try {
      const { from, to } = editor.state.selection;
      const marks = editor.state.doc.rangeHasMark(from, to, editor.schema.marks.strong);

      // Extract all active marks
      const activeMarks = {};
      Object.keys(editor.schema.marks).forEach((markName) => {
        const mark = editor.schema.marks[markName];
        if (editor.isActive(markName)) {
          activeMarks[markName] = {
            active: true,
            attrs: editor.getAttributes(markName) || {},
          };
        }
      });

      // Extract block-level attributes
      const attrs = editor.getAttributes('paragraph') || {};

      this.#sourceFormat = {
        marks: activeMarks,
        attrs,
        timestamp: Date.now(),
      };

      return true;
    } catch (err) {
      console.error('Pick format failed:', err);
      return false;
    }
  }

  /**
   * Apply previously picked format to selection
   */
  static applyFormat(editor) {
    if (!editor || !this.#sourceFormat) {
      return false;
    }

    if (editor.state.selection.empty) {
      return false;
    }

    try {
      let chain = editor.chain().focus();

      // Apply marks
      Object.entries(this.#sourceFormat.marks).forEach(([markName, markData]) => {
        if (markData.active) {
          chain = chain.toggleMark(markName, markData.attrs);
        }
      });

      // Apply block attributes if in paragraph
      if (this.#sourceFormat.attrs && Object.keys(this.#sourceFormat.attrs).length > 0) {
        chain = chain.updateAttributes('paragraph', this.#sourceFormat.attrs);
      }

      chain.run();
      return true;
    } catch (err) {
      console.error('Apply format failed:', err);
      return false;
    }
  }

  /**
   * Clear the picked format
   */
  static clearFormat() {
    this.#sourceFormat = null;
  }

  /**
   * Check if format is picked and still valid
   */
  static hasPickedFormat() {
    if (!this.#sourceFormat) return false;

    // Formats expire after 2 minutes
    const age = Date.now() - this.#sourceFormat.timestamp;
    return age < 120000;
  }

  /**
   * Get a description of the picked format
   */
  static getFormatDescription() {
    if (!this.#sourceFormat) return null;

    const marks = Object.keys(this.#sourceFormat.marks)
      .filter((m) => this.#sourceFormat.marks[m].active)
      .join(', ');

    return marks || 'formatting';
  }
}

export default FormatPainterService;
