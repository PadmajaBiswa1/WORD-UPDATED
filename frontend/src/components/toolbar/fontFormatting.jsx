import { useCallback, useEffect, useRef } from 'react';
import { Select } from '@/components/ui';
import { useEditorStore } from '@/store';

export const FONT_STACKS = {
  'Crimson Pro': '"Crimson Pro", "Noto Serif", serif',
  Calibri: 'Calibri, "Segoe UI", sans-serif',
  Arial: 'Arial, sans-serif',
  'Times New Roman': '"Times New Roman", serif',
  Garamond: 'Garamond, serif',
  Georgia: 'Georgia, serif',
  Helvetica: 'Helvetica, Arial, sans-serif',
  Verdana: 'Verdana, sans-serif',
  'Courier New': '"Courier New", monospace',
  'Trebuchet MS': '"Trebuchet MS", sans-serif',
  'Segoe UI': '"Segoe UI", sans-serif',
  'Nirmala UI': '"Nirmala UI", sans-serif',
  'Microsoft YaHei': '"Microsoft YaHei", sans-serif',
  'Malgun Gothic': '"Malgun Gothic", sans-serif',
  Meiryo: 'Meiryo, sans-serif',
  'Yu Gothic UI': '"Yu Gothic UI", sans-serif',
  'Leelawadee UI': '"Leelawadee UI", sans-serif',
  Ebrama: 'Ebrama, sans-serif',
  'Noto Sans': '"Noto Sans", sans-serif',
  'Noto Sans Devanagari': '"Noto Sans Devanagari", sans-serif',
  'Noto Naskh Arabic': '"Noto Naskh Arabic", sans-serif',
};

export const FONT_FAMILY_OPTIONS = [
  'Calibri', 'Crimson Pro', 'Times New Roman', 'Arial', 'Garamond',
  'Georgia', 'Helvetica', 'Verdana', 'Courier New', 'Trebuchet MS',
  'Segoe UI', 'Nirmala UI', 'Microsoft YaHei', 'Malgun Gothic',
  'Meiryo', 'Yu Gothic UI', 'Leelawadee UI', 'Ebrama',
  'Noto Sans', 'Noto Sans Devanagari', 'Noto Naskh Arabic',
].map((family) => ({
  value: family,
  label: family,
  style: { fontFamily: FONT_STACKS[family] || `${family}, sans-serif` },
  searchTerms: family,
}));

export const FONT_SIZE_OPTIONS = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72']
  .map((size) => ({ value: size, label: size }));

export function useFontFormattingControls(editor) {
  const { setFontFamily, setFontSize } = useEditorStore();
  const lastSelectionRef = useRef(null);

  useEffect(() => {
    if (!editor) return;
    const handleSelectionUpdate = () => {
      const { selection } = editor.state;
      if (!selection.empty) {
        lastSelectionRef.current = { from: selection.from, to: selection.to };
      }
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor]);

  const snapshotSelection = useCallback(() => {
    if (!editor) return;
    const { selection } = editor.state;
    if (!selection.empty) {
      lastSelectionRef.current = { from: selection.from, to: selection.to };
    }
  }, [editor]);

  const applyFontFamily = useCallback((value) => {
    if (!editor || !value) return;
    setFontFamily(value);

    const stack = FONT_STACKS[value] || `${value}, sans-serif`;
    const chain = editor.chain().focus();
    
    // If the live selection was lost due to dropdown focus, restore the saved range
    if (editor.state.selection.empty && lastSelectionRef.current) {
      const { from, to } = lastSelectionRef.current;
      const maxPos = editor.state.doc.content.size;
      if (from <= maxPos && to <= maxPos) {
        chain.setTextSelection({ from, to });
      }
    }

    chain.setFontFamily(stack).run();
  }, [editor, setFontFamily]);

  const applyFontSize = useCallback((value) => {
    if (!editor || !value) return;
    const next = String(value);
    setFontSize(next);

    const chain = editor.chain().focus();
    
    // If the live selection was lost due to dropdown focus, restore the saved range
    if (editor.state.selection.empty && lastSelectionRef.current) {
      const { from, to } = lastSelectionRef.current;
      const maxPos = editor.state.doc.content.size;
      if (from <= maxPos && to <= maxPos) {
        chain.setTextSelection({ from, to });
      }
    }

    chain.setFontSize(`${next}pt`).run();
  }, [editor, setFontSize]);

  return { applyFontFamily, applyFontSize, snapshotSelection };
}

export function FontFormattingControls({
  editor,
  fontFamily,
  fontSize,
  familyWidth = 140,
  sizeWidth = 64,
  searchable = true,
  searchPlaceholder = 'Search fonts...',
  applyFontFamily: applyFontFamilyProp,
  applyFontSize: applyFontSizeProp,
  onFocus,
}) {
  const controls = useFontFormattingControls(editor);
  const applyFontFamily = applyFontFamilyProp || controls.applyFontFamily;
  const applyFontSize = applyFontSizeProp || controls.applyFontSize;
  const snapshotSelection = controls.snapshotSelection;

  const handleFocus = (e) => {
    snapshotSelection();
    onFocus?.(e);
  };

  return (
    <>
      <Select
        value={fontFamily}
        onChange={applyFontFamily}
        onFocus={handleFocus}
        options={FONT_FAMILY_OPTIONS}
        width={familyWidth}
        title="Font Family"
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
      />
      <Select
        value={fontSize}
        onChange={applyFontSize}
        onFocus={handleFocus}
        options={FONT_SIZE_OPTIONS}
        width={sizeWidth}
        title="Font Size"
        searchable={true}
        searchPlaceholder="Size..."
      />
    </>
  );
}