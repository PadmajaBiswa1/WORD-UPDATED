// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Productivity Extension (AutoCorrect, Dictionary, Shortcuts)
// ═══════════════════════════════════════════════════════════════
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { useProductivityStore, useEditorStore, useDocumentStore, useUIStore } from '../store/index.js';

export const autoCorrectPluginKey = new PluginKey('etherx-autocorrect');
export const customDictPluginKey = new PluginKey('etherx-custom-dictionary');
export const customShortcutsPluginKey = new PluginKey('etherx-custom-shortcuts');

/**
 * Normalizes a keyboard event into a standard shortcut string representation like 'Ctrl+B'
 */
export function normalizeKeyEvent(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();
  else if (key === 'ArrowUp') key = 'Up';
  else if (key === 'ArrowDown') key = 'Down';
  else if (key === 'ArrowLeft') key = 'Left';
  else if (key === 'ArrowRight') key = 'Right';
  else if (key === 'Escape') key = 'Esc';
  
  parts.push(key);
  return parts.join('+');
}

/**
 * Dispatches an action mapped by a shortcut command ID
 */
export function executeShortcutCommand(commandId, context = {}) {
  const editor = context.editor || useEditorStore.getState().editor;
  const uiStore = context.uiStore || useUIStore.getState();
  const documentStore = context.documentStore || useDocumentStore.getState();

  if (!commandId) return false;

  switch (commandId) {
    case 'cmd-bold':
      editor?.chain().focus().toggleBold().run();
      return true;
    case 'cmd-italic':
      editor?.chain().focus().toggleItalic().run();
      return true;
    case 'cmd-underline':
      editor?.chain().focus().toggleUnderline().run();
      return true;
    case 'cmd-strike':
      editor?.chain().focus().toggleStrike().run();
      return true;
    case 'cmd-undo':
      editor?.chain().focus().undo().run();
      return true;
    case 'cmd-redo':
      editor?.chain().focus().redo().run();
      return true;
    case 'cmd-selectall':
      editor?.chain().focus().selectAll().run();
      return true;
    case 'cmd-find':
      uiStore.openDialog('findReplace');
      return true;
    case 'cmd-spellcheck':
      useEditorStore.getState().toggleSpellCheck();
      uiStore.toast('Spell check toggled', 'info');
      return true;
    case 'cmd-comment':
      if (editor && !editor.state.selection.empty) {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, ' ');
        documentStore.addComment({ text: `Comment on: ${text.slice(0, 80)}` });
        editor.chain().focus().setTextSelection({ from, to }).toggleHighlight({ color: '#fff59d' }).run();
        uiStore.openDialog('comments');
      } else {
        uiStore.openDialog('comments');
      }
      return true;
    case 'cmd-trackchanges':
      documentStore.toggleTrackChanges();
      uiStore.toast('Track Changes toggled', 'info');
      return true;
    case 'cmd-wordcount':
      uiStore.openDialog('wordCount');
      return true;
    case 'cmd-readability':
      uiStore.openDialog('readability');
      return true;
    case 'cmd-security':
      uiStore.openDialog('security');
      return true;
    case 'cmd-buildingblocks':
      uiStore.openDialog('buildingBlocks');
      return true;
    case 'cmd-align-left':
      editor?.chain().focus().setTextAlign('left').run();
      return true;
    case 'cmd-align-center':
      editor?.chain().focus().setTextAlign('center').run();
      return true;
    case 'cmd-align-right':
      editor?.chain().focus().setTextAlign('right').run();
      return true;
    case 'cmd-align-justify':
      editor?.chain().focus().setTextAlign('justify').run();
      return true;
    case 'cmd-clear-formatting':
      editor?.chain().focus().unsetAllMarks().run();
      return true;
    case 'cmd-subscript':
      editor?.chain().focus().toggleSubscript().run();
      return true;
    case 'cmd-superscript':
      editor?.chain().focus().toggleSuperscript().run();
      return true;
    case 'cmd-bullet-list':
      editor?.chain().focus().toggleBulletList().run();
      return true;
    case 'cmd-page-break':
      editor?.chain().focus().insertPageBreak().run();
      return true;
    case 'cmd-goto':
      uiStore.openDialog('goTo');
      return true;
    case 'cmd-formatting-marks':
      uiStore.toggleFormattingMarks?.();
      return true;
    case 'cmd-save':
      if (typeof context.onSave === 'function') context.onSave();
      return true;
    case 'cmd-print':
      window.print();
      return true;
    case 'cmd-copilot':
      uiStore.openPragna(editor && !editor.state.selection.empty ? 'edit' : 'ask');
      return true;
    case 'cmd-help':
      uiStore.openDialog('help');
      return true;
    case 'cmd-commandmap':
      uiStore.openDialog('commandMap');
      return true;
    case 'cmd-shortcuts':
      uiStore.openDialog('shortcuts');
      return true;
    case 'cmd-export':
      uiStore.openDialog('exportDoc');
      return true;
    default:
      return false;
  }
}

/**
 * Escapes regex special characters
 */
function escapeRegex(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds inline decorations for custom dictionary words to disable native spellcheck
 */
export function buildCustomDictDecorations(doc) {
  const { customDictionary = [] } = useProductivityStore.getState();
  if (!customDictionary || customDictionary.length === 0) {
    return DecorationSet.empty;
  }

  const decos = [];
  const words = customDictionary.map((w) => String(w).trim().toLowerCase()).filter(Boolean);
  if (!words.length) return DecorationSet.empty;

  // Build regex matching any dictionary word as a discrete word token
  const pattern = new RegExp(`\\b(${words.map(escapeRegex).join('|')})\\b`, 'gi');

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(node.text)) !== null) {
        const start = pos + match.index;
        const end = start + match[0].length;
        decos.push(
          Decoration.inline(start, end, {
            spellcheck: 'false',
            'data-custom-dict': 'true',
            class: 'etherx-custom-dict-word',
          })
        );
      }
    }
  });

  return DecorationSet.create(doc, decos);
}

/**
 * Creates the AutoCorrect and Custom Dictionary TipTap extension
 */
export const ProductivityExtension = Extension.create({
  name: 'productivityExtension',

  addProseMirrorPlugins() {
    return [
      // 1. AutoCorrect Keystrokes Plugin
      new Plugin({
        key: autoCorrectPluginKey,
        props: {
          handleTextInput(view, from, to, text) {
            const { autoCorrectRules = [] } = useProductivityStore.getState();
            if (!autoCorrectRules || autoCorrectRules.length === 0) return false;

            const enabledRules = autoCorrectRules.filter((r) => r.enabled !== false && r.trigger);
            if (!enabledRules.length) return false;

            const $from = view.state.selection.$from;
            const textBefore = $from.parent.textBetween(0, $from.parentOffset, null, '\ufffc');

            const isDelimiter = /^[\s.,!?;:—\-\)\]\}]$/.test(text);

            // Case A: Space or punctuation typed following a trigger word
            if (isDelimiter) {
              for (const rule of enabledRules) {
                const trigger = rule.trigger;
                const matches = rule.caseSensitive
                  ? textBefore.endsWith(trigger)
                  : textBefore.toLowerCase().endsWith(trigger.toLowerCase());

                if (matches) {
                  // For alphanumeric triggers, verify word boundary preceding the trigger
                  const charBeforePos = textBefore.length - trigger.length - 1;
                  const charBefore = charBeforePos >= 0 ? textBefore[charBeforePos] : '';
                  const isWordTrigger = /^[a-zA-Z0-9]/.test(trigger);

                  if (isWordTrigger && charBefore && /[a-zA-Z0-9]/.test(charBefore)) {
                    continue; // part of a larger word (e.g. biteh)
                  }

                  const startPos = from - trigger.length;
                  if (startPos >= 0) {
                    const tr = view.state.tr.replaceWith(
                      startPos,
                      to,
                      view.state.schema.text(rule.replacement + text)
                    );
                    view.dispatch(tr);
                    return true;
                  }
                }
              }
            }

            // Case B: Trigger ends with non-word character (like -->, <--, (c), (r), (tm))
            // typed directly as the closing character
            const combinedText = textBefore + text;
            for (const rule of enabledRules) {
              const trigger = rule.trigger;
              if (/[^a-zA-Z0-9]$/.test(trigger)) {
                const matches = rule.caseSensitive
                  ? combinedText.endsWith(trigger)
                  : combinedText.toLowerCase().endsWith(trigger.toLowerCase());

                if (matches) {
                  const startPos = from - (trigger.length - 1);
                  if (startPos >= 0) {
                    const tr = view.state.tr.replaceWith(
                      startPos,
                      to,
                      view.state.schema.text(rule.replacement)
                    );
                    view.dispatch(tr);
                    return true;
                  }
                }
              }
            }

            return false;
          },

          handleKeyDown(view, event) {
            // AutoCorrect on Enter key
            if (event.key === 'Enter') {
              const { autoCorrectRules = [] } = useProductivityStore.getState();
              const enabledRules = (autoCorrectRules || []).filter((r) => r.enabled !== false && r.trigger);
              if (enabledRules.length) {
                const $from = view.state.selection.$from;
                const textBefore = $from.parent.textBetween(0, $from.parentOffset, null, '\ufffc');

                for (const rule of enabledRules) {
                  const trigger = rule.trigger;
                  const matches = rule.caseSensitive
                    ? textBefore.endsWith(trigger)
                    : textBefore.toLowerCase().endsWith(trigger.toLowerCase());

                  if (matches) {
                    const charBeforePos = textBefore.length - trigger.length - 1;
                    const charBefore = charBeforePos >= 0 ? textBefore[charBeforePos] : '';
                    const isWordTrigger = /^[a-zA-Z0-9]/.test(trigger);

                    if (!isWordTrigger || !charBefore || !/[a-zA-Z0-9]/.test(charBefore)) {
                      const startPos = view.state.selection.from - trigger.length;
                      if (startPos >= 0) {
                        const tr = view.state.tr.replaceWith(
                          startPos,
                          view.state.selection.to,
                          view.state.schema.text(rule.replacement)
                        );
                        view.dispatch(tr);
                        break;
                      }
                    }
                  }
                }
              }
            }

            // Custom Shortcuts Dispatcher inside Editor
            const { customShortcuts = {} } = useProductivityStore.getState();
            if (customShortcuts && Object.keys(customShortcuts).length > 0) {
              const currentCombo = normalizeKeyEvent(event);
              const matchedEntry = Object.entries(customShortcuts).find(([, shortcut]) => {
                return shortcut && shortcut.toLowerCase() === currentCombo.toLowerCase();
              });

              if (matchedEntry) {
                event.preventDefault();
                event.stopPropagation();
                executeShortcutCommand(matchedEntry[0]);
                return true;
              }
            }

            return false;
          },
        },
      }),

      // 2. Custom Dictionary Spellcheck Exemption Plugin
      new Plugin({
        key: customDictPluginKey,
        state: {
          init(_, { doc }) {
            return buildCustomDictDecorations(doc);
          },
          apply(tr, oldDecos) {
            if (tr.docChanged) {
              return buildCustomDictDecorations(tr.doc);
            }
            return oldDecos.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
