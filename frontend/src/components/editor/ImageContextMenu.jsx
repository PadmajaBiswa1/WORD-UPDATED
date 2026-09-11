import { useState, useEffect, useRef } from 'react';
import {
  Edit3, Crop, RefreshCw, Palette, Layers, ChevronRight,
  ArrowUp, ArrowUpToLine, ArrowDown, ArrowDownToLine, RotateCcw, Trash2
} from 'lucide-react';
import { parseCssStyle, toCssStyle } from '@/utils/imageSelection';
import { isShapeSrc, parseShapeInfo, generateShapeDataUrl } from '@/utils/shapeUtils';

// Visual icon SVG diagrams for Text Wrap modes
export const WrapModeDiagram = ({ mode, size = 18 }) => {
  if (mode === 'inline') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="3" width="20" height="2" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="7" y="8" width="10" height="8" rx="1" fill="#d4af37" />
        <rect x="2" y="19" width="20" height="2" rx="1" fill="currentColor" opacity="0.6" />
      </svg>
    );
  }
  if (mode === 'left' || mode === 'square-left') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="8" height="8" rx="1" fill="#d4af37" />
        <rect x="13" y="4" width="9" height="2" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="13" y="8" width="9" height="2" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="13" y="12" width="9" height="2" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="2" y="16" width="20" height="2" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="2" y="20" width="15" height="2" rx="1" fill="currentColor" opacity="0.6" />
      </svg>
    );
  }
  if (mode === 'right' || mode === 'square-right') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="14" y="4" width="8" height="8" rx="1" fill="#d4af37" />
        <rect x="2" y="4" width="9" height="2" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="2" y="8" width="9" height="2" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="2" y="12" width="9" height="2" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="2" y="16" width="20" height="2" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="7" y="20" width="15" height="2" rx="1" fill="currentColor" opacity="0.6" />
      </svg>
    );
  }
  if (mode === 'behindText') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="5" y="5" width="14" height="14" rx="2" fill="#d4af37" opacity="0.35" />
        <rect x="2" y="4" width="20" height="2" rx="1" fill="currentColor" />
        <rect x="2" y="9" width="20" height="2" rx="1" fill="currentColor" />
        <rect x="2" y="14" width="20" height="2" rx="1" fill="currentColor" />
        <rect x="2" y="19" width="20" height="2" rx="1" fill="currentColor" />
      </svg>
    );
  }
  // inFrontOfText
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="2" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="2" y="9" width="20" height="2" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="2" y="14" width="20" height="2" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="2" y="19" width="20" height="2" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="5" y="5" width="14" height="14" rx="2" fill="#d4af37" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
};

export function ImageContextMenu({
  isOpen,
  x,
  y,
  onClose,
  imgElement,
  editor,
  onOpenCrop,
}) {
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const [activeSubmenu, setActiveSubmenu] = useState(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      window.addEventListener('scroll', onClose, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', onClose);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !imgElement || !editor) return null;

  const isShape = isShapeSrc(imgElement.src);
  const shapeInfo = isShape ? parseShapeInfo(imgElement.src, imgElement.alt) : null;

  const updateAttrs = (attrsPatch = {}, cssPatch = {}) => {
    const attrs = editor.getAttributes('image') || {};
    const css = parseCssStyle(attrs.style || '');
    Object.entries(cssPatch).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') delete css[k];
      else css[k] = v;
    });
    editor.chain().focus().updateAttributes('image', {
      ...attrsPatch,
      style: toCssStyle(css),
    }).run();
    onClose();
  };

  const handleWrap = (mode) => {
    if (mode === 'inline') {
      updateAttrs({ wrap: mode }, { float: null, display: 'block', margin: '12px auto', position: 'static' });
    } else if (mode === 'left') {
      updateAttrs({ wrap: mode }, { float: 'left', margin: '8px 16px 8px 0', position: 'relative' });
    } else if (mode === 'right') {
      updateAttrs({ wrap: mode }, { float: 'right', margin: '8px 0 8px 16px', position: 'relative' });
    } else if (mode === 'behindText') {
      updateAttrs({ wrap: mode }, { display: 'block', margin: '12px auto', position: 'relative', 'z-index': '0', opacity: '0.65' });
    } else if (mode === 'inFrontOfText') {
      updateAttrs({ wrap: mode }, { display: 'block', margin: '12px auto', position: 'relative', 'z-index': '10' });
    }
  };

  const handleZOrder = (action) => {
    const attrs = editor.getAttributes('image') || {};
    const css = parseCssStyle(attrs.style || '');
    let z = parseInt(String(css['z-index'] || attrs.zIndex || '1'), 10) || 1;
    if (action === 'forward') z += 1;
    else if (action === 'front') z = 99;
    else if (action === 'backward') z = Math.max(0, z - 1);
    else if (action === 'back') z = 0;
    updateAttrs({ zIndex: String(z) }, { position: 'relative', 'z-index': String(z) });
  };

  const handleReplaceFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateAttrs({ src: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleEditText = () => {
    if (!shapeInfo) return;
    const newText = window.prompt('Enter text to display inside shape:', shapeInfo.text || '');
    if (newText !== null) {
      const newUrl = generateShapeDataUrl({
        ...shapeInfo,
        text: newText,
        size: parseInt(imgElement.getAttribute('width') || '140', 10) || 140,
      });
      updateAttrs({ src: newUrl });
    }
  };

  const handleReset = () => {
    editor.chain().focus().updateAttributes('image', {
      width: null,
      height: null,
      style: null,
      rotate: null,
      wrap: null,
      zIndex: null,
    }).run();
    onClose();
  };

  const handleDelete = () => {
    editor.chain().focus().deleteSelection().run();
    onClose();
  };

  // Keep menu within viewport
  const menuWidth = 200;
  const menuHeight = 280;
  const left = Math.min(x, window.innerWidth - menuWidth - 10);
  const top = Math.min(y, window.innerHeight - menuHeight - 10);

  const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 12px',
    fontSize: 12,
    fontFamily: 'var(--font-ui)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    borderRadius: 4,
    userSelect: 'none',
    transition: 'background 0.12s ease',
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleReplaceFile}
        accept="image/*"
        style={{ display: 'none' }}
      />
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          left,
          top,
          width: menuWidth,
          background: 'rgba(24, 24, 24, 0.98)',
          border: '1px solid var(--border-gold)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
          backdropFilter: 'blur(12px)',
          padding: 4,
          zIndex: 10000,
          boxSizing: 'border-box',
        }}
      >
        {/* Wrap Text with Visual Diagrams */}
        <div
          style={itemStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            setActiveSubmenu('wrap');
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WrapModeDiagram mode="inline" size={15} />
            <span>Wrap Text</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▶</span>

          {/* Submenu for Wrap Modes */}
          {activeSubmenu === 'wrap' && (
            <div
              style={{
                position: 'absolute',
                left: menuWidth - 6,
                top: 0,
                width: 170,
                background: 'rgba(24, 24, 24, 0.98)',
                border: '1px solid var(--border-gold)',
                borderRadius: 8,
                padding: 4,
                boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                zIndex: 10001,
              }}
            >
              {[
                { id: 'inline', label: 'In-Line', mode: 'inline' },
                { id: 'left', label: 'Square (Left)', mode: 'left' },
                { id: 'right', label: 'Square (Right)', mode: 'right' },
                { id: 'behindText', label: 'Behind Text', mode: 'behindText' },
                { id: 'inFrontOfText', label: 'In Front of Text', mode: 'inFrontOfText' },
              ].map((w) => (
                <div
                  key={w.id}
                  onClick={() => handleWrap(w.id)}
                  style={itemStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <WrapModeDiagram mode={w.mode} size={15} />
                    <span>{w.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shape Text Option */}
        {isShape && (
          <div
            style={itemStyle}
            onClick={handleEditText}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              setActiveSubmenu(null);
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit3 size={14} strokeWidth={1.75} />
              <span>Edit Text in Shape</span>
            </div>
          </div>
        )}

        {/* Crop Tool */}
        {!isShape && (
          <div
            style={itemStyle}
            onClick={() => {
              onClose();
              onOpenCrop();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              setActiveSubmenu(null);
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Crop size={14} strokeWidth={1.75} />
              <span>Crop Image</span>
            </div>
          </div>
        )}

        {/* Replace Image */}
        <div
          style={itemStyle}
          onClick={() => fileInputRef.current?.click()}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            setActiveSubmenu(null);
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={14} strokeWidth={1.75} />
            <span>Replace {isShape ? 'Graphic' : 'Image'}</span>
          </div>
        </div>

        {/* Quick Format Panel Trigger */}
        <div
          style={itemStyle}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-image-edit-panel', { detail: { img: imgElement } }));
            onClose();
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            setActiveSubmenu(null);
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Palette size={14} strokeWidth={1.75} />
            <span>Format & Filters</span>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

        {/* Z-Order / Arrange */}
        <div
          style={itemStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            setActiveSubmenu('zorder');
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={14} strokeWidth={1.75} />
            <span>Order (Z-Index)</span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)' }}><ChevronRight size={12} strokeWidth={1.75} /></span>

          {activeSubmenu === 'zorder' && (
            <div
              style={{
                position: 'absolute',
                left: menuWidth - 6,
                top: 70,
                width: 150,
                background: 'rgba(24, 24, 24, 0.98)',
                border: '1px solid var(--border-gold)',
                borderRadius: 8,
                padding: 4,
                boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                zIndex: 10001,
              }}
            >
              {[
                { id: 'forward', label: 'Bring Forward', icon: <ArrowUp size={13} strokeWidth={1.75} /> },
                { id: 'front', label: 'Bring to Front', icon: <ArrowUpToLine size={13} strokeWidth={1.75} /> },
                { id: 'backward', label: 'Send Backward', icon: <ArrowDown size={13} strokeWidth={1.75} /> },
                { id: 'back', label: 'Send to Back', icon: <ArrowDownToLine size={13} strokeWidth={1.75} /> },
              ].map((z) => (
                <div
                  key={z.id}
                  onClick={() => handleZOrder(z.id)}
                  style={itemStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{z.icon}</span>
                    <span>{z.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reset Formatting */}
        <div
          style={itemStyle}
          onClick={handleReset}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            setActiveSubmenu(null);
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={14} strokeWidth={1.75} />
            <span>Reset Formatting</span>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

        {/* Delete */}
        <div
          style={{ ...itemStyle, color: '#f87171' }}
          onClick={handleDelete}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
            setActiveSubmenu(null);
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={14} strokeWidth={1.75} />
            <span>Delete</span>
          </div>
        </div>
      </div>
    </>
  );
}
