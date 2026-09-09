// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Voice Command Service & Grammar Parser
// ═══════════════════════════════════════════════════════════════

/**
 * Normalizes speech recognition transcripts for reliable matching.
 * @param {string} text
 * @returns {string}
 */
export function normalizeTranscript(text = '') {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[.,?!:;]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Standard Voice Command Grammar Registry
 */
export const VOICE_GRAMMAR = [
  // ── Formatting ──
  {
    id: 'format.bold',
    label: 'Bold',
    phrases: ['make bold', 'bold', 'toggle bold', 'unbold', 'set bold'],
    description: 'Toggles bold on the current selection',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleBold().run();
      return true;
    },
  },
  {
    id: 'format.italic',
    label: 'Italic',
    phrases: ['make italic', 'italic', 'italics', 'toggle italic'],
    description: 'Toggles italics on the current selection',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleItalic().run();
      return true;
    },
  },
  {
    id: 'format.underline',
    label: 'Underline',
    phrases: ['make underline', 'underline', 'toggle underline'],
    description: 'Toggles underline on the current selection',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleUnderline().run();
      return true;
    },
  },
  {
    id: 'format.strike',
    label: 'Strikethrough',
    phrases: ['strikethrough', 'strike through', 'strike', 'cross out'],
    description: 'Toggles strikethrough on selection',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleStrike().run();
      return true;
    },
  },
  {
    id: 'format.clear',
    label: 'Clear Formatting',
    phrases: ['clear formatting', 'remove formatting', 'reset formatting'],
    description: 'Removes all formatting from the selection',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().unsetAllMarks().clearNodes().run();
      return true;
    },
  },

  // ── Headings & Structure ──
  {
    id: 'structure.heading1',
    label: 'Heading 1',
    phrases: ['heading 1', 'heading one', 'make heading 1', 'header 1', 'header one', 'title 1'],
    description: 'Sets the current paragraph to Heading 1',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleHeading({ level: 1 }).run();
      return true;
    },
  },
  {
    id: 'structure.heading2',
    label: 'Heading 2',
    phrases: ['heading 2', 'heading two', 'make heading 2', 'header 2', 'header two'],
    description: 'Sets the current paragraph to Heading 2',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      return true;
    },
  },
  {
    id: 'structure.heading3',
    label: 'Heading 3',
    phrases: ['heading 3', 'heading three', 'make heading 3', 'header 3', 'header three'],
    description: 'Sets the current paragraph to Heading 3',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleHeading({ level: 3 }).run();
      return true;
    },
  },
  {
    id: 'structure.paragraph',
    label: 'Normal Text',
    phrases: ['normal text', 'regular text', 'paragraph', 'make paragraph', 'body text'],
    description: 'Converts current block to normal body paragraph',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().setParagraph().run();
      return true;
    },
  },
  {
    id: 'structure.newParagraph',
    label: 'New Paragraph',
    phrases: ['new paragraph', 'new line', 'next paragraph', 'break line', 'enter paragraph'],
    description: 'Inserts a new paragraph at current position',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().splitBlock().run();
      return true;
    },
  },

  // ── Alignment ──
  {
    id: 'align.center',
    label: 'Align Center',
    phrases: ['align center', 'center align', 'center text', 'align middle', 'center'],
    description: 'Centers the text alignment',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().setTextAlign('center').run();
      return true;
    },
  },
  {
    id: 'align.left',
    label: 'Align Left',
    phrases: ['align left', 'left align', 'left'],
    description: 'Aligns text to the left',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().setTextAlign('left').run();
      return true;
    },
  },
  {
    id: 'align.right',
    label: 'Align Right',
    phrases: ['align right', 'right align', 'right'],
    description: 'Aligns text to the right',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().setTextAlign('right').run();
      return true;
    },
  },
  {
    id: 'align.justify',
    label: 'Justify',
    phrases: ['justify', 'justify text', 'align justify'],
    description: 'Justifies text alignment',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().setTextAlign('justify').run();
      return true;
    },
  },

  // ── Lists ──
  {
    id: 'list.bullet',
    label: 'Bullet List',
    phrases: ['bullet list', 'bullet points', 'bullets', 'add bullets', 'make bullet list'],
    description: 'Toggles a bulleted list',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleBulletList().run();
      return true;
    },
  },
  {
    id: 'list.ordered',
    label: 'Numbered List',
    phrases: ['numbered list', 'ordered list', 'numbers list', 'number list', 'make numbered list'],
    description: 'Toggles a numbered list',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleOrderedList().run();
      return true;
    },
  },
  {
    id: 'list.task',
    label: 'Checklist',
    phrases: ['task list', 'checklist', 'todo list', 'to-do list'],
    description: 'Toggles a task checklist',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleTaskList().run();
      return true;
    },
  },
  {
    id: 'structure.blockquote',
    label: 'Quote',
    phrases: ['blockquote', 'quote', 'make quote', 'insert quote'],
    description: 'Toggles blockquote formatting',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().toggleBlockquote().run();
      return true;
    },
  },
  {
    id: 'table.insert',
    label: 'Insert Table',
    phrases: ['insert table', 'add table', 'new table', 'create table', 'insert a table'],
    description: 'Inserts a 3x3 table or opens the table dialog',
    execute: (editor, context = {}) => {
      if (!editor) return false;
      try {
        if (editor.commands?.insertTable) {
          const ok = editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          if (ok) return true;
        }
      } catch {
        // fallback
      }
      const uiStore = context.uiStore || context.stores?.uiStore;
      if (uiStore?.openDialog) {
        uiStore.openDialog('insertTable');
        return true;
      }
      return false;
    },
  },

  // ── History ──
  {
    id: 'edit.undo',
    label: 'Undo',
    phrases: ['undo', 'undo that', 'revert'],
    description: 'Reverts the previous editor action',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().undo().run();
      return true;
    },
  },
  {
    id: 'edit.redo',
    label: 'Redo',
    phrases: ['redo', 'redo that'],
    description: 'Redoes the previously undone action',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().redo().run();
      return true;
    },
  },

  // ── Review & Comments ──
  {
    id: 'review.addComment',
    label: 'Add Comment',
    phrases: ['add comment', 'new comment', 'insert comment', 'comment on this', 'comment'],
    description: 'Opens the comment dialog or creates a comment on the selection',
    execute: (editor, context = {}) => {
      const uiStore = context.uiStore || context.stores?.uiStore;
      if (uiStore?.openDialog) {
        uiStore.openDialog('comments');
        return true;
      }
      return false;
    },
  },

  // ── AI & Pragna ──
  {
    id: 'ai.rewrite',
    label: 'Rewrite with AI',
    phrases: ['rewrite', 'rewrite with ai', 'ai rewrite', 'paraphrase', 'rephrase', 'improve writing'],
    description: 'Invokes Pragna AI to rewrite or improve the selected text',
    execute: (editor, context = {}) => {
      const uiStore = context.uiStore || context.stores?.uiStore;
      let selectedText = '';
      if (editor) {
        const { from, to } = editor.state.selection;
        selectedText = editor.state.doc.textBetween(from, to, ' ');
      }
      if (uiStore?.openPragna) {
        uiStore.openPragna('rewrite', selectedText ? `Please rewrite: "${selectedText}"` : 'Please rewrite the text.');
        return true;
      }
      return false;
    },
  },

  // ── Navigation & Common UI ──
  {
    id: 'ui.find',
    label: 'Find / Search',
    phrases: ['find', 'find text', 'search', 'search document'],
    description: 'Opens the Find & Replace dialog',
    execute: (editor, context = {}) => {
      const uiStore = context.uiStore || context.stores?.uiStore;
      if (uiStore?.openDialog) {
        uiStore.openDialog('findReplace');
        return true;
      }
      return false;
    },
  },
  {
    id: 'edit.selectAll',
    label: 'Select All',
    phrases: ['select all', 'highlight all', 'select everything'],
    description: 'Selects all content in the editor',
    execute: (editor) => {
      if (!editor) return false;
      editor.chain().focus().selectAll().run();
      return true;
    },
  },
];

/**
 * Parses spoken text to find a matching voice command.
 *
 * @param {string} transcript - Speech-to-text transcript
 * @returns {{
 *   matched: boolean,
 *   command: object|null,
 *   action: string,
 *   confidence: number,
 *   rawTranscript: string
 * }}
 */
export function parseVoiceCommand(transcript = '') {
  const normalized = normalizeTranscript(transcript);
  if (!normalized) {
    return {
      matched: false,
      command: null,
      action: '',
      confidence: 0,
      rawTranscript: transcript,
    };
  }

  let bestMatch = null;
  let highestScore = 0;

  for (const cmd of VOICE_GRAMMAR) {
    for (const phrase of cmd.phrases) {
      const normPhrase = normalizeTranscript(phrase);

      // Exact match
      if (normalized === normPhrase) {
        return {
          matched: true,
          command: cmd,
          action: cmd.id,
          confidence: 1.0,
          rawTranscript: transcript,
        };
      }

      // Word boundary match
      const regex = new RegExp(`(^|\\s)${normPhrase.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(\\s|$)`);
      if (regex.test(normalized)) {
        const score = Math.max(0.65, normPhrase.length / normalized.length);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = cmd;
        }
      } else if (normalized.startsWith(normPhrase) || normalized.endsWith(normPhrase)) {
        const score = normPhrase.length / normalized.length;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = cmd;
        }
      } else if (normalized.includes(normPhrase)) {
        const score = (normPhrase.length / normalized.length) * 0.8;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = cmd;
        }
      }
    }
  }

  if (bestMatch && highestScore >= 0.25) {
    return {
      matched: true,
      command: bestMatch,
      action: bestMatch.id,
      confidence: Math.round(highestScore * 100) / 100,
      rawTranscript: transcript,
    };
  }

  return {
    matched: false,
    command: null,
    action: '',
    confidence: 0,
    rawTranscript: transcript,
  };
}

/**
 * Executes a voice command against the provided editor and application context.
 *
 * @param {string} transcript - Spoken phrase
 * @param {{ editor?: any, uiStore?: any, documentStore?: any, stores?: object }} context
 * @returns {{ success: boolean, commandId: string|null, message: string }}
 */
export function executeVoiceCommand(transcript, context = {}) {
  const result = parseVoiceCommand(transcript);

  if (!result.matched || !result.command) {
    return {
      success: false,
      commandId: null,
      message: `Unrecognized voice command: "${transcript}"`,
    };
  }

  try {
    const executed = result.command.execute(context.editor, context);
    return {
      success: Boolean(executed),
      commandId: result.command.id,
      message: `Executed: ${result.command.label}`,
    };
  } catch (err) {
    return {
      success: false,
      commandId: result.command.id,
      message: `Command execution failed: ${err.message}`,
    };
  }
}

/**
 * Creates a browser-compatible SpeechRecognition controller.
 *
 * @param {object} options
 * @param {Function} [options.onResult] - Callback with transcript string
 * @param {Function} [options.onCommand] - Callback with execution result
 * @param {Function} [options.onError] - Callback with error message
 * @param {Function} [options.onStatusChange] - Callback with 'listening' | 'idle'
 * @param {object} [options.context] - Editor and store context
 * @returns {{ start: Function, stop: Function, isListening: Function, isSupported: Function }}
 */
export function createVoiceController(options = {}) {
  const { onResult, onCommand, onError, onStatusChange, context = {} } = options;

  let recognition = null;
  let listening = false;

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const isSupported = () => Boolean(SpeechRecognition);

  const start = () => {
    if (!SpeechRecognition) {
      onError?.('Speech recognition is not supported in this browser.');
      return false;
    }

    if (listening) return true;

    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        listening = true;
        onStatusChange?.('listening');
      };

      recognition.onresult = (event) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0]?.transcript || '';
        onResult?.(transcript);

        // Auto-execute if matching voice command
        if (transcript) {
          const outcome = executeVoiceCommand(transcript, context);
          onCommand?.(outcome);
        }
      };

      recognition.onerror = (event) => {
        onError?.(event.error || 'Voice recognition error occurred');
      };

      recognition.onend = () => {
        listening = false;
        onStatusChange?.('idle');
      };

      recognition.start();
      return true;
    } catch (err) {
      onError?.(err.message || 'Failed to start voice recognition');
      return false;
    }
  };

  const stop = () => {
    if (recognition && listening) {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    }
    listening = false;
    onStatusChange?.('idle');
  };

  const isListening = () => listening;

  return {
    start,
    stop,
    isListening,
    isSupported,
  };
}
