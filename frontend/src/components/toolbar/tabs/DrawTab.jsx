import { useMemo, useState } from 'react';
import {
  MousePointer, PenTool, Eraser, Undo2, Redo2, LassoSelect,
  PenLine, Plus, Ruler, Layout, Palette, Hexagon, Sigma, RotateCcw, HelpCircle
} from 'lucide-react';
import { useUIStore, useEditorStore } from '@/store';
import { Button, Tooltip } from '@/components/ui';
import { RibbonGroup } from '../RibbonGroup';

const DEFAULT_PENS = [
  { id: 'black', color: '#111111', label: 'Black Pen', tool: 'pen', size: 4, opacity: 1 },
  { id: 'red', color: '#e53935', label: 'Red Pen', tool: 'pen', size: 4, opacity: 1 },
  { id: 'blue', color: '#1e88e5', label: 'Blue Pen', tool: 'pen', size: 4, opacity: 1 },
  { id: 'green', color: '#0f9d58', label: 'Green Pen', tool: 'pen', size: 4, opacity: 1 },
  { id: 'yellow', color: '#f1d302', label: 'Yellow Highlighter', tool: 'highlighter', size: 6, opacity: 0.4 },
];

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

  const [customPens, setCustomPens] = useState([]);
  const [replayIndex, setReplayIndex] = useState(-1);

  const run = (fn) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    fn?.();
    editor.view?.focus();
  };

  const pens = useMemo(() => [...DEFAULT_PENS, ...customPens], [customPens]);

  const activateTool = (tool, openCanvas = false) => {
    setDrawTool(tool);
    toast(`Active tool: ${tool}`, 'info');
    if (openCanvas) openDialog('drawing');
  };

  const selectPen = (pen) => {
    setDrawTool(pen.tool);
    setDrawColor(pen.color);
    setDrawSize(pen.size);
    setDrawOpacity(pen.opacity);
    toast(`Selected ${pen.label}`, 'info');
    openDialog('drawing');
  };

  const addPen = () => {
    const hex = (window.prompt('Enter hex color (#RRGGBB)', '#7c3aed') || '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      toast('Invalid color format', 'warning');
      return;
    }
    const pen = {
      id: `pen-${Date.now()}`,
      color: hex,
      label: `Pen ${pens.length + 1}`,
      tool: 'pen',
      size: 4,
      opacity: 1,
    };
    setCustomPens((prev) => [...prev, pen]);
    setDrawColor(hex);
    setDrawTool('pen');
    setDrawSize(4);
    setDrawOpacity(1);
    openDialog('drawing');
    toast('Custom pen added', 'success');
  };

  const formatBackground = () => {
    const hex = (window.prompt('Paragraph background color (#RRGGBB)', '#fff7d6') || '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      toast('Invalid color format', 'warning');
      return;
    }
    run(() => editor.chain().updateAttributes('paragraph', { style: `background-color:${hex};` }).run());
    toast('Paragraph background updated', 'success');
  };

  const replayInk = () => {
    const drawings = [...document.querySelectorAll('.ProseMirror img[alt="Drawing"], .ProseMirror img[data-ink="true"]')];
    if (!drawings.length) {
      toast('No ink drawings found to replay', 'info');
      openDialog('drawing');
      return;
    }

    const next = (replayIndex + 1 + drawings.length) % drawings.length;
    setReplayIndex(next);

    drawings.forEach((img) => {
      img.style.outline = '';
      img.style.outlineOffset = '';
    });

    const target = drawings[next];
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.outline = '2px solid var(--gold)';
    target.style.outlineOffset = '2px';
    toast(`Ink replay ${next + 1}/${drawings.length}`, 'success');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {pens.map((pen) => (
              <Tooltip key={pen.id} text={pen.label}>
                <button
                  onClick={() => selectPen(pen)}
                  style={{
                    width: 32,
                    height: 64,
                    border: drawColor === pen.color ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                    background: drawColor === pen.color ? 'var(--gold-dim, rgba(212,175,55,0.15))' : 'var(--bg-elevated)',
                    borderRadius: 3,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 2px 4px 2px',
                    boxShadow: drawColor === pen.color ? '0 0 6px rgba(212,175,55,0.3)' : 'none',
                  }}
                >
                  <PenLine size={16} strokeWidth={1.75} />
                  <div style={{ width: 22, height: 6, borderRadius: 2, background: pen.color }} />
                </button>
              </Tooltip>
            ))}
          </div>
          <HeroBtn icon={<Plus size={20} strokeWidth={1.75} />} label="Add Pen" title="Add Custom Color Pen" onClick={addPen} />
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
          <HeroBtn icon={<Palette size={20} strokeWidth={1.75} />} label="Background" title="Format Drawing Background" onClick={formatBackground} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Convert">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<Hexagon size={20} strokeWidth={1.75} />} label="To Shape" title="Convert Ink to Shapes" onClick={() => openDialog('insertShape')} />
          <HeroBtn icon={<Sigma size={20} strokeWidth={1.75} />} label="To Math" title="Convert Ink to Math Equations" onClick={() => openDialog('equation')} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Replay & Help">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<RotateCcw size={20} strokeWidth={1.75} />} label="Replay" title="Replay Ink Strokes" onClick={replayInk} />
          <HeroBtn icon={<HelpCircle size={20} strokeWidth={1.75} />} label="Help" title="Drawing Help & Reference" onClick={() => window.open('https://support.microsoft.com/en-us/office/draw-and-write-with-ink-in-office', '_blank', 'noopener,noreferrer')} />
        </div>
      </RibbonGroup>
    </>
  );
}
