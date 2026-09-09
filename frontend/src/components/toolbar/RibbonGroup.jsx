// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Standardized Ribbon Group Component
//  Ensures symmetrical padding, consistent divider positioning,
//  and precisely centered group caption labels beneath the icon row.
// ═══════════════════════════════════════════════════════════════
import React from 'react';

export function RibbonGroup({ label, children, style = {}, className = '', noDivider = false }) {
  return (
    <div
      className={`ribbon-group ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRight: noDivider ? 'none' : '1px solid var(--ribbon-divider)',
        padding: '2px 8px 3px 8px',
        margin: 0,
        height: '100%',
        minWidth: 'fit-content',
        flexShrink: 0,
        boxSizing: 'border-box',
        position: 'relative',
        ...style,
      }}
    >
      {/* Icon + control row */}
      <div
        className="ribbon-group-content"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          flex: 1,
          width: '100%',
          flexWrap: 'nowrap',
          paddingTop: 2,
        }}
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
          paddingTop: 3,
          paddingBottom: 2,
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
