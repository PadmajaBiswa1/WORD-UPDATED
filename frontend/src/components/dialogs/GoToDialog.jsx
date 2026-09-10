import { useState } from 'react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { Modal, Button, Input, Label, Stack, Select } from '@/components/ui';

const TARGET_OPTIONS = [
  { value: 'page', label: 'Page' },
  { value: 'paragraph', label: 'Line / Paragraph' },
];

export function GoToDialog() {
  const { closeDialog, toast, zoom, setActivePage } = useUIStore();
  const { editor } = useEditorStore();
  const { pageCount, wordCount } = useDocumentStore();
  
  const [targetType, setTargetType] = useState('page');
  const [targetValue, setTargetValue] = useState('1');

  const handleClose = () => {
    closeDialog('goTo');
  };

  const handleGoTo = () => {
    const num = parseInt(targetValue.trim(), 10);
    if (!Number.isFinite(num) || num < 1) {
      toast('Please enter a valid positive number', 'error');
      return;
    }

    if (targetType === 'page') {
      const maxPages = Math.max(1, pageCount || 1);
      const clampedPage = Math.min(maxPages, Math.max(1, num));
      const pageIndex = clampedPage - 1;
      
      setActivePage(pageIndex);

      const scrollEl = document.getElementById('editor-scroll-area');
      if (scrollEl) {
        // Approximate page height in pixels scaled
        const pageStep = (1123 + 24) * (zoom / 100);
        scrollEl.scrollTo({
          top: pageIndex * pageStep,
          behavior: 'smooth',
        });
      }

      toast(`Jumped to Page ${clampedPage}`, 'success');
      handleClose();
    } else {
      // Jump to paragraph
      if (!editor) return;
      const doc = editor.state.doc;
      let currentParaIndex = 0;
      let targetPos = null;

      doc.descendants((node, pos) => {
        if (node.isTextblock) {
          currentParaIndex += 1;
          if (currentParaIndex === num) {
            targetPos = pos + 1;
            return false;
          }
        }
      });

      if (targetPos !== null) {
        editor.chain().focus().setTextSelection(targetPos).scrollIntoView().run();
        toast(`Jumped to Paragraph ${num}`, 'success');
        handleClose();
      } else {
        toast(`Paragraph ${num} not found (document has ${currentParaIndex} paragraphs)`, 'info');
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGoTo();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  return (
    <Modal title="Go To (Ctrl+G)" onClose={handleClose} width={420}>
      <Stack gap={14}>
        <div>
          <Label>Go to what:</Label>
          <Select
            options={TARGET_OPTIONS}
            value={targetType}
            onChange={(val) => setTargetType(val)}
            width="100%"
          />
        </div>

        <div>
          <Label>
            {targetType === 'page'
              ? `Enter page number (1 – ${Math.max(1, pageCount || 1)}):`
              : 'Enter line / paragraph number:'}
          </Label>
          <Input
            value={targetValue}
            onChange={(v) => setTargetValue(v)}
            onKeyDown={handleKeyDown}
            placeholder={targetType === 'page' ? 'e.g. 1' : 'e.g. 5'}
            autoFocus
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            {targetType === 'page'
              ? `Document contains ${pageCount || 1} page${(pageCount || 1) !== 1 ? 's' : ''}`
              : `Total words in document: ${wordCount || 0}`}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleGoTo}>
            Go To
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
