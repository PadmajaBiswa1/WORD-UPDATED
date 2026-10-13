import { TableView } from '@tiptap/extension-table';

// The resizable TableView updates column widths but does not render table attributes.
export class StyledTableView extends TableView {
  constructor(node, cellMinWidth) {
    super(node, cellMinWidth);
    this.syncAttributes(node);
  }

  syncAttributes(node) {
    for (const [attribute, key] of [['class', 'class'], ['data-theme', 'theme'], ['align', 'align'], ['data-align', 'align'], ['id', 'id']]) {
      if (node.attrs[key]) this.table.setAttribute(attribute, node.attrs[key]);
      else this.table.removeAttribute(attribute);
    }
    const width = this.table.style.width;
    const minWidth = this.table.style.minWidth;
    this.table.style.cssText = node.attrs.style || '';
    if (!this.table.style.width) this.table.style.width = width;
    if (!this.table.style.minWidth) this.table.style.minWidth = minWidth;
  }

  update(node) {
    if (!super.update(node)) return false;
    this.syncAttributes(node);
    return true;
  }
}
