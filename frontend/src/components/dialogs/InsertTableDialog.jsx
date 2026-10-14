import { useState } from 'react';
import { AlignLeft, AlignCenter, AlignRight, Table2 } from 'lucide-react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, NumberInput, Stack, Label } from '@/components/ui';

export function InsertTableDialog() {
  const { closeDialog } = useUIStore();
  const { editor } = useEditorStore();
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [header, setHeader] = useState(true);
  const [alignment, setAlignment] = useState('left'); // 'left' | 'center' | 'right'
  const [hoverCell, setHoverCell] = useState(null); // {r, c}
  const [gridFocus, setGridFocus] = useState(0);

  const GRID = 12;

  const insertTable = (r = rows, c = cols, align = alignment) => {
    const nextRows = Math.max(1, parseInt(String(r), 10) || 3);
    const nextCols = Math.max(1, parseInt(String(c), 10) || 3);
    editor?.chain().focus().insertTable({ rows: nextRows, cols: nextCols, withHeaderRow: header }).run();
    if (align) {
      setTimeout(() => {
        if (!editor) return;
        const { state, view } = editor;
        const { $from } = state.selection;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'table') {
            const tablePos = $from.before(d);
            const tableNode = $from.node(d);
            let marginStyle = 'margin-left: 0; margin-right: auto;';
            if (align === 'center') {
              marginStyle = 'margin-left: auto; margin-right: auto;';
            } else if (align === 'right') {
              marginStyle = 'margin-left: auto; margin-right: 0;';
            }
            view.dispatch(state.tr.setNodeMarkup(tablePos, undefined, {
              ...tableNode.attrs,
              align,
              'data-align': align,
              class: `table-align-${align}`,
              style: marginStyle,
            }));
            break;
          }
        }
      }, 50);
    }
    closeDialog('insertTable');
  };

  return (
    <Modal title="Insert Table" description="Choose the size and layout for your table." icon={Table2}
      onClose={() => closeDialog('insertTable')} width={460}
      footer={<>
        <Button variant="subtle" onClick={() => closeDialog('insertTable')}>Cancel</Button>
        <Button variant="primary" onClick={() => insertTable()}>Insert {rows} × {cols} table</Button>
      </>}>
      <Stack gap={20}>
        {/* Visual grid picker */}
        <div>
          <div className="table-picker__heading">
            <Label>Quick pick</Label>
            <span className="table-picker__size" aria-live="polite">{hoverCell ? `${hoverCell.r + 1} × ${hoverCell.c + 1}` : `${rows} × ${cols}`}</span>
          </div>
          <div className="table-picker__grid" onMouseLeave={() => setHoverCell(null)}>
            {Array.from({ length: GRID * GRID }).map((_, i) => {
              const r = Math.floor(i / GRID), c = i % GRID;
              const lit = hoverCell ? (r <= hoverCell.r && c <= hoverCell.c) : (r < rows && c < cols);
              return (
                <button key={i} type="button" className="table-picker__cell"
                  tabIndex={i === gridFocus ? 0 : -1}
                  aria-label={`Insert ${r + 1} rows by ${c + 1} columns`}
                  data-selected={lit}
                  onMouseEnter={() => setHoverCell({ r, c })}
                  onFocus={() => { setGridFocus(i); setHoverCell({ r, c }); }}
                  onBlur={() => setHoverCell(null)}
                  onKeyDown={(e) => {
                    const targets = {
                      ArrowLeft: r * GRID + Math.max(0, c - 1),
                      ArrowRight: r * GRID + Math.min(GRID - 1, c + 1),
                      ArrowUp: Math.max(0, r - 1) * GRID + c,
                      ArrowDown: Math.min(GRID - 1, r + 1) * GRID + c,
                    };
                    if (targets[e.key] === undefined) return;
                    e.preventDefault();
                    e.currentTarget.parentElement.children[targets[e.key]]?.focus();
                  }}
                  onClick={() => { setRows(r+1); setCols(c+1); insertTable(r+1, c+1); }}
                />
              );
            })}
          </div>
          <div className="table-picker__hint">
            Hover to preview. Click a cell to insert.
          </div>
        </div>

        {/* Manual input */}
        <div>
          <Label>Custom size</Label>
          <div className="table-picker__options" style={{ marginTop: 8 }}>
            <NumberInput label="Rows" value={rows} onChange={setRows} min={1} max={100} />
            <NumberInput label="Columns" value={cols} onChange={setCols} min={1} max={50} />
          </div>
        </div>

        {/* Table Alignment */}
        <div>
          <Label>Table alignment</Label>
          <div className="table-picker__alignment">
            {[
              { id: 'left', label: 'Left', icon: AlignLeft },
              { id: 'center', label: 'Center', icon: AlignCenter },
              { id: 'right', label: 'Right', icon: AlignRight },
            ].map((opt) => (
              <Button
                key={opt.id}
                type="button"
                variant="ghost"
                aria-pressed={alignment === opt.id}
                size="sm"
                onClick={() => setAlignment(opt.id)}
                style={{ flex: 1 }}
              >
                <opt.icon size={14} aria-hidden="true" />{opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Header row toggle */}
        <label className="table-picker__header">
          <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} style={{ accentColor:'var(--gold)', cursor: 'pointer' }} />
          Include header row
        </label>
      </Stack>
    </Modal>
  );
}
