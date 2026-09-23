import { useRef, useState, useEffect, useCallback } from 'react';
import { PenLine, Pipette, Undo2, Redo2 } from 'lucide-react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Tooltip } from '@/components/ui';
import { PenCustomizerPopover } from '@/components/editor/PenCustomizerPanel';

const TOOLS  = [{ id:'pen', icon:'✏', label:'Pen' }, { id:'highlighter', icon:'🖍', label:'Highlighter' }, { id:'eraser', icon:'⬜', label:'Eraser' }];
const COLORS = ['#d4af37','#e8d98a','#ffffff','#ff5555','#55ff88','#55aaff','#ff55ff','#000000'];
const SIZES  = [2, 4, 6, 10, 16];

export function DrawingDialog() {
  const {
    closeDialog, toast,
    drawTool, drawColor, drawSize, drawOpacity,
    setDrawTool, setDrawColor, setDrawSize, setDrawOpacity,
    drawingEditSrc, drawingEditPos, clearDrawingEdit,
  } = useUIStore();
  const { editor } = useEditorStore();
  const canvasRef = useRef();
  const customizerBtnRef = useRef(null);
  const colorInputRef = useRef(null);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const lastPos = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [canUndoStroke, setCanUndoStroke] = useState(false);
  const [canRedoStroke, setCanRedoStroke] = useState(false);

  const isEditMode = Boolean(drawingEditSrc);
  const W = 560, H = 360;

  // Load existing drawing onto canvas when in edit mode
  useEffect(() => {
    if (!drawingEditSrc || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
    };
    img.src = drawingEditSrc;
  }, [drawingEditSrc]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const toRgba = (hex, alpha = 1) => {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    let c = String(hex).replace('#', '').trim();
    if (c.length === 3) {
      c = c.split('').map((ch) => ch + ch).join('');
    }
    if (c.length === 6) {
      const num = parseInt(c, 16);
      if (!isNaN(num)) {
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    return hex;
  };

  const saveCanvasSnapshot = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const snapshot = ctx.getImageData(0, 0, W, H);
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndoStroke(true);
    setCanRedoStroke(false);
  }, [W, H]);

  const undoStroke = useCallback(() => {
    if (!canvasRef.current || undoStackRef.current.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    const current = ctx.getImageData(0, 0, W, H);
    redoStackRef.current.push(current);
    const prev = undoStackRef.current.pop();
    ctx.putImageData(prev, 0, 0);
    setCanUndoStroke(undoStackRef.current.length > 0);
    setCanRedoStroke(true);
    toast('Undone drawing stroke', 'info');
  }, [W, H, toast]);

  const redoStroke = useCallback(() => {
    if (!canvasRef.current || redoStackRef.current.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    const current = ctx.getImageData(0, 0, W, H);
    undoStackRef.current.push(current);
    const next = redoStackRef.current.pop();
    ctx.putImageData(next, 0, 0);
    setCanUndoStroke(true);
    setCanRedoStroke(redoStackRef.current.length > 0);
    toast('Redone drawing stroke', 'info');
  }, [W, H, toast]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const isZ = key === 'z' || e.code === 'KeyZ';
      const isY = key === 'y' || e.code === 'KeyY';

      if (mod && !e.shiftKey && !e.altKey && isZ) {
        e.preventDefault();
        e.stopPropagation();
        undoStroke();
        return;
      }
      if (mod && !e.altKey && (isY || (e.shiftKey && isZ))) {
        e.preventDefault();
        e.stopPropagation();
        redoStroke();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [undoStroke, redoStroke]);

  const startDraw = (e) => {
    saveCanvasSnapshot();
    isDrawingRef.current = true;
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !lastPos.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    if (drawTool === 'eraser') {
      // Smooth, continuous erase using destination-out composite
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth   = drawSize * 4;
    } else if (drawTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = toRgba(drawColor, drawOpacity ?? 0.4);
      ctx.lineWidth   = drawSize * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = toRgba(drawColor, drawOpacity ?? 1);
      ctx.lineWidth   = drawSize;
    }
    ctx.stroke();

    lastPos.current = pos;
  };

  const stopDraw = () => {
    if (!canvasRef.current) return;
    // Reset composite after eraser stroke so subsequent draws work normally
    const ctx = canvasRef.current.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    isDrawingRef.current = false;
    setDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    saveCanvasSnapshot();
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, W, H);
  };

  const handleClose = () => {
    clearDrawingEdit();
    closeDialog('drawing');
  };

  const insertDrawing = () => {
    if (!canvasRef.current) return;
    const img = canvasRef.current.toDataURL('image/png');
    if (!editor) return;

    if (isEditMode && drawingEditPos != null) {
      // Replace existing drawing node at the saved position, preserving width/height
      let curW = String(W);
      let curH = String(H);
      try {
        const node = editor.state.doc.nodeAt(drawingEditPos);
        if (node?.attrs?.width) curW = String(node.attrs.width);
        if (node?.attrs?.height) curH = String(node.attrs.height);
      } catch (_) {}

      editor
        .chain()
        .focus()
        .setNodeSelection(drawingEditPos)
        .updateAttributes('image', {
          src: img,
          alt: 'Drawing',
          'data-drawing': 'true',
          width: curW,
          height: curH,
          style: `width:${curW}px;height:${curH}px;display:block;margin:12px auto;`,
        })
        .run();
      toast('Drawing updated!', 'success');
    } else {
      // Insert new drawing after current selection with explicit 560x360 size
      const insertPos = editor.state.selection.to;
      editor
        .chain()
        .focus()
        .setTextSelection(insertPos)
        .insertContent([
          { type: 'paragraph' },
          {
            type: 'image',
            attrs: {
              src: img,
              alt: 'Drawing',
              'data-drawing': 'true',
              width: String(W),
              height: String(H),
              style: `width:${W}px;height:${H}px;display:block;margin:12px auto;`,
            },
          },
          { type: 'paragraph' },
        ])
        .run();
      toast('Drawing inserted!', 'success');
    }

    clearDrawingEdit();
    closeDialog('drawing');
  };

  return (
    <Modal title={isEditMode ? 'Edit Drawing' : 'Freehand Drawing'} onClose={handleClose} width={620} noPad>
      <div style={{ display:'flex', flexDirection:'column' }}>
        {/* Toolbar */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
          {/* Tools */}
          <div style={{ display:'flex', gap:3 }}>
            {TOOLS.map((t) => (
              <Tooltip key={t.id} text={t.label}>
                <button onClick={() => setDrawTool(t.id)} style={{
                  background: drawTool===t.id ? 'var(--bg-active)':'var(--bg-elevated)',
                  border: drawTool===t.id ? '1px solid var(--gold)':'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)', padding:'4px 10px',
                  cursor:'pointer', fontSize:15, color:'var(--text-primary)',
                  transition:'var(--transition)',
                }}>{t.icon}</button>
              </Tooltip>
            ))}
          </div>

          <div style={{ width:1, height:24, background:'var(--border)' }} />

          {/* Pen Customizer Popover Trigger */}
          <Tooltip text="Customize Pen (Color, Thickness, Opacity)">
            <button
              ref={customizerBtnRef}
              type="button"
              onClick={() => setCustomizerOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: 12,
                background: customizerOpen ? 'var(--bg-active)' : 'var(--bg-elevated)',
                border: customizerOpen ? '1px solid var(--gold)' : '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <PenLine size={13} style={{ color: 'var(--gold)' }} />
              <span>Pen Settings</span>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: drawColor || '#d4af37',
                  opacity: drawOpacity ?? 1,
                  border: '1px solid var(--border-gold)',
                  marginLeft: 2,
                }}
              />
            </button>
          </Tooltip>

          <PenCustomizerPopover
            triggerRef={customizerBtnRef}
            isOpen={customizerOpen}
            onClose={() => setCustomizerOpen(false)}
            onAction={() => {
              setDrawTool('pen');
              setCustomizerOpen(false);
            }}
            actionLabel="Apply to Pen"
            title="Pen Customization"
          />

          <div style={{ width:1, height:24, background:'var(--border)' }} />

          {/* Colors */}
          <div style={{ display:'flex', gap:3, alignItems: 'center', flexWrap:'wrap' }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setDrawColor(c)} style={{
                width:20, height:20, background:c, border: drawColor===c ? '2px solid var(--gold)':'1px solid var(--border)',
                borderRadius:3, cursor:'pointer', padding:0,
              }} />
            ))}
            <div
              onClick={() => colorInputRef.current?.click()}
              title="Custom Color"
              style={{
                position: 'relative',
                width: 20,
                height: 20,
                background: drawColor,
                border: '1px dashed var(--gold)',
                borderRadius: 3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pipette size={10} style={{ color: '#fff', mixBlendMode: 'difference' }} />
              <input
                ref={colorInputRef}
                type="color"
                value={drawColor.startsWith('#') && drawColor.length === 7 ? drawColor : '#d4af37'}
                onChange={(e) => setDrawColor(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              />
            </div>
          </div>

          <div style={{ width:1, height:24, background:'var(--border)' }} />

          {/* Brush size */}
          <div style={{ display:'flex', gap:3, alignItems:'center' }}>
            {SIZES.map((s) => (
              <button key={s} onClick={() => setDrawSize(s)} style={{
                width:s+12, height:s+12,
                background: drawSize===s ? 'var(--gold)':'var(--bg-elevated)',
                border: drawSize===s ? '1px solid var(--gold)':'1px solid var(--border)',
                borderRadius:'50%', cursor:'pointer',
              }} />
            ))}
          </div>

          <div style={{ width:1, height:24, background:'var(--border)' }} />

          {/* Undo / Redo */}
          <div style={{ display:'flex', gap:3, alignItems:'center' }}>
            <Tooltip text="Undo Stroke (Ctrl+Z)">
              <button
                type="button"
                onClick={undoStroke}
                disabled={!canUndoStroke}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  cursor: canUndoStroke ? 'pointer' : 'not-allowed',
                  opacity: canUndoStroke ? 1 : 0.45,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-primary)',
                }}
              >
                <Undo2 size={13} />
              </button>
            </Tooltip>
            <Tooltip text="Redo Stroke (Ctrl+Y)">
              <button
                type="button"
                onClick={redoStroke}
                disabled={!canRedoStroke}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  cursor: canRedoStroke ? 'pointer' : 'not-allowed',
                  opacity: canRedoStroke ? 1 : 0.45,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-primary)',
                }}
              >
                <Redo2 size={13} />
              </button>
            </Tooltip>
          </div>

          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            <Button variant="subtle"  onClick={clearCanvas}>Clear</Button>
            <Button variant="primary" onClick={insertDrawing}>
              {isEditMode ? '✓ Save Drawing' : '✓ Insert'}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <canvas ref={canvasRef} width={W} height={H}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          style={{ cursor: drawTool==='eraser'?'cell':'crosshair', display:'block', width:'100%', background:'#ffffff' }} />
      </div>
    </Modal>
  );
}
