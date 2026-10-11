// Run-scoped ids for blocks the agent has seen. Each id tracks a document range
// [start, end) that is mapped through every transaction (including the user's typing).
// Nothing is stored in the document.
//
// The range is mapped with start (assoc 1) and end (assoc -1) and does NOT use the
// `deleted` flag: ReplaceAroundStep (heading toggle, alignment) and splits would otherwise
// kill ids that still point at the same content. resolve() returns the first non-empty matching
// node fully inside the range (or the first one if all are empty), so a split keeps the id on its
// first half, never resolves to an empty paragraph, and a merge (which drops the range) resolves
// to nothing.

export class BlockRefs {
  constructor(editor) {
    this.editor = editor;
    this.entries = new Map(); // id -> { start, end, kind: 'block'|'table' }
    this.byPos = new Map(); // `${kind}:${pos}` -> id (cleared on every docChanged transaction)
    this.counts = { block: 0, table: 0 };
    this.onTransaction = ({ transaction }) => {
      if (!transaction.docChanged) return;
      this.byPos.clear();
      this.entries.forEach((entry) => {
        entry.start = transaction.mapping.mapResult(entry.start, 1).pos;
        entry.end = transaction.mapping.mapResult(entry.end, -1).pos;
      });
    };
    editor.on('transaction', this.onTransaction);
  }

  register(pos, kind, node) {
    const key = `${kind}:${pos}`;
    const cached = this.byPos.get(key);
    if (cached) return cached;
    // Reuse an id only if it still resolves to the node at `pos` (after a split its range also
    // covers the new block, which may be the one it resolves to).
    const existing = Array.from(this.entries.entries())
      .find(([id, e]) => e.end > e.start && e.start === pos && e.kind === kind && this.resolve(id)?.pos === pos)?.[0];
    if (existing) {
      this.byPos.set(key, existing);
      return existing;
    }
    const target = node || this.editor.state.doc.nodeAt(pos);
    this.counts[kind] += 1;
    const id = `${kind === 'table' ? 't' : 'b'}${this.counts[kind]}`;
    this.entries.set(id, { start: pos, end: pos + (target ? target.nodeSize : 0), kind });
    this.byPos.set(key, id);
    return id;
  }

  idFor(pos, node) {
    return this.register(pos, 'block', node);
  }

  tableIdFor(pos, node) {
    return this.register(pos, 'table', node);
  }

  resolve(id) {
    const entry = this.entries.get(String(id || '').trim());
    if (!entry || entry.end <= entry.start) return null;
    const { start, end, kind } = entry;
    let best = null;
    this.editor.state.doc.nodesBetween(start, end, (node, pos) => {
      const matches = kind === 'block' ? node.isTextblock : node.type.name === 'table';
      if (!matches) return true;
      if (pos >= start && pos + node.nodeSize <= end) {
        // The first non-empty match wins, so a split keeps the id on its first half.
        if (!best || (!best.node.content.size && node.content.size)) best = { node, pos };
        return false; // do not descend into a matched node
      }
      return true;
    });
    return best;
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
