import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PenLine, X, Check, Pipette } from 'lucide-react';
import { useUIStore } from '@/store';

export const PRESET_COLORS = [
  '#d4af37', // Gold
  '#ffffff', // White
  '#000000', // Black
  '#e53935', // Red
  '#1e88e5', // Blue
  '#0f9d58', // Green
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ff5722', // Deep Orange
  '#64748b', // Slate
];

export const THICKNESS_PRESETS = [
  { label: '1px', value: 1 },
  { label: '2px', value: 2 },
  { label: '4px', value: 4 },
  { label: '8px', value: 8 },
  { label: '12px', value: 12 },
  { label: '16px', value: 16 },
];

export const OPACITY_PRESETS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
];

export function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  let c = String(hex).replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
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
}

export function PenCustomizerPanel({
  onClose,
  onAction,
  actionLabel = 'Start Drawing',
  title = 'Pen Customization',
  showAction = true,
  style = {},
}) {
  const {
    drawColor = '#d4af37',
    drawSize = 4,
    drawOpacity = 1,
    setDrawTool,
    setDrawColor,
    setDrawSize,
    setDrawOpacity,
    openDialog,
  } = useUIStore();

  const [hexInput, setHexInput] = useState(drawColor);
  const colorInputRef = useRef(null);

  // Sync internal hex input when store drawColor changes
  useEffect(() => {
    setHexInput(drawColor);
  }, [drawColor]);

  const handleColorSelect = (color) => {
    setDrawColor(color);
    setDrawTool('pen');
    setHexInput(color);
  };

  const handleHexInputChange = (e) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#([0-9a-fA-F]{3}){1,2}$/.test(val)) {
      setDrawColor(val);
      setDrawTool('pen');
    }
  };

  const handleActionClick = () => {
    setDrawTool('pen');
    if (onAction) {
      onAction();
    } else {
      openDialog('drawing');
    }
    onClose?.();
  };

  const currentOpacityPercent = Math.round((drawOpacity != null ? drawOpacity : 1) * 100);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: 'var(--font-ui)',
        color: 'var(--text-primary)',
        width: 268,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PenLine size={15} style={{ color: 'var(--gold)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>
            {title}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 2,
              borderRadius: 3,
            }}
            title="Close"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Color Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            COLOR
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: 'var(--text-secondary)',
              background: 'var(--bg-elevated)',
              padding: '1px 5px',
              borderRadius: 3,
              border: '1px solid var(--border)',
            }}
          >
            {drawColor.toUpperCase()}
          </span>
        </div>

        {/* Swatch grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 6,
          }}
        >
          {PRESET_COLORS.map((c) => {
            const isSelected = drawColor.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleColorSelect(c)}
                title={c}
                style={{
                  width: '100%',
                  height: 24,
                  borderRadius: 3,
                  backgroundColor: c,
                  border: isSelected ? '2px solid var(--gold)' : '1px solid var(--border)',
                  outline: isSelected ? '1px solid rgba(212,175,55,0.4)' : 'none',
                  outlineOffset: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'transform 0.1s, box-shadow 0.1s',
                  boxShadow: isSelected ? '0 0 6px rgba(212,175,55,0.4)' : 'none',
                }}
              >
                {isSelected && (
                  <Check
                    size={13}
                    strokeWidth={2.5}
                    style={{
                      color: c === '#ffffff' || c === '#d4af37' ? '#000000' : '#ffffff',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Custom Color Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {/* Native Color Picker Trigger */}
          <div
            onClick={() => colorInputRef.current?.click()}
            title="Custom color picker"
            style={{
              position: 'relative',
              width: 28,
              height: 24,
              borderRadius: 3,
              backgroundColor: drawColor,
              border: '1px solid var(--border-gold)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Pipette
              size={12}
              style={{
                color: drawColor === '#ffffff' ? '#000' : '#fff',
                mixBlendMode: 'difference',
              }}
            />
            <input
              ref={colorInputRef}
              type="color"
              value={drawColor.startsWith('#') && drawColor.length === 7 ? drawColor : '#d4af37'}
              onChange={(e) => handleColorSelect(e.target.value)}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
            />
          </div>

          {/* Hex text input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              height: 24,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '0 6px',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>#</span>
            <input
              type="text"
              value={hexInput.replace(/^#/, '')}
              onChange={(e) => handleHexInputChange({ target: { value: `#${e.target.value}` } })}
              placeholder="RRGGBB"
              maxLength={6}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: 11,
                width: '100%',
              }}
            />
          </div>
        </div>
      </div>

      {/* Thickness / Stroke Width Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            THICKNESS
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: 'var(--text-secondary)',
              background: 'var(--bg-elevated)',
              padding: '1px 5px',
              borderRadius: 3,
              border: '1px solid var(--border)',
            }}
          >
            {drawSize} px
          </span>
        </div>

        {/* Thickness Quick Chips */}
        <div style={{ display: 'flex', gap: 4 }}>
          {THICKNESS_PRESETS.map((p) => {
            const isSelected = drawSize === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  setDrawSize(p.value);
                  setDrawTool('pen');
                }}
                style={{
                  flex: 1,
                  height: 22,
                  fontSize: 10,
                  fontFamily: 'var(--font-ui)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--gold)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--gold-dim, rgba(212,175,55,0.15))' : 'var(--bg-elevated)',
                  color: isSelected ? 'var(--gold)' : 'var(--text-secondary)',
                  padding: 0,
                  transition: 'background 0.1s, border-color 0.1s',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Thickness Range Slider */}
        <input
          type="range"
          min={1}
          max={30}
          step={1}
          value={drawSize}
          onChange={(e) => {
            setDrawSize(Number(e.target.value));
            setDrawTool('pen');
          }}
          style={{
            width: '100%',
            accentColor: 'var(--gold)',
            cursor: 'pointer',
            height: 4,
            marginTop: 2,
          }}
        />
      </div>

      {/* Opacity Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            OPACITY
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: 'var(--text-secondary)',
              background: 'var(--bg-elevated)',
              padding: '1px 5px',
              borderRadius: 3,
              border: '1px solid var(--border)',
            }}
          >
            {currentOpacityPercent}%
          </span>
        </div>

        {/* Opacity Quick Chips */}
        <div style={{ display: 'flex', gap: 4 }}>
          {OPACITY_PRESETS.map((p) => {
            const isSelected = Math.abs((drawOpacity ?? 1) - p.value) < 0.05;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setDrawOpacity(p.value);
                  setDrawTool('pen');
                }}
                style={{
                  flex: 1,
                  height: 22,
                  fontSize: 10,
                  fontFamily: 'var(--font-ui)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--gold)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--gold-dim, rgba(212,175,55,0.15))' : 'var(--bg-elevated)',
                  color: isSelected ? 'var(--gold)' : 'var(--text-secondary)',
                  padding: 0,
                  transition: 'background 0.1s, border-color 0.1s',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Opacity Range Slider */}
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={currentOpacityPercent}
          onChange={(e) => {
            setDrawOpacity(Number(e.target.value) / 100);
            setDrawTool('pen');
          }}
          style={{
            width: '100%',
            accentColor: 'var(--gold)',
            cursor: 'pointer',
            height: 4,
            marginTop: 2,
          }}
        />
      </div>

      {/* Live Stroke Preview */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '6px 8px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 4,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600 }}>PREVIEW</span>
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
            {drawSize}px • {currentOpacityPercent}%
          </span>
        </div>
        <div
          style={{
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d0d0d',
            borderRadius: 3,
            border: '1px solid rgba(212,175,55,0.15)',
            padding: '0 12px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '100%',
              height: Math.min(drawSize, 26),
              background: drawColor,
              opacity: drawOpacity ?? 1,
              borderRadius: Math.max(1, drawSize / 2),
              boxShadow: drawOpacity > 0.5 ? `0 0 4px ${hexToRgba(drawColor, 0.4)}` : 'none',
              transition: 'height 0.1s, background 0.1s, opacity 0.1s',
            }}
          />
        </div>
      </div>

      {/* Action Button */}
      {showAction && (
        <button
          type="button"
          onClick={handleActionClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            height: 28,
            borderRadius: 4,
            border: '1px solid var(--border-gold)',
            background: 'var(--gold)',
            color: '#000000',
            fontWeight: 600,
            fontSize: 11,
            cursor: 'pointer',
            transition: 'background 0.12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'none';
          }}
        >
          <PenLine size={13} strokeWidth={2} />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}

export function PenCustomizerPopover({
  triggerRef,
  isOpen,
  onClose,
  onAction,
  actionLabel = 'Start Drawing',
  title = 'Pen Customization',
  align = 'center',
}) {
  const popoverRef = useRef(null);
  const [coords, setCoords] = useState({ top: 100, left: 100 });

  useEffect(() => {
    if (!isOpen || !triggerRef?.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popWidth = 286;
      let left = rect.left;

      if (align === 'center') {
        left = rect.left + rect.width / 2 - popWidth / 2;
      } else if (align === 'right') {
        if (rect.left - popWidth - 12 > 10) {
          left = rect.left - popWidth - 10;
        } else {
          left = rect.right - popWidth;
        }
      }

      // Viewport clamping
      left = Math.max(12, Math.min(window.innerWidth - popWidth - 12, left));

      let top = rect.bottom + 6;
      const popHeight = 440;
      if (top + popHeight > window.innerHeight && rect.top > popHeight + 10) {
        top = Math.max(12, rect.top - popHeight - 6);
      } else if (top + popHeight > window.innerHeight) {
        top = Math.max(12, window.innerHeight - popHeight - 12);
      }

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, triggerRef, align]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (
        popoverRef.current?.contains(e.target) ||
        triggerRef?.current?.contains(e.target)
      ) {
        return;
      }
      onClose?.();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 9999,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-gold)',
        borderRadius: 8,
        padding: 12,
        boxShadow: '0 12px 36px rgba(0,0,0,0.55), 0 0 16px rgba(212,175,55,0.15)',
        animation: 'fadeIn 0.12s ease-out',
      }}
    >
      <PenCustomizerPanel
        onClose={onClose}
        onAction={onAction}
        actionLabel={actionLabel}
        title={title}
      />
    </div>,
    document.body
  );
}
