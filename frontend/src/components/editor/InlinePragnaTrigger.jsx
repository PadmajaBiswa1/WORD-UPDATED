import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, ArrowRight, Check, RotateCcw, Plus } from 'lucide-react';
import { useEditorStore, useUIStore } from '@/store';
import { executePragnaAi } from '@/services/ai';

export function InlinePragnaTrigger({ editor, scrollContainerRef }) {
  const { toast, openPragna } = useUIStore();
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState(null);
  const [insertedRange, setInsertedRange] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!editor || !editor.view || !editor.view.dom) {
      setVisible(false);
      return;
    }

    const { selection } = editor.state;
    // Only show on empty selection
    if (!selection.empty) {
      if (!expanded) setVisible(false);
      return;
    }

    const { $from } = selection;
    const parentNode = $from.parent;
    const isLineEmpty = parentNode.isTextblock && parentNode.content.size === 0;

    if (!isLineEmpty && !expanded) {
      setVisible(false);
      return;
    }

    try {
      const coords = editor.view.coordsAtPos($from.pos);
      if (!coords) {
        if (!expanded) setVisible(false);
        return;
      }

      setPos({
        top: coords.top,
        left: Math.max(12, coords.left - 38), // place just to the left of the empty line
      });
      setVisible(true);
    } catch {
      if (!expanded) setVisible(false);
    }
  }, [editor, expanded]);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      requestAnimationFrame(updatePosition);
    };

    editor.on('selectionUpdate', handleUpdate);
    editor.on('update', handleUpdate);
    editor.on('focus', handleUpdate);

    const scrollEl = scrollContainerRef?.current || window;
    scrollEl.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate, { passive: true });

    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('update', handleUpdate);
      editor.off('focus', handleUpdate);
      scrollEl.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [editor, scrollContainerRef, updatePosition]);

  // Focus input when expanded
  useEffect(() => {
    if (expanded && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [expanded]);

  // Listen for Alt+I
  useEffect(() => {
    const handleKey = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.metaKey) {
        if (editor?.isFocused && editor.state.selection.empty) {
          e.preventDefault();
          setExpanded(true);
          updatePosition();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [editor, updatePosition]);

  if (!visible && !expanded) return null;

  const handleGenerate = async (overridePrompt) => {
    const query = (overridePrompt || prompt).trim();
    if (!query) return;

    setLoading(true);
    toast('Pragna: Drafting with Gemma 31B Cloud...', 'info');

    try {
      const from = editor.state.selection.from;
      const res = await executePragnaAi('generate', '', { topic: query, tone: 'professional', pages: 1 });
      const htmlContent = res?.html || `<p>${res?.text || query}</p>`;

      // Insert at cursor
      editor.chain().focus().insertContent(htmlContent).run();
      const to = editor.state.selection.to;

      setGeneratedHtml(htmlContent);
      setInsertedRange({ from, to });
      toast('Pragna: Draft created', 'success');
    } catch (err) {
      toast('Drafting failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeep = () => {
    setGeneratedHtml(null);
    setInsertedRange(null);
    setExpanded(false);
    setPrompt('');
    editor.view.focus();
    toast('Pragna draft retained', 'success');
  };

  const handleDiscard = () => {
    if (insertedRange && editor) {
      try {
        editor.chain().focus().undo().run();
      } catch {
        // ignore
      }
    }
    setGeneratedHtml(null);
    setInsertedRange(null);
    setExpanded(false);
    setPrompt('');
    editor.view.focus();
    toast('Draft discarded', 'info');
  };

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: expanded ? Math.max(16, pos.left - 8) : pos.left,
        zIndex: 1500,
        transform: expanded ? 'translateY(-6px)' : 'translateY(-2px)',
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {!expanded ? (
        /* MS Word-style circular Copilot trigger button on left margin in Pragna Gold Theme */
        <button
          onClick={() => {
            setExpanded(true);
            updatePosition();
          }}
          title="Draft with Pragna (Alt+I)"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)',
            border: '1.5px solid #d4af37',
            color: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(212, 175, 55, 0.4)',
            outline: 'none',
            padding: 0,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.15)';
            e.currentTarget.style.boxShadow = '0 3px 14px rgba(212, 175, 55, 0.65)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(212, 175, 55, 0.4)';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L14.6 8.4L21 11L14.6 13.6L12 20L9.4 13.6L3 11L9.4 8.4L12 2Z" fill="#000000" />
          </svg>
        </button>
      ) : (
        /* MS Word-style inline expandable prompt card in Pragna Gold Theme */
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid rgba(212, 175, 55, 0.5)',
            borderRadius: 8,
            boxShadow: '0 8px 30px rgba(0,0,0,0.55), 0 0 16px rgba(212, 175, 55, 0.2)',
            padding: '10px 12px',
            width: 460,
            maxWidth: 'calc(100vw - 40px)',
            color: 'var(--text-primary)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--gold)', display: 'inline-flex', alignItems: 'center' }}><Sparkles size={16} strokeWidth={2} /></span>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gold)' }}>Draft with Pragna</span>
              <span style={{ fontSize: 10, background: 'rgba(212, 175, 55, 0.15)', color: 'var(--gold)', padding: '1px 6px', borderRadius: 10 }}>Gemma 31B</span>
            </div>
            <button
              onClick={() => {
                setExpanded(false);
                setGeneratedHtml(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              <X size={14} />
            </button>
          </div>

          {!generatedHtml ? (
            <>
              {/* Prompt Input */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Describe what you want to write (or instructions)..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                    if (e.key === 'Escape') {
                      setExpanded(false);
                    }
                  }}
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text-primary)',
                    padding: '7px 10px',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => handleGenerate()}
                  disabled={loading || !prompt.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)',
                    border: 'none',
                    borderRadius: 4,
                    color: '#000000',
                    fontWeight: 600,
                    fontSize: 12,
                    padding: '0 12px',
                    cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
                    opacity: loading || !prompt.trim() ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    boxShadow: '0 2px 6px rgba(212, 175, 55, 0.35)',
                  }}
                >
                  {loading ? 'Drafting...' : (
                    <>
                      <span>Generate</span>
                      <ArrowRight size={13} strokeWidth={2} />
                    </>
                  )}
                </button>
              </div>

              {/* Quick Prompt Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[
                  'Executive project summary',
                  'Client proposal outline',
                  'Meeting key takeaways',
                  'Formal recommendation',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => {
                      setPrompt(chip);
                      handleGenerate(chip);
                    }}
                    disabled={loading}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      color: 'var(--text-secondary)',
                      padding: '3px 8px',
                      fontSize: 10,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--gold)';
                      e.currentTarget.style.color = 'var(--gold)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <Plus size={10} strokeWidth={2} />
                    <span>{chip}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* MS Word Keep / Try Again / Discard Bar */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
              <span style={{ fontSize: 11, color: '#52c41a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Check size={13} strokeWidth={2} /> Draft inserted into document
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleKeep}
                  style={{
                    background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)',
                    border: 'none',
                    color: '#000000',
                    fontWeight: 600,
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Check size={12} strokeWidth={2} />
                  <span>Keep it</span>
                </button>
                <button
                  onClick={() => handleGenerate()}
                  disabled={loading}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(212, 175, 55, 0.4)',
                    color: 'var(--gold)',
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RotateCcw size={12} strokeWidth={2} />
                  <span>Regenerate</span>
                </button>
                <button
                  onClick={handleDiscard}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,77,79,0.4)',
                    color: '#ff4d4f',
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <X size={12} strokeWidth={2} />
                  <span>Discard</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
