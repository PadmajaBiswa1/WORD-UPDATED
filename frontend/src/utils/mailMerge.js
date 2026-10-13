import { useDocumentStore } from '@/store';

export const RECIPIENTS_KEY = 'etherx-mailing-recipients';
export const mergeTokenRegex = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
export const escapeMailHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const extractFields = (recipients) => [...new Set(recipients.flatMap((recipient) => Object.keys(recipient || {})))];
export const mailingConfig = () => useDocumentStore.getState().references?.mailMerge || {};

export function saveMailingConfig(patch) {
  useDocumentStore.getState().setReferences({ mailMerge: { ...mailingConfig(), ...patch } });
  window.dispatchEvent(new Event('etherx:recipients-change'));
}

export function loadRecipients() {
  if (Array.isArray(mailingConfig().recipients)) return mailingConfig().recipients;
  try { const value = JSON.parse(localStorage.getItem(RECIPIENTS_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}

export function saveRecipients(recipients) {
  localStorage.setItem(RECIPIENTS_KEY, JSON.stringify(recipients));
  saveMailingConfig({ recipients });
}

export function csvToRecipients(csv) {
  const rows = []; let row = []; let value = ''; let quoted = false;
  const input = String(csv || '').replace(/^\uFEFF/, '');
  for (let i = 0; i <= input.length; i += 1) {
    const char = input[i];
    if (char === '"') { if (quoted && input[i + 1] === '"') { value += '"'; i += 1; } else quoted = !quoted; }
    else if (!quoted && (char === ',' || char === '\n' || char === undefined)) {
      row.push(value.trim()); value = '';
      if (char !== ',') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else if (char !== '\r' || quoted) value += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quote');
  if (!rows.length) return [];
  const headers = rows.shift();
  if (headers.some((header) => !/^[A-Za-z0-9_]+$/.test(header)) || new Set(headers).size !== headers.length) throw new Error('Use unique field names containing letters, numbers, or underscores');
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

export function recipientsToCsv(recipients) {
  const headers = extractFields(recipients);
  if (!headers.length) return 'FirstName,LastName,Address,City,State,Zip,Email\n';
  const quote = (value) => /[",\n\r]/.test(String(value ?? '')) ? `"${String(value).replace(/"/g, '""')}"` : String(value ?? '');
  return [headers.join(','), ...recipients.map((recipient) => headers.map((field) => quote(recipient[field])).join(','))].join('\n');
}

export function mergeDocumentHtml(html, recipient, mapping = mailingConfig().mapping || {}) {
  const get = (field) => recipient?.[mapping[field] || field];
  let result = String(html || '').replace(/\{\{#if\s+([A-Za-z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, field, branches) => {
    const [yes, no = ''] = branches.split('{{else}}'); return String(get(field) ?? '').trim() ? yes : no;
  });
  return result.replace(mergeTokenRegex, (token, field) => get(field) == null ? token : escapeMailHtml(get(field)));
}

export function mergeErrors(html, recipients, mapping = mailingConfig().mapping || {}) {
  const fields = [...new Set([
    ...[...String(html).matchAll(mergeTokenRegex)].map((match) => match[1]).filter((field) => field !== 'else'),
    ...[...String(html).matchAll(/\{\{#if\s+([A-Za-z0-9_]+)\}\}/g)].map((match) => match[1]),
  ])];
  return recipients.flatMap((recipient, index) => fields.filter((field) => !((mapping[field] || field) in recipient)).map((field) => `Recipient ${index + 1}: ${field}`));
}

export function labelSheetHtml(recipients, rows, columns, mapping = mailingConfig().mapping || {}) {
  const cells = Array.from({ length: rows * columns }, (_, index) => {
    const source = recipients[index] || {};
    const recipient = Object.fromEntries(['FirstName', 'LastName', 'Address', 'City', 'State', 'Zip'].map((field) => [field, source[mapping[field] || field]]));
    const name = [recipient.FirstName, recipient.LastName].filter(Boolean).join(' ');
    const lines = [name, recipient.Address, [recipient.City, recipient.State, recipient.Zip].filter(Boolean).join(' ')].filter(Boolean);
    return `<td style="border:1px solid #ccc;padding:10px;vertical-align:top;width:${100 / columns}%;height:72px;">${lines.map(escapeMailHtml).join('<br>') || '&nbsp;'}</td>`;
  });
  return `<table id="etherx-mailing-labels" style="border-collapse:collapse;width:100%;table-layout:fixed;">${Array.from({ length: rows }, (_, row) => `<tr>${cells.slice(row * columns, (row + 1) * columns).join('')}</tr>`).join('')}</table>`;
}
