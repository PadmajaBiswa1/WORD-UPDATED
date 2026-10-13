import { Node } from '@tiptap/core';

// Insert > Online Videos (YouTube, Vimeo) and Insert > 3D Models (Sketchfab): an
// embedded player as its own block. Only these providers' embed URLs are accepted,
// from the dialogs, from paste and from saved HTML, so a document cannot carry an
// iframe to any other site.
const EMBED_URL = /^https:\/\/(?:www\.youtube\.com\/embed\/[A-Za-z0-9_-]{11}|player\.vimeo\.com\/video\/\d+|sketchfab\.com\/models\/[0-9a-f]{32}\/embed)$/;

export const isEmbedUrl = (src) => EMBED_URL.test(String(src || ''));

// A Sketchfab model page or embed link as its embed URL, or null.
export function sketchfabEmbedUrl(url) {
  const id = String(url || '').match(/sketchfab\.com\/(?:3d-models\/[^/?#]*?-|models\/)([0-9a-f]{32})/)?.[1];
  return id ? `https://sketchfab.com/models/${id}/embed` : null;
}

export const MediaEmbed = Node.create({
  name: 'mediaEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return { src: { default: null, parseHTML: (element) => element.getAttribute('src') } };
  },

  parseHTML() {
    return [{ tag: 'iframe', getAttrs: (element) => (isEmbedUrl(element.getAttribute('src')) ? {} : false) }];
  },

  renderHTML({ node }) {
    if (!isEmbedUrl(node.attrs.src)) return ['div', { 'data-media-embed': 'invalid' }, 'Embedded media unavailable'];
    return ['iframe', {
      'data-media-embed': '',
      src: node.attrs.src,
      width: '100%',
      height: '360',
      frameborder: '0',
      allowfullscreen: 'true',
      allow: 'encrypted-media; picture-in-picture; fullscreen; xr-spatial-tracking',
      sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
      style: 'display:block;border:0;margin:12px 0;',
    }];
  },

  addCommands() {
    return {
      insertMediaEmbed: (src) => ({ commands }) => isEmbedUrl(src) && commands.insertContent({ type: this.name, attrs: { src } }),
    };
  },
});
