import { useState } from 'react';
import { useUIStore, useDocumentStore, useEditorStore } from '@/store';
import { Modal, Button, Stack } from '@/components/ui';
import { exportToHtml, exportToPdf, exportToDocx, exportToMarkdown, exportToEpub } from '@/services/export';

const OPTIONS = [
  { id: 'pdf',      icon: '📄', label: 'PDF Document',   desc: 'Best for printing & sharing' },
  { id: 'docx',     icon: '📝', label: 'Word Document',  desc: 'Open in Microsoft Word' },
  { id: 'html',     icon: '🌐', label: 'Web Page',       desc: 'HTML file for browsers' },
  { id: 'markdown', icon: '📋', label: 'Markdown (.md)', desc: 'Plain text with lightweight formatting' },
  { id: 'epub',     icon: '📚', label: 'EPUB (.epub)',   desc: 'Standard e-book reader format' },
];

export function ExportDialog() {
  const { closeDialog, toast, pageSize, pageOrientation } = useUIStore();
  const { title }   = useDocumentStore();
  const { editor }  = useEditorStore();
  const [loading, setLoading] = useState(null);

  const doExport = async (type) => {
    setLoading(type);
    try {
      const html = editor?.getHTML() || '';
      if (type === 'html') exportToHtml(title, html);
      else if (type === 'markdown' || type === 'md') {
        exportToMarkdown(title, html);
      } else if (type === 'epub') {
        await exportToEpub(title, html);
      } else if (type === 'pdf') {
        const el = document.getElementById('document-page-0') ||
                   document.querySelector('.page') ||
                   document.querySelector('.document-page') ||
                   document.querySelector('.ProseMirror') ||
                   document.querySelector('.document-editor');
        const pageSettings = {
          format: pageSize || 'a4',
          orientation: pageOrientation || 'portrait',
        };
        if (el) {
          await exportToPdf(title, el, pageSettings);
        } else {
          const frame = document.createElement('div');
          frame.style.position = 'fixed';
          frame.style.left = '-10000px';
          frame.style.top = '0';
          frame.style.width = '794px';
          frame.style.background = '#ffffff';
          frame.style.padding = '40px';
          frame.innerHTML = html || '<p></p>';
          document.body.appendChild(frame);
          try {
            await exportToPdf(title, frame, pageSettings);
          } finally {
            frame.remove();
          }
        }
      } else if (type === 'docx') {
        await exportToDocx(title, html);
      }
      toast(`Exported as ${type.toUpperCase()}`, 'success');
      closeDialog('exportDoc');
    } catch (err) {
      toast(`Export failed: ${err.message}`, 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal title="Export Document" onClose={() => closeDialog('exportDoc')} width={400}>
      <Stack gap={10}>
        {OPTIONS.map((opt) => (
          <button key={opt.id} onClick={() => doExport(opt.id)} disabled={!!loading}
            style={{
              display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
              background: 'var(--bg-elevated)', border:'1px solid var(--border)',
              borderRadius:'var(--radius-md)', cursor: loading ? 'not-allowed':'pointer',
              opacity: loading && loading !== opt.id ? 0.5 : 1,
              transition: 'var(--transition)', width:'100%', textAlign:'left',
            }}
            onMouseEnter={(e) => { if(!loading) { e.currentTarget.style.borderColor='var(--gold)'; e.currentTarget.style.background='var(--bg-hover)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--bg-elevated)'; }}>
            <span style={{ fontSize:28 }}>{opt.icon}</span>
            <div>
              <div style={{ fontFamily:'var(--font-ui)', fontSize:14, fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>
                {loading === opt.id ? 'Exporting…' : opt.label}
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-ui)' }}>{opt.desc}</div>
            </div>
            <div style={{ marginLeft:'auto', color:'var(--gold)', fontSize:18 }}>
              {loading === opt.id ? <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> : '→'}
            </div>
          </button>
        ))}
        <Button variant="subtle" onClick={() => closeDialog('exportDoc')} style={{ marginTop:4 }}>Cancel</Button>
      </Stack>
    </Modal>
  );
}
