import { useState } from 'react';
import { useDocumentStore, useEditorStore, useUIStore } from '@/store';
import { Modal, Input, Button } from '@/components/ui';

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function BookmarkDialog() {
  const editor = useEditorStore((s) => s.editor);
  const closeDialog = useUIStore((s) => s.closeDialog);
  const toast = useUIStore((s) => s.toast);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const close = () => closeDialog('bookmark');
  const add = () => {
    const id = name.trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) return setError('Start with a letter. Use letters, numbers, underscores, or hyphens.');
    let duplicate = false;
    editor?.state.doc.descendants((node) => { if (node.attrs.id === id) duplicate = true; });
    if (duplicate) return setError('This bookmark name already exists.');
    const type = ['heading', 'paragraph', 'blockquote', 'table'].find((type) => editor?.isActive(type));
    if (!type) return setError('Place cursor in a paragraph or heading first.');
    editor.chain().focus().updateAttributes(type, { id }).run();
    toast('Bookmark added', 'success'); close();
  };
  return <Modal title="Add bookmark" onClose={close}>
    <p style={{ marginBottom: 14 }}>Name the current paragraph so you can link to it later.</p>
    <Input aria-label="Bookmark name" value={name} onChange={setName} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
    {error && <p role="alert" style={{ marginTop: 12, color: '#ef7777' }}>{error}</p>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={add}>Add bookmark</Button></div>
  </Modal>;
}

export function CrossReferenceDialog() {
  const editor = useEditorStore((s) => s.editor);
  const closeDialog = useUIStore((s) => s.closeDialog);
  const entries = [];
  editor?.state.doc.descendants((node) => { if (node.attrs.id) entries.push({ id: node.attrs.id, label: node.textContent || node.attrs.id }); });
  const [target, setTarget] = useState(entries[0]?.id || '');
  const [label, setLabel] = useState('');
  const close = () => closeDialog('crossReference');
  return <Modal title="Insert cross-reference" onClose={close}>
    {entries.length ? <>
      <label>Bookmark<select aria-label="Reference target" className="studio-setting-input" value={target} onChange={(e) => setTarget(e.target.value)}>
        {entries.map((entry, index) => <option key={`${entry.id}-${index}`} value={entry.id}>{entry.id} · {entry.label.slice(0, 50)}</option>)}
      </select></label>
      <Input aria-label="Link text" placeholder="Link text (optional)" value={label} onChange={setLabel} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}><Button onClick={close}>Cancel</Button>
        <Button variant="primary" onClick={() => { editor.chain().focus().insertContent(`<a href="#${escape(target)}">${escape(label || target)}</a>`).run(); close(); }}>Insert reference</Button>
      </div>
    </> : <p>Add a bookmark in your document before inserting a cross-reference.</p>}
  </Modal>;
}

export function CoverPageDialog() {
  const editor = useEditorStore((s) => s.editor);
  const title = useDocumentStore((s) => s.title);
  const closeDialog = useUIStore((s) => s.closeDialog);
  const [heading, setHeading] = useState(title === 'Untitled Document' ? '' : title);
  const [subtitle, setSubtitle] = useState('');
  const [style, setStyle] = useState('editorial');
  const close = () => closeDialog('templates');
  return <Modal title="Insert cover page" onClose={close}>
    <div style={{ display: 'grid', gap: 14 }}>
      <Input aria-label="Cover title" value={heading} onChange={setHeading} placeholder="Document title" autoFocus />
      <Input aria-label="Cover subtitle" value={subtitle} onChange={setSubtitle} placeholder="Subtitle or author" />
      <select aria-label="Cover style" className="studio-setting-input" value={style} onChange={(e) => setStyle(e.target.value)}>
        <option value="editorial">Editorial</option><option value="centered">Centered</option><option value="minimal">Minimal</option>
      </select>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Button onClick={close}>Cancel</Button>
        <Button variant="primary" disabled={!heading.trim()} onClick={() => {
          const alignment = style === 'centered' ? 'center' : 'left';
          editor.chain().focus().insertContentAt(0, `<h1 style="text-align:${alignment};font-size:36pt">${escape(heading)}</h1><p style="text-align:${alignment}">${escape(subtitle)}</p><div data-page-break="true" data-manual="true"></div><p></p>`).run(); close();
        }}>Insert cover</Button>
      </div>
    </div>
  </Modal>;
}
