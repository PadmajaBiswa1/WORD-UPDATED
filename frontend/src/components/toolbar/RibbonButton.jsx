// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Standardized Ribbon Button Component
//  Ensures identical vertical rhythm, fixed icon size, fixed gap,
//  and consistent label typography/baseline across all ribbon groups.
// ═══════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { Tooltip } from '@/components/ui';

/**
 * Intelligent icon + label extractor from string or node children
 */
function extractIconAndLabel(iconProp, labelProp, children) {
  if (iconProp !== undefined && labelProp !== undefined) {
    return { icon: iconProp, label: labelProp };
  }
  if (iconProp !== undefined && !labelProp) {
    return { icon: iconProp, label: children || '' };
  }
  if (!iconProp && labelProp) {
    return { icon: null, label: labelProp };
  }
  if (typeof children === 'string') {
    const text = children.trim();
    // Match icon prefix: Unicode symbols, emoji, superscript, numbers like 123, or ABC✓
    const match = text.match(/^([^\w\s]+|[A-Z]{2,4}✓?|\d+|¹|²|³)\s+(.+)$/u);
    if (match) {
      return { icon: match[1], label: match[2] };
    }
    return { icon: null, label: text };
  }
  return { icon: null, label: children };
}

export function RibbonButton({
  icon,
  label,
  children,
  onClick,
  onMouseDown,
  active = false,
  disabled = false,
  tooltip,
  title,
  shortcut,
  dropdown = false,
  size = 'large', // 'large' (default icon top, label bottom) | 'small' (horizontal compact)
  style = {},
  className = '',
  id,
}) {
  const [hovered, setHovered] = useState(false);
  const resolved = extractIconAndLabel(icon, label, children);
  const tooltipText = tooltip || title;

  if (size === 'small') {
    const smallBtn = (
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        onMouseDown={onMouseDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 24,
          padding: '0 6px',
          background: active
            ? 'rgba(212, 175, 55, 0.2)'
            : hovered
            ? 'var(--ribbon-hover, var(--bg-hover))'
            : 'transparent',
          border: active
            ? '1px solid var(--gold)'
            : hovered
            ? '1px solid var(--border-gold, #3d3000)'
            : '1px solid transparent',
          borderRadius: 3,
          color: active ? 'var(--gold)' : 'var(--ribbon-ink, var(--text-primary))',
          fontFamily: 'var(--font-ui)',
          fontSize: 11,
          fontWeight: active ? 600 : 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          userSelect: 'none',
          whiteSpace: 'nowrap',
          outline: 'none',
          transition: 'all 0.1s ease',
          ...style,
        }}
        className={className}
      >
        {resolved.icon && (
          <span style={{ fontSize: 13, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
            {resolved.icon}
          </span>
        )}
        <span style={{ fontSize: 11, lineHeight: 1.1 }}>{resolved.label}</span>
        {dropdown && <span style={{ fontSize: 8, marginLeft: 1, opacity: 0.8 }}>▾</span>}
      </button>
    );

    if (tooltipText) {
      return (
        <Tooltip text={tooltipText} shortcut={shortcut}>
          {smallBtn}
        </Tooltip>
      );
    }
    return smallBtn;
  }

  // ── Large Ribbon Button (Standard: Icon on top, label below) ──
  const largeBtn = (
    <button
      id={id}
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minWidth: 46,
        maxWidth: 78,
        height: 60,
        padding: '3px 4px 2px',
        background: active
          ? 'rgba(212, 175, 55, 0.2)'
          : hovered
          ? 'var(--ribbon-hover, var(--bg-hover))'
          : 'transparent',
        border: active
          ? '1px solid var(--gold)'
          : hovered
          ? '1px solid var(--border-gold, #3d3000)'
          : '1px solid transparent',
        borderRadius: 3,
        color: active ? 'var(--gold)' : 'var(--ribbon-ink, var(--text-primary))',
        fontFamily: 'var(--font-ui)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        userSelect: 'none',
        outline: 'none',
        boxSizing: 'border-box',
        flexShrink: 0,
        transition: 'background 0.1s, border-color 0.1s, color 0.1s',
        ...style,
      }}
      className={className}
    >
      {/* Fixed 24x24 icon slot */}
      <div
        style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
          color: active ? 'var(--gold)' : 'inherit',
        }}
      >
        {resolved.icon || <span style={{ fontSize: 13, opacity: 0.6 }}>•</span>}
      </div>

      {/* Fixed icon-to-label vertical rhythm gap: exactly 3px */}
      <div style={{ height: 3, flexShrink: 0 }} />

      {/* Standardized 24px label container — aligns baseline across all buttons */}
      <div
        style={{
          width: '100%',
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            lineHeight: 1.12,
            fontFamily: 'var(--font-ui)',
            fontWeight: active ? 600 : 450,
            color: 'inherit',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            wordBreak: 'break-word',
          }}
        >
          {resolved.label}
          {dropdown && <span style={{ fontSize: 8, marginLeft: 2, verticalAlign: 'middle', opacity: 0.8 }}>▾</span>}
        </span>
      </div>
    </button>
  );

  if (tooltipText) {
    return (
      <Tooltip text={tooltipText} shortcut={shortcut}>
        {largeBtn}
      </Tooltip>
    );
  }

  return largeBtn;
}
