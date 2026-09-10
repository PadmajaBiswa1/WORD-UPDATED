// ── Layout Tab ───────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react';
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

  const col = { display: 'flex', flexDirection: 'column', flexWrap: 'wrap', maxHeight: 82, height: 82, gap: 2, alignContent: 'flex-start' };
  const rbtn = { height: 25, display: 'inline-flex', alignItems: 'center', fontSize: 11, padding: '0 6px', border: '1px solid transparent', background: 'transparent', borderRadius: 2, cursor: 'pointer', color: 'var(--ribbon-ink)', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap', flexShrink: 0 };

  return (
    <>
      <RibbonGroup label="Page Setup">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Margins */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 90 }}>
            <span style={{ fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>📄</span>
            <span style={{ fontSize: 9.5, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>MARGINS</span>
            <Select
              width={90}
              options={MARGIN_OPTIONS}
              value={pageMargin}
              onChange={(v) => { setPageMargin(v); apply({ margin: v }); toast(`Margins: ${v}`, 'success'); }}
              title="Page Margins"
            />
          </div>

          {/* Orientation */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 92 }}>
            <span style={{ fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>↕</span>
            <span style={{ fontSize: 9.5, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>ORIENTATION</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <Button
                style={{ ...rbtn, height: 24, padding: '0 6px', fontSize: 10 }}
                active={pageOrientation === 'portrait'}
                onClick={() => { setPageOrientation('portrait'); apply({ orientation: 'portrait' }); toast('Orientation: Portrait', 'success'); }}
                title="Portrait"
              >
                Port.
              </Button>
              <Button
                style={{ ...rbtn, height: 24, padding: '0 6px', fontSize: 10 }}
                active={pageOrientation === 'landscape'}
                onClick={() => { setPageOrientation('landscape'); apply({ orientation: 'landscape' }); toast('Orientation: Landscape', 'success'); }}
                title="Landscape"
              >
                Land.
              </Button>
            </div>
          </div>

          {/* Page Size */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 80 }}>
            <span style={{ fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>📏</span>
            <span style={{ fontSize: 9.5, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>SIZE</span>
            <Select
              width={80}
              options={SIZE_OPTIONS}
              value={pageSize}
              onChange={(v) => { setPageSize(v); apply({ size: v }); toast(`Size: ${v.toUpperCase()}`, 'success'); }}
              title="Paper Size"
            />
          </div>

          {/* Columns */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 80 }}>
            <span style={{ fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>☵</span>
            <span style={{ fontSize: 9.5, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>COLUMNS</span>
            <Select
              width={80}
              options={COLUMN_OPTIONS}
              value={String(pageColumns)}
              onChange={(v) => { const c = Number(v); setPageColumns(c); apply({ columns: c }); toast(`Columns: ${v}`, 'success'); }}
              title="Columns"
            />
          </div>

          {/* Breaks, Line Numbers, Hyphenation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, height: 82, justifyContent: 'space-between', paddingLeft: 6, borderLeft: '1px solid var(--border)' }}>
            <Tooltip text="Insert Page Break (Ctrl+Enter)">
              <Button style={{ ...rbtn, height: 24, justifyContent: 'flex-start', padding: '0 6px' }} onClick={insertBreak}>
                ⊞ Breaks
              </Button>
            </Tooltip>
            <Tooltip text="Toggle Line Numbers">
              <Button style={{ ...rbtn, height: 24, justifyContent: 'flex-start', padding: '0 6px' }} active={lineNumbersOn} onClick={toggleLineNumbers}>
                # Lines
              </Button>
            </Tooltip>
            <Tooltip text="Toggle Automatic Hyphenation">
              <Button style={{ ...rbtn, height: 24, justifyContent: 'flex-start', padding: '0 6px' }} active={hyphenationOn} onClick={toggleHyphenation}>
                ― Hyphen
              </Button>
            </Tooltip>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Paragraph">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Indent column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 80, justifyContent: 'center' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>⇤</span>
              <span>INDENT</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 34 }}>Left:</span>
              <Select
                width={74}
                value={String(indentLeftCm)}
                options={INDENT_OPTIONS.map((v) => ({ value: String(v), label: `${v} cm` }))}
                onChange={(v) => { const n = Number(v); setIndentLeftCm(n); applyParagraphLayout({ indentLeftCm: n }); }}
                title="Indent Left"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 34 }}>Right:</span>
              <Select
                width={74}
                value={String(indentRightCm)}
                options={INDENT_OPTIONS.map((v) => ({ value: String(v), label: `${v} cm` }))}
                onChange={(v) => { const n = Number(v); setIndentRightCm(n); applyParagraphLayout({ indentRightCm: n }); }}
                title="Indent Right"
              />
            </div>
          </div>

          {/* Spacing column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 80, justifyContent: 'center', paddingLeft: 10, borderLeft: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>⇕</span>
              <span>SPACING</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 42 }}>Before:</span>
              <Select
                width={74}
                value={String(spacingBeforePt)}
                options={SPACING_OPTIONS.map((v) => ({ value: String(v), label: `${v} pt` }))}
                onChange={(v) => { const n = Number(v); setSpacingBeforePt(n); applyParagraphLayout({ spacingBeforePt: n }); }}
                title="Spacing Before"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 42 }}>After:</span>
              <Select
                width={74}
                value={String(spacingAfterPt)}
                options={SPACING_OPTIONS.map((v) => ({ value: String(v), label: `${v} pt` }))}
                onChange={(v) => { const n = Number(v); setSpacingAfterPt(n); applyParagraphLayout({ spacingAfterPt: n }); }}
                title="Spacing After"
              />
            </div>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Arrange">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, height: 82, justifyContent: 'space-between' }}>
            <Tooltip text="Position on page"><Button style={rbtn} onClick={() => alignImage('center')}>⊞ Position</Button></Tooltip>
            <Tooltip text="Wrap Text around image/shape"><Button style={rbtn} onClick={wrapText}>☰ Wrap Text</Button></Tooltip>
            <Tooltip text="Selection Pane"><Button style={rbtn} active={sidebarOpen} onClick={() => toggleSidebar()}>⌖ Selection Pane</Button></Tooltip>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, height: 82, justifyContent: 'space-between' }}>
            <Tooltip text="Bring Forward"><Button style={rbtn} onClick={() => layerImage('up')}>↑ Forward</Button></Tooltip>
            <Tooltip text="Send Backward"><Button style={rbtn} onClick={() => layerImage('down')}>↓ Backward</Button></Tooltip>
            <Tooltip text="Align Object"><Button style={rbtn} onClick={() => alignImage('left')}>⇤ Align Left</Button></Tooltip>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, height: 82, justifyContent: 'space-between' }}>
            <Tooltip text="Rotate 90 degrees"><Button style={rbtn} onClick={rotateImage}>↻ Rotate</Button></Tooltip>
            <Tooltip text="Increase Size"><Button style={rbtn} onClick={() => resizeSelectedImage('up')}>＋ Enlarge</Button></Tooltip>
            <Tooltip text="Decrease Size"><Button style={rbtn} onClick={() => resizeSelectedImage('down')}>－ Shrink</Button></Tooltip>
          </div>
        </div>
      </RibbonGroup>
    </>
  );
}

// ── Review Tab ───────────────────────────────────────────────
import { useDocumentStore, useUIStore as useUI } from '@/store';
import { runDictation, runImageTextCapture, runReadAloud, runSmartSuggestions } from '@/utils/smartFeatures';
import { parseVoiceCommand, executeVoiceCommand } from '@/services/voiceCommands';

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
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceMode, setVoiceMode] = useState(null); // 'command' | 'typing'
  const voiceRecRef = useRef(null);

  const stopVoice = () => {
    if (voiceRecRef.current) {
      try { voiceRecRef.current.stop(); } catch {}
      voiceRecRef.current = null;
    }
    setVoiceActive(false);
    setVoiceMode(null);
  };

  useEffect(() => {
    return () => {
      if (voiceRecRef.current) {
        try { voiceRecRef.current.stop(); } catch {}
      }
    };
  }, []);

  const startVoice = (mode) => {
    if (voiceActive && voiceMode === mode) {
      stopVoice();
      toast('Voice listening stopped', 'info');
      return;
    }
    stopVoice();

    const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      const mockInput = window.prompt(
        mode === 'command'
          ? 'Browser speech recognition not detected. Type a voice command to execute (e.g. "make bold", "heading 1", "new paragraph", "insert table", "undo", "redo", "select all", "align center", "bullet list", "add comment"):'
          : 'Browser speech recognition not detected. Type dictation text or command:'
      );
      if (mockInput) {
        const res = parseVoiceCommand(mockInput);
        if (res.matched) {
          executeVoiceCommand(mockInput, { editor, uiStore: { openDialog } });
          toast(`🎙 Voice Command executed: ${res.command.label}`, 'success');
        } else if (mode === 'typing') {
          editor?.chain().focus().insertContent(`${mockInput} `).run();
          toast(`🎤 Typed: "${mockInput}"`, 'info');
        } else {
          toast(`Voice command not recognized: "${mockInput}"`, 'warning');
        }
      }
      return;
    }

    try {
      const recognition = new SpeechRecognitionApi();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setVoiceActive(true);
        setVoiceMode(mode);
        toast(mode === 'command' ? '🎙 Voice Commands active — listening for editing commands…' : '🎤 Voice Typing active — speak to dictate or command…', 'info');
      };

      recognition.onresult = (event) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0]?.transcript || '';
        if (!transcript.trim()) return;

        const cmdResult = parseVoiceCommand(transcript);
        if (cmdResult.matched) {
          executeVoiceCommand(transcript, { editor, uiStore: { openDialog } });
          toast(`🎙 Voice Command: ${cmdResult.command.label}`, 'success');
        } else if (mode === 'typing') {
          editor?.chain().focus().insertContent(`${transcript.trim()} `).run();
          toast(`🎤 Voice Typing: "${transcript.trim()}"`, 'info');
        } else {
          toast(`Heard: "${transcript.trim()}" (no matching voice command)`, 'info');
        }
      };

      recognition.onerror = (e) => {
        console.warn('Voice recognition error:', e.error);
        if (e.error !== 'no-speech') {
          toast(`Voice recognition: ${e.error || 'error'}`, 'warning');
        }
      };

      recognition.onend = () => {
        setVoiceActive(false);
        setVoiceMode(null);
      };

      recognition.start();
      voiceRecRef.current = recognition;
    } catch (err) {
      console.error(err);
      toast('Failed to start speech recognition: ' + err.message, 'error');
    }
  };

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

  const removeCurrentComment = () => {
    try {
      if (!comments || comments.length === 0) {
        toast('No comments to delete', 'info');
        return;
      }
      const targetIndex = (commentCursor >= 0 && commentCursor < comments.length)
        ? commentCursor
        : comments.length - 1;
      const target = comments[targetIndex];
      if (target && typeof deleteComment === 'function') {
        deleteComment(target.id);
        setCommentCursor((prev) => Math.max(-1, Math.min(prev, comments.length - 2)));
        toast('Comment deleted', 'success');
      } else {
        toast('Select a comment to delete', 'info');
      }
    } catch (err) {
      console.error('removeCurrentComment error:', err);
      toast('Failed to delete comment', 'error');
    }
  };

  const stepComment = (direction) => {
    try {
      if (!comments || comments.length === 0) {
        toast('No comments in document', 'info');
        return;
      }
      const nextIdx = (commentCursor + direction + comments.length) % comments.length;
      setCommentCursor(nextIdx);
      const target = comments[nextIdx];
      if (target) {
        toast(`Comment (${nextIdx + 1}/${comments.length}): ${(target.text || target.body || '').slice(0, 40)}`, 'info');
        openDialog('comments');
      }
    } catch (err) {
      console.error('stepComment error:', err);
    }
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

  const announceChange = stepChange;

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

  const rBtn = { height: 25, fontSize: 11, padding: '0 6px', justifyContent: 'flex-start', whiteSpace: 'nowrap', flexShrink: 0 };
  const col = { display: 'flex', flexDirection: 'column', flexWrap: 'wrap', maxHeight: 82, height: 82, gap: 2, alignContent: 'flex-start' };

  return (
    <>
      <RibbonGroup label="Proofing">
        <div style={col}>
          <Tooltip text="Spelling & Grammar" shortcut="F7">
            <Button style={rBtn} active={spellCheck} onClick={handleSpellCheck}>ABC✓ Spell</Button>
          </Tooltip>
          <Tooltip text="Readability Dashboard & Clarity Metrics">
            <Button style={rBtn} onClick={() => openDialog('readability')}>📊 Clarity</Button>
          </Tooltip>
          <Tooltip text="Thesaurus"><Button style={rBtn} onClick={openThesaurus}>📖 Thesaurus</Button></Tooltip>
          <Tooltip text="Word Count"><Button style={rBtn} onClick={handleWordCount}>123 Words</Button></Tooltip>
          <Tooltip text="Read Aloud"><Button style={rBtn} onClick={handleReadAloud}>🔊 Read</Button></Tooltip>
          <Tooltip text="Check Accessibility"><Button style={rBtn} onClick={handleAccessibility}>♿ Access</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Language">
        <div style={col}>
          <Tooltip text="Translate"><Button style={rBtn} onClick={translateSelection}>🌐 Translate</Button></Tooltip>
          <Tooltip text="Language"><Button style={rBtn} onClick={handleLanguage}>🗣 Language</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Comments">
        <div style={col}>
          <Tooltip text="New Comment" shortcut="Ctrl+Alt+M"><Button style={rBtn} onMouseDown={(e) => e.preventDefault()} onClick={handleNewComment}>💬 New</Button></Tooltip>
          <Tooltip text="Delete Comment"><Button style={rBtn} onClick={removeCurrentComment}>🗑 Delete</Button></Tooltip>
          <Tooltip text="Show All Comments"><Button style={rBtn} onClick={handleComments}>👁 Show All</Button></Tooltip>
          <Tooltip text="Previous Comment"><Button style={rBtn} onClick={() => stepComment(-1)}>◀ Prev</Button></Tooltip>
          <Tooltip text="Next Comment"><Button style={rBtn} onClick={() => stepComment(1)}>▶ Next</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Tracking">
        <div style={col}>
          <Tooltip text="Track Changes" shortcut="Ctrl+Shift+E">
            <Button style={rBtn} active={trackChanges} onClick={toggleTrackChanges}>⊕ Track</Button>
          </Tooltip>
          <Tooltip text="Accept Change"><Button style={rBtn} onClick={handleAcceptChange}>✓ Accept</Button></Tooltip>
          <Tooltip text="Reject Change"><Button style={rBtn} onClick={handleRejectChange}>✕ Reject</Button></Tooltip>
          <Tooltip text="Previous Change"><Button style={rBtn} onClick={() => announceChange(-1)}>◀ Prev</Button></Tooltip>
          <Tooltip text="Next Change"><Button style={rBtn} onClick={() => announceChange(1)}>▶ Next</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Markup">
        <div style={col}>
          <Tooltip text="Filter All Markup">
            <Select width={108} options={MARKUP_OPTIONS} value={markupMode} onChange={handleFilterMarkup} title="All Markup" />
          </Tooltip>
          <Tooltip text="Show Markup"><Button style={rBtn} onClick={handleReviewingPane}>☰ Markup</Button></Tooltip>
          <Tooltip text="Reviewing Pane"><Button style={rBtn} onClick={handleReviewingPane}>▣ Pane</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Compare">
        <div style={col}>
          <Tooltip text="Version History"><Button style={rBtn} onClick={() => openDialog('versionHistory')}>⏱ History</Button></Tooltip>
          <Tooltip text="Compare Documents"><Button style={rBtn} onClick={handleCompare}>⇔ Compare</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Protect">
        <div style={col}>
          <Tooltip text="Block Authors"><Button style={rBtn} onClick={blockAuthors}>👥 Protect</Button></Tooltip>
          <Tooltip text="Restrict Editing"><Button style={rBtn} onClick={handleRestrictEditing}>🛡 Restrict</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Ink">
        <div style={col}>
          <Tooltip text="Hide Ink"><Button style={rBtn} active={hideInk} onClick={handleHideInk}>🖌 Hide Ink</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Smart Features">
        <div style={col}>
          <Tooltip text="Voice Commands & Speech Control">
            <Button
              style={rBtn}
              active={voiceActive && voiceMode === 'command'}
              onClick={() => startVoice('command')}
            >
              {voiceActive && voiceMode === 'command' ? '🔴 Stop' : '🎙 Voice'}
            </Button>
          </Tooltip>
          <Tooltip text="Voice Typing (Dictation + Commands)">
            <Button
              style={rBtn}
              active={voiceActive && voiceMode === 'typing'}
              onClick={() => startVoice('typing')}
            >
              {voiceActive && voiceMode === 'typing' ? '🔴 Stop' : '🎤 Dictate'}
            </Button>
          </Tooltip>
          <Tooltip text="Text-to-Speech"><Button style={rBtn} onClick={() => runReadAloud({ editor, toast })}>🔊 Read</Button></Tooltip>
          <Tooltip text="Stop Reading"><Button style={rBtn} onClick={() => { if (window.speechSynthesis) { window.speechSynthesis.cancel(); toast('Read aloud stopped', 'info'); } }}>🔇 Stop</Button></Tooltip>
          <Tooltip text="OCR (Image to Text)"><Button style={rBtn} onClick={() => runImageTextCapture({ editor, toast, mode: 'ocr' })}>🧾 OCR</Button></Tooltip>
          <Tooltip text="Handwriting Recognition"><Button style={rBtn} onClick={() => runImageTextCapture({ editor, toast, mode: 'handwriting' })}>✍ Ink</Button></Tooltip>
          <Tooltip text="Smart Suggestions"><Button style={rBtn} onClick={() => runSmartSuggestions({ editor, toast })}>✨ Suggest</Button></Tooltip>
        </div>
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
    openDialog,
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
      {(() => {
        const col = { display: 'flex', flexDirection: 'column', flexWrap: 'wrap', maxHeight: 82, height: 82, gap: 2, alignContent: 'flex-start' };
        const vbtn = { height: 25, display: 'inline-flex', alignItems: 'center', fontSize: 11, padding: '0 6px', flexShrink: 0, whiteSpace: 'nowrap' };
        return (
          <>
            <RibbonGroup label="Views">
              <div style={col}>
                <Tooltip text="Print Layout"><Button style={vbtn} active={viewMode === 'print'} onClick={() => applyViewMode('print')}>📄 Print</Button></Tooltip>
                <Tooltip text="Web Layout"><Button style={vbtn} active={viewMode === 'web'} onClick={() => applyViewMode('web')}>🌐 Web</Button></Tooltip>
                <Tooltip text="Outline"><Button style={vbtn} active={viewMode === 'outline'} onClick={() => applyViewMode('outline')}>≡ Outline</Button></Tooltip>
                <Tooltip text="Draft"><Button style={vbtn} active={viewMode === 'draft'} onClick={() => applyViewMode('draft')}>📝 Draft</Button></Tooltip>
                <Tooltip text="Read Mode"><Button style={vbtn} active={viewMode === 'read'} onClick={() => applyViewMode('read')}>📖 Read</Button></Tooltip>
                <Tooltip text="Focus Mode"><Button style={vbtn} active={focusMode} onClick={() => {
                  const el = document.getElementById('editor-scroll-area');
                  const next = !focusMode;
                  setFocusMode(next);
                  if (el) el.classList.toggle('etherx-focus-mode', next);
                  toast(next ? 'Focus mode enabled' : 'Focus mode disabled', 'info');
                }}>🎯 Focus</Button></Tooltip>
              </div>
            </RibbonGroup>

            <RibbonGroup label="Show">
              <div style={col}>
                <Tooltip text="Toggle Page Sidebar"><Button style={vbtn} active={sidebarOpen} onClick={toggleSidebar}>⊞ Sidebar</Button></Tooltip>
                <Tooltip text="Ruler"><Button style={vbtn} active={rulerVisible} onClick={handleRuler}>📏 Ruler</Button></Tooltip>
                <Tooltip text="Gridlines"><Button style={vbtn} active={gridlinesVisible} onClick={handleGridlines}>⊞ Grid</Button></Tooltip>
                <Tooltip text="Navigation Pane"><Button style={vbtn} onClick={() => toggleSidebar()}>🧭 Nav Pane</Button></Tooltip>
              </div>
            </RibbonGroup>

            <RibbonGroup label="Zoom">
              <div style={col}>
                <Tooltip text="Zoom Out"><Button style={vbtn} onClick={() => setZoom(zoom - 10)}>−</Button></Tooltip>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', minWidth: 36, textAlign: 'center', height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{zoom}%</span>
                <Tooltip text="Zoom In"><Button style={vbtn} onClick={() => setZoom(zoom + 10)}>+</Button></Tooltip>
                <Tooltip text="100%"><Button style={vbtn} onClick={() => setZoom(100)}>100%</Button></Tooltip>
                <Tooltip text="Fit Page"><Button style={vbtn} onClick={() => setZoom(85)}>⊡ Fit</Button></Tooltip>
                <Tooltip text="Page Width"><Button style={vbtn} onClick={() => setZoom(110)}>↔ Width</Button></Tooltip>
                <Tooltip text="75%"><Button style={vbtn} onClick={() => setZoom(75)}>75%</Button></Tooltip>
              </div>
            </RibbonGroup>

            <RibbonGroup label="Window">
              <div style={col}>
                <Tooltip text="New Window — opens document in a new tab">
                  <Button style={vbtn} onClick={() => window.open(window.location.href, '_blank')}>⊞ New Window</Button>
                </Tooltip>
                <Tooltip text={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                  <Button style={vbtn} onClick={toggleFullscreen}>{fullscreen ? '⤡ Exit Full' : '⤢ Fullscreen'}</Button>
                </Tooltip>
                <Tooltip text="Split View"><Button style={vbtn} onClick={() => {
                  const left = document.getElementById('editor-scroll-area');
                  if (!left) return;
                  const existing = document.getElementById('etherx-split-preview');
                  if (existing) {
                    existing.remove();
                    toast('Split view closed', 'info');
                    return;
                  }
                  const container = document.createElement('div');
                  container.id = 'etherx-split-preview';
                  container.style.flex = '1';
                  container.style.borderLeft = '1px solid var(--border)';
                  container.style.overflow = 'auto';
                  container.style.background = 'var(--bg-primary)';
                  container.style.position = 'relative';
                  const lbl = document.createElement('div');
                  lbl.style.cssText = 'position:absolute;top:0;left:0;right:0;padding:8px 12px;background:var(--ribbon-surface);border-bottom:1px solid var(--border);font-size:12px;font-weight:600;color:var(--text-muted);z-index:10;';
                  lbl.textContent = 'Preview';
                  container.appendChild(lbl);
                  const content = document.createElement('div');
                  content.id = 'etherx-split-content';
                  content.style.cssText = 'margin-top:32px;padding:20px;white-space:pre-wrap;word-wrap:break-word;';
                  container.appendChild(content);
                  left.parentElement?.appendChild(container);
                  if (editor) {
                    const update = () => { content.innerText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n'); };
                    editor.on('update', update);
                    update();
                    container.dataset.editorListener = 'true';
                  }
                  toast('Split view opened - synchronized preview', 'success');
                }}>⊟ Split</Button></Tooltip>
              </div>
            </RibbonGroup>

            <RibbonGroup label="Structure & Security">
              <div style={col}>
                <Tooltip text="Master Document & Subdocuments"><Button style={vbtn} onClick={() => openDialog('masterDoc')}>📑 Master Doc</Button></Tooltip>
                <Tooltip text="Security & Protection"><Button style={vbtn} onClick={() => openDialog('security')}>🔒 Security</Button></Tooltip>
              </div>
            </RibbonGroup>

            <RibbonGroup label="Macros">
              <div style={col}>
                <Tooltip text="Macros"><Button style={vbtn} onClick={() => {
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
              </div>
            </RibbonGroup>
          </>
        );
      })()}
    </>
  );
}

