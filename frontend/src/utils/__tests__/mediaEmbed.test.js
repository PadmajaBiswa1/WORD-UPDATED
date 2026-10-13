import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MediaEmbed, sketchfabEmbedUrl } from '@/components/editor/MediaEmbed';

const editors = [];
const setup = (content = '<p></p>') => {
  const editor = new Editor({ extensions: [StarterKit, MediaEmbed], content });
  editors.push(editor);
  return editor;
};
afterEach(() => { while (editors.length) editors.pop().destroy(); });

describe('MediaEmbed', () => {
  it('inserts a YouTube player block', () => {
    const editor = setup();
    expect(editor.commands.insertMediaEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
    expect(editor.getHTML()).toContain('<iframe data-media-embed="" src="https://www.youtube.com/embed/dQw4w9WgXcQ"');
  });

  it('refuses embeds from other sites', () => {
    const editor = setup();
    expect(editor.commands.insertMediaEmbed('https://evil.example/embed')).toBe(false);
    expect(editor.getHTML()).not.toContain('iframe');
  });

  it('keeps saved videos and drops other iframes when loading HTML', () => {
    const editor = setup('<iframe src="https://player.vimeo.com/video/123"></iframe><iframe src="javascript:alert(1)"></iframe><p>x</p>');
    const html = editor.getHTML();
    expect(html).toContain('src="https://player.vimeo.com/video/123"');
    expect(html).not.toContain('javascript:');
  });

  it('embeds a Sketchfab model from its page link', () => {
    const editor = setup();
    const src = sketchfabEmbedUrl('https://sketchfab.com/3d-models/old-chair-0123456789abcdef0123456789abcdef');
    expect(src).toBe('https://sketchfab.com/models/0123456789abcdef0123456789abcdef/embed');
    expect(editor.commands.insertMediaEmbed(src)).toBe(true);
    expect(sketchfabEmbedUrl('https://example.com/model.glb')).toBe(null);
  });
});
