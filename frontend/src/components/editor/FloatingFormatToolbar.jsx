import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  RemoveFormatting,
} from 'lucide-react';
import { Button, ColorSwatch, Divider, Select, Tooltip } from '@/components/ui';
import { useEditorStore, useUIStore } from '@/store';
import { FontFormattingControls, useFontFormattingControls } from '../toolbar/fontFormatting.jsx';

const LINE_SPACING_VALUES = [
  { value: '1', label: '1.0' },
  { value: '1.15', label: '1.15' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2.0' },
];

const TEXT_COLORS = [
  '#F5F1E8', '#d4af37', '#ffffff', '#999999', '#444444',
  '#000000', '#ff4d4f', '#fa8c16', '#fadb14', '#52c41a',
  '#1677ff', '#722ed1', '#eb2f96', '#13c2c2', '#873800',
];

const HIGHLIGHT_COLORS = [
  '#fff59d', '#ffe08a', '#ffd6a5', '#c8f7c5', '#a8e0ff',
  '#f4c7f3', '#ffd1dc', '#d9f7be', '#bbf7d0', '#bfdbfe',
];

// Compact, comfortable buttons for the floating toolbar
const BUTTON_STYLE = { minWidth: 28, height: 28, padding: '0 4px', fontSize: 12, borderRadius: 5, flexShrink: 0 };
const SWATCH_BUTTON_STYLE = { minWidth: 28, height: 28, padding: '0 4px', fontSize: 12, borderRadius: 5, flexShrink: 0 };

function parseStyle(style = '') {
  const out = {};
  String(style).split(';').forEach((pair) => {
    const [key, value] = pair.split(':').map((s) => s?.trim());
    if (key && value) out[key] = value;
  });
  return out;
}

function toStyle(obj) {
  return Object.entries(obj)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
}

function isSelectionInsideEditor(editor) {
  if (!editor?.view?.dom) return false;
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  return editor.view.dom.contains(range.commonAncestorContainer);
}

function getSelectionBounds(editor) {
  if (!editor || !isSelectionInsideEditor(editor) || editor.state.selection.empty) return null;

  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
  if (!rects.length) {
    const { from, to } = editor.state.selection;
    try {
      const fromCoords = editor.view.coordsAtPos(from);
      const toCoords = editor.view.coordsAtPos(to);
      const left = Math.min(fromCoords.left, toCoords.left);
      const right = Math.max(fromCoords.right, toCoords.right);
      const top = Math.min(fromCoords.top, toCoords.top);
      const bottom = Math.max(fromCoords.bottom, toCoords.bottom);
      return { centerX: (left + right) / 2, top, bottom, left, right };
    } catch {
      return null;
    }
  }

  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const top = Math.min(...rects.map((rect) => rect.top));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { centerX: (left + right) / 2, top, bottom, left, right };
}

function isImageSelection(editor) {
  return Boolean(
    editor?.isActive?.('image')
    || editor?.state?.selection?.node?.type?.name === 'image'
  );
}

function isFocusableFormField(target) {
  return Boolean(target?.closest?.('input, textarea, [contenteditable="true"]'));
}

export function FloatingFormatToolbar({ editor, scrollContainerRef }) {
  const { fontFamily, fontSize } = useEditorStore();
  const dialogs = useUIStore((s) => s.dialogs);
  const isAnyDialogOpen = Boolean(dialogs && Object.values(dialogs).some(Boolean));

  const { applyFontFamily, applyFontSize, snapshotSelection, restoreSelection } = useFontFormattingControls(editor);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [position, setPosition] = useState({ top: 0, left: 0, hidden: false });
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightColorOpen, setHighlightColorOpen] = useState(false);
  const [colorPalettePos, setColorPalettePos] = useState({ top: 0, left: 0 });
  const [isImageOperationActive, setIsImageOperationActive] = useState(false);

  const toolbarRef = useRef(null);
  const textColorBtnRef = useRef(null);
  const highlightColorBtnRef = useRef(null);
  const hideTimerRef = useRef(null);
  const pointerLockRef = useRef(false);
  const isMouseDownRef = useRef(false);
  const savedSelectionRef = useRef(null);

  const hideToolbar = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setVisible(false);
    setTextColorOpen(false);
    setHighlightColorOpen(false);
    hideTimerRef.current = setTimeout(() => {
      setMounted(false);
      setAnchor(null);
    }, 160);
  }, []);

  const restoreSavedSelection = useCallback(() => {
    if (!editor || !savedSelectionRef.current) return false;
    const { from, to } = savedSelectionRef.current;
    const maxPos = editor.state.doc.content.size;
    if (from <= maxPos && to <= maxPos && from !== to) {
      editor.chain().focus().setTextSelection({ from, to }).run();
      return true;
    }
    return false;
  }, [editor]);

  const run = useCallback((callback) => {
    if (!editor) return;
    if (editor.state.selection.empty) {
      restoreSavedSelection();
    } else {
      editor.view.focus();
    }
    callback();
    editor.view.focus();
  }, [editor, restoreSavedSelection]);

  const updateParagraphStyle = useCallback((patch = {}) => {
    if (!editor) return;
    const base = editor.getAttributes('paragraph')?.style || '';
    const css = parseStyle(base);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') delete css[key];
      else css[key] = value;
    });
    run(() => editor.chain().updateAttributes('paragraph', { style: toStyle(css) }).run());
  }, [editor, run]);

  const showToolbar = useCallback(() => {
    if (!editor || isAnyDialogOpen) return;
    const nextAnchor = getSelectionBounds(editor);
    if (!nextAnchor) {
      hideToolbar();
      return;
    }
    const { selection } = editor.state;
    if (!selection.empty) {
      savedSelectionRef.current = { from: selection.from, to: selection.to };
    }
    setAnchor(nextAnchor);
    setMounted(true);
    requestAnimationFrame(() => setVisible(true));
  }, [editor, hideToolbar, isAnyDialogOpen]);

  const positionToolbar = useCallback(() => {
    if (!toolbarRef.current || !anchor) return;
    const toolbarEl = toolbarRef.current;
    const rect = toolbarEl.getBoundingClientRect();
    const width = rect.width || 620;
    const height = rect.height || 42;

    // Get the visible canvas bounds (the document editing viewport)
    const scrollEl = scrollContainerRef?.current;
    const scrollRect = scrollEl?.getBoundingClientRect?.() || {
      top: 130,
      bottom: window.innerHeight - 36,
      left: 12,
      right: window.innerWidth - 12,
    };

    // If the selection is completely scrolled outside the visible scroll container, hide
    if (anchor.bottom < scrollRect.top || anchor.top > scrollRect.bottom) {
      setPosition((prev) => (prev.hidden ? prev : { ...prev, hidden: true }));
      return;
    }

    // Safe boundaries: avoid Ribbon/Ruler (top), Status Bar (bottom), and Sidebars (left/right)
    const minTop = Math.max(10, scrollRect.top + 8);
    const maxBottom = Math.min(window.innerHeight - 36, scrollRect.bottom - 8);
    const minLeft = Math.max(10, scrollRect.left + 8);
    const maxRight = Math.min(window.innerWidth - 10, scrollRect.right - 8);

    const gap = 10;
    const aboveTop = anchor.top - height - gap;
    const belowTop = anchor.bottom + gap;

    // Vertical placement: Prefer above the selection; flip below if colliding with Ribbon/Ruler
    let top;
    if (aboveTop >= minTop) {
      top = aboveTop;
    } else if (belowTop + height <= maxBottom) {
      top = belowTop;
    } else {
      top = Math.max(minTop, Math.min(maxBottom - height, aboveTop));
    }

    // Horizontal placement: Center on selection, clamped to container bounds
    const halfWidth = width / 2;
    let left;
    if (width >= (maxRight - minLeft)) {
      left = (minLeft + maxRight) / 2;
    } else {
      left = Math.max(minLeft + halfWidth, Math.min(maxRight - halfWidth, anchor.centerX));
    }

    setPosition({ top, left, hidden: false });
  }, [anchor, scrollContainerRef]);

  useLayoutEffect(() => {
    if (!mounted) return undefined;
    positionToolbar();
    const raf = requestAnimationFrame(positionToolbar);
    return () => cancelAnimationFrame(raf);
  }, [mounted, positionToolbar, fontFamily, fontSize]);

  const isInsideToolbarOrPopups = useCallback((target) => {
    if (!target) return false;
    if (toolbarRef.current?.contains(target)) return true;
    if (textColorBtnRef.current?.contains(target)) return true;
    if (highlightColorBtnRef.current?.contains(target)) return true;
    if (target.closest?.('[data-toolbar-active="true"], [data-format-palette="true"], [data-select-menu="true"], [data-color-trigger="true"]')) return true;
    return false;
  }, []);

  // Track mouse interactions and dismiss when clicking anywhere outside (like Microsoft Word)
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (isInsideToolbarOrPopups(e.target)) {
        if (!e.target.closest?.('[data-format-palette="true"], [data-color-trigger="true"]')) {
          setTextColorOpen(false);
          setHighlightColorOpen(false);
        }
        return;
      }

      // Click is outside the floating toolbar and palettes:
      // Immediately dismiss/hide toolbar, like Microsoft Word
      hideToolbar();
      isMouseDownRef.current = true;
    };

    const handleMouseUp = (e) => {
      isMouseDownRef.current = false;

      if (isInsideToolbarOrPopups(e.target)) {
        return;
      }

      // If mouseup occurred outside the editor canvas, keep toolbar hidden
      if (!editor || !isSelectionInsideEditor(editor) || !editor.view.dom.contains(e.target)) {
        hideToolbar();
        return;
      }

      // If user dragged to make a non-empty text selection inside editor, show toolbar
      if (editor.state.selection.empty || isImageSelection(editor) || isAnyDialogOpen) {
        hideToolbar();
        return;
      }

      showToolbar();
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('mouseup', handleMouseUp, true);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [editor, hideToolbar, isAnyDialogOpen, isInsideToolbarOrPopups, showToolbar]);

  // Sync toolbar with editor selections (keyboard selections, programmatic changes)
  useEffect(() => {
    if (!editor) return undefined;

    const syncFromSelection = () => {
      const active = document.activeElement;
      if (active?.closest?.('[data-toolbar-active="true"], [data-select-menu="true"], [data-format-palette="true"]')) {
        return;
      }

      const { selection } = editor.state;
      if (!selection.empty) {
        savedSelectionRef.current = { from: selection.from, to: selection.to };
      }

      if (isMouseDownRef.current) {
        return;
      }

      if (selection.empty || !isSelectionInsideEditor(editor) || isImageSelection(editor) || isAnyDialogOpen) {
        hideToolbar();
        return;
      }

      showToolbar();
    };

    const handleWindowInteraction = () => {
      if (!mounted) return;
      setTextColorOpen(false);
      setHighlightColorOpen(false);

      if (editor.state.selection.empty || !isSelectionInsideEditor(editor) || isImageSelection(editor)) {
        hideToolbar();
        return;
      }

      const nextAnchor = getSelectionBounds(editor);
      if (nextAnchor) {
        setAnchor(nextAnchor);
      }
      positionToolbar();
    };

    const handleBlur = () => {
      if (pointerLockRef.current) return;
      setTimeout(() => {
        const active = document.activeElement;
        if (active?.closest?.('[data-toolbar-active="true"], [data-select-menu="true"], [data-format-palette="true"]')) return;
        hideToolbar();
      }, 60);
    };

    syncFromSelection();
    editor.on('selectionUpdate', syncFromSelection);
    editor.on('blur', handleBlur);
    window.addEventListener('resize', handleWindowInteraction);

    const scrollEl = scrollContainerRef?.current;
    if (scrollEl) scrollEl.addEventListener('scroll', handleWindowInteraction, { passive: true });

    return () => {
      editor.off('selectionUpdate', syncFromSelection);
      editor.off('blur', handleBlur);
      window.removeEventListener('resize', handleWindowInteraction);
      if (scrollEl) scrollEl.removeEventListener('scroll', handleWindowInteraction);
    };
  }, [anchor, editor, hideToolbar, mounted, positionToolbar, scrollContainerRef, showToolbar, isAnyDialogOpen]);

  useEffect(() => {
    const handleStart = () => {
      setIsImageOperationActive(true);
      hideToolbar();
    };
    const handleEnd = () => setIsImageOperationActive(false);
    window.addEventListener('image-drag-start', handleStart);
    window.addEventListener('image-drag-end', handleEnd);
    return () => {
      window.removeEventListener('image-drag-start', handleStart);
      window.removeEventListener('image-drag-end', handleEnd);
    };
  }, [hideToolbar]);

  // Hide toolbar when any modal or dialog opens
  useEffect(() => {
    if (isAnyDialogOpen && visible) {
      hideToolbar();
    }
  }, [isAnyDialogOpen, visible, hideToolbar]);

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && visible) {
        hideToolbar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, hideToolbar]);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  const toggleTextColor = (e) => {
    e.preventDefault();
    e.stopPropagation();
    snapshotSelection();

    if (textColorOpen) {
      setTextColorOpen(false);
      return;
    }

    setHighlightColorOpen(false);
    const rect = textColorBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const popoverHeight = 175;
      const popoverWidth = 170;
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const openUp = spaceBelow < popoverHeight && rect.top > popoverHeight;
      const top = openUp ? Math.max(8, rect.top - popoverHeight - 6) : Math.min(window.innerHeight - popoverHeight - 8, rect.bottom + 6);
      const left = Math.max(10, Math.min(window.innerWidth - popoverWidth - 10, rect.left + rect.width / 2 - popoverWidth / 2));
      setColorPalettePos({ top, left });
    }
    setTextColorOpen(true);
  };

  const toggleHighlightColor = (e) => {
    e.preventDefault();
    e.stopPropagation();
    snapshotSelection();

    if (highlightColorOpen) {
      setHighlightColorOpen(false);
      return;
    }

    setTextColorOpen(false);
    const rect = highlightColorBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const popoverHeight = 150;
      const popoverWidth = 160;
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const openUp = spaceBelow < popoverHeight && rect.top > popoverHeight;
      const top = openUp ? Math.max(8, rect.top - popoverHeight - 6) : Math.min(window.innerHeight - popoverHeight - 8, rect.bottom + 6);
      const left = Math.max(10, Math.min(window.innerWidth - popoverWidth - 10, rect.left + rect.width / 2 - popoverWidth / 2));
      setColorPalettePos({ top, left });
    }
    setHighlightColorOpen(true);
  };

  const applyTextColor = (color) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && savedSelectionRef.current) {
      const { from, to } = savedSelectionRef.current;
      const maxPos = editor.state.doc.content.size;
      if (from <= maxPos && to <= maxPos && from !== to) {
        chain.setTextSelection({ from, to });
      }
    }
    if (color) {
      chain.setColor(color).run();
    } else {
      chain.unsetColor().run();
    }
    setTextColorOpen(false);
    editor.view.focus();
  };

  const applyHighlightColor = (color) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && savedSelectionRef.current) {
      const { from, to } = savedSelectionRef.current;
      const maxPos = editor.state.doc.content.size;
      if (from <= maxPos && to <= maxPos && from !== to) {
        chain.setTextSelection({ from, to });
      }
    }
    if (color) {
      if (editor.isActive('highlight', { color })) {
        chain.unsetHighlight().run();
      } else {
        chain.setHighlight({ color }).run();
      }
    } else {
      chain.unsetHighlight().run();
    }
    setHighlightColorOpen(false);
    editor.view.focus();
  };

  const clearFormatting = () => {
    run(() => editor.chain().clearNodes().unsetAllMarks().run());
  };

  const cycleLineSpacing = (value) => {
    if (!editor || !value) return;
    snapshotSelection();

    const restored = restoreSelection();
    if (restored) {
      updateParagraphStyle({ 'line-height': value });
    }
    editor.view.focus();
  };

  const currentTextColor = editor?.getAttributes('textStyle')?.color || '';
  const currentHighlight = editor?.getAttributes('highlight')?.color || (editor?.isActive('highlight') ? '#fff59d' : '');
  const currentAlignment = editor?.getAttributes('paragraph')?.textAlign || 'left';
  const paragraphStyle = editor?.getAttributes('paragraph')?.style || '';
  const currentLineSpacing = parseStyle(paragraphStyle)['line-height'] || '1';

  if (!mounted || !editor || isImageOperationActive || isAnyDialogOpen) return null;

  return (
    <>
      {createPortal(
        <div
          ref={toolbarRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            transform: `translate(-50%, ${visible && !position.hidden ? '0' : '-6px'})`,
            opacity: visible && !position.hidden ? 1 : 0,
            pointerEvents: visible && !position.hidden ? 'auto' : 'none',
            transition: 'opacity 140ms ease, transform 140ms ease',
            zIndex: 3500,
            width: 'max-content',
            maxWidth: 'min(96vw, 980px)',
          }}
        >
          <div
            data-toolbar-active="true"
            onMouseDown={(event) => {
              if (isFocusableFormField(event.target)) return;
              event.preventDefault();
              pointerLockRef.current = true;
              window.setTimeout(() => { pointerLockRef.current = false; }, 0);
            }}
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              alignItems: 'center',
              gap: 3,
              padding: '5px 8px',
              border: '1px solid rgba(212, 175, 55, 0.45)',
              borderRadius: 8,
              background: 'rgba(18, 18, 18, 0.96)',
              color: 'var(--text-primary)',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(212, 175, 55, 0.15)',
              backdropFilter: 'blur(12px)',
              pointerEvents: visible && !position.hidden ? 'auto' : 'none',
              fontSize: 12,
              maxWidth: 'min(96vw, 980px)',
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            <Tooltip text="Edit selected text with Pragna AI (Gemma 31B)">
              <Button
                style={{
                  ...BUTTON_STYLE,
                  minWidth: 92,
                  height: 28,
                  fontWeight: 600,
                  fontSize: 12,
                  padding: '0 8px',
                  gap: 5,
                  background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)',
                  color: '#000000',
                  border: '1px solid #d4af37',
                  boxShadow: '0 1px 6px rgba(212, 175, 55, 0.35)',
                  flexShrink: 0,
                }}
                onClick={() => useUIStore.getState().openPragna('edit')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Sparkles size={13} strokeWidth={2} color="#000000" />
                </span>
                <span>Pragna Edit</span>
              </Button>
            </Tooltip>

            <Divider vertical style={{ height: 18, margin: '0 2px' }} />

            <FontFormattingControls
              editor={editor}
              fontFamily={fontFamily}
              fontSize={fontSize}
              familyWidth={126}
              sizeWidth={56}
              applyFontFamily={applyFontFamily}
              applyFontSize={applyFontSize}
              onFocus={snapshotSelection}
            />

            <Divider vertical style={{ height: 18, margin: '0 2px' }} />

            <Tooltip text="Bold" shortcut="Ctrl+B">
              <Button style={BUTTON_STYLE} active={editor.isActive('bold')} onClick={() => run(() => editor.chain().toggleBold().run())}>
                <span style={{ fontWeight: 700 }}>B</span>
              </Button>
            </Tooltip>
            <Tooltip text="Italic" shortcut="Ctrl+I">
              <Button style={BUTTON_STYLE} active={editor.isActive('italic')} onClick={() => run(() => editor.chain().toggleItalic().run())}>
                <span style={{ fontStyle: 'italic', fontFamily: 'serif' }}>I</span>
              </Button>
            </Tooltip>
            <Tooltip text="Underline" shortcut="Ctrl+U">
              <Button style={BUTTON_STYLE} active={editor.isActive('underline')} onClick={() => run(() => editor.chain().toggleUnderline().run())}>
                <span style={{ textDecoration: 'underline' }}>U</span>
              </Button>
            </Tooltip>
            <Tooltip text="Strikethrough">
              <Button style={BUTTON_STYLE} active={editor.isActive('strike')} onClick={() => run(() => editor.chain().toggleStrike().run())}>
                <span style={{ textDecoration: 'line-through' }}>S</span>
              </Button>
            </Tooltip>

            <Divider vertical style={{ height: 18, margin: '0 2px' }} />

            <Tooltip text="Text Color">
              <button
                ref={textColorBtnRef}
                type="button"
                data-color-trigger="true"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={toggleTextColor}
                style={{
                  ...SWATCH_BUTTON_STYLE,
                  background: textColorOpen ? 'rgba(212, 175, 55, 0.25)' : 'transparent',
                  borderColor: textColorOpen ? 'var(--gold)' : 'transparent',
                  border: '1px solid',
                  borderRadius: 5,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>A</span>
                  <span style={{ width: 14, height: 3, borderRadius: 1, background: currentTextColor || '#F5F1E8', border: '0.5px solid rgba(255, 255, 255, 0.25)' }} />
                </span>
              </button>
            </Tooltip>

            <Tooltip text="Highlight Color">
              <button
                ref={highlightColorBtnRef}
                type="button"
                data-color-trigger="true"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={toggleHighlightColor}
                style={{
                  ...SWATCH_BUTTON_STYLE,
                  background: highlightColorOpen ? 'rgba(212, 175, 55, 0.25)' : 'transparent',
                  borderColor: highlightColorOpen ? 'var(--gold)' : 'transparent',
                  border: '1px solid',
                  borderRadius: 5,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>ab</span>
                  <span style={{ width: 14, height: 3, borderRadius: 1, background: currentHighlight || '#fff59d', border: '0.5px solid rgba(255, 255, 255, 0.25)' }} />
                </span>
              </button>
            </Tooltip>

            <Tooltip text="Clear Formatting">
              <Button style={BUTTON_STYLE} onClick={clearFormatting}>
                <RemoveFormatting size={13} />
              </Button>
            </Tooltip>

            <Divider vertical style={{ height: 18, margin: '0 2px' }} />

            <Tooltip text="Align Left" shortcut="Ctrl+L">
              <Button style={BUTTON_STYLE} active={currentAlignment === 'left'} onClick={() => run(() => editor.chain().setTextAlign('left').run())}>
                <AlignLeft size={13} />
              </Button>
            </Tooltip>
            <Tooltip text="Align Center" shortcut="Ctrl+E">
              <Button style={BUTTON_STYLE} active={currentAlignment === 'center'} onClick={() => run(() => editor.chain().setTextAlign('center').run())}>
                <AlignCenter size={13} />
              </Button>
            </Tooltip>
            <Tooltip text="Align Right" shortcut="Ctrl+R">
              <Button style={BUTTON_STYLE} active={currentAlignment === 'right'} onClick={() => run(() => editor.chain().setTextAlign('right').run())}>
                <AlignRight size={13} />
              </Button>
            </Tooltip>
            <Tooltip text="Justify">
              <Button style={BUTTON_STYLE} active={currentAlignment === 'justify'} onClick={() => run(() => editor.chain().setTextAlign('justify').run())}>
                <AlignJustify size={13} />
              </Button>
            </Tooltip>

            <Divider vertical style={{ height: 18, margin: '0 2px' }} />

            <Tooltip text="Bullet List">
              <Button style={BUTTON_STYLE} active={editor.isActive('bulletList')} onClick={() => run(() => editor.chain().toggleBulletList().run())}>
                <List size={13} />
              </Button>
            </Tooltip>
            <Tooltip text="Numbered List">
              <Button style={BUTTON_STYLE} active={editor.isActive('orderedList')} onClick={() => run(() => editor.chain().toggleOrderedList().run())}>
                <ListOrdered size={13} />
              </Button>
            </Tooltip>
            <Tooltip text="Line Spacing">
              <Select
                value={currentLineSpacing}
                onChange={cycleLineSpacing}
                options={LINE_SPACING_VALUES}
                width={72}
                title="Line Spacing"
                style={{ height: 28, fontSize: 11 }}
              />
            </Tooltip>
          </div>
        </div>,
        document.body,
      )}

      {textColorOpen && createPortal(
        <div
          data-format-palette="true"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            position: 'fixed',
            top: colorPalettePos.top,
            left: colorPalettePos.left,
            zIndex: 10001,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-gold)',
            background: 'rgba(20, 20, 20, 0.98)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(212, 175, 55, 0.2)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 170,
            userSelect: 'none',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 2px' }}>
            Text Color
          </div>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => applyTextColor(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '4px 6px',
              background: !currentTextColor || currentTextColor === '#F5F1E8' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: 4,
              color: '#F5F1E8',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212, 175, 55, 0.25)'; }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = !currentTextColor || currentTextColor === '#F5F1E8' ? 'rgba(212, 175, 55, 0.15)' : 'transparent';
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: 999, background: '#F5F1E8', border: '1px solid rgba(0,0,0,0.5)', flexShrink: 0 }} />
            <span>Automatic (Default)</span>
          </button>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 5,
              paddingTop: 2,
            }}
          >
            {TEXT_COLORS.map((color) => {
              const isSelected = currentTextColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  title={color}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={() => applyTextColor(color)}
                  style={{
                    width: 24,
                    height: 24,
                    background: color,
                    border: isSelected ? '2px solid #d4af37' : '1px solid rgba(255, 255, 255, 0.18)',
                    borderRadius: 3,
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: isSelected ? '0 0 6px rgba(212, 175, 55, 0.6)' : 'none',
                    transition: 'transform 0.1s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                />
              );
            })}
          </div>
        </div>,
        document.body,
      )}

      {highlightColorOpen && createPortal(
        <div
          data-format-palette="true"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          style={{
            position: 'fixed',
            top: colorPalettePos.top,
            left: colorPalettePos.left,
            zIndex: 10001,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-gold)',
            background: 'rgba(20, 20, 20, 0.98)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(212, 175, 55, 0.2)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 160,
            userSelect: 'none',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 2px' }}>
            Highlight Color
          </div>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => applyHighlightColor(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '4px 6px',
              background: !currentHighlight ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: 4,
              color: '#F5F1E8',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212, 175, 55, 0.25)'; }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = !currentHighlight ? 'rgba(212, 175, 55, 0.15)' : 'transparent';
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: 2, border: '1px dashed #999', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#ff4d4f', flexShrink: 0 }}>✕</span>
            <span>No Color</span>
          </button>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 5,
              paddingTop: 2,
            }}
          >
            {HIGHLIGHT_COLORS.map((color) => {
              const isSelected = currentHighlight === color;
              return (
                <button
                  key={color}
                  type="button"
                  title={color}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={() => applyHighlightColor(color)}
                  style={{
                    width: 24,
                    height: 24,
                    background: color,
                    border: isSelected ? '2px solid #d4af37' : '1px solid rgba(255, 255, 255, 0.18)',
                    borderRadius: 3,
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: isSelected ? '0 0 6px rgba(212, 175, 55, 0.6)' : 'none',
                    transition: 'transform 0.1s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                />
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}