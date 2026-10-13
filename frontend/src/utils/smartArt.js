// SmartArt graphics as SVG: a list of items laid out as a list, process, cycle,
// hierarchy or pyramid. Items come one per line; in a hierarchy, lines indented
// with spaces or starting with "-" are children of the line above.

export const SMARTART_LAYOUTS = [
  { id: 'list', name: 'Basic List' },
  { id: 'process', name: 'Basic Process' },
  { id: 'cycle', name: 'Basic Cycle' },
  { id: 'hierarchy', name: 'Hierarchy' },
  { id: 'pyramid', name: 'Basic Pyramid' },
];

export const SMARTART_COLORS = {
  gold: ['#d4af37', '#b8912a', '#8f6f1c'],
  blue: ['#2f6fdb', '#1f55b3', '#163f86'],
  green: ['#2e9d5b', '#237a46', '#185632'],
  purple: ['#7b4fd6', '#6038b0', '#462885'],
  gray: ['#6b7280', '#4b5563', '#374151'],
};

const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Up to two lines of text, centred in a box at (cx, cy).
function label(text, cx, cy, width, size = 15, color = '#ffffff') {
  const words = String(text).split(/\s+/).filter(Boolean);
  const perLine = Math.max(4, Math.floor(width / (size * 0.56)));
  const lines = [''];
  words.forEach((word) => {
    const line = lines[lines.length - 1];
    if ((line + ' ' + word).trim().length > perLine && line && lines.length < 2) lines.push(word);
    else lines[lines.length - 1] = (line + ' ' + word).trim();
  });
  if (lines[1] && lines[1].length > perLine) lines[1] = `${lines[1].slice(0, perLine - 1)}…`;
  const top = cy - ((lines.length - 1) * size * 1.2) / 2;
  return lines.map((line, i) => `<text x="${cx}" y="${top + i * size * 1.2}" font-size="${size}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-family="Calibri, Segoe UI, Arial, sans-serif" font-weight="600">${esc(line)}</text>`).join('');
}

export function parseItems(text) {
  return String(text || '').split('\n').map((line) => line.replace(/\s+$/, '')).filter((line) => line.trim())
    .map((line) => ({ text: line.trim().replace(/^[-•*]\s*/, ''), child: /^(\s{2,}|\t|[-•*]\s)/.test(line) }));
}

const svg = (width, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
const arrowDef = (color) => `<defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker></defs>`;

export function renderSmartArt(layout, text, colorKey = 'gold') {
  const items = parseItems(text);
  const [c1, c2, c3] = SMARTART_COLORS[colorKey] || SMARTART_COLORS.gold;
  if (!items.length) return svg(400, 120, label('Type your text', 200, 60, 360, 16, '#888888'));
  const top = items.map((item) => item.text);

  if (layout === 'process' || layout === 'list') {
    const n = top.length;
    const w = 150; const h = 80; const gap = layout === 'process' ? 50 : 16;
    const width = n * w + (n - 1) * gap + 20;
    let body = layout === 'process' ? arrowDef(c3) : '';
    top.forEach((t, i) => {
      const x = 10 + i * (w + gap);
      body += `<rect x="${x}" y="10" width="${w}" height="${h}" rx="10" fill="${i % 2 ? c2 : c1}"/>` + label(t, x + w / 2, 10 + h / 2, w - 16);
      if (layout === 'process' && i < n - 1) body += `<line x1="${x + w + 6}" y1="${10 + h / 2}" x2="${x + w + gap - 8}" y2="${10 + h / 2}" stroke="${c3}" stroke-width="4" marker-end="url(#a)"/>`;
    });
    return svg(width, h + 20, body);
  }

  if (layout === 'cycle') {
    const n = top.length; const r = Math.max(110, n * 34); const node = 52;
    const size = (r + node + 12) * 2; const c = size / 2;
    let body = arrowDef(c3);
    const at = (i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + r * Math.cos(a), c + r * Math.sin(a), a]; };
    top.forEach((t, i) => {
      if (n > 1) {
        const [, , a1] = at(i); const [, , a2] = at(i + 1);
        const s = a1 + 0.42; const e = a2 - 0.42;
        body += `<path d="M${c + r * Math.cos(s)} ${c + r * Math.sin(s)} A${r} ${r} 0 0 1 ${c + r * Math.cos(e)} ${c + r * Math.sin(e)}" fill="none" stroke="${c3}" stroke-width="4" marker-end="url(#a)"/>`;
      }
    });
    top.forEach((t, i) => { const [x, y] = at(i); body += `<circle cx="${x}" cy="${y}" r="${node}" fill="${i % 2 ? c2 : c1}"/>` + label(t, x, y, node * 1.7, 13); });
    return svg(size, size, body);
  }

  if (layout === 'pyramid') {
    const n = top.length; const h = 56; const width = 420; const height = n * h + 20;
    let body = '';
    top.forEach((t, i) => {
      const y = 10 + i * h;
      const half = (k) => ((k + 0.15) / (n + 0.15)) * (width / 2 - 10);
      const a = half(i); const b = half(i + 1);
      body += `<polygon points="${width / 2 - a},${y} ${width / 2 + a},${y} ${width / 2 + b},${y + h - 4} ${width / 2 - b},${y + h - 4}" fill="${[c1, c2, c3][i % 3]}"/>` + label(t, width / 2, y + h / 2 - 2, Math.max(60, b * 1.6), 14);
    });
    return svg(width, height, body);
  }

  // Hierarchy: top-level lines are parents across the first row; children sit below their parent.
  const groups = [];
  items.forEach((item) => { if (!item.child || !groups.length) groups.push({ text: item.text, children: [] }); else groups[groups.length - 1].children.push(item.text); });
  const w = 140; const h = 64; const gap = 24; const vgap = 50;
  const colWidth = (g) => Math.max(1, g.children.length) * (w + gap) - gap;
  const width = groups.reduce((sum, g) => sum + colWidth(g) + gap, gap);
  const hasKids = groups.some((g) => g.children.length);
  const height = 10 + h + (hasKids ? vgap + h : 0) + 10;
  let body = ''; let x = gap;
  groups.forEach((g) => {
    const cw = colWidth(g); const px = x + cw / 2;
    body += `<rect x="${px - w / 2}" y="10" width="${w}" height="${h}" rx="8" fill="${c1}"/>` + label(g.text, px, 10 + h / 2, w - 14);
    g.children.forEach((child, i) => {
      const cx = x + i * (w + gap) + w / 2; const cy = 10 + h + vgap;
      body += `<path d="M${px} ${10 + h} V${10 + h + vgap / 2} H${cx} V${cy}" fill="none" stroke="${c3}" stroke-width="2"/>`;
      body += `<rect x="${cx - w / 2}" y="${cy}" width="${w}" height="${h}" rx="8" fill="${c2}"/>` + label(child, cx, cy + h / 2, w - 14, 14);
    });
    x += cw + gap;
  });
  return svg(width, height, body);
}

export const svgDataUrl = (markup) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
