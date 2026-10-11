// Pending Pragna suggestions shown as if accepted, for exports that have no tracked changes.
export function acceptSuggestionsInHtml(html = '') {
  if (!html || !/data-suggestion|data-comment-id/.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.body.querySelectorAll('del[data-suggestion]').forEach((el) => el.remove());
  doc.body.querySelectorAll('ins[data-suggestion], span[data-comment-id]').forEach((el) => el.replaceWith(...el.childNodes));
  return doc.body.innerHTML;
}
