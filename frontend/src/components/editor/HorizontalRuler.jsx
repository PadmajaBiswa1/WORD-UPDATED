import React, { useState, useEffect, useRef } from 'react';
import { useUIStore } from '@/store';
import { MARGIN_MAP, getLayoutMetrics } from '@/utils/pageLayout';

const PIXELS_PER_INCH = 96;
const PIXELS_PER_CM = PIXELS_PER_INCH / 2.54;

function getNearestMarginPreset(px) {
  const entries = Object.entries(MARGIN_MAP);
  let nearest = entries[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  entries.forEach((entry) => {
    const distance = Math.abs(entry[1] - px);
    if (distance < bestDistance) {
      nearest = entry;
      bestDistance = distance;
    }
  });

  return nearest[0];
}

export function HorizontalRuler({ pageWidth: propPageWidth }) {
  const { zoom, pageMargin, setPageMargin, pageSize, pageOrientation, toast } = useUIStore();
  const [draggingMargin, setDraggingMargin] = useState(null);
  const rulerRef = useRef(null);
  const dragPositionRef = useRef(null);

  const scale = (zoom || 100) / 100;
  const rulerHeight = 24;
  const majorTickHeight = 8;
  const minorTickHeight = 4;
  const inchWidth = PIXELS_PER_INCH * scale;
  const cmWidth = PIXELS_PER_CM * scale;
  const unit = 'inch';
  const unitWidth = unit === 'inch' ? inchWidth : cmWidth;

  const layoutMetrics = getLayoutMetrics({ size: pageSize, orientation: pageOrientation, margin: pageMargin });
  const actualPageWidth = Math.round(propPageWidth || (layoutMetrics.pageWidth * scale));

  const marginPx = Math.round((MARGIN_MAP[pageMargin] || MARGIN_MAP.normal) * scale);
  const leftMargin = marginPx;
  const rightMargin = marginPx;

  const commitMargin = () => {
    if (!draggingMargin || !rulerRef.current || dragPositionRef.current === null) return;

    const rawPx = draggingMargin === 'right'
      ? actualPageWidth - dragPositionRef.current
      : dragPositionRef.current;
    const nextMargin = getNearestMarginPreset(Math.max(0, rawPx / scale));

    setPageMargin(nextMargin);
    toast(`Margin: ${nextMargin}`, 'info');
  };

  const handleMouseDown = (marginType, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingMargin(marginType);
    dragPositionRef.current = null;
  };

  const handleMouseUp = () => {
    commitMargin();
    setDraggingMargin(null);
    dragPositionRef.current = null;
  };

  const handleMouseMove = (e) => {
    if (!draggingMargin || !rulerRef.current) return;

    const rect = rulerRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(actualPageWidth, e.clientX - rect.left));
    dragPositionRef.current = pos;
  };

  useEffect(() => {
    if (!draggingMargin) return undefined;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingMargin, actualPageWidth]);

  return (
    <div
      ref={rulerRef}
      id="etherx-horizontal-ruler"
      style={{
        width: actualPageWidth,
        minWidth: actualPageWidth,
        maxWidth: actualPageWidth,
        height: rulerHeight,
        backgroundColor: '#262626',
        borderLeft: '1px solid #404040',
        borderRight: '1px solid #404040',
        borderBottom: '1px solid #404040',
        display: 'flex',
        alignItems: 'flex-end',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        boxSizing: 'border-box',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Left shaded margin region */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: leftMargin,
          height: rulerHeight,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          pointerEvents: 'none',
        }}
      />

      {/* Right shaded margin region */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: rightMargin,
          height: rulerHeight,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          pointerEvents: 'none',
        }}
      />

      {/* SVG Tick marks aligned with page inches */}
      <svg
        width={actualPageWidth}
        height={rulerHeight}
        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      >
        {Array.from({ length: Math.floor(actualPageWidth / (unitWidth / 8)) + 1 }).map((_, stepIdx) => {
          const x = stepIdx * (unitWidth / 8);
          if (x > actualPageWidth) return null;
          const isMajor = stepIdx % 8 === 0;
          const isHalf = stepIdx % 4 === 0 && !isMajor;
          const isQuarter = stepIdx % 2 === 0 && !isMajor && !isHalf;
          const tickHeight = isMajor ? 8 : (isHalf ? 6 : (isQuarter ? 4 : 2.5));
          const stroke = isMajor ? '#b0b0b0' : (isHalf ? '#888888' : '#5c5c5c');

          return (
            <g key={stepIdx}>
              <line
                x1={x}
                y1={rulerHeight}
                x2={x}
                y2={rulerHeight - tickHeight}
                stroke={stroke}
                strokeWidth="1"
              />
              {isMajor && stepIdx > 0 && x + 12 <= actualPageWidth && (
                <text
                  x={x + 3}
                  y={rulerHeight - 8 - 2}
                  fontSize="9"
                  fill="#b8b8b8"
                  fontFamily="var(--font-ui, 'Segoe UI', sans-serif)"
                  fontWeight="500"
                >
                  {stepIdx / 8}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Left Margin drag marker */}
      <div
        onMouseDown={(e) => handleMouseDown('left', e)}
        style={{
          position: 'absolute',
          left: leftMargin - 6,
          top: 0,
          width: 12,
          height: rulerHeight,
          cursor: 'col-resize',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        }}
        title="Drag to adjust left margin"
      >
        <div
          style={{
            width: 3,
            height: 14,
            backgroundColor: draggingMargin === 'left' ? '#d4af37' : '#9e9e9e',
            borderRadius: 1,
            boxShadow: '0 0 2px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      {/* Right Margin drag marker */}
      <div
        onMouseDown={(e) => handleMouseDown('right', e)}
        style={{
          position: 'absolute',
          left: actualPageWidth - rightMargin - 6,
          top: 0,
          width: 12,
          height: rulerHeight,
          cursor: 'col-resize',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        }}
        title="Drag to adjust right margin"
      >
        <div
          style={{
            width: 3,
            height: 14,
            backgroundColor: draggingMargin === 'right' ? '#d4af37' : '#9e9e9e',
            borderRadius: 1,
            boxShadow: '0 0 2px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  );
}