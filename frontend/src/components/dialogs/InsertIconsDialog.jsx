import { useEffect, useMemo, useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Input } from '@/components/ui';

const pascal = (name) => name.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
const COLORS = ['#000000', '#1f4e79', '#c00000', '#2e7d32', '#7030a0', '#d4af37'];
const PAGE = 120;

// The icon as a standalone SVG image, in the chosen colour, at Word's 1" default.
export function iconImageSrc(svg, color) {
  const sized = svg.trim().replace('width="24"', 'width="96"').replace('height="24"', 'height="96"').replaceAll('currentColor', color);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
}

// Insert > Icons: search the Lucide icon set (loaded on first open) and insert
// icons as pictures, so the picture tools (size, wrap, position) apply.
export function InsertIconsDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [icons, setIcons] = useState(null);
  const [tags, setTags] = useState({});
  const [query, setQuery] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [picked, setPicked] = useState([]);
  const [limit, setLimit] = useState(PAGE);
  const close = () => closeDialog('insertIcons');

  useEffect(() => {
    let alive = true;
    Promise.all([import('lucide-static'), import('lucide-static/tags.json')])
      .then(([mod, tagData]) => { if (alive) { setIcons(mod); setTags(tagData.default || tagData); } })
      .catch(() => { if (alive) toast('Could not load icons', 'error'); });
    return () => { alive = false; };
  }, [toast]);

  const matches = useMemo(() => {
    if (!icons) return [];
    const q = query.trim().toLowerCase();
    return Object.keys(tags).filter((name) => icons[pascal(name)] && (!q || name.includes(q) || tags[name].some((tag) => tag.includes(q))));
  }, [icons, tags, query]);

  const toggle = (name) => setPicked((list) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]));

  const insert = () => {
    if (!editor || !picked.length) return;
    // One insert for all icons: chained setImage calls would each replace the
    // image the previous one left selected.
    editor.chain().focus().insertContent(picked.map((name) => ({
      type: 'image', attrs: { src: iconImageSrc(icons[pascal(name)], color), alt: `${name} icon`, width: '96' },
    }))).run();
    toast(picked.length === 1 ? 'Icon inserted' : `${picked.length} icons inserted`, 'success');
    close();
  };

  return (
    <Modal title="Insert Icons" onClose={close} width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Input autoFocus placeholder="Search icons, e.g. heart, arrow, chart" value={query} onChange={(value) => { setQuery(value); setLimit(PAGE); }} aria-label="Search icons" />
          <div role="radiogroup" aria-label="Icon colour" style={{ display: 'flex', gap: 4 }}>
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} title={c} onClick={() => setColor(c)}
                style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2px solid var(--gold)' : '1px solid var(--border)' }} />
            ))}
          </div>
        </div>
        <div style={{ height: 340, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 6, alignContent: 'start', padding: 2 }}>
          {!icons && <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: 13 }}>Loading icons…</div>}
          {icons && !matches.length && <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: 13 }}>No icons match “{query}”.</div>}
          {matches.slice(0, limit).map((name) => (
            <button key={name} type="button" title={name} aria-pressed={picked.includes(name)} onClick={() => toggle(name)}
              style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 8, cursor: 'pointer',
                background: picked.includes(name) ? 'rgba(212,175,55,0.16)' : 'var(--bg-elevated)', border: picked.includes(name) ? '1px solid var(--gold)' : '1px solid var(--border)' }}>
              <img alt="" src={iconImageSrc(icons[pascal(name)], '#c4c2bd')} style={{ width: 24, height: 24 }} />
              <span style={{ fontSize: 9.5, color: 'var(--text-muted)', maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            </button>
          ))}
          {matches.length > limit && (
            <button type="button" onClick={() => setLimit((n) => n + PAGE)} style={{ gridColumn: '1 / -1', padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Show more ({matches.length - limit} left)
            </button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{picked.length ? `${picked.length} selected` : 'Click icons to select them'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={insert} disabled={!picked.length}>Insert</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
