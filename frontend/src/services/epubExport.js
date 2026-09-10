// ═══════════════════════════════════════════════════════════════
//  EtherX Word — EPUB 3 Export Service
// ═══════════════════════════════════════════════════════════════
import JSZip from 'jszip';
import fileSaver from 'file-saver';

const saveAs = fileSaver?.saveAs || fileSaver;

function sanitizeFilename(name) {
  return (name || 'document').replace(/[^a-z0-9_\-\s]/gi, '_').trim();
}

function escapeXml(unsafe = '') {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Sanitizes and cleans HTML to make it valid XHTML for EPUB, extracting embedded images.
 * @param {string} html
 * @param {Array} imageCollector - accumulator array for extracted images
 * @returns {string}
 */
function cleanForXhtml(html = '', imageCollector = []) {
  if (!html) return '<p></p>';

  let cleaned = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Extract base64 images into internal EPUB items
    .replace(/<img\s+([^>]*?)src=["']data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)["']([^>]*?)(?:\s*\/)?>/gi, (match, before, ext, base64Data, after) => {
      const imgIdx = imageCollector.length + 1;
      const normExt = ext === 'jpeg' ? 'jpg' : ext;
      const imgPath = `images/img-${imgIdx}.${normExt}`;
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      imageCollector.push({
        id: `img-${imgIdx}`,
        fileName: imgPath,
        base64Data,
        mimeType,
      });
      return `<img ${before}src="${imgPath}"${after} />`;
    })
    // Ensure remaining void tags are properly self-closed
    .replace(/<br\s*\/?>/gi, '<br />')
    .replace(/<hr\s*\/?>/gi, '<hr />')
    .replace(/<img\s*([^>]*?)(?:\s*\/)?>/gi, '<img $1 />')
    // Remove custom or problematic data attributes
    .replace(/\sdata-[a-zA-Z0-9_\-]+="[^"]*"/gi, '')
    // Ensure ampersands that aren't entities are escaped
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[a-f0-9]+);)/gi, '&amp;');

  return cleaned;
}

/**
 * Parses contentHtml into chapter blocks.
 * If <h1> tags are present, splits at each <h1>.
 * Otherwise returns a single chapter.
 * @param {string} title
 * @param {string} contentHtml
 * @returns {Array<{ id: string, fileName: string, title: string, content: string }>}
 */
function partitionChapters(title, contentHtml, imageCollector = []) {
  if (!contentHtml || typeof contentHtml !== 'string') {
    return [
      {
        id: 'chapter-1',
        fileName: 'chapter1.xhtml',
        title: title || 'Chapter 1',
        content: '<p></p>',
      },
    ];
  }

  // Regex to split on <h1> tags
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  const matches = [...contentHtml.matchAll(h1Regex)];

  if (matches.length <= 1) {
    return [
      {
        id: 'chapter-1',
        fileName: 'chapter1.xhtml',
        title: matches.length === 1 ? matches[0][1].replace(/<[^>]+>/g, '').trim() || title : title,
        content: cleanForXhtml(contentHtml, imageCollector),
      },
    ];
  }

  const chapters = [];
  let lastIndex = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const matchStart = match.index;
    const chapterTitle = match[1].replace(/<[^>]+>/g, '').trim() || `Chapter ${i + 1}`;

    if (i === 0 && matchStart > 0) {
      // Preface / prologue before first h1
      const introContent = contentHtml.substring(0, matchStart).trim();
      if (introContent && !/^(?:<p>\s*<\/p>|\s*)$/i.test(introContent)) {
        chapters.push({
          id: 'chapter-intro',
          fileName: 'chapter0.xhtml',
          title: 'Introduction',
          content: cleanForXhtml(introContent, imageCollector),
        });
      }
    }

    const nextMatchStart = i + 1 < matches.length ? matches[i + 1].index : contentHtml.length;
    const chapterRawContent = contentHtml.substring(matchStart, nextMatchStart);

    chapters.push({
      id: `chapter-${i + 1}`,
      fileName: `chapter${i + 1}.xhtml`,
      title: chapterTitle,
      content: cleanForXhtml(chapterRawContent, imageCollector),
    });

    lastIndex = nextMatchStart;
  }

  return chapters;
}

const EPUB_CSS = `
body {
  font-family: serif;
  margin: 1.5em;
  line-height: 1.6;
  color: #1a1a1a;
}
h1, h2, h3, h4, h5, h6 {
  font-family: sans-serif;
  margin-top: 1.2em;
  margin-bottom: 0.6em;
  line-height: 1.25;
  color: #111111;
}
p {
  margin: 0.8em 0;
  text-indent: 0;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1.2em 0;
}
th, td {
  border: 1px solid #cccccc;
  padding: 6px 10px;
  text-align: left;
}
th {
  background-color: #f2f2f2;
}
blockquote {
  border-left: 3px solid #c9a84c;
  margin: 1.2em 0;
  padding-left: 1em;
  font-style: italic;
  color: #444444;
}
code, pre {
  font-family: monospace;
  background-color: #f6f6f6;
  padding: 2px 4px;
  border-radius: 3px;
}
pre {
  padding: 10px;
  overflow-x: auto;
}
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}
`;

/**
 * Builds an EPUB 3 zip archive and initiates browser download.
 *
 * @param {string} title - Document title
 * @param {string} contentHtml - HTML content to format into EPUB chapters
 * @param {object} [metadata={}] - Optional metadata (author, language, description, publisher)
 * @returns {Promise<{ blob: Blob, filename: string, chapters: number }>}
 */
export async function exportToEpub(title = 'Untitled Document', contentHtml = '', metadata = {}) {
  const zip = new JSZip();
  const docTitle = title || 'Untitled Document';
  const author = metadata.author || 'EtherX Word Author';
  const language = metadata.language || 'en';
  const uuid = metadata.uuid || generateUuid();
  const modifiedDate = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const filename = `${sanitizeFilename(docTitle)}.epub`;

  // 1. mimetype (MUST be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.folder('META-INF').file('container.xml', containerXml);

  // 3. Partition content into chapters
  const oebps = zip.folder('OEBPS');
  oebps.file('style.css', EPUB_CSS.trim());

  const imageCollector = [];
  const chapters = partitionChapters(docTitle, contentHtml, imageCollector);

  // Write collected image files
  if (imageCollector.length > 0) {
    const imgFolder = oebps.folder('images');
    for (const img of imageCollector) {
      imgFolder.file(img.fileName.replace(/^images\//, ''), img.base64Data, { base64: true });
    }
  }

  // Write chapter xhtml files
  for (const ch of chapters) {
    const chapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  ${ch.content}
</body>
</html>`;
    oebps.file(ch.fileName, chapterXhtml);
  }

  // 4. OEBPS/toc.ncx (EPUB 2 / NCX compatibility)
  const navPoints = chapters
    .map(
      (ch, idx) => `    <navPoint id="navPoint-${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="${ch.fileName}"/>
    </navPoint>`
    )
    .join('\n');

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(docTitle)}</text>
  </docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
  oebps.file('toc.ncx', tocNcx);

  // 5. OEBPS/nav.xhtml (EPUB 3 Navigation Document)
  const tocList = chapters
    .map((ch) => `      <li><a href="${ch.fileName}">${escapeXml(ch.title)}</a></li>`)
    .join('\n');

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head>
  <meta charset="utf-8" />
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${tocList}
    </ol>
  </nav>
</body>
</html>`;
  oebps.file('nav.xhtml', navXhtml);

  // 6. OEBPS/content.opf
  const publisher = metadata.publisher || 'EtherX Word Platform';
  const description = metadata.description || 'Generated by EtherX Word Editor';
  const rights = metadata.rights || 'All rights reserved';
  const subject = metadata.subject || 'Document';

  const imageManifestItems = imageCollector.map(
    (img) => `    <item id="${img.id}" href="${img.fileName}" media-type="${img.mimeType}"/>`
  );

  const manifestItems = [
    '    <item id="style" href="style.css" media-type="text/css"/>',
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    ...chapters.map(
      (ch) => `    <item id="${ch.id}" href="${ch.fileName}" media-type="application/xhtml+xml"/>`
    ),
    ...imageManifestItems,
  ].join('\n');

  const spineItems = chapters
    .map((ch) => `    <itemref idref="${ch.id}"/>`)
    .join('\n');

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(docTitle)}</dc:title>
    <dc:language>${language}</dc:language>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:publisher>${escapeXml(publisher)}</dc:publisher>
    <dc:description>${escapeXml(description)}</dc:description>
    <dc:rights>${escapeXml(rights)}</dc:rights>
    <dc:subject>${escapeXml(subject)}</dc:subject>
    <dc:date>${new Date().toISOString().slice(0, 10)}</dc:date>
    <meta property="dcterms:modified">${modifiedDate}</meta>
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
  oebps.file('content.opf', contentOpf);

  // Generate zip as Blob or Buffer
  let blob;
  if (typeof window !== 'undefined' || typeof Blob !== 'undefined') {
    blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip',
    });
    if (typeof saveAs === 'function') {
      saveAs(blob, filename);
    }
  } else {
    // Node.js fallback
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    blob = buffer;
  }

  return {
    blob,
    filename,
    chapters: chapters.length,
  };
}
