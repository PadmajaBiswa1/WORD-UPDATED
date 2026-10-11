import { Mapping } from '@tiptap/pm/transform';

// Records every step map after the run starts, and the inverse of each agent step, so the whole
// run can be reverted in one transaction even if the user edited in between. It keeps listening
// after the run finishes (accepting/rejecting suggestions is tagged as an agent step) until the
// owner calls stop() — when the next run starts or the editor goes away — or undo() runs.
export class RunRecorder {
  constructor(editor) {
    this.editor = editor;
    this.maps = [];
    this.items = []; // { inverted, index } index = position of that step's map in `maps`
    this.skipped = 0; // inverted steps dropped by the last undo() (mapped away or failed to apply)
    this.onTransaction = ({ transaction }) => {
      if (!transaction.docChanged || transaction.getMeta('pragnaUndo')) return;
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
    this.skipped = 0;
    const undone = []; // { index, map }: applied inverse steps and the map index they cancel
    for (let k = this.items.length - 1; k >= 0; k -= 1) {
      const { inverted, index } = this.items[k];
      // Everything recorded after this step, plus the inverses already applied, each mirrored with
      // the step it cancels, so positions resolve as if only the user's own edits came after it.
      const mapping = new Mapping(this.maps.slice(index + 1));
      undone.forEach((u) => mapping.appendMap(u.map, u.index - (index + 1)));
      const mapped = inverted.map(mapping);
      if (!mapped || tr.maybeStep(mapped).failed) {
        this.skipped += 1;
      } else {
        undone.push({ index, map: mapped.getMap() });
      }
    }
    this.items = [];
    this.maps = [];
    this.stop();
    if (!undone.length) return false;
    this.editor.view.dispatch(tr.setMeta('pragnaUndo', true));
    return true;
  }
}
