import { useState } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Stack, Input } from '@/components/ui';

const SUPPORTED_PROVIDERS = [
  { name: 'YouTube', pattern: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/, embed: (id) => `https://www.youtube.com/embed/${id}` },
  { name: 'Vimeo', pattern: /vimeo\.com\/(\d+)/, embed: (id) => `https://player.vimeo.com/video/${id}` },
];

function extractVideoId(url) {
  for (const provider of SUPPORTED_PROVIDERS) {
    const match = url.match(provider.pattern);
    if (match) {
      return { provider: provider.name, id: match[1], embedUrl: provider.embed(match[1]) };
    }
  }
  return null;
}

export function InsertVideoDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInsert = async () => {
    if (!url.trim()) {
      toast('Please enter a video URL', 'warning');
      return;
    }

    const video = extractVideoId(url);
    if (!video) {
      toast('Unsupported video URL. Use YouTube or Vimeo links.', 'error');
      return;
    }

    if (!editor) {
      toast('Editor is not ready', 'error');
      return;
    }

    setLoading(true);
    try {
      const html = `<div style="margin:12px 0;border:1px solid #ddd;border-radius:4px;overflow:hidden;background:#000;">
        <iframe width="100%" height="400" src="${video.embedUrl}" frameborder="0" allowfullscreen style="display:block;"></iframe>
        <div style="padding:8px;background:#f5f5f5;font-size:12px;color:#666;">${video.provider} video</div>
      </div>`;
      
      editor.chain().focus().insertContent(html).run();
      toast(`${video.provider} video inserted successfully`, 'success');
      closeDialog('insertVideo');
      setUrl('');
    } catch (err) {
      toast(`Failed to insert video: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Insert Online Video" onClose={() => closeDialog('insertVideo')} width={400}>
      <Stack gap={12}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
            Video URL
          </label>
          <Input
            placeholder="https://youtube.com/watch?v=dQw4w9WgXcQ"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Supported: YouTube, Vimeo
          </div>
        </div>

        <Stack gap={8} direction="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('insertVideo')} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={loading || !url.trim()}>
            {loading ? 'Inserting…' : 'Insert'}
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
