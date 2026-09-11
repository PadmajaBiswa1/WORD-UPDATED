function getEditorRoot(editor) {
  if (editor?.view?.dom) return editor.view.dom;
  if (typeof document === 'undefined') return null;
  return document.querySelector('.ProseMirror');
}

export function isImageSelection(editor) {
  return Boolean(
    editor?.state?.selection?.node?.type?.name === 'image'
    || editor?.isActive?.('image')
  );
}

export function getSelectedImageElement(editor) {
  const selection = editor?.state?.selection;
  const selectedNode = selection?.node;

  if (selectedNode?.type?.name === 'image' && editor?.view?.nodeDOM) {
    const domNode = editor.view.nodeDOM(selection.from);
    if (domNode?.tagName === 'IMG') return domNode;
    const nestedImage = domNode?.querySelector?.('img');
    if (nestedImage) return nestedImage;
  }

  const root = getEditorRoot(editor);
  if (!root) return null;

  return root.querySelector('img.ProseMirror-selectednode')
    || root.querySelector('.ProseMirror-selectednode img')
    || (typeof document !== 'undefined'
      ? document.querySelector('.ProseMirror img.ProseMirror-selectednode, .ProseMirror .ProseMirror-selectednode img')
      : null);
}

export function isInsideSelectedImage(target, editor) {
  const image = getSelectedImageElement(editor);
  return Boolean(image && target && image.contains(target));
}

export function parseCssStyle(style = '') {
  const out = {};
  style.split(';').forEach((pair) => {
    const [k, v] = pair.split(':').map((s) => s?.trim());
    if (k && v) out[k] = v;
  });
  return out;
}

export function toCssStyle(obj = {}) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}
