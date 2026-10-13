// Renders the design's <rb-icon> custom element (defined in ribbon-icons.js).
// Names without a drawn ribbon icon fall back to the lucide icon font; the
// element reads that stylesheet from window.__rbSheet inside its shadow root,
// so seed it from the bundled lucide CSS instead of letting it fetch a CDN copy.
import 'lucide-static/font/lucide.css';
import lucideCss from 'lucide-static/font/lucide.css?inline';
import './ribbon-icons.js';

if (typeof window !== 'undefined' && !window.__rbSheet && 'adoptedStyleSheets' in Document.prototype) {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(lucideCss.replace(/@font-face\s*{[^}]*}/g, ''));
    window.__rbSheet = sheet;
  } catch { /* the element falls back to its own stylesheet link */ }
}

export function RbIcon({ name, size, style }) {
  return <rb-icon name={name} size={size} style={style} aria-hidden="true" />;
}
