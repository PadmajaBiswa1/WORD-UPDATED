import { Mapping } from '@tiptap/pm/transform';

// Records every step map after the run starts, and the inverse of each agent step, so the whole
// run can be reverted in one transaction even if the user edited in between.
export class RunRecorder {
  constructor(editor) {
    this.editor = editor;
    this.maps = [];
    this.items = []; // { inverted, index } index = position of that step's map in `maps`
    this.onTransaction = ({ transaction }) => {
      if (!transaction.docChanged) return;
      const agent = transaction.getMeta('pragnaAgent');
      transaction.steps.forEach((step, i) => {
        if (agent) this.items.push({ inverted: step.invert(transaction.docs[i]), index: this.maps.length });
        this.maps.push(step.getMap());
      });
    };
    editor.on('transaction', this.onTransaction);
  }

  get changed() {
    return this.items.length > 0;
  }

  stop() {
    this.editor.off('transaction', this.onTransaction);
  }

  undo() {
    if (!this.items.length) return false;
    const { tr } = this.editor.state;
    for (let k = this.items.length - 1; k >= 0; k -= 1) {
      const { inverted, index } = this.items[k];
      const later = new Mapping(this.maps.slice(index + 1));
      const mapped = inverted.map(later)?.map(tr.mapping);
      if (mapped) tr.maybeStep(mapped);
    }
    this.items = [];
    this.editor.view.dispatch(tr);
    return true;
  }
}
