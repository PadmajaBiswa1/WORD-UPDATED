// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Export Service (client-side)
// ═══════════════════════════════════════════════════════════════
import { saveAs } from 'file-saver';

function sanitize(name) {
  return (name || 'document').replace(/[^a-z0-9_\-\s]/gi, '_').trim();
}

export function buildHtmlDocument(title, html) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
     <title>${title}</title>
     <style>body{font-family:'Georgia',serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7}</style>
     </head><body>${html}</body></html>`;
}

/* ── HTML ───────────────────────────────────────────────────── */
export function exportToHtml(title, html) {
  const blob = new Blob([buildHtmlDocument(title, html)], { type: 'text/html;charset=utf-8' });
  saveAs(blob, `${sanitize(title)}.html`);
}

/* ── PDF (via jsPDF + html2canvas) ─────────────────────────── */
export async function exportToPdf(title, el, pageSettings = {}) {
  const [{ default: jsPDF }, { default: h2c }] = await Promise.all([
    import('jspdf'), import('html2canvas'),
  ]);
  
  // Get page settings or use defaults
  const orientation = pageSettings.orientation || 'portrait';
  const format = pageSettings.format || 'a4';
  const formatMap = {
    'a4': 'a4',
    'letter': 'letter',
    'legal': 'legal',
    'a3': 'a3',
  };
  const selectedFormat = formatMap[format] || 'a4';
  
  // Capture the content
  const canvas   = await h2c(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', allowTaint: true });
  const imgData  = canvas.toDataURL('image/png');
  const pdf      = new jsPDF({ 
    orientation: orientation === 'landscape' ? 'l' : 'p',
    unit: 'mm', 
    format: selectedFormat,
  });
  
  const pw       = pdf.internal.pageSize.getWidth()  - 20;
  const ph       = pdf.internal.pageSize.getHeight() - 20;
  const imgH     = (canvas.height * pw) / canvas.width;
  let   y        = 10;
  let   imgPos   = 0;
  let   remaining = imgH;

  // Add pages as needed for the full height
  while (remaining > 0) {
    // Calculate the portion of the image to display on this page
    const startY = (imgPos / imgH) * canvas.height;
    const endY = startY + (ph / imgH) * canvas.height;
    
    // Create a temporary canvas for this page's portion
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = endY - startY;
    const ctx = pageCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, -startY, canvas.width, canvas.height);
    
    const pageImgData = pageCanvas.toDataURL('image/png');
    pdf.addImage(pageImgData, 'PNG', 10, y, pw, ph * (endY - startY) / canvas.height);
    
    remaining -= ph;
    if (remaining > 0) {
      pdf.addPage();
      y = 10;
    }
    imgPos += ph;
  }
  
  pdf.save(`${sanitize(title)}.pdf`);
}

/* ── DOCX (via docx library) ────────────────────────────────── */
export async function buildDocxBlob(html) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, UnorderedList, OrderedList, ListItem, AlignmentType, BorderStyle, VerticalAlign } = await import('docx');
  const div = document.createElement('div');
  div.innerHTML = html;

  const children = [];
  
  const parseNode = (node) => {
    if (node.nodeType === 3) { // Text node
      return node.textContent;
    }
    
    const tag = node.tagName?.toLowerCase();
    const txt = node.textContent || '';
    const style = node.getAttribute('style') || '';
    
    // Parse inline styles
    const isBold = node.style.fontWeight === 'bold' || node.style.fontWeight >= 700 || node.tagName === 'STRONG' || node.tagName === 'B';
    const isItalic = node.style.fontStyle === 'italic' || node.tagName === 'EM' || node.tagName === 'I';
    const isUnderline = node.style.textDecoration?.includes('underline') || node.tagName === 'U';
    const color = node.style.color;
    const fontSize = parseInt(node.style.fontSize) || 12;
    
    if (tag === 'h1') return new Paragraph({ text: txt, heading: HeadingLevel.HEADING_1 });
    if (tag === 'h2') return new Paragraph({ text: txt, heading: HeadingLevel.HEADING_2 });
    if (tag === 'h3') return new Paragraph({ text: txt, heading: HeadingLevel.HEADING_3 });
    if (tag === 'h4') return new Paragraph({ text: txt, heading: HeadingLevel.HEADING_4 });
    if (tag === 'h5') return new Paragraph({ text: txt, heading: HeadingLevel.HEADING_5 });
    if (tag === 'h6') return new Paragraph({ text: txt, heading: HeadingLevel.HEADING_6 });
    
    if (tag === 'table') {
      const rows = [];
      node.querySelectorAll('tr').forEach(tr => {
        const cells = [];
        tr.querySelectorAll('td, th').forEach(td => {
          cells.push(new TableCell({ children: [new Paragraph(td.textContent)] }));
        });
        rows.push(new TableRow({ children: cells }));
      });
      return new Table({ rows });
    }
    
    if (tag === 'ul') {
      const items = [];
      node.querySelectorAll('li').forEach(li => {
        items.push(new ListItem(new Paragraph(li.textContent)));
      });
      return new UnorderedList({ children: items });
    }
    
    if (tag === 'ol') {
      const items = [];
      node.querySelectorAll('li').forEach(li => {
        items.push(new ListItem(new Paragraph(li.textContent)));
      });
      return new OrderedList({ children: items });
    }
    
    if (tag === 'a') {
      return new Paragraph({
        children: [new TextRun({
          text: txt,
          underline: {},
          color: '0563C1',
        })],
      });
    }
    
    if (tag === 'img') {
      return new Paragraph({ text: `[Image: ${node.getAttribute('alt') || 'image'}]` });
    }
    
    if (tag === 'br') {
      return new Paragraph({ text: '' });
    }
    
    // Default paragraph with formatting
    const runProps = { text: txt };
    if (isBold) runProps.bold = true;
    if (isItalic) runProps.italic = true;
    if (isUnderline) runProps.underline = {};
    if (color) runProps.color = color.replace('#', '');
    if (fontSize) runProps.size = fontSize * 2;
    
    if (tag && tag.match(/^(p|div|span|b|i|u|strong|em)$/)) {
      if (tag === 'p' || tag === 'div') {
        return new Paragraph({ children: [new TextRun(runProps)] });
      }
    }
    
    return new Paragraph({ children: [new TextRun(runProps)] });
  };
  
  div.childNodes.forEach((n) => {
    const result = parseNode(n);
    if (result) children.push(result);
  });

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBlob(doc);
}

export async function exportToDocx(title, html) {
  const buffer = await buildDocxBlob(html);
  saveAs(buffer, `${sanitize(title)}.docx`);
}
