import { useEffect, useState } from 'react';
import { listSuggestionIds } from '@/ai/suggestions';

function selectSuggestion(editor, id) {
  const el = editor.view.dom.querySelector(`[data-suggestion="${CSS.escape(id)}"]`);
  if (!el) return;
  const pos = editor.view.posAtDOM(el, 0);
  editor.chain().focus().setTextSelection(pos).run();
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function SuggestionReview({ editor }) {
  const [ids, setIds] = useState([]);
  const [index, setIndex] = useState(0);
  const [popover, setPopover] = useState(null); // { id, x, y }

  useEffect(() => {
    if (!editor) return undefined;
    const refresh = () => setIds(listSuggestionIds(editor.state.doc));
    refresh();
    editor.on('update', refresh);
    const onClick = (event) => {
      const el = event.target.closest?.('[data-suggestion]');
      const id = el?.getAttribute('data-suggestion');
      // No popover without a real suggestion id: there is nothing to accept or reject.
      if (!el || !id) { setPopover(null); return; }
      const rect = el.getBoundingClientRect();
      setPopover({ id, x: rect.left, y: rect.bottom + 6 });
    };
    editor.view.dom.addEventListener('click', onClick);
    return () => {
      editor.off('update', refresh);
      editor.view.dom.removeEventListener('click', onClick);
    };
  }, [editor]);

  if (!editor || !ids.length) return null;
  const go = (step) => {
    const next = (index + step + ids.length) % ids.length;
    setIndex(next);
    selectSuggestion(editor, ids[next]);
  };
  const act = (command, id) => {
    editor.chain().focus()[command](id).run();
    setPopover(null);
  };
  const actOne = (command, id) => {
    if (!id) return;
    act(command, id);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderTop: '1px solid var(--border)', fontSize: 12 }}>
        <span style={{ flex: 1, color: 'var(--text-secondary)' }}>Pragna changes ({ids.length})</span>
        <button type="button" onClick={() => go(-1)} title="Previous change">‹</button>
        <button type="button" onClick={() => go(1)} title="Next change">›</button>
        <button type="button" onClick={() => act('acceptAllSuggestions')}>Accept all</button>
        <button type="button" onClick={() => act('rejectAllSuggestions')}>Reject all</button>
      </div>
      {popover && (
        <div className="etherx-suggestion-popover" style={{ left: popover.x, top: popover.y }}>
          <button type="button" style={{ background: '#6fcf8f', color: '#10200f' }} onClick={() => actOne('acceptSuggestion', popover.id)}>✓ Accept</button>
          <button type="button" style={{ background: '#d8443d', color: '#fff' }} onClick={() => actOne('rejectSuggestion', popover.id)}>✗ Reject</button>
        </div>
      )}
    </>
  );
}
