// ── Layout Tab ───────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Button, Tooltip, Select } from '@/components/ui';
import { RibbonGroup } from '../RibbonGroup';
import { recalculatePages } from '@/utils/paginationUtils';

// Page dimension maps (px at 96dpi)
const PAGE_SIZES = {
  a4:     { w: 794,  h: 1123 },
  letter: { w: 816,  h: 1056 },
  legal:  { w: 816,  h: 1344 },
  a3:     { w: 1123, h: 1587 },
};

const MARGIN_MAP = {
  normal:   96,
  narrow:   48,
  moderate: 72,
  wide:     144,
};

const MARGIN_OPTIONS = [
  { value: 'normal',   label: 'Normal'   },
  { value: 'narrow',   label: 'Narrow'   },
  { value: 'moderate', label: 'Moderate' },
  { value: 'wide',     label: 'Wide'     },
];

const SIZE_OPTIONS = [
  { value: 'a4',     label: 'A4'     },
  { value: 'letter', label: 'Letter' },
  { value: 'legal',  label: 'Legal'  },
  { value: 'a3',     label: 'A3'     },
];

const COLUMN_OPTIONS = [
  { value: '1', label: 'One' },
  { value: '2', label: 'Two' },
  { value: '3', label: 'Three' },
];

const INDENT_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3];
const SPACING_OPTIONS = [0, 6, 8, 10, 12, 18, 24, 30];

const parseCssStyle = (style = '') => {
  const out = {};
  style.split(';').forEach((pair) => {
    const [k, v] = pair.split(':').map((s) => s?.trim());
    if (k && v) out[k] = v;
  });
  return out;
};

const toCssStyle = (obj) => Object.entries(obj)
  .filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([k, v]) => `${k}:${v}`)
  .join(';');

const pxToCm = (px = 0) => Number((px / 37.795).toFixed(1));
const cmToPx = (cm = 0) => Math.round(cm * 37.795);

// Apply page layout to the live DOM element
function applyPageLayout({ size, orientation, margin, columns }) {
  const pageEls = Array.from(document.querySelectorAll('[id^="document-page-"]'));
  const pm = document.querySelector('.ProseMirror');
  if (!pageEls.length) return;
  const dims = PAGE_SIZES[size] || PAGE_SIZES.a4;
  const pad  = MARGIN_MAP[margin] || 96;
  const w = orientation === 'landscape' ? dims.h : dims.w;
  const h = orientation === 'landscape' ? dims.w : dims.h;
  pageEls.forEach((el) => {
    el.style.width = w + 'px';
    el.style.minHeight = h + 'px';
    el.style.padding = pad + 'px';
    el.style.boxSizing = 'border-box';
  });
  if (pm && columns > 1) {
    pm.style.columnCount = String(columns);
    pm.style.columnGap   = '40px';
  } else {
    if (pm) {
      pm.style.columnCount = '';
      pm.style.columnGap = '';
    }
  }
  
  // Recalculate pagination with new layout
  if (pm?.parentElement) {
    try {
      const result = recalculatePages(pm, { size, margin, orientation });
      // Update page count if available
      const statusBar = document.querySelector('[data-status="pageCount"]');
      if (statusBar) {
        statusBar.textContent = `Page ${Math.max(1, Math.ceil(pageEls.length / (columns || 1)))} of ${result.totalPages}`;
      }
    } catch (err) {
      console.warn('Pagination calculation failed:', err);
    }
  }
}

const selectedImageElement = () =>
  document.querySelector('.ProseMirror img.ProseMirror-selectednode') ||
  document.querySelector('.ProseMirror .ProseMirror-selectednode img');

const ensureNumber = (n, fallback) => (Number.isFinite(Number(n)) ? Number(n) : fallback);

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function LayoutTab() {
  const { editor } = useEditorStore();
  const {
    pageMargin, setPageMargin,
    pageSize, setPageSize,
    pageOrientation, setPageOrientation,
    pageColumns, setPageColumns,
    sidebarOpen, toggleSidebar,
    toast,
  } = useUIStore();

  const [indentLeftCm, setIndentLeftCm] = useState(0);
  const [indentRightCm, setIndentRightCm] = useState(0);
  const [spacingBeforePt, setSpacingBeforePt] = useState(0);
  const [spacingAfterPt, setSpacingAfterPt] = useState(8);
  const [lineNumbersOn, setLineNumbersOn] = useState(false);
  const [hyphenationOn, setHyphenationOn] = useState(false);

  const apply = (patch) => {
    const next = {
      size: pageSize, orientation: pageOrientation,
      margin: pageMargin, columns: pageColumns, ...patch,
    };
    applyPageLayout(next);
  };

  useEffect(() => {
    applyPageLayout({
      size: pageSize,
      orientation: pageOrientation,
      margin: pageMargin,
      columns: pageColumns,
    });
  }, [pageSize, pageOrientation, pageMargin, pageColumns]);

  useEffect(() => {
    if (!editor) return;
    const syncFromSelection = () => {
      const style = editor.getAttributes('paragraph')?.style || '';
      const css = parseCssStyle(style);
      const leftPx = parseInt((css['margin-left'] || '0').replace('px', ''), 10) || 0;
      const rightPx = parseInt((css['margin-right'] || '0').replace('px', ''), 10) || 0;
      const beforePx = parseInt((css['margin-top'] || '0').replace('px', ''), 10) || 0;
      const afterPx = parseInt((css['margin-bottom'] || '0').replace('px', ''), 10) || 0;
      setIndentLeftCm(pxToCm(leftPx));
      setIndentRightCm(pxToCm(rightPx));
      setSpacingBeforePt(Math.round(beforePx * 0.75));
      setSpacingAfterPt(Math.round(afterPx * 0.75));
    };
    syncFromSelection();
    editor.on('selectionUpdate', syncFromSelection);
    return () => editor.off('selectionUpdate', syncFromSelection);
  }, [editor]);

  const applyParagraphLayout = (patch = {}) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    const base = editor.getAttributes('paragraph')?.style || '';
    const css = parseCssStyle(base);
    const nextLeft = ensureNumber(patch.indentLeftCm, indentLeftCm);
    const nextRight = ensureNumber(patch.indentRightCm, indentRightCm);
    const nextBefore = ensureNumber(patch.spacingBeforePt, spacingBeforePt);
    const nextAfter = ensureNumber(patch.spacingAfterPt, spacingAfterPt);

    css['margin-left'] = `${cmToPx(nextLeft)}px`;
    css['margin-right'] = `${cmToPx(nextRight)}px`;
    css['margin-top'] = `${Math.round(nextBefore * 1.333)}px`;
    css['margin-bottom'] = `${Math.round(nextAfter * 1.333)}px`;

    editor.chain().focus().updateAttributes('paragraph', { style: toCssStyle(css) }).run();
  };

  const insertBreak = () => {
    if (!editor) return toast('Editor is not ready yet', 'info');
    editor.chain().focus().insertPageBreak().run();
    toast('Page break inserted', 'success');
  };

  const toggleLineNumbers = () => {
    const pm = document.querySelector('.ProseMirror');
    if (!pm) return;
    const next = !lineNumbersOn;
    setLineNumbersOn(next);
    pm.classList.toggle('etherx-line-numbers', next);
    toast(next ? 'Line numbers on' : 'Line numbers off', 'info');
  };

  const toggleHyphenation = () => {
    const pm = document.querySelector('.ProseMirror');
    if (!pm) return;
    const next = !hyphenationOn;
    setHyphenationOn(next);
    pm.style.hyphens = next ? 'auto' : 'manual';
    pm.lang = next ? 'en' : '';
    toast(next ? 'Hyphenation on' : 'Hyphenation off', 'info');
  };

  const alignImage = (where) => {
    const img = selectedImageElement();
    if (!img) return toast('Select an image first', 'info');
    img.style.display = 'block';
    if (where === 'left') {
      img.style.marginLeft = '0';
      img.style.marginRight = 'auto';
    } else if (where === 'center') {
      img.style.marginLeft = 'auto';
      img.style.marginRight = 'auto';
    } else {
      img.style.marginLeft = 'auto';
      img.style.marginRight = '0';
    }
  };

  const rotateImage = () => {
    const img = selectedImageElement();
    if (!img) return toast('Select an image first', 'info');
    const current = parseInt(img.dataset.rotate || '0', 10) || 0;
    const next = (current + 15) % 360;
    img.dataset.rotate = String(next);
    img.style.transform = `rotate(${next}deg)`;
  };

  const layerImage = (direction) => {
    const img = selectedImageElement();
    if (!img) return toast('Select an image first', 'info');
    img.style.position = 'relative';
    const current = parseInt(img.style.zIndex || '1', 10) || 1;
    img.style.zIndex = String(direction === 'up' ? current + 1 : Math.max(0, current - 1));
  };

  const wrapText = () => {
    const img = selectedImageElement();
    if (!img) return toast('Select an image first', 'info');
    const mode = img.dataset.wrap || 'inline';
    const next = mode === 'inline' ? 'left' : mode === 'left' ? 'right' : 'inline';
    img.dataset.wrap = next;
    if (next === 'inline') {
      img.style.float = 'none';
      img.style.display = 'block';
      img.style.margin = '12px auto';
    } else if (next === 'left') {
      img.style.float = 'left';
      img.style.margin = '8px 16px 8px 0';
    } else {
      img.style.float = 'right';
      img.style.margin = '8px 0 8px 16px';
    }
    toast(`Wrap text: ${next}`, 'success');
  };

  const resizeSelectedImage = (direction) => {
    if (!editor) return toast('Editor is not ready yet', 'info');
    if (!editor.isActive('image')) return toast('Select an image or shape first', 'info');

    const attrs = editor.getAttributes('image') || {};
    const selected = selectedImageElement();
    const domWidth = selected?.getBoundingClientRect?.().width || 0;
    const baseWidth = parseInt(String(attrs.width || ''), 10)
      || Math.round(domWidth)
      || 240;
    const step = 30;
    const nextWidth = clamp(baseWidth + (direction === 'up' ? step : -step), 40, 1400);

    editor.chain().focus().updateAttributes('image', { width: String(nextWidth) }).run();
    toast(`Media width: ${nextWidth}px`, 'success');
  };

  const removeSelectedImage = () => {
    if (!editor) return toast('Editor is not ready yet', 'info');
    if (!editor.isActive('image')) return toast('Select an image or shape first', 'info');
    editor.chain().focus().deleteSelection().run();
    toast('Image/shape removed', 'success');
  };

  return (
    <>
      <RibbonGroup label="Page Setup">
        <Tooltip text="Margins">
          <Select width={90} options={MARGIN_OPTIONS} value={pageMargin}
            onChange={(v) => { setPageMargin(v); apply({ margin: v }); toast(`Margins: ${v}`, 'success'); }}
            title="Margins" />
        </Tooltip>
        <Tooltip text="Portrait">
          <Button active={pageOrientation === 'portrait'}
            onClick={() => { setPageOrientation('portrait'); apply({ orientation: 'portrait' }); }}>↕ Portrait</Button>
        </Tooltip>
        <Tooltip text="Landscape">
          <Button active={pageOrientation === 'landscape'}
            onClick={() => { setPageOrientation('landscape'); apply({ orientation: 'landscape' }); }}>↔ Landscape</Button>
        </Tooltip>
        <Tooltip text="Page Size">
          <Select width={80} options={SIZE_OPTIONS} value={pageSize}
            onChange={(v) => { setPageSize(v); apply({ size: v }); toast(`Size: ${v.toUpperCase()}`, 'success'); }}
            title="Size" />
        </Tooltip>
        <Tooltip text="Columns">
          <Select width={84} options={COLUMN_OPTIONS} value={String(pageColumns)}
            onChange={(v) => { const c = Number(v); setPageColumns(c); apply({ columns: c }); toast(`Columns: ${v}`, 'success'); }}
            title="Columns" />
        </Tooltip>
        <Tooltip text="Page Break (Ctrl+Enter)">
          <Button onClick={insertBreak}>⊞ Breaks</Button>
        </Tooltip>
        <Tooltip text="Line Numbers">
          <Button active={lineNumbersOn} onClick={toggleLineNumbers}># Lines</Button>
        </Tooltip>
        <Tooltip text="Auto Hyphenation">
          <Button active={hyphenationOn} onClick={toggleHyphenation}>- Hyphen</Button>
        </Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Paragraph">
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>Left:</span>
        <Select width={72}
          value={String(indentLeftCm)}
          options={INDENT_OPTIONS.map((v) => ({ value: String(v), label: `${v} cm` }))}
          onChange={(v) => { const n = Number(v); setIndentLeftCm(n); applyParagraphLayout({ indentLeftCm: n }); }}
          title="Indent Left"
        />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>Right:</span>
        <Select width={72}
          value={String(indentRightCm)}
          options={INDENT_OPTIONS.map((v) => ({ value: String(v), label: `${v} cm` }))}
          onChange={(v) => { const n = Number(v); setIndentRightCm(n); applyParagraphLayout({ indentRightCm: n }); }}
          title="Indent Right"
        />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>Before:</span>
        <Select width={72}
          value={String(spacingBeforePt)}
          options={SPACING_OPTIONS.map((v) => ({ value: String(v), label: `${v} pt` }))}
          onChange={(v) => { const n = Number(v); setSpacingBeforePt(n); applyParagraphLayout({ spacingBeforePt: n }); }}
          title="Spacing Before"
        />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>After:</span>
        <Select width={72}
          value={String(spacingAfterPt)}
          options={SPACING_OPTIONS.map((v) => ({ value: String(v), label: `${v} pt` }))}
          onChange={(v) => { const n = Number(v); setSpacingAfterPt(n); applyParagraphLayout({ spacingAfterPt: n }); }}
          title="Spacing After"
        />
      </RibbonGroup>

      <RibbonGroup label="Arrange">
        <Tooltip text="Position"><Button onClick={() => alignImage('center')}>⊞ Position</Button></Tooltip>
        <Tooltip text="Wrap Text"><Button onClick={wrapText}>☰ Wrap</Button></Tooltip>
        <Tooltip text="Increase Size"><Button onClick={() => resizeSelectedImage('up')}>＋ Size</Button></Tooltip>
        <Tooltip text="Decrease Size"><Button onClick={() => resizeSelectedImage('down')}>－ Size</Button></Tooltip>
        <Tooltip text="Remove Image/Shape"><Button onClick={removeSelectedImage}>🗑 Remove</Button></Tooltip>
        <Tooltip text="Bring Forward"><Button onClick={() => layerImage('up')}>↑ Forward</Button></Tooltip>
        <Tooltip text="Send Backward"><Button onClick={() => layerImage('down')}>↓ Backward</Button></Tooltip>
        <Tooltip text="Selection Pane"><Button active={sidebarOpen} onClick={() => { toggleSidebar(); }}>⌖ Pane</Button></Tooltip>
        <Tooltip text="Align Left"><Button onClick={() => alignImage('left')}>⇤ Align</Button></Tooltip>
        <Tooltip text="Group"><Button onClick={() => toast('Grouping is limited in this editor', 'info')}>⊞ Group</Button></Tooltip>
        <Tooltip text="Rotate"><Button onClick={rotateImage}>↻ Rotate</Button></Tooltip>
      </RibbonGroup>
    </>
  );
}

// ── Review Tab ───────────────────────────────────────────────
import { useDocumentStore, useUIStore as useUI } from '@/store';
import { runDictation, runImageTextCapture, runReadAloud, runSmartSuggestions } from '@/utils/smartFeatures';

const MARKUP_OPTIONS = [
  { value: 'all', label: 'All Markup' },
  { value: 'simple', label: 'Simple Markup' },
  { value: 'original', label: 'Original' },
  { value: 'final', label: 'Final' },
];

const getEditorRoot = () => document.querySelector('.ProseMirror');

const getSelectedText = (editor) => {
  if (!editor) return '';
  const { from, to } = editor.state.selection;
  if (from === to) return editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ');
  return editor.state.doc.textBetween(from, to, ' ');
};

export function ReviewTab() {
  const { toggleTrackChanges, trackChanges, addComment, comments, deleteComment } = useDocumentStore();
  const { editor, spellCheck, toggleSpellCheck } = useEditorStore();
  const { openDialog, toast } = useUI();
  const [markupMode, setMarkupMode] = useState('all');
  const [hideInk, setHideInk] = useState(false);
  const [commentCursor, setCommentCursor] = useState(-1);

  useEffect(() => {
    const root = getEditorRoot();
    if (!root) return;
    root.dataset.reviewMarkup = markupMode;
  }, [markupMode]);

  useEffect(() => {
    const root = getEditorRoot();
    if (!root) return;
    root.classList.toggle('etherx-hide-ink', hideInk);
    return () => root.classList.remove('etherx-hide-ink');
  }, [hideInk]);

  // Live spell check toggle — updates the editor DOM attribute immediately
  const handleSpellCheck = () => {
    toggleSpellCheck();
    if (editor) {
      editor.setOptions({
        editorProps: {
          attributes: {
            spellcheck: String(!spellCheck),
            style: editor.options.editorProps?.attributes?.style || '',
          },
        },
      });
      // Force re-render of the contenteditable
      const el = editor.view.dom;
      if (el) el.setAttribute('spellcheck', String(!spellCheck));
    }
  };

  const handleWordCount = () => openDialog('wordCount');
  const handleAccessibility = () => openDialog('accessibility');
  const handleLanguage = () => openDialog('language');
  const handleComments = () => openDialog('comments');
  const handleReviewingPane = () => openDialog('reviewingPane');
  const handleCompare = () => openDialog('compareDocuments');
  const handleRestrictEditing = () => openDialog('restrictEditing');
  const handleHideInk = () => setHideInk((value) => !value);
  const handleMarkupMode = (value) => {
    setMarkupMode(value);
    toast(`Markup view: ${MARKUP_OPTIONS.find((option) => option.value === value)?.label || value}`, 'info');
  };

  const handleReadAloud = () => {
    runReadAloud({ editor, toast });
  };

  const openThesaurus = () => {
    const text = getSelectedText(editor).trim().split(/\s+/)[0] || 'word';
    window.open(`https://www.thesaurus.com/browse/${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    toast(`Opened thesaurus for "${text}"`, 'success');
  };

  const translateSelection = () => {
    const text = getSelectedText(editor).trim();
    if (!text) {
      toast('Select text to translate', 'info');
      return;
    }
    window.open(`https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(text)}&op=translate`, '_blank', 'noopener,noreferrer');
    toast('Opened translation in browser', 'success');
  };

  const handleNewComment = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;

    if (from === to) {
      const max = editor.state.doc.content.size;
      const snippet = editor.state.doc.textBetween(Math.max(0, from - 25), Math.min(max, from + 55), ' ').trim();
      addComment({ text: snippet ? `Comment near: ${snippet.slice(0, 80)}` : 'General comment' });
      toast('Comment added', 'success');
      openDialog('comments');
      return;
    }

    const text = editor.state.doc.textBetween(from, to, ' ');
    addComment({ text: `Comment on: ${text.slice(0, 80)}` });
    editor.chain().focus().setTextSelection({ from, to }).toggleHighlight({ color: '#fff59d' }).run();
    toast('Comment added', 'success');
    openDialog('comments');
  };

  const handleAcceptChange = () => {
    if (!editor) return;
    
    // Find and accept tracked change marks at cursor position
    const { from, to } = editor.state.selection;
    const $from = editor.state.doc.resolve(from);
    
    // Find all tracked change spans in the document
    let changeFound = false;
    editor.state.doc.nodesBetween(0, editor.state.doc.content.size, (node, pos) => {
      if (node.marks.some(m => m.type.name === 'insertion' || m.type.name === 'deletion')) {
        if (pos >= from - 10 && pos <= to + 10) {
          changeFound = true;
          // Remove the insertion/deletion marks, keeping the content for insertion
          const marks = node.marks.filter(m => m.type.name !== 'insertion' && m.type.name !== 'deletion');
          if (node.type.name === 'text') {
            editor.chain().focus().setSelection(pos, pos + node.text.length).removeAllMarks().setMarks(marks).run();
          }
        }
      }
    });
    
    if (!changeFound) {
      // Use a simpler approach: find tracked-change data attributes
      const editorEl = editor.view.dom;
      const changes = editorEl.querySelectorAll('[data-tracked-change]');
      if (changes.length === 0) {
        toast('No tracked changes found', 'info');
        return;
      }
      const change = changes[0]; // Accept first change
      if (change) {
        change.removeAttribute('data-tracked-change');
        change.style.background = '';
        change.style.textDecoration = '';
      }
    }
    
    toast('Change accepted', 'success');
  };

  const handleRejectChange = () => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    
    // Find tracked-change data attributes in the selection
    const editorEl = editor.view.dom;
    const changes = editorEl.querySelectorAll('[data-tracked-change]');
    
    if (changes.length === 0) {
      toast('No tracked changes to reject', 'info');
      return;
    }
    
    // Find and reject the most relevant change
    let rejectedAny = false;
    changes.forEach(change => {
      const changeType = change.getAttribute('data-tracked-change');
      if (changeType === 'deletion') {
        // Restore deleted content
        change.removeAttribute('data-tracked-change');
        change.style.background = '';
        change.style.textDecoration = '';
        rejectedAny = true;
      } else if (changeType === 'insertion') {
        // Remove inserted content
        change.remove();
        rejectedAny = true;
      }
    });
    
    if (rejectedAny) {
      toast('Change rejected', 'success');
    } else {
      toast('No changes to reject', 'info');
    }
  };

  const stepChange = (direction) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    
    const editorEl = editor.view.dom;
    const changes = editorEl.querySelectorAll('[data-tracked-change]');
    
    if (!changes.length) {
      toast('No tracked changes found', 'info');
      return;
    }
    
    // Find the change closest to cursor
    const { from } = editor.state.selection;
    let nearestChange = changes[0];
    let nearestDistance = Infinity;
    
    changes.forEach(change => {
      // Estimate distance (this is approximate)
      const distance = Math.abs(from - (change.offsetTop || 0));
      if (distance < nearestDistance || distance === 0) {
        nearestDistance = distance;
        nearestChange = change;
      }
    });
    
    if (nearestChange) {
      nearestChange.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const changeType = nearestChange.getAttribute('data-tracked-change');
      toast(`${changeType === 'insertion' ? 'Inserted' : 'Deleted'} text: ${nearestChange.textContent.slice(0, 50)}...`, 'info');
    }
  };

  const blockAuthors = () => {
    const selected = getSelectedText(editor);
    if (!selected) {
      toast('Select text to block editing for authors', 'info');
      return;
    }
    if (!editor) return;
    editor.chain().focus().insertContent(`<span data-etherx-locked="true" style="background:rgba(212,175,55,0.18);">${selected}</span>`).run();
    toast('Selected text marked as author-protected', 'success');
  };

  const handleFilterMarkup = (value) => handleMarkupMode(value);

  return (
    <>
      <RibbonGroup label="Proofing">
        <Tooltip text="Spelling & Grammar" shortcut="F7">
          <Button active={spellCheck} onClick={handleSpellCheck}>ABC✓ Spelling</Button>
        </Tooltip>
        <Tooltip text="Thesaurus"><Button onClick={openThesaurus}>📖 Thesaurus</Button></Tooltip>
        <Tooltip text="Word Count"><Button onClick={handleWordCount}>123 Word Count</Button></Tooltip>
        <Tooltip text="Read Aloud"><Button onClick={handleReadAloud}>🔊 Read Aloud</Button></Tooltip>
        <Tooltip text="Check Accessibility"><Button onClick={handleAccessibility}>♿ Check Accessibility</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Language">
        <Tooltip text="Translate"><Button onClick={translateSelection}>🌐 Translate</Button></Tooltip>
        <Tooltip text="Language"><Button onClick={handleLanguage}>🗣 Language</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Comments">
        <Tooltip text="New Comment"><Button onMouseDown={(e) => e.preventDefault()} onClick={handleNewComment}>💬 New</Button></Tooltip>
        <Tooltip text="Delete Comment"><Button onClick={removeCurrentComment}>🗑 Delete</Button></Tooltip>
        <Tooltip text="Previous Comment"><Button onClick={() => stepComment(-1)}>◀ Prev</Button></Tooltip>
        <Tooltip text="Next Comment"><Button onClick={() => stepComment(1)}>▶ Next</Button></Tooltip>
        <Tooltip text="Show All Comments"><Button onClick={handleComments}>👁 Show All</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Tracking">
        <Tooltip text="Track Changes — highlights insertions/deletions in the document">
          <Button active={trackChanges} onClick={toggleTrackChanges}>⊕ Track</Button>
        </Tooltip>
        <Tooltip text="Accept Change"><Button onClick={handleAcceptChange}>✓ Accept</Button></Tooltip>
        <Tooltip text="Reject Change"><Button onClick={handleRejectChange}>✕ Reject</Button></Tooltip>
        <Tooltip text="Previous Change"><Button onClick={() => announceChange(-1)}>◀ Prev</Button></Tooltip>
        <Tooltip text="Next Change"><Button onClick={() => announceChange(1)}>▶ Next</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Markup">
        <Tooltip text="Filter All Markup">
          <Select width={122} options={MARKUP_OPTIONS} value={markupMode} onChange={handleFilterMarkup} title="All Markup" />
        </Tooltip>
        <Tooltip text="Show Markup"><Button onClick={handleReviewingPane}>☰ Show Markup</Button></Tooltip>
        <Tooltip text="Reviewing Pane"><Button onClick={handleReviewingPane}>▣ Pane</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Compare">
        <Tooltip text="Version History"><Button onClick={() => openDialog('versionHistory')}>⏱ History</Button></Tooltip>
        <Tooltip text="Compare Documents"><Button onClick={handleCompare}>⇔ Compare</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Protect">
        <Tooltip text="Block Authors"><Button onClick={blockAuthors}>👥 Block Authors</Button></Tooltip>
        <Tooltip text="Restrict Editing"><Button onClick={handleRestrictEditing}>🛡 Restrict</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Ink">
        <Tooltip text="Hide Ink"><Button active={hideInk} onClick={handleHideInk}>🖌 Hide Ink</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Smart Features">
        <Tooltip text="Voice Typing"><Button onClick={() => runDictation({ editor, toast })}>🎤 Voice Typing</Button></Tooltip>
        <Tooltip text="Text-to-Speech"><Button onClick={() => runReadAloud({ editor, toast })}>🔊 TTS</Button></Tooltip>
        <Tooltip text="OCR (Image to Text)"><Button onClick={() => runImageTextCapture({ editor, toast, mode: 'ocr' })}>🧾 OCR</Button></Tooltip>
        <Tooltip text="Handwriting Recognition"><Button onClick={() => runImageTextCapture({ editor, toast, mode: 'handwriting' })}>✍ Handwriting</Button></Tooltip>
        <Tooltip text="Smart Suggestions"><Button onClick={() => runSmartSuggestions({ editor, toast })}>✨ Suggestions</Button></Tooltip>
      </RibbonGroup>
    </>
  );
}

// ── View Tab ─────────────────────────────────────────────────
export function ViewTab() {
  const { editor } = useEditorStore();
  const {
    zoom, setZoom, toggleFullscreen, fullscreen,
    sidebarOpen, toggleSidebar,
    rulerVisible, toggleRuler,
    gridlinesVisible, toggleGridlines,
    toast,
  } = useUIStore();
  const [viewMode, setViewMode] = useState('print');
  const [focusMode, setFocusMode] = useState(false);

  const applyViewMode = (mode) => {
    const scroll = document.getElementById('editor-scroll-area');
    if (!scroll) return;
    scroll.classList.remove('etherx-view-print', 'etherx-view-web', 'etherx-view-outline', 'etherx-view-draft', 'etherx-view-read');
    scroll.classList.add(`etherx-view-${mode}`);
    setViewMode(mode);
    toast(`${mode[0].toUpperCase()}${mode.slice(1)} mode enabled`, 'info');
  };

  const applyGridlines = (on) => {
    const el = document.getElementById('document-page-0');
    if (!el) return;
    el.style.backgroundImage = on
      ? `repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(212,175,55,0.08) 27px,rgba(212,175,55,0.08) 28px),
         repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(212,175,55,0.08) 27px,rgba(212,175,55,0.08) 28px)`
      : '';
  };

  const handleGridlines = () => {
    toggleGridlines();
    applyGridlines(!gridlinesVisible);
  };

  const applyRuler = (on) => {
    const ruler = document.getElementById('etherx-ruler');
    if (ruler) ruler.style.display = on ? 'flex' : 'none';
  };

  const handleRuler = () => {
    toggleRuler();
    applyRuler(!rulerVisible);
  };

  return (
    <>
      <RibbonGroup label="Views">
        <Tooltip text="Print Layout"><Button active={viewMode === 'print'} onClick={() => applyViewMode('print')}>📄 Print</Button></Tooltip>
        <Tooltip text="Web Layout"><Button active={viewMode === 'web'} onClick={() => applyViewMode('web')}>🌐 Web</Button></Tooltip>
        <Tooltip text="Outline"><Button active={viewMode === 'outline'} onClick={() => applyViewMode('outline')}>≡ Outline</Button></Tooltip>
        <Tooltip text="Draft"><Button active={viewMode === 'draft'} onClick={() => applyViewMode('draft')}>📝 Draft</Button></Tooltip>
        <Tooltip text="Read Mode"><Button active={viewMode === 'read'} onClick={() => applyViewMode('read')}>📖 Read</Button></Tooltip>
        <Tooltip text="Focus Mode"><Button active={focusMode} onClick={() => {
          const el = document.getElementById('editor-scroll-area');
          const next = !focusMode;
          setFocusMode(next);
          if (el) el.classList.toggle('etherx-focus-mode', next);
          toast(next ? 'Focus mode enabled' : 'Focus mode disabled', 'info');
        }}>🎯 Focus</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Show">
        <Tooltip text="Toggle Page Sidebar"><Button active={sidebarOpen} onClick={toggleSidebar}>⊞ Sidebar</Button></Tooltip>
        <Tooltip text="Ruler"><Button active={rulerVisible} onClick={handleRuler}>📏 Ruler</Button></Tooltip>
        <Tooltip text="Gridlines"><Button active={gridlinesVisible} onClick={handleGridlines}>⊞ Grid</Button></Tooltip>
        <Tooltip text="Navigation Pane"><Button onClick={() => toggleSidebar()}>🧭 Nav Pane</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Zoom">
        <Tooltip text="Zoom Out"><Button onClick={() => setZoom(zoom - 10)}>−</Button></Tooltip>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', minWidth: 40, textAlign: 'center' }}>{zoom}%</span>
        <Tooltip text="Zoom In"><Button onClick={() => setZoom(zoom + 10)}>+</Button></Tooltip>
        <Tooltip text="100%"><Button onClick={() => setZoom(100)}>100%</Button></Tooltip>
        <Tooltip text="Fit Page"><Button onClick={() => setZoom(85)}>⊡ Fit</Button></Tooltip>
        <Tooltip text="Page Width"><Button onClick={() => setZoom(110)}>↔ Width</Button></Tooltip>
        <Tooltip text="75%"><Button onClick={() => setZoom(75)}>75%</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Window">
        <Tooltip text="New Window — opens document in a new tab">
          <Button onClick={() => window.open(window.location.href, '_blank')}>⊞ New Window</Button>
        </Tooltip>
        <Tooltip text={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
          <Button onClick={toggleFullscreen}>{fullscreen ? '⤡ Exit Full' : '⤢ Fullscreen'}</Button>
        </Tooltip>
        <Tooltip text="Split View"><Button onClick={() => {
          const left = document.getElementById('editor-scroll-area');
          if (!left) return;
          const existing = document.getElementById('etherx-split-preview');
          if (existing) {
            existing.remove();
            toast('Split view closed', 'info');
            return;
          }
          
          // Create a synchronized split view container
          const container = document.createElement('div');
          container.id = 'etherx-split-preview';
          container.style.flex = '1';
          container.style.borderLeft = '1px solid var(--border)';
          container.style.overflow = 'auto';
          container.style.background = 'var(--bg-primary)';
          container.style.position = 'relative';
          
          // Create a mirror view label
          const label = document.createElement('div');
          label.style.position = 'absolute';
          label.style.top = '0';
          label.style.left = '0';
          label.style.right = '0';
          label.style.padding = '8px 12px';
          label.style.background = 'var(--ribbon-surface)';
          label.style.borderBottom = '1px solid var(--border)';
          label.style.fontSize = '12px';
          label.style.fontWeight = '600';
          label.style.color = 'var(--text-muted)';
          label.style.zIndex = '10';
          label.textContent = 'Preview';
          container.appendChild(label);
          
          // Create content area
          const content = document.createElement('div');
          content.id = 'etherx-split-content';
          content.style.marginTop = '32px';
          content.style.padding = '20px';
          content.style.whiteSpace = 'pre-wrap';
          content.style.wordWrap = 'break-word';
          content.style.fontFamily = 'inherit';
          content.style.fontSize = 'inherit';
          content.style.lineHeight = 'inherit';
          container.appendChild(content);
          
          left.parentElement?.appendChild(container);
          
          // Sync content when editor changes
          const updatePreview = () => {
            if (editor) {
              content.innerText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n');
            }
          };
          
          if (editor) {
            editor.on('update', updatePreview);
            updatePreview(); // Initial update
            
            // Store editor listener so we can remove it later
            container.dataset.editorListener = 'true';
          }
          
          toast('Split view opened - synchronized preview', 'success');
        }}>⊟ Split</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Macros">
        <Tooltip text="Macros"><Button onClick={() => {
          const script = window.prompt('Macro command (upper|lower|title)', 'upper');
          if (!script || !editor) return;
          const { from, to } = editor.state.selection;
          if (from === to) {
            toast('Select text to run macro', 'info');
            return;
          }
          const selected = editor.state.doc.textBetween(from, to, ' ');
          let transformed = selected;
          if (script === 'upper') transformed = selected.toUpperCase();
          if (script === 'lower') transformed = selected.toLowerCase();
          if (script === 'title') transformed = selected.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
          editor.chain().focus().insertContentAt({ from, to }, transformed).run();
          toast(`Macro applied: ${script}`, 'success');
        }}>⚙ Macros</Button></Tooltip>
      </RibbonGroup>
    </>
  );
}
