// Layout > Group / Ungroup for pictures. Grouped pictures become one SVG picture
// that moves, wraps and resizes as a unit; each original picture is kept inside
// it (source, width, alt), so Ungroup restores them exactly.

const GROUP_ATTR = 'data-etherx-group';
const GAP = 8;

const esc = (text) => String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Pictures inside the selection, in document order.
export function selectedImages(state) {
  const { from, to } = state.selection;
  const images = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'image') images.push({ node, pos });
  });
  return images;
}

// Pictures in an SVG must be embedded: fetch other sources into data URLs.
async function embeddable(src) {
  if (src.startsWith('data:')) return src;
  const blob = await (await fetch(src)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Natural size, or a square fallback if the picture never loads.
const naturalSize = (src) => new Promise((resolve) => {
  const img = new Image();
  const timer = setTimeout(() => resolve({ w: 100, h: 100 }), 1500);
  const done = (size) => { clearTimeout(timer); resolve(size); };
  img.onload = () => done({ w: img.naturalWidth || 100, h: img.naturalHeight || 100 });
  img.onerror = () => done({ w: 100, h: 100 });
  img.src = src;
});

export function isGroupSrc(src) {
  return typeof src === 'string' && src.startsWith('data:image/svg+xml') && decodeURIComponent(src).includes(GROUP_ATTR);
}

// SVG laying the pictures out side by side at their current widths.
export async function buildGroupSvg(images) {
  let x = 0;
  let height = 0;
  const parts = [];
  for (const { node } of images) {
    const href = await embeddable(node.attrs.src);
    const natural = await naturalSize(href);
    const w = Number.parseFloat(node.attrs.width) || natural.w;
    const h = Math.round((w * natural.h) / natural.w);
    parts.push(`<image x="${x}" y="0" width="${w}" height="${h}" href="${esc(href)}" data-width="${esc(node.attrs.width || '')}" data-alt="${esc(node.attrs.alt || '')}" preserveAspectRatio="xMidYMid meet"/>`);
    x += w + GAP;
    height = Math.max(height, h);
  }
  const width = Math.max(1, x - GAP);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" ${GROUP_ATTR}="1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width };
}

export function parseGroup(src) {
  const markup = decodeURIComponent(src.slice(src.indexOf(',') + 1));
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  return [...doc.querySelectorAll('image')].map((el) => ({
    src: el.getAttribute('href'),
    width: el.getAttribute('data-width') || el.getAttribute('width'),
    alt: el.getAttribute('data-alt') || '',
  }));
}

export async function groupSelectedImages(editor) {
  const images = selectedImages(editor.state);
  if (images.length < 2) return { error: 'Select two or more pictures to group them' };
  const { src, width } = await buildGroupSvg(images);
  const first = images[0].pos;
  const tr = editor.state.tr;
  [...images].reverse().forEach(({ node, pos }) => tr.delete(tr.mapping.map(pos), tr.mapping.map(pos + node.nodeSize)));
  tr.insert(tr.mapping.map(first), editor.schema.nodes.image.create({ src, width: String(Math.min(width, 640)), alt: `Group of ${images.length} pictures` }));
  editor.view.dispatch(tr);
  return { count: images.length };
}

export function ungroupSelectedImage(editor) {
  const { state } = editor;
  const sel = state.selection;
  const hit = sel.node?.type.name === 'image' ? { node: sel.node, pos: sel.from } : selectedImages(state).find(({ node }) => isGroupSrc(node.attrs.src));
  if (!hit || !isGroupSrc(hit.node.attrs.src)) return { error: 'Select a grouped picture to ungroup it' };
  const parts = parseGroup(hit.node.attrs.src);
  const nodes = parts.map((p) => state.schema.nodes.image.create({ src: p.src, width: p.width, alt: p.alt }));
  editor.view.dispatch(state.tr.replaceWith(hit.pos, hit.pos + hit.node.nodeSize, nodes));
  return { count: nodes.length };
}
