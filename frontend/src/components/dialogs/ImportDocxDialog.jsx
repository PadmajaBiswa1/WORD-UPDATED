import { useRef, useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Stack } from '@/components/ui';

export function ImportDocxDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      toast('Please select a .docx file', 'warning');
      return;
    }

    setFileName(file.name);
    setLoading(true);

    try {
      // Dynamically import mammoth
      const mammoth = (await import('mammoth')).default;
      
      // Read file as array buffer
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result;
          if (!arrayBuffer) {
            toast('Failed to read file', 'error');
            return;
          }

          // Convert DOCX to HTML
          const result = await mammoth.convertToHtml({ arrayBuffer });
          
          if (!result.value) {
            toast('No content found in document', 'warning');
            setLoading(false);
            return;
          }

          // Clean up any problematic HTML
          let html = result.value;
          
          // Remove any artificial page break patterns
          html = html.replace(/style="page-break-after[^"]*"/g, '');
          
          // Replace unnecessary wrapping divs with paragraphs
          html = html.replace(/<div[^>]*>(.*?)<\/div>/g, '<p>$1</p>');
          
          // Preserve reasonable spacing
          html = html.replace(/<p><\/p>/g, '<p>&nbsp;</p>');

          if (!editor) {
            toast('Editor not ready', 'error');
            setLoading(false);
            return;
          }

          // Insert content
          editor.chain().focus().insertContent(html).run();
          
          toast(`Imported "${file.name}" successfully`, 'success');
          closeDialog('importDocx');
          setFileName('');
          setLoading(false);
        } catch (err) {
          toast(`Import error: ${err.message}`, 'error');
          setLoading(false);
        }
      };

      reader.onerror = () => {
        toast('Failed to read file', 'error');
        setLoading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      toast(`Import failed: ${err.message}`, 'error');
      setLoading(false);
    }
  };

  return (
    <Modal title="Import DOCX Document" onClose={() => closeDialog('importDocx')} width={400}>
      <Stack gap={12}>
        <div>
          <div style={{ 
            padding: '20px', 
            border: '2px dashed var(--border)',
            borderRadius: '4px',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s'
          }}
          onDragOver={(e) => {
            if (!loading) {
              e.preventDefault();
              e.currentTarget.style.borderColor = 'var(--gold)';
              e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)';
            }
          }}
          onDragLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }
          }}
          onDrop={(e) => {
            if (loading) return;
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'var(--bg-secondary)';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
              fileInputRef.current.files = files;
              handleFileSelect({ target: { files } });
            }
          }}
          onClick={() => !loading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              disabled={loading}
            />
            
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {loading ? 'Importing...' : fileName || 'Select or drop DOCX file'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {loading ? 'Converting document...' : 'Click to browse or drag & drop'}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong>Supported:</strong> Formatting, headings, lists, tables, images, hyperlinks
        </div>

        <Stack gap={8} direction="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('importDocx')} disabled={loading}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
