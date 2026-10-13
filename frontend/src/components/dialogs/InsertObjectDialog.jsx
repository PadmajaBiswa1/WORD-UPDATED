import { useRef, useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button } from '@/components/ui';
import { docxToHtml } from '@/services/docxImport';
import { markdownToHtml } from '@/services/ai';
import { printableHtml } from '@/utils/printUtils';

const ACCEPT = '.docx,.txt,.md,.markdown,.html,.htm';
const esc = (text) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// A file's content as HTML for the editor. Untrusted HTML is sanitized.
export async function fileToHtml(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return (await docxToHtml(await file.arrayBuffer())).html;
  const text = await file.text();
  if (name.endsWith('.md') || name.endsWith('.markdown')) return printableHtml(markdownToHtml(text));
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const body = new DOMParser().parseFromString(text, 'text/html').body;
    return printableHtml(body?.innerHTML || '');
  }
  return text.trim().split(/\r?\n\r?\n/).map((para) => `<p>${esc(para).replace(/\r?\n/g, '<br>')}</p>`).join('');
}

// Insert > Object > Text from File, as in Word: the content of a Word, text,
// Markdown or web page file goes in at the cursor.
export function InsertObjectDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const close = () => closeDialog('insertObject');

  const insertFile = async (file) => {
    if (!file || !editor) return;
    setBusy(true);
    try {
      const html = await fileToHtml(file);
      if (!html.trim()) { toast('That file has no text to insert', 'info'); return; }
      editor.chain().focus().insertContent(html).run();
      toast(`Inserted text from ${file.name}`, 'success');
      close();
    } catch (err) {
      toast(`Could not read ${file.name}: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Object" onClose={close} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>Text from File</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Insert the contents of a Word document (.docx), text file, Markdown file or web page at the cursor.
        </div>
        <input ref={input} type="file" accept={ACCEPT} aria-label="File to insert" style={{ display: 'none' }}
          onChange={(e) => { insertFile(e.target.files?.[0]); e.target.value = ''; }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Inserting…' : 'Choose file…'}</Button>
        </div>
      </div>
    </Modal>
  );
}
