import { useUIStore, useEditorStore } from '@/store';
import { HandwritingRecognitionModal } from '@/components/handwriting/HandwritingRecognitionModal';

/**
 * Handwriting Recognition Dialog adapter for EtherX Word.
 * Integrates the modular HandwritingRecognitionModal with the active document editor and store.
 */
export function HandwritingDialog() {
  const { dialogs, closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();

  const isOpen = Boolean(dialogs.handwriting);

  const handleInsert = (html, plainText, metadata) => {
    if (!editor) {
      toast('Please open or select a document first', 'warning');
      return;
    }

    try {
      // Focus editor and insert content at current cursor position / selection
      editor.chain().focus().insertContent(html).run();

      if (metadata?.lowConfidence) {
        toast('Handwritten text inserted (Note: low recognition confidence)', 'warning');
      } else {
        toast('Handwritten text inserted successfully', 'success');
      }
    } catch (err) {
      console.error('Failed to insert recognized handwriting into editor:', err);
      toast('Failed to insert content into document', 'error');
    }
  };

  return (
    <HandwritingRecognitionModal
      isOpen={isOpen}
      onClose={() => closeDialog('handwriting')}
      onInsert={handleInsert}
    />
  );
}
