// DOCX -> editor HTML. mammoth handles structure (headings, lists, tables, images) but drops
// paragraph alignment and image sizes, so both are carried across here.

const ALIGN_MARK = /([crj])/g;
const ALIGN_CODE = { center: 'c', right: 'r', end: 'r', both: 'j', distribute: 'j' };
const ALIGN_CSS = { c: 'center', r: 'right', j: 'justify' };
const EMU_PER_PX = 9525;

// Display size of each DrawingML image in body order, in CSS px. mammoth reports images in the
// same order; if the counts disagree (e.g. legacy VML images), sizes are not applied.
async function readDrawingSizes(arrayBuffer) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) return [];
    return Array.from(xml.matchAll(/<w:drawing>[\s\S]*?<\/w:drawing>/g), ([drawing]) => {
      const extent = drawing.match(/<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"/);
      return extent
        ? { width: Math.round(Number(extent[1]) / EMU_PER_PX), height: Math.round(Number(extent[2]) / EMU_PER_PX) }
        : null;
    });
  } catch {
    return [];
  }
}

function imageStyle(align) {
  if (align === 'c') return 'display:block;margin:12px auto';
  if (align === 'r') return 'display:block;margin:12px 0 12px auto';
  return null;
}

export async function docxToHtml(arrayBuffer) {
  const mammoth = (await import('mammoth')).default;
  const sizes = await readDrawingSizes(arrayBuffer);
  let useSizes = false;

  const transformDocument = (doc) => {
    const images = mammoth.transforms.getDescendantsOfType(doc, 'image');
    useSizes = images.length > 0 && images.length === sizes.length;
    images.forEach((image, index) => { image.etherxIndex = index; });

    return mammoth.transforms.paragraph((paragraph) => {
      const code = ALIGN_CODE[paragraph.alignment];
      if (!code) return paragraph;
      mammoth.transforms.getDescendantsOfType(paragraph, 'image').forEach((image) => { image.etherxAlign = code; });
      // Tag the paragraph's first text so its alignment can be restored on the HTML element.
      const firstText = mammoth.transforms.getDescendantsOfType(paragraph, 'text')[0];
      if (firstText) firstText.value = `${code}${firstText.value}`;
      return paragraph;
    })(doc);
  };

  const convertImage = mammoth.images.imgElement(async (image) => {
    const attrs = { src: `data:${image.contentType};base64,${await image.read('base64')}` };
    const size = useSizes ? sizes[image.etherxIndex] : null;
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
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const marked = [];
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue.includes('')) marked.push(walker.currentNode);
  }
  marked.forEach((textNode) => {
    const [, code] = ALIGN_MARK.exec(textNode.nodeValue) || [];
    ALIGN_MARK.lastIndex = 0;
    textNode.nodeValue = textNode.nodeValue.replace(ALIGN_MARK, '');
    let block = textNode.parentElement?.closest('p, h1, h2, h3, h4, h5, h6, li');
    if (!code || !block) return;
    if (block.tagName === 'LI') {
      // The editor keeps alignment on the list item's paragraph, so give its text one.
      const para = doc.createElement('p');
      while (block.firstChild && !/^(UL|OL)$/.test(block.firstChild.nodeName)) para.appendChild(block.firstChild);
      block.insertBefore(para, block.firstChild);
      block = para;
    }
    block.style.textAlign = ALIGN_CSS[code];
  });

  // Images are block nodes in the editor; an image-only paragraph would leave an empty
  // paragraph behind, so hoist the images out of it.
  doc.body.querySelectorAll('p').forEach((p) => {
    const onlyImages = p.querySelector('img') && Array.from(p.childNodes).every((n) =>
      n.nodeName === 'IMG' || (n.nodeType === Node.TEXT_NODE && !n.nodeValue.trim()));
    if (onlyImages) p.replaceWith(...p.querySelectorAll('img'));
  });

  return { html: doc.body.innerHTML, messages: result.messages };
}
