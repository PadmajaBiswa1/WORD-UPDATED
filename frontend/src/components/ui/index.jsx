// ═══════════════════════════════════════════════════════════════
//  EtherX Word — UI Primitives
// ═══════════════════════════════════════════════════════════════
import { createPortal } from 'react-dom';
import { useState, useEffect, useRef, useId } from 'react';
import { PanelTop, X } from 'lucide-react';

/* ── Button ─────────────────────────────────────────────────── */
const variantStyle = {
  ghost:   { bg: 'transparent', color: 'var(--text-primary)', hoverBg: 'var(--bg-hover)', activeBg: 'var(--bg-active)' },
  primary: { bg: 'var(--gold)', color: 'var(--text-on-gold)', hoverBg: 'var(--gold-hover)', activeBg: 'var(--gold)' },
  outline: { bg: 'transparent', color: 'var(--gold)', hoverBg: 'var(--gold-dim)', activeBg: 'var(--gold-dim)', border: '1px solid var(--gold-border)' },
  danger:  { bg: '#c0392b',        color: '#fff',                  hoverBg: '#e74c3c', activeBg: '#c0392b' },
  subtle:  { bg: 'var(--bg-elevated)', color: 'var(--text-secondary)', hoverBg: 'var(--bg-hover)', activeBg: 'var(--bg-active)' },
};

export function Button({ children, onClick, onMouseDown, variant = 'ghost', size = 'sm', active = false, disabled = false, title, className = '', style = {}, type = 'button', ...rest }) {
  const v = variantStyle[variant] || variantStyle.ghost;
  const pad = { xs: '2px 5px', sm: '3px 8px', md: '6px 14px', lg: '8px 20px' }[size] || '3px 8px';
  const fz  = { xs: '11px', sm: '12px', md: '13px', lg: '14px' }[size] || '12px';

  const cleanStyle = style ? Object.fromEntries(Object.entries(style).filter(([, val]) => val !== undefined)) : {};

  return (
    <button
      {...rest}
      type={type}
      title={title}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseDown={disabled ? undefined : onMouseDown}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
        minWidth: 22, minHeight: 22, padding: pad, fontSize: fz, fontFamily: 'var(--font-ui)', fontWeight: 500,
        background: active ? v.activeBg : v.bg,
        color: active ? (variant === 'ghost' ? 'var(--gold)' : v.color) : v.color,
        border: v.border || '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.1s, border-color 0.1s, color 0.1s',
        userSelect: 'none', whiteSpace: 'nowrap', outline: 'none',
        ...cleanStyle,
      }}
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = v.hoverBg;
          e.currentTarget.style.borderColor = 'var(--gold)';
          if (variant === 'ghost') e.currentTarget.style.color = 'var(--gold)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = active ? v.activeBg : v.bg;
          e.currentTarget.style.borderColor = v.border ? 'var(--gold-border)' : 'transparent';
          if (variant === 'ghost') e.currentTarget.style.color = active ? 'var(--gold)' : v.color;
        }
      }}
    >
      {children}
    </button>
  );
}

/* ── Divider ────────────────────────────────────────────────── */
export function Divider({ vertical = false }) {
  return (
    <div style={{
      background: 'var(--border-strong)', flexShrink: 0,
      ...(vertical ? { width: '1px', height: '26px', margin: '0 3px' } : { height: '1px', margin: '4px 0' }),
    }} />
  );
}

const isMacPlatform = typeof navigator !== 'undefined' && (
  /Mac|iPod|iPhone|iPad/.test(navigator.platform || '') ||
  /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent || '') ||
  navigator.userAgentData?.platform === 'macOS'
);

function formatTooltipShortcut(shortcut = '') {
  if (!shortcut) return '';
  const raw = String(shortcut).replace(/^\(|\)$/g, '').trim();
  if (isMacPlatform) {
    return raw.replace(/Ctrl\+/gi, 'Cmd+').replace(/Alt\+/gi, 'Option+');
  }
  return raw;
}

/* ── Tooltip ────────────────────────────────────────────────── */
export function Tooltip({ children, text, shortcut, placement = 'top', delay = 450 }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, actualPlacement: placement });
  const triggerRef = useRef(null);
  const timerRef = useRef(null);

  const handleMouseEnter = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const isTop = placement === 'top';
      const actualPlacement = (isTop && rect.top < 36) ? 'bottom' : placement;
      const top = actualPlacement === 'top'
        ? Math.max(4, rect.top - 8)
        : Math.min(window.innerHeight - 30, rect.bottom + 8);
      const left = Math.max(10, Math.min(window.innerWidth - 10, rect.left + rect.width / 2));
      setCoords({ top, left, actualPlacement });
      setShow(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    setShow(false);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const displayShortcut = shortcut ? formatTooltipShortcut(shortcut) : null;

  return (
    <div
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && text && typeof document !== 'undefined' && createPortal(
        <div
          className="studio-tooltip anim-fade-in"
          role="tooltip"
          style={{
            position: 'fixed',
            zIndex: 99999,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            background: 'var(--popup-bg)',
            color: 'var(--text-primary)',
            border: '1px solid var(--popup-border)',
            fontSize: '11px',
            padding: '4px 9px',
            borderRadius: 8,
            boxShadow: 'var(--shadow-lg)',
            top: coords.top,
            left: coords.left,
            transform: coords.actualPlacement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
        >
          {text}
          {displayShortcut && (
            <span style={{ color: 'var(--gold)', marginLeft: 6, fontSize: '10px' }}>
              ({displayShortcut})
            </span>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ── Select ─────────────────────────────────────────────────── */
export function Select({ value, onChange, options = [], width = 120, minMenuWidth, title, searchable = false, searchPlaceholder, onFocus, style = {} }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 });
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  
  const styles = {
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    hoverBg: 'var(--bg-hover)',
    arrowColor: 'var(--gold)',
  };

  const normalizedVal = String(value || '').trim().toLowerCase();
  const selected = options.find((option) => String(option.value).toLowerCase() === normalizedVal)
    || options.find((option) => {
      const optVal = String(option.value).toLowerCase();
      return normalizedVal.startsWith(optVal) || normalizedVal.includes(optVal);
    })
    || options[0]
    || { value: '', label: '' };

  const normalizedQuery = query.trim().toLowerCase();
  const numericQuery = parseFloat(normalizedQuery);
  const isNumeric = !isNaN(numericQuery) && numericQuery > 0 && String(numericQuery) === normalizedQuery.replace(/pt$/, '');

  const filteredOptions = options.filter((option) => {
    if (!normalizedQuery) return true;
    const searchHaystack = [option.label, option.value, option.searchTerms]
      .flat()
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchHaystack.includes(normalizedQuery);
  });

  const displayOptions = [...filteredOptions];
  if (isNumeric && !filteredOptions.some((o) => String(o.value) === String(numericQuery))) {
    displayOptions.unshift({
      value: String(numericQuery),
      label: `${numericQuery} pt`,
      isCustom: true,
    });
  }

  const updateMenuPosition = () => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;

    const estimatedHeight = 340;
    const spaceBelow = window.innerHeight - triggerRect.bottom - 12;
    const spaceAbove = triggerRect.top - 12;
    const openUp = spaceBelow < 210 && spaceAbove > spaceBelow;
    const menuHeight = Math.min(estimatedHeight, Math.max(180, openUp ? spaceAbove : spaceBelow));
    const top = openUp
      ? Math.max(8, triggerRect.top - menuHeight - 4)
      : Math.min(window.innerHeight - menuHeight - 8, triggerRect.bottom + 4);

    const resolvedWidth = Math.max(triggerRect.width, minMenuWidth || (searchable ? 64 : 48));

    setMenuStyle({
      top,
      left: Math.max(8, Math.min(triggerRect.left, window.innerWidth - resolvedWidth - 8)),
      width: resolvedWidth,
      maxHeight: menuHeight,
    });
  };

  useEffect(() => {
    if (!open) return undefined;

    const selectedIndex = options.findIndex((option) => {
      if (option.value === value) return true;
      const optVal = String(option.value).toLowerCase();
      const normVal = String(value || '').trim().toLowerCase();
      return optVal === normVal || normVal.startsWith(optVal) || normVal.includes(optVal);
    });
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    updateMenuPosition();

    const onMouseDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    const onResize = () => updateMenuPosition();

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    if (!filteredOptions.length) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => Math.min(current, filteredOptions.length - 1));
  }, [filteredOptions.length, open]);

  const choose = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
  };

  if (searchable) {
    return (
      <div style={{ position: 'relative', width: widthStyle, flexShrink: 0 }}>
        <button
          ref={triggerRef}
          className="ui-select"
          type="button"
          title={title}
          onClick={() => setOpen((current) => !current)}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--gold)';
            onFocus?.(e);
          }}
          style={{
            height: 22,
            width: '100%',
            background: styles.background,
            color: styles.color,
            border: styles.border,
            borderRadius: 2,
            padding: '0 18px 0 6px',
            fontSize: '12px',
            fontFamily: selected?.style?.fontFamily || 'var(--font-ui)',
            cursor: 'pointer',
            outline: 'none',
            appearance: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textAlign: 'left',
            backgroundImage: `linear-gradient(45deg, transparent 50%, ${styles.arrowColor} 50%), linear-gradient(135deg, ${styles.arrowColor} 50%, transparent 50%)`,
            backgroundPosition: 'calc(100% - 10px) 9px, calc(100% - 5px) 9px',
            backgroundSize: '5px 5px, 5px 5px',
            backgroundRepeat: 'no-repeat',
            ...style,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = styles.hoverBg; e.currentTarget.style.borderColor = 'var(--gold)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = styles.background; e.currentTarget.style.borderColor = styles.border.split('solid ')[1]; }}
          onBlur={(e) => (e.currentTarget.style.borderColor = styles.border.split('solid ')[1])}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected?.label}</span>
        </button>

        {open && createPortal(
          <div
            ref={menuRef}
            data-select-menu="true"
            className="studio-popover"
            style={{
              position: 'fixed',
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
              maxHeight: menuStyle.maxHeight,
              zIndex: 9999,
              background: styles.background,
              border: styles.border,
              borderRadius: 6,
              boxShadow: '0 16px 34px rgba(0,0,0,0.32)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveIndex((current) => Math.min(current + 1, Math.max(displayOptions.length - 1, 0)));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveIndex((current) => Math.max(current - 1, 0));
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    const next = displayOptions[activeIndex] || displayOptions[0];
                    if (next) choose(next.value);
                    else if (isNumeric) choose(String(numericQuery));
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setOpen(false);
                  }
                }}
                placeholder={searchPlaceholder || `Search ${title || 'options'}...`}
                style={{
                  width: '100%',
                  height: 26,
                  boxSizing: 'border-box',
                   background: 'var(--bg-surface)',
                   color: styles.color,
                   border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '0 6px',
                  fontSize: 12,
                  fontFamily: 'var(--font-ui)',
                  outline: 'none',
                }}
                 onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
                 onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
            <div style={{ maxHeight: menuStyle.maxHeight - 40, overflowY: 'auto', padding: 3, scrollbarWidth: 'thin' }}>
              {displayOptions.length > 0 ? displayOptions.map((option, index) => {
                const isActive = index === activeIndex;
                const isSelected = String(option.value).toLowerCase() === normalizedVal;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option.value)}
                    style={{
                      width: '100%',
                      minHeight: 24,
                      padding: '4px 6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 4,
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                      background: isActive ? 'var(--bg-hover)' : (isSelected ? 'var(--gold-dim)' : 'transparent'),
                      color: isSelected ? 'var(--gold)' : styles.color,
                      fontFamily: option.style?.fontFamily || 'var(--font-ui)',
                      fontSize: 12,
                      fontWeight: isSelected ? 600 : 400,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.label}</span>
                    {option.isCustom && <span style={{ fontSize: 9, color: 'var(--gold)', opacity: 0.8 }}>custom</span>}
                  </button>
                );
              }) : (
                <div style={{ padding: '10px 8px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: 12, textAlign: 'center' }}>
                  No results
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
      </div>
    );
  }
  
  return (
    <select 
      className="ui-select"
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      title={title}
      onFocus={(e) => {
        e.target.style.borderColor = 'var(--gold)';
        onFocus?.(e);
      }}
      style={{
        height: 22,
        background: styles.background,
        color: styles.color,
        border: styles.border,
        borderRadius: 2,
        padding: '0 22px 0 6px',
        fontSize: '12px',
        fontFamily: 'var(--font-ui)',
        width,
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        backgroundImage: `linear-gradient(45deg, transparent 50%, ${styles.arrowColor} 50%), linear-gradient(135deg, ${styles.arrowColor} 50%, transparent 50%)`,
        backgroundPosition: 'calc(100% - 12px) 9px, calc(100% - 7px) 9px',
        backgroundSize: '5px 5px, 5px 5px',
        backgroundRepeat: 'no-repeat',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = styles.hoverBg; e.currentTarget.style.borderColor = 'var(--gold)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = styles.background; e.currentTarget.style.borderColor = styles.border.split('solid ')[1]; }}
      onBlur={(e)  => (e.target.style.borderColor = styles.border.split('solid ')[1])}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ── Input ──────────────────────────────────────────────────── */
export function Input({ value, onChange, placeholder, width = '100%', type = 'text', autoFocus, onKeyDown, rows, style = {}, className, ...rest }) {
  const base = {
    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    padding: '6px 10px', fontSize: '13px', fontFamily: 'var(--font-ui)',
    width, outline: 'none', transition: 'border-color var(--transition)',
    resize: rows ? 'vertical' : undefined,
    boxSizing: 'border-box',
    ...style,
  };
  const handlers = {
    onFocus: (e) => {
      e.target.style.borderColor = style.borderColor || 'var(--gold)';
      rest.onFocus?.(e);
    },
    onBlur:  (e) => {
      e.target.style.borderColor = style.borderColor || (style.border ? undefined : 'var(--border)');
      rest.onBlur?.(e);
    },
  };
  return rows
    ? <textarea value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder}
        rows={rows} style={base} className={`ui-input ${className || ''}`} {...handlers} {...rest} />
    : <input type={type} value={value} onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus} onKeyDown={onKeyDown}
        style={base} className={`ui-input ${className || ''}`} {...handlers} {...rest} />;
}

/* ── ColorSwatch ────────────────────────────────────────────── */
export function ColorSwatch({ color, onSelect, label, size = 18 }) {
  const borderColor = 'var(--border-strong)';
  
  return (
    <button title={label || color} onClick={() => onSelect(color)}
      style={{
        width: size, height: size, background: color,
        border: `1px solid ${borderColor}`, borderRadius: '2px',
        cursor: 'pointer', padding: 0, flexShrink: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; }}
    />
  );
}

/* ── Modal ──────────────────────────────────────────────────── */
export function Modal({ title, description, icon: Icon = PanelTop, onClose, children, footer, width = 480, noPad = false, className = '' }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () => [...(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || [])].filter((el) => el.getClientRects().length);
    const frame = requestAnimationFrame(() => {
      if (!dialogRef.current?.contains(document.activeElement)) (focusable()[0] || dialogRef.current)?.focus();
    });
    const h = (e) => {
      if ([...document.querySelectorAll('.studio-modal')].at(-1) !== dialogRef.current) return;
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      if (e.key !== 'Tab') return;
      const list = focusable();
      if (!list.length) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === list[0]) { e.preventDefault(); list.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === list.at(-1)) { e.preventDefault(); list[0].focus(); }
    };
    window.addEventListener('keydown', h);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', h); if (previous?.isConnected) previous.focus(); };
  }, []);

  return createPortal(
    <div className="studio-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined} tabIndex={-1}
        className={`studio-modal anim-scale-in ${className}`} style={{ width }}>
        <div className="studio-modal__header">
          <span className="studio-modal__icon" aria-hidden="true"><Icon size={19} strokeWidth={1.6} /></span>
          <div className="studio-modal__heading">
            <h2 id={titleId} className="studio-modal__title">{title}</h2>
            {description && <p id={descriptionId} className="studio-modal__description">{description}</p>}
          </div>
          <button type="button" className="studio-modal__close" aria-label="Close dialog" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className={`studio-modal__body${noPad ? ' studio-modal__body--flush' : ''}`}>{children}</div>
        {footer && <div className="studio-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ── Label ──────────────────────────────────────────────────── */
export function Label({ children, style }) {
  return <div className="ui-label" style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5, ...style }}>{children}</div>;
}

/* ── Stack ──────────────────────────────────────────────────── */
export function Stack({ children, gap = 10, dir = 'column', align, justify, style }) {
  return (
    <div style={{ display:'flex', flexDirection:dir, gap, alignItems:align, justifyContent:justify, ...style }}>
      {children}
    </div>
  );
}

/* ── Badge ──────────────────────────────────────────────────── */
export function Badge({ children, color = 'var(--gold)' }) {
  return (
    <span style={{
      background: color, color: 'var(--text-on-gold)', fontSize: 9, fontWeight: 700,
      padding: '1px 5px', borderRadius: 999, fontFamily: 'var(--font-ui)', letterSpacing: '.04em',
    }}>{children}</span>
  );
}

/* ── NumberInput ────────────────────────────────────────────── */
export function NumberInput({ value, onChange, min = 1, max = 100, label }) {
  const inputId = useId();
  return (
    <Stack dir="column" gap={4}>
      {label && <label className="ui-label" htmlFor={inputId}>{label}</label>}
      <div className="ui-number-input" style={{ display:'flex', alignItems:'center', gap:4 }}>
        <button type="button" aria-label={`Decrease ${label || 'value'}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width:24, height:24, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', cursor:'pointer', color:'var(--text-primary)', fontSize:14 }}>−</button>
        <input id={inputId} aria-label={label || 'Value'} type="number" value={value} min={min} max={max}
          onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
          style={{ width:48, textAlign:'center', background:'var(--bg-elevated)', color:'var(--text-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'3px 6px', fontSize:13, fontFamily:'var(--font-ui)', outline:'none' }} />
        <button type="button" aria-label={`Increase ${label || 'value'}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}
          style={{ width:24, height:24, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', cursor:'pointer', color:'var(--text-primary)', fontSize:14 }}>+</button>
      </div>
    </Stack>
  );
}
