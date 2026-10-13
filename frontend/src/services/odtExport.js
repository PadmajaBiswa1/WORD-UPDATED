// OpenDocument Text (.odt) and plain-text export. ODT is a zip of XML parts;
// this writes the document body (headings, paragraphs, bold/italic/underline/
// strikethrough, lists, tables, line breaks) with matching styles. Images,
// colours and fonts are preserved by the rich document package below.
import JSZip from 'jszip';
import { acceptSuggestionsInHtml } from './suggestionHtml';
import { portableExportHtml, exportPageFill, flattenExportMedia, rasterizeExportImage } from './exportAppearance';
import { resolveExportMetadata, normalizeExportColor } from './export';
import { PAGE_SIZES, MARGIN_MAP } from '@/utils/pageLayout';
import { stripAutoPageBreaks } from '@/components/editor/PageBreak';

const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';
const MARKS = { strong: 'T_b', b: 'T_b', em: 'T_i', i: 'T_i', u: 'T_u', s: 'T_s', strike: 'T_s', del: 'T_s', sub: 'T_sub', sup: 'T_sup' };
const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'PRE', 'DIV', 'TR']);

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function parse(html) {
  const clean = acceptSuggestionsInHtml(stripAutoPageBreaks(html || ''));
  return new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html').body;
}

// Inline content of an element as ODF text runs.
function inline(node) {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += esc(child.data).replace(/ {2,}/g, (spaces) => ` <text:s text:c="${spaces.length - 1}"/>`);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') out += '<text:line-break/>';
      else if (MARKS[tag]) out += `<text:span text:style-name="${MARKS[tag]}">${inline(child)}</text:span>`;
      else if (tag === 'a' && child.getAttribute('href')) out += `<text:a xlink:type="simple" xlink:href="${esc(child.getAttribute('href'))}">${inline(child)}</text:a>`;
      else out += inline(child);
    }
  });
  return out;
}

function blocks(parent) {
  let out = '';
  parent.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.data.trim()) out += `<text:p text:style-name="Standard">${esc(node.data)}</text:p>`;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    const level = /^h([1-6])$/.exec(tag)?.[1];
    if (level) out += `<text:h text:style-name="Heading_20_${level}" text:outline-level="${level}">${inline(node)}</text:h>`;
    else if (tag === 'p' || tag === 'pre') out += `<text:p text:style-name="Standard">${inline(node)}</text:p>`;
    else if (tag === 'blockquote') out += blocks(node).replaceAll('text:style-name="Standard"', 'text:style-name="Quotations"');
    else if (tag === 'ul' || tag === 'ol') {
      out += `<text:list text:style-name="${tag === 'ol' ? 'L_num' : 'L_bullet'}">`;
      node.querySelectorAll(':scope > li').forEach((li) => {
        const hasBlocks = [...li.children].some((c) => BLOCK_TAGS.has(c.tagName) || c.tagName === 'UL' || c.tagName === 'OL');
        out += `<text:list-item>${hasBlocks ? blocks(li) : `<text:p text:style-name="Standard">${inline(li)}</text:p>`}</text:list-item>`;
      });
      out += '</text:list>';
    } else if (tag === 'table') {
      const rows = [...node.querySelectorAll('tr')];
      const cols = Math.max(1, ...rows.map((r) => r.children.length));
      out += `<table:table table:style-name="Tbl"><table:table-column table:number-columns-repeated="${cols}"/>`;
      rows.forEach((row) => {
        out += '<table:table-row>';
        [...row.children].forEach((cell) => {
          const inner = [...cell.children].some((c) => BLOCK_TAGS.has(c.tagName)) ? blocks(cell) : `<text:p text:style-name="Standard">${inline(cell)}</text:p>`;
          out += `<table:table-cell table:style-name="Cell" office:value-type="string">${inner}</table:table-cell>`;
        });
        out += '</table:table-row>';
      });
      out += '</table:table>';
    } else if (node.matches?.('[data-page-break]')) {
      out += '<text:p text:style-name="PageBreak"/>';
    } else if (tag === 'hr') {
      out += '<text:p text:style-name="Standard"/>';
    } else if (tag === 'img' || tag === 'iframe') {
      // Pictures and embeds are not exported.
    } else {
      out += [...node.children].some((c) => BLOCK_TAGS.has(c.tagName) || ['UL', 'OL', 'TABLE'].includes(c.tagName))
        ? blocks(node)
        : (node.textContent.trim() ? `<text:p text:style-name="Standard">${inline(node)}</text:p>` : '');
    }
  });
  return out;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${NS} office:version="1.3"><office:styles>
<style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.21cm"/><style:text-properties fo:font-size="11pt" style:font-name="Calibri"/></style:default-style>
<style:style style:name="Standard" style:family="paragraph" style:class="text"/>
<style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="1cm" fo:margin-right="1cm"/><style:text-properties fo:font-style="italic"/></style:style>
${[1, 2, 3, 4, 5, 6].map((n) => `<style:style style:name="Heading_20_${n}" style:display-name="Heading ${n}" style:family="paragraph" style:parent-style-name="Standard" style:default-outline-level="${n}" style:class="text"><style:paragraph-properties fo:margin-top="0.42cm" fo:margin-bottom="0.21cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="${[20, 16, 14, 12, 11, 11][n - 1]}pt" fo:font-weight="bold"/></style:style>`).join('\n')}
</office:styles></office:document-styles>`;

const CONTENT_STYLES = `<office:automatic-styles>
<style:style style:name="T_b" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="T_i" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>
<style:style style:name="T_u" style:family="text"><style:text-properties style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"/></style:style>
<style:style style:name="T_s" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style>
<style:style style:name="T_sub" style:family="text"><style:text-properties style:text-position="sub 58%"/></style:style>
<style:style style:name="T_sup" style:family="text"><style:text-properties style:text-position="super 58%"/></style:style>
<style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:break-before="page"/></style:style>
<style:style style:name="Tbl" style:family="table"><style:table-properties table:align="margins"/></style:style>
<style:style style:name="Cell" style:family="table-cell"><style:table-cell-properties fo:padding="0.1cm" fo:border="0.5pt solid #999999"/></style:style>
<text:list-style style:name="L_bullet"><text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.635cm" fo:margin-left="1.27cm"/></style:list-level-properties></text:list-level-style-bullet></text:list-style>
<text:list-style style:name="L_num"><text:list-level-style-number text:level="1" style:num-format="1" style:num-suffix="."><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.635cm" fo:margin-left="1.27cm"/></style:list-level-properties></text:list-level-style-number></text:list-style>
</office:automatic-styles>`;

export function buildOdtContentXml(html) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS} xmlns:xlink="http://www.w3.org/1999/xlink" office:version="1.3">${CONTENT_STYLES}<office:body><office:text>${blocks(parse(html)) || '<text:p text:style-name="Standard"/>'}</office:text></office:body></office:document-content>`;
}

export async function buildOdtBlob(title, html, options = {}) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  const meta = resolveExportMetadata(options);
  const { design, pageSettings, headerFooter, watermark } = meta;
  const body = parse(portableExportHtml(html, meta));
  flattenExportMedia(body);
  const pictures = [];
  for (const [index, image] of Array.from(body.querySelectorAll('img')).entries()) {
    const raster = await rasterizeExportImage(image.src, { filter: image.style.filter, opacity: image.style.opacity });
    const path = `Pictures/image-${index + 1}.png`;
    zip.file(path, raster.src.split(',')[1], { base64: true });
    image.setAttribute('data-odt-image', path);
    pictures.push(path);
    if (!image.getAttribute('width')) image.setAttribute('width', raster.width);
    if (!image.getAttribute('height')) image.setAttribute('height', raster.height);
  }
  let watermarkImage = '';
  if (watermark) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><g transform="rotate(-28 320 320)"><text x="320" y="345" text-anchor="middle" font-size="64" font-family="serif" fill="#6f5320" fill-opacity=".11">${esc(watermark)}</text></g></svg>`;
    const raster = await rasterizeExportImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);
    watermarkImage = 'Pictures/watermark.png'; zip.file(watermarkImage, raster.src.split(',')[1], { base64: true }); pictures.push(watermarkImage);
  }
  const declarations = [];
  const styles = new Map();
  const color = (value) => normalizeExportColor(value, false, true);
  const length = (value) => { const n = parseFloat(value); if (!Number.isFinite(n)) return null; return `${n * (String(value).endsWith('pt') ? 1 : .75)}pt`; };
  const attrs = (value) => Object.entries(value).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
  const styleFor = (node, family, parent = 'Standard') => {
    const style = node.style;
    const text = { 'fo:color': color(style.color), 'fo:font-size': length(style.fontSize), 'fo:font-family': style.fontFamily?.replace(/["']/g, ''), 'fo:font-weight': style.fontWeight, 'fo:font-style': style.fontStyle };
    if (style.textDecoration?.includes('underline')) text['style:text-underline-style'] = 'solid';
    if (style.textDecoration?.includes('line-through') || node.dataset.mark === 'deletion') text['style:text-line-through-style'] = 'solid';
    if (family === 'text' && color(style.backgroundColor)) text['fo:background-color'] = color(style.backgroundColor);
    let props = {};
    if (family === 'paragraph') props = { 'fo:text-align': style.textAlign, 'fo:margin-top': length(style.marginTop), 'fo:margin-bottom': length(style.marginBottom), 'fo:margin-left': length(style.marginLeft), 'fo:line-height': /^\d*\.?\d+$/.test(style.lineHeight) ? `${Number(style.lineHeight) * 100}%` : length(style.lineHeight) };
    if (family === 'table-cell') {
      props = { 'fo:background-color': color(style.backgroundColor), 'style:vertical-align': style.verticalAlign === 'middle' ? 'middle' : style.verticalAlign || 'top' };
      for (const side of ['top','right','bottom','left']) {
        const borderStyle = style.getPropertyValue(`border-${side}-style`);
        props[`fo:border-${side}`] = !borderStyle || borderStyle === 'none' ? 'none' : `${length(style.getPropertyValue(`border-${side}-width`)) || '.5pt'} ${borderStyle} ${color(style.getPropertyValue(`border-${side}-color`)) || '#999999'}`;
        props[`fo:padding-${side}`] = length(style.getPropertyValue(`padding-${side}`)) || '5pt';
      }
    }
    if (family === 'table') props = { 'table:align': node.getAttribute('align') || 'margins', 'style:width': length(style.width) };
    const properties = attrs(props); const textProperties = attrs(text);
    const key = `${family}/${parent}/${properties}/${textProperties}`;
    if (!styles.has(key)) {
      const name = `Ex${styles.size + 1}`;
      styles.set(key, name);
      declarations.push(`<style:style style:name="${name}" style:family="${family}" style:parent-style-name="${parent}">${properties ? `<style:${family}-properties ${properties}/>` : ''}${textProperties ? `<style:text-properties ${textProperties}/>` : ''}</style:style>`);
    }
    return styles.get(key);
  };
  const imageXml = (node) => {
    const width = parseFloat(node.style.width || node.getAttribute('width')) || 300;
    const height = parseFloat(node.style.height || node.getAttribute('height')) || 200;
    return `<draw:frame draw:name="${esc(node.alt || 'Image')}" text:anchor-type="as-char" svg:width="${width / 96 * 2.54}cm" svg:height="${height / 96 * 2.54}cm"><draw:image xlink:href="${esc(node.getAttribute('data-odt-image'))}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
  };
  const inlineRich = (parent) => Array.from(parent.childNodes).map((node) => {
    if (node.nodeType === 3) return esc(node.textContent);
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '<text:line-break/>';
    if (tag === 'img') return imageXml(node);
    const content = inlineRich(node);
    if (tag === 'a') return `<text:a xlink:href="${esc(node.getAttribute('href') || '')}" xlink:type="simple">${content}</text:a>`;
    const styled = `<text:span text:style-name="${styleFor(node, 'text', MARKS[tag] || 'Standard')}">${content}</text:span>`;
    return styled;
  }).join('');
  const blocksRich = (parent) => Array.from(parent.childNodes).map((node) => {
    if (node.nodeType === 3) return node.textContent.trim() ? `<text:p>${esc(node.textContent)}</text:p>` : '';
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    if (node.hasAttribute('data-page-break')) return '<text:p text:style-name="PageBreak"/>';
    if (tag === 'img') return `<text:p>${imageXml(node)}</text:p>`;
    if (tag === 'table') {
      const rows = Array.from(node.rows);
      const count = Math.max(1, ...rows.map((row) => Array.from(row.cells).reduce((sum, cell) => sum + cell.colSpan, 0)));
      const occupied = [];
      return `<table:table table:style-name="${styleFor(node, 'table', 'Tbl')}"><table:table-column table:number-columns-repeated="${count}"/>${rows.map((row, r) => {
        let c = 0; let cells = '';
        for (const cell of Array.from(row.cells)) {
          while (occupied[r]?.[c]) { cells += '<table:covered-table-cell/>'; c += 1; }
          cells += `<table:table-cell table:style-name="${styleFor(cell, 'table-cell', 'Cell')}" office:value-type="string" table:number-columns-spanned="${cell.colSpan}" table:number-rows-spanned="${cell.rowSpan}">${cell.children.length ? blocksRich(cell) : `<text:p>${inlineRich(cell)}</text:p>`}</table:table-cell>`;
          for (let y = r; y < r + cell.rowSpan; y += 1) { occupied[y] ||= []; for (let x = c; x < c + cell.colSpan; x += 1) occupied[y][x] = true; }
          for (let x = 1; x < cell.colSpan; x += 1) cells += '<table:covered-table-cell/>';
          c += cell.colSpan;
        }
        while (c < count) { cells += occupied[r]?.[c] ? '<table:covered-table-cell/>' : '<table:table-cell><text:p/></table:table-cell>'; c += 1; }
        return `<table:table-row>${cells}</table:table-row>`;
      }).join('')}</table:table>`;
    }
    if (tag === 'ul' || tag === 'ol') return `<text:list text:style-name="${tag === 'ol' ? 'L_num' : 'L_bullet'}">${Array.from(node.children).map((li) => `<text:list-item>${Array.from(li.children).some((child) => BLOCK_TAGS.has(child.tagName) || ['UL','OL','TABLE'].includes(child.tagName)) ? blocksRich(li) : `<text:p>${inlineRich(li)}</text:p>`}</text:list-item>`).join('')}</text:list>`;
    const heading = /^h([1-6])$/.exec(tag)?.[1];
    if (heading || ['p','pre'].includes(tag)) { const type = heading ? 'h' : 'p'; return `<text:${type} text:style-name="${styleFor(node,'paragraph',heading ? `Heading_20_${heading}` : 'Standard')}"${heading ? ` text:outline-level="${heading}"` : ''}>${inlineRich(node)}</text:${type}>`; }
    return node.children.length ? blocksRich(node) : `<text:p>${inlineRich(node)}</text:p>`;
  }).join('');
  const bodyXml = blocksRich(body) || '<text:p/>';
  const annotations = meta.comments.map((comment) => `<text:p><office:annotation><dc:creator>${esc(comment.author?.name || comment.author || 'Reviewer')}</dc:creator><text:p>${esc(comment.text || comment.body || '')}</text:p></office:annotation></text:p>`).join('');
  const contentStyles = CONTENT_STYLES.replace('</office:automatic-styles>', `${declarations.join('')}</office:automatic-styles>`);
  const namespace = `${NS} xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/"`;
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${namespace} office:version="1.3">${contentStyles}<office:body><office:text>${bodyXml}${annotations}</office:text></office:body></office:document-content>`);
  const dims = PAGE_SIZES[pageSettings.format] || PAGE_SIZES.a4;
  const landscape = pageSettings.orientation === 'landscape';
  const margin = (MARGIN_MAP[pageSettings.margin] || MARGIN_MAP.normal) / 96 * 2.54;
  const borderAttrs = {};
  if (design.borderSetting && design.borderSetting !== 'none') for (const side of ['top','right','bottom','left']) borderAttrs[`fo:border-${side}`] = design.borderSides?.[side] === false ? 'none' : `${Number(design.borderWidth || 1)}pt ${design.borderStyle || 'solid'} ${design.borderColor || '#6f5320'}`;
  const pageLayout = `<office:automatic-styles><style:page-layout style:name="DocumentPage"><style:page-layout-properties fo:page-width="${(landscape ? dims.h : dims.w) / 96 * 2.54}cm" fo:page-height="${(landscape ? dims.w : dims.h) / 96 * 2.54}cm" style:print-orientation="${landscape ? 'landscape' : 'portrait'}" fo:margin="${margin}cm" fo:background-color="${exportPageFill(design)}" ${attrs(borderAttrs)}><style:columns fo:column-count="${Number(pageSettings.columns) || 1}" fo:column-gap="1.27cm"/>${watermarkImage ? `<style:background-image xlink:href="${watermarkImage}" xlink:type="simple" style:repeat="no-repeat" style:position="center"/>` : ''}</style:page-layout-properties></style:page-layout></office:automatic-styles>`;
  const headerXml = `<style:header><text:p>${esc(headerFooter.headerText || '')}${headerFooter.pageNumberEnabled && headerFooter.pageNumberStyle.startsWith('top') ? '<text:page-number text:select-page="current"/>' : ''}</text:p></style:header>`;
  const footerXml = `<style:footer><text:p>${esc(headerFooter.footerText || '')}${headerFooter.pageNumberEnabled && headerFooter.pageNumberStyle.startsWith('bottom') ? '<text:page-number text:select-page="current"/>' : ''}</text:p></style:footer>`;
  const customStyles = STYLES.replace(NS, namespace).replace('fo:font-size="11pt" style:font-name="Calibri"', `fo:font-size="${Number(design.fontSize) || 12}pt" fo:font-family="${esc(design.bodyFont || design.font || 'Georgia')}"`).replace('<style:style style:name="Standard" style:family="paragraph" style:class="text"/>', '<style:style style:name="Standard" style:family="paragraph" style:class="text" style:master-page-name="Standard"/>').replace('</office:document-styles>', `${pageLayout}<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="DocumentPage">${headerXml}${footerXml}</style:master-page></office:master-styles></office:document-styles>`);
  zip.file('styles.xml', customStyles);
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>${['content.xml','styles.xml','meta.xml'].map((path) => `<manifest:file-entry manifest:full-path="${path}" manifest:media-type="text/xml"/>`).join('')}${pictures.map((path) => `<manifest:file-entry manifest:full-path="${path}" manifest:media-type="image/png"/>`).join('')}</manifest:manifest>`);
  zip.file('meta.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3"><office:meta><dc:title>${esc(title || 'Document')}</dc:title><meta:user-defined meta:name="EtherX.DocumentMetadata">${esc(JSON.stringify({ ...meta, watermark, signatures: options.signatures || [] }))}</meta:user-defined></office:meta></office:document-meta>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text', compression: 'DEFLATE' });
}

// Plain text: one line per paragraph, list items as "• ", table cells tab-separated.
export function htmlToPlainText(html) {
  const body = parse(html);
  body.querySelectorAll('li').forEach((li) => li.prepend(li.closest('ol') ? '' : '• '));
  body.querySelectorAll('td, th').forEach((cell) => { if (cell.nextElementSibling) cell.append('\t'); });
  body.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  let text = '';
  const walk = (node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) text += child.data;
      else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
        // Rows end lines; cells within a row and paragraphs inside list items or cells do not.
        const inline = child.tagName === 'TD' || child.tagName === 'TH' || (child.tagName === 'P' && child.parentElement?.matches('li, td, th'));
        if (BLOCK_TAGS.has(child.tagName) && !inline) text += '\n';
      }
    });
  };
  walk(body);
  return text.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function buildTextBlob(html) {
  return new Blob([htmlToPlainText(html)], { type: 'text/plain;charset=utf-8' });
}
