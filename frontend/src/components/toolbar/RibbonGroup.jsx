// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Standardized Ribbon Group Component
//  Ensures symmetrical padding, consistent divider positioning,
//  and precisely centered group caption labels beneath the icon row.
// ═══════════════════════════════════════════════════════════════
import React from 'react';

export function RibbonGroup({
  label,
  children,
  style = {},
  contentStyle = {},
  className = '',
  noDivider = false,
  customLayout = false,
}) {
  return (
    <div
      className={`ribbon-group ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        borderRight: noDivider ? 'none' : '1px solid var(--ribbon-divider)',
        padding: '3px 12px 3px 12px',
        margin: 0,
        height: '100%',
        minWidth: 'fit-content',
        flexShrink: 0,
        boxSizing: 'border-box',
        position: 'relative',
        userSelect: 'none',
        gap: '2px',
        ...style,
      }}
    >
      {/* 3-Row Icon & Control Area */}
      <div
        className="ribbon-group-content"
        style={
          customLayout
            ? {
                display: 'flex',
                alignItems: 'center',
                height: 82,
                maxHeight: 82,
                width: '100%',
                flexShrink: 0,
                ...contentStyle,
              }
            : {
                display: 'flex',
                alignItems: 'center',
                height: 82,
                maxHeight: 82,
                flexShrink: 0,
                overflow: 'visible',
                ...contentStyle,
              }
        }
      >
        {children}
      </div>

      {/* Caption row strictly centered under the group's icon row */}
      <div
        className="ribbon-group-caption"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 'auto',
          height: 16,
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '.02em',
            fontFamily: 'var(--font-ui)',
            lineHeight: 1.2,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
            display: 'block',
          }}
          title={label}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
