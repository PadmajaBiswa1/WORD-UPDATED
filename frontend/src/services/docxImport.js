// DOCX -> editor HTML. mammoth handles structure (headings, lists, tables, images, merged cells)
// but drops layout: paragraph alignment and spacing, run font/size, table column widths, image
// sizes and page setup. Those are read from the package XML here and carried across.
//
// mammoth's document tree and the XML list paragraphs, tables and drawings in the same document
// order, so XML properties are matched by index. Where the counts disagree (content mammoth
// skips), that property is left out rather than applied to the wrong element.

const PARA_MARK = /(\d+)/g;
const RUN_START = /(\d+)/;
const RUN_END = '';
const ALIGN_CSS = { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' };
const EMU_PER_PX = 9525;
const TWIPS_PER_PX = 15;
const TWIPS_PER_PT = 20;
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const wAttr = (el, name) => el?.getAttributeNS(W_NS, name) ?? el?.getAttribute(`w:${name}`) ?? null;
const wChild = (el, name) => (el ? Array.from(el.children).find((c) => c.localName === name) : null);
const wAll = (root, name) => (root ? Array.from(root.getElementsByTagNameNS(W_NS, name)) : []);

async function readPackage(arrayBuffer) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const parse = async (path) => {
      const xml = await zip.file(path)?.async('string');
      return xml ? new DOMParser().parseFromString(xml, 'application/xml') : null;
    };
    return { document: await parse('word/document.xml'), styles: await parse('word/styles.xml') };
  } catch {
    return { document: null, styles: null };
  }
}

// ── Paragraph spacing: direct formatting > paragraph style chain > document defaults ──
function readSpacing(pPr) {
  const spacing = wChild(pPr, 'spacing');
  if (!spacing) return {};
  const out = {};
  for (const key of ['line', 'lineRule', 'before', 'after']) {
    const value = wAttr(spacing, key);
    if (value !== null && value !== '') out[key] = value;
  }
  return out;
}

function buildStyleResolver(stylesDoc) {
  const styles = new Map();
  wAll(stylesDoc, 'style').forEach((style) => {
    styles.set(wAttr(style, 'styleId'), {
      basedOn: wAttr(wChild(style, 'basedOn'), 'val'),
      spacing: readSpacing(wChild(style, 'pPr')),
      isDefaultParagraph: wAttr(style, 'type') === 'paragraph' && wAttr(style, 'default') === '1',
    });
  });
  const docDefaults = wChild(stylesDoc?.documentElement, 'docDefaults');
  const defaultSpacing = readSpacing(wChild(wChild(docDefaults, 'pPrDefault'), 'pPr'));
  const defaultParagraphStyle = Array.from(styles.entries()).find(([, s]) => s.isDefaultParagraph)?.[0];

  const chainSpacing = (styleId, seen = new Set()) => {
    const style = styles.get(styleId);
    if (!style || seen.has(styleId)) return {};
    seen.add(styleId);
    return { ...chainSpacing(style.basedOn, seen), ...style.spacing };
  };

  const rPrDefault = wChild(wChild(docDefaults, 'rPrDefault'), 'rPr');
  return {
    spacingFor: (pPr) => {
      const styleId = wAttr(wChild(pPr, 'pStyle'), 'val') || defaultParagraphStyle;
      return { ...defaultSpacing, ...chainSpacing(styleId), ...readSpacing(pPr) };
    },
    defaultFont: wAttr(wChild(rPrDefault, 'rFonts'), 'ascii'),
    defaultSizePt: Number(wAttr(wChild(rPrDefault, 'sz'), 'val')) / 2 || null,
    defaultLine: { ...defaultSpacing, ...chainSpacing(defaultParagraphStyle) },
  };
}

// Word line spacing -> CSS line-height. "auto" lines are 240ths of a line; exact/atLeast are twips.
function cssLineHeight({ line, lineRule }) {
  if (!line) return null;
  if (!lineRule || lineRule === 'auto') return String(Math.round((Number(line) / 240) * 100) / 100);
  return `${Number(line) / TWIPS_PER_PT}pt`;
}

function paragraphCss(spacing) {
  const css = [];
  const lineHeight = cssLineHeight(spacing);
  if (lineHeight) css.push(`line-height: ${lineHeight}`);
  css.push(`margin-top: ${(Number(spacing.before) || 0) / TWIPS_PER_PT}pt`);
  css.push(`margin-bottom: ${(Number(spacing.after) || 0) / TWIPS_PER_PT}pt`);
  return css.join('; ');
}

// ── Page setup -> the editor's page size / margin presets ──
function readLayout(documentXml) {
  const sectPr = wAll(documentXml, 'sectPr').pop();
  if (!sectPr) return null;
  const pgSz = wChild(sectPr, 'pgSz');
  const pgMar = wChild(sectPr, 'pgMar');
  const w = Number(wAttr(pgSz, 'w')) || 11906;
  const h = Number(wAttr(pgSz, 'h')) || 16838;
  const landscape = wAttr(pgSz, 'orient') === 'landscape' || w > h;
  const [shortSide, longSide] = [Math.min(w, h), Math.max(w, h)];
  let pageSize = 'a4';
  if (Math.abs(shortSide - 12240) < 200) pageSize = longSide > 18000 ? 'legal' : 'letter';
  else if (Math.abs(shortSide - 16838) < 300) pageSize = 'a3';

  const sides = ['left', 'right', 'top', 'bottom'].map((side) => Number(wAttr(pgMar, side)) || 1440);
  const avgInches = sides.reduce((a, b) => a + b, 0) / sides.length / 1440;
  const pageMargin = avgInches < 0.625 ? 'narrow' : avgInches < 0.875 ? 'moderate' : avgInches < 1.25 ? 'normal' : 'wide';

  return { pageSize, pageOrientation: landscape ? 'landscape' : 'portrait', pageMargin };
}

// ── Tables: give every cell the widths of the grid columns it spans (the editor's `colwidth`) ──
function applyColumnWidths(table, gridTwips) {
  const gridPx = gridTwips.map((w) => Math.max(1, Math.round(w / TWIPS_PER_PX)));
  const occupied = [];
  Array.from(table.rows).forEach((row, r) => {
    let col = 0;
    Array.from(row.cells).forEach((cell) => {
      while (occupied[r]?.[col]) col += 1;
      const span = cell.colSpan || 1;
      const widths = gridPx.slice(col, col + span);
      if (widths.length === span) cell.setAttribute('colwidth', widths.join(','));
      for (let dr = 0; dr < (cell.rowSpan || 1); dr += 1) {
        occupied[r + dr] = occupied[r + dr] || [];
        for (let dc = 0; dc < span; dc += 1) occupied[r + dr][col + dc] = true;
      }
      col += span;
    });
  });
}

function imageStyle(alignment) {
  if (alignment === 'center') return 'display:block;margin:12px auto';
  if (alignment === 'right' || alignment === 'end') return 'display:block;margin:12px 0 12px auto';
  return null;
}

// Wraps the text between a run's start marker and its end marker in a styled span.
// Runs never nest, so one pass in document order handles them all.
function wrapMarkedRuns(doc, runStyles) {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const startNode = walker.currentNode;
    const match = RUN_START.exec(startNode.nodeValue);
    if (!match) continue;
    const after = startNode.splitText(match.index);
    after.nodeValue = after.nodeValue.slice(match[0].length);
    const range = doc.createRange();
    range.setStart(after, 0);

    // The end marker sits in this run's last text, at or after the start.
    const seek = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    seek.currentNode = after;
    let node = after;
    let endFound = false;
    while (node) {
      const idx = node.nodeValue.indexOf(RUN_END);
      if (idx !== -1) {
        node.nodeValue = node.nodeValue.slice(0, idx) + node.nodeValue.slice(idx + 1);
        range.setEnd(node, idx);
        endFound = true;
        break;
      }
      node = seek.nextNode();
    }

    const style = runStyles[Number(match[1])];
    if (endFound && style && !range.collapsed) {
      const span = doc.createElement('span');
      span.setAttribute('style', style);
      span.appendChild(range.extractContents());
      range.insertNode(span);
      walker.currentNode = span; // continue after the wrapped run
    } else {
      walker.currentNode = after;
    }
  }
}

export async function docxToHtml(arrayBuffer) {
  const mammoth = (await import('mammoth')).default;
  const pkg = await readPackage(arrayBuffer);
  const resolver = buildStyleResolver(pkg.styles);
  const body = wChild(pkg.document?.documentElement, 'body');

  const xmlParagraphs = wAll(body, 'p');
  const xmlTables = wAll(body, 'tbl');
  const xmlDrawings = wAll(body, 'drawing').map((drawing) => {
    const extent = drawing.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'extent')[0];
    return extent
      ? { width: Math.round(Number(extent.getAttribute('cx')) / EMU_PER_PX), height: Math.round(Number(extent.getAttribute('cy')) / EMU_PER_PX) }
      : null;
  });

  const paragraphCssByIndex = [];
  const runStyles = [];
  let tableCount = 0;
  let useImageSizes = false;
  const baseFont = resolver.defaultFont || '';

  const transformDocument = (doc) => {
    const images = mammoth.transforms.getDescendantsOfType(doc, 'image');
    useImageSizes = images.length > 0 && images.length === xmlDrawings.length;
    images.forEach((image, index) => { image.etherxIndex = index; });
    tableCount = mammoth.transforms.getDescendantsOfType(doc, 'table').length;

    const paragraphs = mammoth.transforms.getDescendantsOfType(doc, 'paragraph');
    const spacingMatches = paragraphs.length === xmlParagraphs.length;
    if (!spacingMatches) console.warn(`[docxImport] ${paragraphs.length} paragraphs vs ${xmlParagraphs.length} in XML; spacing not imported`);

    paragraphs.forEach((paragraph, index) => {
      const css = [];
      if (ALIGN_CSS[paragraph.alignment]) css.push(`text-align: ${ALIGN_CSS[paragraph.alignment]}`);
      if (spacingMatches) css.push(paragraphCss(resolver.spacingFor(wChild(xmlParagraphs[index], 'pPr'))));
      mammoth.transforms.getDescendantsOfType(paragraph, 'image').forEach((image) => { image.etherxAlign = paragraph.alignment; });
      const firstText = mammoth.transforms.getDescendantsOfType(paragraph, 'text')[0];
      if (!firstText || !css.length) return;
      paragraphCssByIndex[index] = css.join('; ');
      firstText.value = `${index}${firstText.value}`;
    });

    return mammoth.transforms.run((run) => {
      const texts = mammoth.transforms.getDescendantsOfType(run, 'text');
      if (!texts.length) return run;
      if (run.isAllCaps) texts.forEach((t) => { t.value = t.value.toUpperCase(); });
      const css = [];
      if (run.fontSize) css.push(`font-size: ${run.fontSize}pt`);
      if (run.font && run.font !== baseFont) css.push(`font-family: '${run.font.replace(/'/g, '')}'`);
      if (!css.length) return run;
      runStyles.push(css.join('; '));
      texts[0].value = `${runStyles.length - 1}${texts[0].value}`;
      texts[texts.length - 1].value += RUN_END;
      return run;
    })(doc);
  };

  const convertImage = mammoth.images.imgElement(async (image) => {
    const attrs = { src: `data:${image.contentType};base64,${await image.read('base64')}` };
    const size = useImageSizes ? xmlDrawings[image.etherxIndex] : null;
    if (size) {
      attrs.width = String(size.width);
      attrs.height = String(size.height);
    }
    const style = imageStyle(image.etherxAlign);
    if (style) attrs.style = style;
    return attrs;
  });

  const result = await mammoth.convertToHtml({ arrayBuffer }, { transformDocument, convertImage });
  const doc = new DOMParser().parseFromString(`<body>${result.value || ''}</body>`, 'text/html');

  // Paragraph markers -> inline paragraph style.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const marked = [];
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue.includes('')) marked.push(walker.currentNode);
  }
  marked.forEach((textNode) => {
    const indexes = Array.from(textNode.nodeValue.matchAll(PARA_MARK), (m) => Number(m[1]));
    textNode.nodeValue = textNode.nodeValue.replace(PARA_MARK, '');
    let block = textNode.parentElement?.closest('p, h1, h2, h3, h4, h5, h6, li');
    const css = paragraphCssByIndex[indexes[0]];
    if (!css || !block) return;
    if (block.tagName === 'LI') {
      // The editor keeps paragraph formatting on the list item's paragraph, so give its text one.
      const para = doc.createElement('p');
      while (block.firstChild && !/^(UL|OL)$/.test(block.firstChild.nodeName)) para.appendChild(block.firstChild);
      block.insertBefore(para, block.firstChild);
      block = para;
    }
    block.setAttribute('style', css);
  });

  wrapMarkedRuns(doc, runStyles);

  const htmlTables = Array.from(doc.body.querySelectorAll('table'));
  if (htmlTables.length === xmlTables.length && htmlTables.length === tableCount) {
    htmlTables.forEach((table, index) => {
      const grid = wChild(xmlTables[index], 'tblGrid');
      const widths = Array.from(grid?.children || []).map((col) => Number(wAttr(col, 'w')) || 0);
      if (widths.length && widths.every((w) => w > 0)) applyColumnWidths(table, widths);
    });
  }

  // A sub-list with no parent item comes out of mammoth as an empty <li> holding the nested list,
  // which the editor shows as a bare bullet; lift the nested items into the parent list.
  doc.body.querySelectorAll('li').forEach((li) => {
    const lists = Array.from(li.children).filter((c) => /^(UL|OL)$/.test(c.nodeName));
    const hasOwnContent = Array.from(li.childNodes).some((n) =>
      !lists.includes(n) && (n.nodeType === Node.ELEMENT_NODE || n.nodeValue.trim()));
    if (lists.length && !hasOwnContent && li.parentNode) {
      lists.forEach((list) => li.before(...Array.from(list.children)));
      li.remove();
    }
  });

  // Images are block nodes in the editor; an image-only paragraph would leave an empty
  // paragraph behind, so hoist the images out of it.
  doc.body.querySelectorAll('p').forEach((p) => {
    const onlyImages = p.querySelector('img') && Array.from(p.childNodes).every((n) =>
      n.nodeName === 'IMG' || (n.nodeType === Node.TEXT_NODE && !n.nodeValue.trim()));
    if (onlyImages) p.replaceWith(...p.querySelectorAll('img'));
  });

  const design = {};
  if (baseFont) design.font = baseFont;
  const defaultLineHeight = cssLineHeight(resolver.defaultLine);
  design.spacing = defaultLineHeight && !defaultLineHeight.endsWith('pt') ? defaultLineHeight : '1';

  return { html: doc.body.innerHTML, design, layout: readLayout(pkg.document), messages: result.messages };
}
