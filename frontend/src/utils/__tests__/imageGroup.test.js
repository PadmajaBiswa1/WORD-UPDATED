import { describe, it, expect } from 'vitest';
import { buildGroupSvg, parseGroup, isGroupSrc } from '@/utils/imageGroup';

const sq = (c) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><rect width="60" height="40" fill="${c}"/></svg>`);
const node = (src, width, alt) => ({ node: { attrs: { src, width, alt } } });

describe('picture groups', () => {
  it('round-trips the grouped pictures exactly', async () => {
    const { src, width } = await buildGroupSvg([node(sq('red'), '120', 'Red "box"'), node(sq('blue'), '90', 'Blue')]);
    expect(isGroupSrc(src)).toBe(true);
    expect(width).toBe(120 + 8 + 90);
    expect(parseGroup(src)).toEqual([
      { src: sq('red'), width: '120', alt: 'Red "box"' },
      { src: sq('blue'), width: '90', alt: 'Blue' },
    ]);
    expect(isGroupSrc(sq('red'))).toBe(false);
  });
});
