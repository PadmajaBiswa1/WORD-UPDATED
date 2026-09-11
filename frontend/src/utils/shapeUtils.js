/**
 * shapeUtils.js
 * SVG Shape Definitions, parsing, and generators with text-in-shape and style presets.
 */

export const SHAPES = [
  {
    id: 'rect',
    label: 'Rectangle',
    viewBox: '0 0 140 80',
    innerSvg: (fill, stroke, strokeWidth = 2) =>
      `<rect width="140" height="80" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
  },
  {
    id: 'circle',
    label: 'Circle',
    viewBox: '0 0 140 140',
    innerSvg: (fill, stroke, strokeWidth = 2) =>
      `<ellipse cx="70" cy="70" rx="66" ry="66" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
  },
  {
    id: 'triangle',
    label: 'Triangle',
    viewBox: '0 0 150 150',
    innerSvg: (fill, stroke, strokeWidth = 2) =>
      `<polygon points="75,8 144,142 6,142" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
  },
  {
    id: 'star',
    label: 'Star',
    viewBox: '0 0 150 130',
    innerSvg: (fill, stroke, strokeWidth = 2) =>
      `<polygon points="75,5 90,50 140,50 100,80 115,125 75,95 35,125 50,80 10,50 60,50" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
  },
  {
    id: 'arrow',
    label: 'Arrow →',
    viewBox: '0 0 140 100',
    innerSvg: (fill, stroke, strokeWidth = 2) =>
      `<polygon points="4,30 85,30 85,12 136,50 85,88 85,70 4,70" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
  },
  {
    id: 'diamond',
    label: 'Diamond',
    viewBox: '0 0 150 140',
    innerSvg: (fill, stroke, strokeWidth = 2) =>
      `<polygon points="75,6 142,70 75,134 8,70" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
  },
  {
    id: 'hexagon',
    label: 'Hexagon',
    viewBox: '0 0 150 140',
    innerSvg: (fill, stroke, strokeWidth = 2) =>
      `<polygon points="37,6 113,6 146,70 113,134 37,134 4,70" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
  },
  {
    id: 'cross',
    label: 'Cross',
    viewBox: '0 0 130 130',
    innerSvg: (fill, stroke, strokeWidth = 2) =>
      `<polygon points="45,4 85,4 85,45 126,45 126,85 85,85 85,126 45,126 45,85 4,85 4,45 45,45" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
  },
];

export const SHAPE_PRESETS = [
  { id: 'gold', label: 'Gold Accent', fill: '#d4af37', stroke: '#b8952d', strokeWidth: 2, textColor: '#111827' },
  { id: 'blue', label: 'Azure Blue', fill: '#2563eb', stroke: '#1d4ed8', strokeWidth: 2, textColor: '#ffffff' },
  { id: 'emerald', label: 'Emerald', fill: '#10b981', stroke: '#047857', strokeWidth: 2, textColor: '#ffffff' },
  { id: 'slate', label: 'Charcoal', fill: '#334155', stroke: '#1e293b', strokeWidth: 2, textColor: '#f8fafc' },
  { id: 'crimson', label: 'Crimson', fill: '#ef4444', stroke: '#b91c1c', strokeWidth: 2, textColor: '#ffffff' },
  { id: 'outline', label: 'Outline Only', fill: 'transparent', stroke: '#d4af37', strokeWidth: 3, textColor: '#d4af37' },
];

export function isShapeSrc(src = '') {
  return typeof src === 'string' && src.startsWith('data:image/svg+xml');
}

export function isShapeNode(node) {
  if (!node) return false;
  const src = node.attrs?.src || node.src || '';
  const alt = node.attrs?.alt || node.alt || '';
  return isShapeSrc(src) || SHAPES.some((s) => s.label.toLowerCase() === alt.toLowerCase());
}

export function parseShapeInfo(src = '', alt = '') {
  let shapeId = 'rect';
  let fill = '#d4af37';
  let stroke = '#b8952d';
  let strokeWidth = 2;
  let text = '';
  let textColor = '#ffffff';

  const matchedShape = SHAPES.find((s) => s.label.toLowerCase() === alt.toLowerCase() || s.id === alt.toLowerCase());
  if (matchedShape) shapeId = matchedShape.id;

  if (isShapeSrc(src)) {
    try {
      const raw = decodeURIComponent(src.replace('data:image/svg+xml;utf8,', '').replace('data:image/svg+xml;charset=utf-8,', ''));
      
      const fillMatch = raw.match(/fill="([^"]+)"/);
      if (fillMatch && fillMatch[1] && fillMatch[1] !== 'none') fill = fillMatch[1];
      
      const strokeMatch = raw.match(/stroke="([^"]+)"/);
      if (strokeMatch && strokeMatch[1]) stroke = strokeMatch[1];
      
      const strokeWidthMatch = raw.match(/stroke-width="([^"]+)"/);
      if (strokeWidthMatch && strokeWidthMatch[1]) strokeWidth = parseInt(strokeWidthMatch[1], 10) || 2;

      const textMatch = raw.match(/<text[^>]*>([\s\S]*?)<\/text>/i);
      if (textMatch && textMatch[1]) {
        text = textMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      }
      
      const textColorMatch = raw.match(/<text[^>]*fill="([^"]+)"/i);
      if (textColorMatch && textColorMatch[1]) textColor = textColorMatch[1];

      // Also detect shapeId from elements if not found from alt
      if (!matchedShape) {
        if (raw.includes('<rect')) shapeId = 'rect';
        else if (raw.includes('<ellipse') || raw.includes('<circle')) shapeId = 'circle';
        else if (raw.includes('points="75,5 90,50')) shapeId = 'star';
        else if (raw.includes('points="75,8') || raw.includes('points="75,5 145,145')) shapeId = 'triangle';
        else if (raw.includes('points="4,30') || raw.includes('points="0,30')) shapeId = 'arrow';
        else if (raw.includes('142,70 75,134') || raw.includes('140,70 75,135')) shapeId = 'diamond';
        else if (raw.includes('146,70 113,134') || raw.includes('150,70 113,135')) shapeId = 'hexagon';
        else if (raw.includes('45,4 85,4') || raw.includes('45,0 85,0')) shapeId = 'cross';
      }
    } catch {
      // fallback
    }
  }

  return { shapeId, fill, stroke, strokeWidth, text, textColor };
}

export function generateShapeDataUrl({
  shapeId = 'rect',
  fill = '#d4af37',
  stroke = '#b8952d',
  strokeWidth = 2,
  size = 140,
  text = '',
  textColor = '#ffffff',
  opacity = 1,
}) {
  const shape = SHAPES.find((s) => s.id === shapeId) || SHAPES[0];
  const inner = shape.innerSvg(fill, stroke, strokeWidth);
  
  // Calculate center coordinate for text based on viewBox
  const vbParts = shape.viewBox.split(' ').map(Number);
  const cx = (vbParts[2] || 140) / 2;
  const cy = (vbParts[3] || 140) / 2;

  let textMarkup = '';
  if (text && text.trim()) {
    const escaped = text.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const fontSize = text.length > 20 ? 12 : text.length > 10 ? 14 : 16;
    textMarkup = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-size="${fontSize}" font-family="Segoe UI, Calibri, sans-serif" font-weight="600">${escaped}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${shape.viewBox}" width="${size}" height="${size}" opacity="${opacity}" data-shape-id="${shape.id}">${inner}${textMarkup}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
