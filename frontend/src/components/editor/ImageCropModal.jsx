import { useState, useRef, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

export function ImageCropModal({ isOpen, onClose, imgElement, onApplyCrop }) {
  const [aspectRatio, setAspectRatio] = useState('free'); // 'free', '1:1', '4:3', '16:9'
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, width: 80, height: 80 }); // in percentages (0 to 100)
  const [draggingHandle, setDraggingHandle] = useState(null);
  const dragStartRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCropBox({ x: 10, y: 10, width: 80, height: 80 });
      setAspectRatio('free');
    }
  }, [isOpen]);

  const setPresetRatio = (ratioKey) => {
    setAspectRatio(ratioKey);
    if (!containerRef.current || !imgElement) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    let targetRatio = null;
    if (ratioKey === '1:1') targetRatio = 1;
    else if (ratioKey === '4:3') targetRatio = 4 / 3;
    else if (ratioKey === '16:9') targetRatio = 16 / 9;

    if (targetRatio !== null) {
      // Calculate max width/height within 80% of container
      let boxW = 80;
      let boxH = (boxW * w) / (targetRatio * h);
      if (boxH > 80) {
        boxH = 80;
        boxW = (boxH * h * targetRatio) / w;
      }
      setCropBox({
        x: (100 - boxW) / 2,
        y: (100 - boxH) / 2,
        width: boxW,
        height: boxH,
      });
    }
  };

  const handlePointerDown = (e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingHandle(handle);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialBox: { ...cropBox },
    };
  };

  const handlePointerMove = useCallback((e) => {
    if (!draggingHandle || !dragStartRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaXPct = ((e.clientX - dragStartRef.current.clientX) / rect.width) * 100;
    const deltaYPct = ((e.clientY - dragStartRef.current.clientY) / rect.height) * 100;
    const { initialBox } = dragStartRef.current;

    setCropBox((prev) => {
      let nextX = initialBox.x;
      let nextY = initialBox.y;
      let nextW = initialBox.width;
      let nextH = initialBox.height;

      if (draggingHandle === 'move') {
        nextX = Math.max(0, Math.min(100 - initialBox.width, initialBox.x + deltaXPct));
        nextY = Math.max(0, Math.min(100 - initialBox.height, initialBox.y + deltaYPct));
      } else {
        if (draggingHandle.includes('w')) {
          const maxLeft = initialBox.x + initialBox.width - 10;
          nextX = Math.max(0, Math.min(maxLeft, initialBox.x + deltaXPct));
          nextW = initialBox.width + (initialBox.x - nextX);
        }
        if (draggingHandle.includes('e')) {
          nextW = Math.max(10, Math.min(100 - initialBox.x, initialBox.width + deltaXPct));
        }
        if (draggingHandle.includes('n')) {
          const maxTop = initialBox.y + initialBox.height - 10;
          nextY = Math.max(0, Math.min(maxTop, initialBox.y + deltaYPct));
          nextH = initialBox.height + (initialBox.y - nextY);
        }
        if (draggingHandle.includes('s')) {
          nextH = Math.max(10, Math.min(100 - initialBox.y, initialBox.height + deltaYPct));
        }
      }

      return { x: nextX, y: nextY, width: nextW, height: nextH };
    });
  }, [draggingHandle]);

  const handlePointerUp = useCallback(() => {
    setDraggingHandle(null);
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    if (draggingHandle) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [draggingHandle, handlePointerMove, handlePointerUp]);

  const applyCrop = () => {
    if (!imgElement) return;
    try {
      const naturalW = imgElement.naturalWidth || imgElement.width || 400;
      const naturalH = imgElement.naturalHeight || imgElement.height || 300;

      const cropPxX = (cropBox.x / 100) * naturalW;
      const cropPxY = (cropBox.y / 100) * naturalH;
      const cropPxW = (cropBox.width / 100) * naturalW;
      const cropPxH = (cropBox.height / 100) * naturalH;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(cropPxW));
      canvas.height = Math.max(1, Math.round(cropPxH));
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, cropPxX, cropPxY, cropPxW, cropPxH, 0, 0, canvas.width, canvas.height);
        const croppedUrl = canvas.toDataURL('image/png');
        onApplyCrop(croppedUrl, canvas.width, canvas.height);
        onClose();
      };
      img.onerror = () => {
        // Direct draw from existing element if CORS fails
        ctx.drawImage(imgElement, cropPxX, cropPxY, cropPxW, cropPxH, 0, 0, canvas.width, canvas.height);
        const croppedUrl = canvas.toDataURL('image/png');
        onApplyCrop(croppedUrl, canvas.width, canvas.height);
        onClose();
      };
      img.src = imgElement.src;
    } catch (err) {
      console.error('Crop error:', err);
      onClose();
    }
  };

  if (!isOpen || !imgElement) return null;

  return (
    <Modal title="Crop Image" onClose={onClose} width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Aspect Ratio Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Ratio:</span>
          {[
            { id: 'free', label: 'Free' },
            { id: '1:1', label: '1:1 Square' },
            { id: '4:3', label: '4:3 Standard' },
            { id: '16:9', label: '16:9 Widescreen' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setPresetRatio(preset.id)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                borderRadius: 4,
                cursor: 'pointer',
                background: aspectRatio === preset.id ? 'var(--gold)' : 'var(--bg-elevated)',
                color: aspectRatio === preset.id ? '#000000' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontWeight: aspectRatio === preset.id ? 600 : 400,
              }}
            >
              {preset.label}
            </button>
          ))}
          <Button
            variant="subtle"
            style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px' }}
            onClick={() => setCropBox({ x: 0, y: 0, width: 100, height: 100 })}
          >
            Reset
          </Button>
        </div>

        {/* Crop Stage with Visual Overlay */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            height: 380,
            background: '#111',
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          }}
        >
          <img
            src={imgElement.src}
            alt="Crop target"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              display: 'block',
            }}
          />

          {/* Dark mask outside crop box */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.55)`,
              clipPath: `polygon(
                0% 0%, 0% 100%,
                ${cropBox.x}% 100%,
                ${cropBox.x}% ${cropBox.y}%,
                ${cropBox.x + cropBox.width}% ${cropBox.y}%,
                ${cropBox.x + cropBox.width}% ${cropBox.y + cropBox.height}%,
                ${cropBox.x}% ${cropBox.y + cropBox.height}%,
                ${cropBox.x}% 100%,
                100% 100%, 100% 0%
              )`,
              background: 'rgba(0, 0, 0, 0.55)',
            }}
          />

          {/* Movable / Resizable Crop Frame */}
          <div
            onPointerDown={(e) => handlePointerDown(e, 'move')}
            style={{
              position: 'absolute',
              left: `${cropBox.x}%`,
              top: `${cropBox.y}%`,
              width: `${cropBox.width}%`,
              height: `${cropBox.height}%`,
              border: '2px solid #fff',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.5)',
              cursor: 'move',
              boxSizing: 'border-box',
            }}
          >
            {/* Rule of thirds grid lines */}
            <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />

            {/* Corner & edge handles */}
            {[
              { handle: 'nw', top: -4, left: -4, cursor: 'nwse-resize' },
              { handle: 'ne', top: -4, right: -4, cursor: 'nesw-resize' },
              { handle: 'sw', bottom: -4, left: -4, cursor: 'nesw-resize' },
              { handle: 'se', bottom: -4, right: -4, cursor: 'nwse-resize' },
              { handle: 'n', top: -4, left: 'calc(50% - 4px)', cursor: 'ns-resize' },
              { handle: 's', bottom: -4, left: 'calc(50% - 4px)', cursor: 'ns-resize' },
              { handle: 'w', left: -4, top: 'calc(50% - 4px)', cursor: 'ew-resize' },
              { handle: 'e', right: -4, top: 'calc(50% - 4px)', cursor: 'ew-resize' },
            ].map(({ handle, cursor, ...pos }) => (
              <div
                key={handle}
                onPointerDown={(e) => handlePointerDown(e, handle)}
                style={{
                  position: 'absolute',
                  width: 10,
                  height: 10,
                  background: '#fff',
                  border: '1.5px solid #1a73e8',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                  cursor,
                  ...pos,
                }}
              />
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={applyCrop} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={14} /> Apply Crop</Button>
        </div>
      </div>
    </Modal>
  );
}
