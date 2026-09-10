// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Markdown Export Service
// ═══════════════════════════════════════════════════════════════
import fileSaver from 'file-saver';

const saveAs = fileSaver?.saveAs || fileSaver;

function sanitizeFilename(name) {
  return (name || 'document').replace(/[^a-z0-9_\-\s]/gi, '_').trim();
}

/**
 * Renders Tiptap inline nodes (text, hardBreak, etc.) with marks to Markdown.
 * @param {Array} content
 * @returns {string}
 */
function renderInlineNodes(content = []) {
  if (!Array.isArray(content)) return '';

  return content
    .map((node) => {
      if (node.type === 'hardBreak') return '\n';
      if (node.type === 'image') {
        const alt = node.attrs?.alt || '';
        const src = node.attrs?.src || '';
        return `![${alt}](${src})`;
      }
      if (node.type !== 'text') {
        return node.text || '';
      }

      let text = node.text || '';
      if (!node.marks || node.marks.length === 0) return text;

      // Apply marks in structured order
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold':
            text = `**${text}**`;
            break;
          case 'italic':
            text = `*${text}*`;
            break;
          case 'strike':
            text = `~~${text}~~`;
            break;
          case 'code':
            text = `\`${text}\``;
            break;
          case 'link':
            text = `[${text}](${mark.attrs?.href || ''})`;
            break;
          case 'underline':
            text = `<u>${text}</u>`;
            break;
          case 'highlight':
            text = `==${text}==`;
            break;
          case 'subscript':
            text = `~${text}~`;
            break;
          case 'superscript':
            text = `^${text}^`;
            break;
          default:
            break;
        }
      }
      return text;
    })
    .join('');
}

/**
 * Converts a Tiptap table node into a GitHub Flavored Markdown table.
 * @param {object} tableNode
 * @returns {string}
 */
function renderTableNode(tableNode) {
  if (!tableNode.content || !tableNode.content.length) return '';

  const rows = [];
  let maxCols = 0;

  for (const rowNode of tableNode.content) {
    if (rowNode.type !== 'tableRow') continue;
    const cells = (rowNode.content || []).map((cellNode) => {
      const cellText = (cellNode.content || [])
        .map((p) => renderInlineNodes(p.content))
        .join(' ')
        .replace(/\|/g, '\\|')
        .replace(/\n+/g, ' ')
        .trim();
      return cellText;
    });
    maxCols = Math.max(maxCols, cells.length);
    rows.push(cells);
  }

  if (rows.length === 0) return '';

  // Pad cells so each row has maxCols
  const paddedRows = rows.map((r) => {
    while (r.length < maxCols) r.push('');
    return r;
  });

  const headerRow = paddedRows[0];
  const headerLine = `| ${headerRow.join(' | ')} |`;
  const separatorLine = `| ${headerRow.map(() => '---').join(' | ')} |`;
  const bodyLines = paddedRows
    .slice(1)
    .map((r) => `| ${r.join(' | ')} |`)
    .join('\n');

  return bodyLines ? `${headerLine}\n${separatorLine}\n${bodyLines}\n\n` : `${headerLine}\n${separatorLine}\n\n`;
}

/**
 * Recursively converts Tiptap JSON content nodes to Markdown.
 * @param {Array} nodes
 * @param {number} indentLevel
 * @returns {string}
 */
function renderJsonNodes(nodes = [], indentLevel = 0) {
  if (!Array.isArray(nodes)) return '';

  const indent = '  '.repeat(indentLevel);
  let md = '';

  for (const node of nodes) {
    switch (node.type) {
      case 'heading': {
        const level = Math.min(6, Math.max(1, node.attrs?.level || 1));
        const hashes = '#'.repeat(level);
        md += `${hashes} ${renderInlineNodes(node.content)}\n\n`;
        break;
      }
      case 'paragraph': {
        const text = renderInlineNodes(node.content);
        md += `${indent}${text}\n\n`;
        break;
      }
      case 'blockquote': {
        const inner = renderJsonNodes(node.content, 0)
          .trim()
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
        md += `${inner}\n\n`;
        break;
      }
      case 'codeBlock': {
        const lang = node.attrs?.language || '';
        const codeText = (node.content || []).map((c) => c.text || '').join('');
        md += `\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`;
        break;
      }
      case 'bulletList': {
        for (const item of node.content || []) {
          if (item.type === 'listItem') {
            const firstPara = item.content?.[0];
            const text = firstPara ? renderInlineNodes(firstPara.content) : '';
            md += `${indent}- ${text}\n`;
            if (item.content?.length > 1) {
              md += renderJsonNodes(item.content.slice(1), indentLevel + 1);
            }
          }
        }
        md += '\n';
        break;
      }
      case 'orderedList': {
        let index = node.attrs?.start || 1;
        for (const item of node.content || []) {
          if (item.type === 'listItem') {
            const firstPara = item.content?.[0];
            const text = firstPara ? renderInlineNodes(firstPara.content) : '';
            md += `${indent}${index}. ${text}\n`;
            if (item.content?.length > 1) {
              md += renderJsonNodes(item.content.slice(1), indentLevel + 1);
            }
            index++;
          }
        }
        md += '\n';
        break;
      }
      case 'taskList': {
        for (const item of node.content || []) {
          if (item.type === 'taskItem') {
            const checked = Boolean(item.attrs?.checked);
            const box = checked ? '- [x] ' : '- [ ] ';
            const firstPara = item.content?.[0];
            const text = firstPara ? renderInlineNodes(firstPara.content) : '';
            md += `${indent}${box}${text}\n`;
            if (item.content?.length > 1) {
              md += renderJsonNodes(item.content.slice(1), indentLevel + 1);
            }
          }
        }
        md += '\n';
        break;
      }
      case 'table': {
        md += renderTableNode(node);
        break;
      }
      case 'horizontalRule': {
        md += `---\n\n`;
        break;
      }
      case 'image': {
        const alt = node.attrs?.alt || '';
        const src = node.attrs?.src || '';
        md += `![${alt}](${src})\n\n`;
        break;
      }
      case 'pageBreak': {
        md += `<!-- pagebreak -->\n\n`;
        break;
      }
      default: {
        if (node.content) {
          md += renderJsonNodes(node.content, indentLevel);
        }
        break;
      }
    }
  }

  return md;
}

/**
 * Converts an HTML string to Markdown as a fallback when JSON AST is not provided.
 * @param {string} html
 * @returns {string}
 */
export function htmlToMarkdown(html) {
  if (!html || typeof html !== 'string') return '';

  let text = html;

  // Code blocks: <pre><code>...</code></pre>
  text = text.replace(/<pre[^>]*><code(?: class="(?:language-)?([^"]*)")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, lang, code) => {
    const unescaped = code
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');
    return `\n\`\`\`${lang || ''}\n${unescaped.trim()}\n\`\`\`\n\n`;
  });

  // Headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n\n');
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n\n');
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n\n');

  // Blockquotes
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, quote) => {
    const lines = quote.trim().split('\n').map((l) => `> ${l.trim()}`).join('\n');
    return `\n${lines}\n\n`;
  });

  // Horizontal rules
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n\n');

  // Images
  text = text.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)');
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, '![$1]($2)');
  text = text.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)');

  // Links
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Inline formatting
  text = text.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  text = text.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  text = text.replace(/<(?:s|strike|del)[^>]*>([\s\S]*?)<\/(?:s|strike|del)>/gi, '~~$1~~');
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  text = text.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
  text = text.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '==$1==');

  // Lists
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  text = text.replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n');

  // Paragraphs and breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');

  // Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // Clean extra blank lines
  return text.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/**
 * Converts a document JSON structure or HTML string to valid Markdown with YAML frontmatter.
 * @param {string} title
 * @param {object|string} docJsonOrHtml
 * @returns {string} Markdown string
 */
export function exportToMarkdown(title = 'Untitled Document', docJsonOrHtml = '') {
  const cleanTitle = (title || 'Untitled Document').replace(/"/g, '\\"');
  const date = new Date().toISOString().slice(0, 10);

  const frontmatter = `---
title: "${cleanTitle}"
date: "${date}"
generator: "EtherX Word"
---

`;

  let body = '';

  if (docJsonOrHtml && typeof docJsonOrHtml === 'object') {
    // If it is wrapped in an envelope or store state
    const ast = docJsonOrHtml.contentJson || (docJsonOrHtml.type === 'doc' ? docJsonOrHtml : null);
    if (ast && Array.isArray(ast.content)) {
      body = renderJsonNodes(ast.content);
    } else if (typeof docJsonOrHtml.content === 'string') {
      body = htmlToMarkdown(docJsonOrHtml.content);
    }
  } else if (typeof docJsonOrHtml === 'string') {
    // Check if it's JSON encoded string
    try {
      const parsed = JSON.parse(docJsonOrHtml);
      if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content)) {
        body = renderJsonNodes(parsed.content);
      } else {
        body = htmlToMarkdown(docJsonOrHtml);
      }
    } catch {
      body = htmlToMarkdown(docJsonOrHtml);
    }
  }

  const finalContent = `${frontmatter}${body.trim()}\n`;
  return finalContent;
}

/**
 * Exports and initiates download of a .md file.
 * @param {string} title
 * @param {object|string} docJsonOrHtml
 */
export function downloadMarkdown(title, docJsonOrHtml) {
  const md = exportToMarkdown(title, docJsonOrHtml);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, `${sanitizeFilename(title)}.md`);
  return blob;
}
