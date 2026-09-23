import { useRef, useState } from 'react';
import {
  MousePointer, PenTool, Eraser, Undo2, Redo2, LassoSelect,
  PenLine, ChevronDown, Ruler, Layout, Hexagon, Sigma
} from 'lucide-react';
import { useUIStore, useEditorStore } from '@/store';
import { Button, Tooltip } from '@/components/ui';
import { RibbonGroup } from '../RibbonGroup';
import { PenCustomizerPopover } from '@/components/editor/PenCustomizerPanel';

const THICKNESS_PRESETS = [
  { px: 2, label: '0.25 mm' },
  { px: 4, label: '0.5 mm' },
  { px: 6, label: '0.7 mm' },
  { px: 10, label: '1.0 mm' },
];

const HIGHLIGHT_OPACITY = [
  { value: 0.25, label: '25%' },
  { value: 0.4, label: '40%' },
  { value: 0.6, label: '60%' },
  { value: 0.8, label: '80%' },
];

function HeroBtn({ icon, label, onClick, title, active, disabled }) {
  return (
    <Tooltip text={title || label}>
      <button
        disabled={disabled}
        onClick={onClick}
        style={{
          border: active ? '1px solid var(--border-gold, #c9a84c)' : '1px solid transparent',
          background: active ? 'var(--bg-hover, rgba(212,175,55,0.1))' : 'transparent',
          borderRadius: 3,
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: active ? 'var(--text-gold, #c9a84c)' : 'var(--text-primary)',
          minWidth: 58,
          height: 74,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '4px 6px',
          fontFamily: 'var(--font-ui)',
          fontSize: 11,
          transition: 'background 0.1s, border-color 0.1s',
          whiteSpace: 'nowrap',
          opacity: disabled ? 0.45 : 1,
        }}
        onMouseEnter={(e) => {
          if (!disabled && !active) {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !active) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }
        }}
      >
        <div style={{ fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: 11, lineHeight: 1.1, textAlign: 'center' }}>{label}</span>
      </button>
    </Tooltip>
  );
}

function MiniAction({ icon, text, onClick, title, active, disabled }) {
  return (
    <Tooltip text={title || text}>
      <button
        disabled={disabled}
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: 22,
          padding: '0 6px',
          fontSize: 11,
          fontFamily: 'var(--font-ui)',
          border: active ? '1px solid var(--border-gold, #c9a84c)' : '1px solid transparent',
          borderRadius: 2,
          background: active ? 'var(--bg-hover)' : 'transparent',
          color: active ? 'var(--text-gold, #c9a84c)' : 'var(--text-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'background 0.1s, border-color 0.1s',
          opacity: disabled ? 0.45 : 1,
        }}
        onMouseEnter={(e) => {
          if (!disabled && !active) {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !active) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }
        }}
      >
        {icon && <span style={{ fontSize: 12, lineHeight: 1 }}>{icon}</span>}
        <span>{text}</span>
      </button>
    </Tooltip>
  );
}

export function DrawTab() {
  const {
    openDialog,
    toast,
    rulerVisible,
    toggleRuler,
    drawTool,
    drawColor,
    drawSize,
    drawOpacity,
    setDrawTool,
    setDrawColor,
    setDrawSize,
    setDrawOpacity,
  } = useUIStore();
  const { editor } = useEditorStore();

  const [penPopoverOpen, setPenPopoverOpen] = useState(false);
  const penBtnRef = useRef(null);

  const run = (fn) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    fn?.();
    editor.view?.focus();
  };

  const activateTool = (tool, openCanvas = false) => {
    setDrawTool(tool);
    toast(`Active tool: ${tool}`, 'info');
    if (openCanvas) openDialog('drawing');
  };

  return (
    <>
      <RibbonGroup label="Tools">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<MousePointer size={20} strokeWidth={1.75} />} label="Select" title="Select Tool" active={drawTool === 'select'} onClick={() => activateTool('select')} />
          <HeroBtn icon={<PenTool size={20} strokeWidth={1.75} />} label="Draw" title="Draw with Touch / Pen" active={drawTool === 'pen'} onClick={() => activateTool('pen', true)} />
          <HeroBtn icon={<Eraser size={20} strokeWidth={1.75} />} label="Eraser" title="Eraser Tool" active={drawTool === 'eraser'} onClick={() => activateTool('eraser', true)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<Undo2 size={13} strokeWidth={1.75} />} text="Undo" title="Undo Inking" onClick={() => run(() => editor.chain().undo().run())} />
            <MiniAction icon={<Redo2 size={13} strokeWidth={1.75} />} text="Redo" title="Redo Inking" onClick={() => run(() => editor.chain().redo().run())} />
            <MiniAction icon={<LassoSelect size={13} strokeWidth={1.75} />} text="Lasso" title="Lasso Select" onClick={() => run(() => editor.chain().selectAll().run())} />
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Pens">
        <div style={{ display: 'flex', alignItems: 'center', height: 74 }}>
          <Tooltip text="Pen Tool — Click to customize color, thickness & opacity">
            <button
              ref={penBtnRef}
              type="button"
              onClick={() => {
                setDrawTool('pen');
                setPenPopoverOpen((prev) => !prev);
              }}
              style={{
                border: (drawTool === 'pen' || penPopoverOpen) ? '1px solid var(--border-gold, #c9a84c)' : '1px solid transparent',
                background: (drawTool === 'pen' || penPopoverOpen) ? 'var(--bg-hover, rgba(212,175,55,0.1))' : 'transparent',
                borderRadius: 3,
                cursor: 'pointer',
                color: (drawTool === 'pen' || penPopoverOpen) ? 'var(--text-gold, #c9a84c)' : 'var(--text-primary)',
                minWidth: 60,
                height: 70,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '4px 8px',
                fontFamily: 'var(--font-ui)',
                fontSize: 11,
                transition: 'background 0.1s, border-color 0.1s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (drawTool !== 'pen' && !penPopoverOpen) {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }
              }}
              onMouseLeave={(e) => {
                if (drawTool !== 'pen' && !penPopoverOpen) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PenLine size={20} strokeWidth={1.75} style={{ color: drawColor || 'var(--gold)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 11, lineHeight: 1.1, fontWeight: 500 }}>Pen</span>
                <ChevronDown size={10} style={{ opacity: 0.7 }} />
              </div>
              <div
                style={{
                  width: 30,
                  height: 4,
                  borderRadius: 2,
                  background: drawColor || '#d4af37',
                  opacity: drawOpacity ?? 1,
                  boxShadow: '0 0 4px rgba(212,175,55,0.25)',
                }}
              />
            </button>
          </Tooltip>

          <PenCustomizerPopover
            triggerRef={penBtnRef}
            isOpen={penPopoverOpen}
            onClose={() => setPenPopoverOpen(false)}
            onAction={() => {
              openDialog('drawing');
              setPenPopoverOpen(false);
            }}
            actionLabel="Start Drawing"
            title="Pen Customization"
          />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Thickness & Opacity">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 74 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)' }}>THICKNESS</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {THICKNESS_PRESETS.map((t) => (
                <Button
                  key={t.px}
                  style={{
                    height: 22,
                    padding: '0 5px',
                    fontSize: 10,
                    border: drawSize === t.px ? '1px solid var(--border-gold)' : undefined,
                    background: drawSize === t.px ? 'var(--bg-hover)' : undefined,
                  }}
                  onClick={() => { setDrawSize(t.px); toast(`Ink thickness: ${t.label}`, 'info'); }}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center', paddingLeft: 6, borderLeft: '1px solid var(--border)' }}>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)' }}>OPACITY</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {HIGHLIGHT_OPACITY.map((o) => (
                <Button
                  key={o.label}
                  style={{
                    height: 22,
                    padding: '0 5px',
                    fontSize: 10,
                    border: Math.abs(drawOpacity - o.value) < 0.01 ? '1px solid var(--border-gold)' : undefined,
                    background: Math.abs(drawOpacity - o.value) < 0.01 ? 'var(--bg-hover)' : undefined,
                  }}
                  onClick={() => { setDrawOpacity(o.value); toast(`Highlighter opacity: ${o.label}`, 'info'); }}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Stencils & Canvas">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<Ruler size={20} strokeWidth={1.75} />} label="Ruler" title="Toggle Drawing Ruler" active={rulerVisible} onClick={() => { toggleRuler(); toast(rulerVisible ? 'Ruler hidden' : 'Ruler shown', 'info'); }} />
          <HeroBtn icon={<Layout size={20} strokeWidth={1.75} />} label="Canvas" title="Insert Drawing Canvas" onClick={() => openDialog('drawing')} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Convert">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<Hexagon size={20} strokeWidth={1.75} />} label="To Shape" title="Convert Ink to Shapes" onClick={() => openDialog('insertShape')} />
          <HeroBtn icon={<Sigma size={20} strokeWidth={1.75} />} label="To Math" title="Convert Ink to Math Equations" onClick={() => openDialog('equation')} />
        </div>
      </RibbonGroup>
    </>
  );
}
