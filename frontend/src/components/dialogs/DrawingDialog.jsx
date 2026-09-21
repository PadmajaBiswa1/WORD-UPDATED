import { useRef, useState, useEffect } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Tooltip } from '@/components/ui';

const TOOLS  = [{ id:'pen', icon:'✏', label:'Pen' }, { id:'highlighter', icon:'🖍', label:'Highlighter' }, { id:'eraser', icon:'⬜', label:'Eraser' }];
const COLORS = ['#d4af37','#e8d98a','#ffffff','#ff5555','#55ff88','#55aaff','#ff55ff','#000000'];
const SIZES  = [2, 4, 6, 10, 16];

export function DrawingDialog() {
  const {
    closeDialog, toast,
    drawTool, drawColor, drawSize, drawOpacity,
    setDrawTool, setDrawColor, setDrawSize,
    drawingEditSrc, drawingEditPos, clearDrawingEdit,
  } = useUIStore();
  const { editor } = useEditorStore();
  const canvasRef = useRef();
  const [drawing, setDrawing] = useState(false);
  const lastPos = useRef(null);

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

  // When dialog opens in edit mode: hide the image selection handles/border so
  // the blue overlay doesn't bleed through the drawing canvas
  useEffect(() => {
    if (!isEditMode) return;
    // Hide resize handles and selection border
    window.dispatchEvent(new CustomEvent('image-handles-hide'));
    // Also blur the editor so PictureFormatToolbar auto-hides
    if (editor) {
      try { editor.commands.blur(); } catch (_) {}
    }
  }, [isEditMode, editor]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const toRgba = (hex, alpha) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return hex;
    return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
  };

  const startDraw = (e) => {
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    if (!drawing || !lastPos.current) return;
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
      ctx.strokeStyle = drawColor;
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
    setDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = () => {
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
      // Replace existing drawing node at the saved position
      editor
        .chain()
        .focus()
        .setNodeSelection(drawingEditPos)
        .updateAttributes('image', {
          src: img,
          alt: 'Drawing',
          'data-drawing': 'true',
        })
        .run();
      toast('Drawing updated!', 'success');
    } else {
      // Insert new drawing after current selection
      const insertPos = editor.state.selection.to;
      editor
        .chain()
        .focus()
        .setTextSelection(insertPos)
        .insertContent([
          { type: 'paragraph' },
          { type: 'image', attrs: { src: img, alt: 'Drawing', 'data-drawing': 'true' } },
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

          {/* Colors */}
          <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setDrawColor(c)} style={{
                width:20, height:20, background:c, border: drawColor===c ? '2px solid var(--gold)':'1px solid var(--border)',
                borderRadius:3, cursor:'pointer', padding:0,
              }} />
            ))}
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
