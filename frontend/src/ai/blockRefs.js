// Run-scoped ids for blocks the agent has seen. Positions are mapped through every
// transaction (including the user's typing), and nothing is stored in the document.

export class BlockRefs {
  constructor(editor) {
    this.editor = editor;
    this.entries = new Map(); // id -> { pos, kind: 'block'|'table', deleted }
    this.byPos = new Map(); // pos -> id (refreshed lazily)
    this.counts = { block: 0, table: 0 };
    this.onTransaction = ({ transaction }) => {
      if (!transaction.docChanged) return;
      this.byPos.clear();
      this.entries.forEach((entry) => {
        if (entry.deleted) return;
        const result = transaction.mapping.mapResult(entry.pos, 1);
        entry.pos = result.pos;
        entry.deleted = result.deleted;
      });
    };
    editor.on('transaction', this.onTransaction);
  }

  register(pos, kind) {
    const existing = this.byPos.get(pos) || Array.from(this.entries.entries())
      .find(([, e]) => !e.deleted && e.pos === pos && e.kind === kind)?.[0];
    if (existing) {
      this.byPos.set(pos, existing);
      return existing;
    }
    this.counts[kind] += 1;
    const id = `${kind === 'table' ? 't' : 'b'}${this.counts[kind]}`;
    this.entries.set(id, { pos, kind, deleted: false });
    this.byPos.set(pos, id);
    return id;
  }

  idFor(pos) {
    return this.register(pos, 'block');
  }

  tableIdFor(pos) {
    return this.register(pos, 'table');
  }

  resolve(id) {
    const entry = this.entries.get(String(id || '').trim());
    if (!entry || entry.deleted) return null;
    const node = this.editor.state.doc.nodeAt(entry.pos);
    if (!node) return null;
    if (entry.kind === 'block' && !node.isTextblock) return null;
    if (entry.kind === 'table' && node.type.name !== 'table') return null;
    return { node, pos: entry.pos };
  }

  // `t1.r2c3` -> the cell node at row 2, column 3 of table t1.
  resolveCell(cellId) {
    const match = /^(t\d+)\.r(\d+)c(\d+)$/.exec(String(cellId || '').trim());
    if (!match) return null;
    const table = this.resolve(match[1]);
    if (!table) return null;
    const row = Number(match[2]);
    const col = Number(match[3]);
    if (row >= table.node.childCount) return null;
    let pos = table.pos + 1;
    for (let r = 0; r < row; r += 1) pos += table.node.child(r).nodeSize;
    const rowNode = table.node.child(row);
    if (col >= rowNode.childCount) return null;
    pos += 1;
    for (let c = 0; c < col; c += 1) pos += rowNode.child(c).nodeSize;
    return { node: rowNode.child(col), pos };
  }

  detach() {
    this.editor.off('transaction', this.onTransaction);
  }
}
