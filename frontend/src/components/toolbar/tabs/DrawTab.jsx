import { useMemo, useState } from 'react';
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

function iconBtnStyle(active = false) {
  return {
    width: 30,
    height: 28,
    border: active ? '1px solid var(--gold)' : '1px solid var(--border)',
    background: active ? 'var(--gold-dim)' : 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    borderRadius: 2,
    padding: 0,
    fontSize: 14,
    lineHeight: 1,
  };
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

  const pens = useMemo(() => [...DEFAULT_PENS, ...customPens], [customPens]);

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
    // Draw tab tool selection should control ink behavior, not text formatting.
    // Keep existing color/size/opacity and let drawing canvas apply it.
    if (openCanvas) openDialog('drawing');
  };

  const selectPen = (pen) => {
    setDrawColor(pen.color);
    setDrawTool(pen.tool);
    setDrawSize(pen.size || drawSize);
    setDrawOpacity(typeof pen.opacity === 'number' ? pen.opacity : drawOpacity);
    toast(`${pen.label} active`, 'success');
    openDialog('drawing');
  };

  const addPen = () => {
    const hex = (window.prompt('Enter pen color in HEX (#RRGGBB)', '#7e57c2') || '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      toast('Invalid color format', 'warning');
      return;
    }
    const id = `custom-${Date.now()}`;
    const next = { id, color: hex, label: 'Custom Pen', tool: 'pen', size: drawSize, opacity: 1 };
    setCustomPens((prev) => [...prev, next]);
    setDrawColor(hex);
    setDrawTool('pen');
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

  const col = { display: 'flex', flexDirection: 'column', flexWrap: 'wrap', maxHeight: 82, height: 82, gap: 2, alignContent: 'flex-start' };

  return (
    <>
      <RibbonGroup label="Drawing Tools">
        <div style={col}>
          <Tooltip text="Undo"><Button style={iconBtnStyle()} onClick={() => run(() => editor.chain().undo().run())}>↶</Button></Tooltip>
          <Tooltip text="Redo"><Button style={iconBtnStyle()} onClick={() => run(() => editor.chain().redo().run())}>↷</Button></Tooltip>
          <Tooltip text="Select"><Button style={iconBtnStyle(drawTool === 'select')} onClick={() => activateTool('select')}>↖</Button></Tooltip>
          <Tooltip text="Lasso Select"><Button style={iconBtnStyle()} onClick={() => run(() => editor.chain().selectAll().run())}>◌</Button></Tooltip>
          <Tooltip text="Eraser"><Button style={iconBtnStyle(drawTool === 'eraser')} onClick={() => activateTool('eraser', true)}>⌫</Button></Tooltip>
          <Tooltip text="Pencil"><Button style={iconBtnStyle(drawTool === 'pencil')} onClick={() => activateTool('pencil', true)}>✎</Button></Tooltip>
          <Tooltip text="Pen"><Button style={iconBtnStyle(drawTool === 'pen')} onClick={() => activateTool('pen', true)}>✒</Button></Tooltip>
          <Tooltip text="Highlighter"><Button style={iconBtnStyle(drawTool === 'highlighter')} onClick={() => activateTool('highlighter', true)}>▮</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Pens">
        <div style={col}>
          {pens.map((pen) => (
            <Tooltip key={pen.id} text={pen.label}>
              <Button
                style={{
                  ...iconBtnStyle(drawColor === pen.color),
                  borderBottom: `4px solid ${pen.color}`,
                  width: 26,
                  height: 26,
                }}
                onClick={() => selectPen(pen)}
              >
                ✎
              </Button>
            </Tooltip>
          ))}
          <Tooltip text="Add Pen"><Button style={{ ...iconBtnStyle(), width: 44, height: 26 }} onClick={addPen}>+ Add</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Thickness">
        <div style={col}>
          {THICKNESS_PRESETS.map((t) => (
            <Tooltip key={t.px} text={t.label}>
              <Button
                style={{
                  ...iconBtnStyle(drawSize === t.px),
                  width: 52,
                  height: 26,
                  fontSize: 10,
                }}
                onClick={() => { setDrawSize(t.px); toast(`Ink thickness: ${t.label}`, 'info'); }}
              >
                {t.label}
              </Button>
            </Tooltip>
          ))}
        </div>
      </RibbonGroup>

      <RibbonGroup label="Stencils">
        <div style={col}>
          <Tooltip text="Ruler"><Button style={{ ...iconBtnStyle(rulerVisible), height: 26 }} onClick={() => { toggleRuler(); toast(rulerVisible ? 'Ruler hidden' : 'Ruler shown', 'info'); }}>📏</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Edit">
        <div style={col}>
          <Tooltip text="Format Background"><Button style={{ ...iconBtnStyle(), width: 58, height: 26 }} onClick={formatBackground}>Background</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Highlighter">
        <div style={col}>
          {HIGHLIGHT_OPACITY.map((o) => (
            <Tooltip key={o.label} text={`Opacity ${o.label}`}>
              <Button
                style={{ ...iconBtnStyle(Math.abs(drawOpacity - o.value) < 0.01), width: 42, height: 26, fontSize: 10 }}
                onClick={() => { setDrawOpacity(o.value); toast(`Highlighter opacity: ${o.label}`, 'info'); }}
              >
                {o.label}
              </Button>
            </Tooltip>
          ))}
        </div>
      </RibbonGroup>

      <RibbonGroup label="Convert">
        <div style={col}>
          <Tooltip text="Ink to Shape"><Button style={{ ...iconBtnStyle(), width: 56, height: 26 }} onClick={() => openDialog('insertShape')}>Shape</Button></Tooltip>
          <Tooltip text="Ink to Math"><Button style={{ ...iconBtnStyle(), width: 52, height: 26 }} onClick={() => openDialog('equation')}>Math</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Insert">
        <div style={col}>
          <Tooltip text="Drawing Canvas"><Button style={{ ...iconBtnStyle(), width: 66, height: 26 }} onClick={() => openDialog('drawing')}>Canvas</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Replay">
        <div style={col}>
          <Tooltip text="Ink Replay"><Button style={{ ...iconBtnStyle(), width: 60, height: 26 }} onClick={replayInk}>Replay</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Help">
        <div style={col}>
          <Tooltip text="Ink Help"><Button style={{ ...iconBtnStyle(), width: 48, height: 26 }} onClick={() => window.open('https://support.microsoft.com/en-us/office/draw-and-write-with-ink-in-office', '_blank', 'noopener,noreferrer')}>?</Button></Tooltip>
        </div>
      </RibbonGroup>
    </>
  );
}

