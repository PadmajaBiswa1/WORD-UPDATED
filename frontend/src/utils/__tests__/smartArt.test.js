import { describe, it, expect } from 'vitest';
import { renderSmartArt, parseItems, SMARTART_LAYOUTS } from '@/utils/smartArt';

describe('SmartArt', () => {
  it('reads hierarchy levels from indentation or dashes', () => {
    expect(parseItems('Boss\n  Ann\n- Bob\nPeer')).toEqual([
      { text: 'Boss', child: false }, { text: 'Ann', child: true }, { text: 'Bob', child: true }, { text: 'Peer', child: false },
    ]);
  });

  it('renders every layout as well-formed SVG with the items', () => {
    SMARTART_LAYOUTS.forEach(({ id }) => {
      const svg = renderSmartArt(id, 'One\n  Two & <three>\nFour', 'blue');
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(doc.querySelector('parsererror')).toBe(null);
      expect(svg).toContain('&amp;');
      expect(svg).toContain('&lt;three&gt;');
      expect(svg).not.toContain('<three>');
    });
  });
});
