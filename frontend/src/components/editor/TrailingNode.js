import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * TrailingNode extension ensures that the document always ends with an editable paragraph
 * when the last node is a non-textblock (such as a table, image, drawing, page break, etc.).
 * This allows users to always click below or arrow-down out of tables/drawings and continue typing.
 */
export const TrailingNode = Extension.create({
  name: 'trailingNode',

  addOptions() {
    return {
      node: 'paragraph',
      notAfter: ['paragraph'],
    };
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey(this.name);
    const disabledNodes = Object.entries(this.editor.schema.nodes)
      .map(([, value]) => value)
      .filter((node) => this.options.notAfter.includes(node.name));

    return [
      new Plugin({
        key: pluginKey,
        appendTransaction: (transactions, oldState, state) => {
          const { doc, tr, schema } = state;
          const shouldInsertNodeAtEnd = pluginKey.getState(state);
          const endType = schema.nodes[this.options.node];

          if (!shouldInsertNodeAtEnd || !endType) {
            return;
          }

          return tr.insert(doc.content.size, endType.create());
        },
        state: {
          init: (_, state) => {
            const lastNode = state.doc.lastChild;
            return !disabledNodes.includes(lastNode?.type);
          },
          apply: (tr, value) => {
            if (!tr.docChanged) {
              return value;
            }

            const lastNode = tr.doc.lastChild;
            return !disabledNodes.includes(lastNode?.type);
          },
        },
      }),
    ];
  },
});
