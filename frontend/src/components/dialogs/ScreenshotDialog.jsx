import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Stack } from '@/components/ui';

export function ScreenshotDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();

  const handleScreenshot = async () => {
    try {
      // Check if browser supports the Screenshot API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast('Screenshot capture not supported in this browser', 'error');
        return;
      }

      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' },
        audio: false
      });

      // Get the first video track
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      // Wait for video to load
      await new Promise(resolve => {
        video.onloadedmetadata = () => resolve();
        setTimeout(resolve, 1000);
      });

      // Capture to canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      // Stop the stream
      stream.getTracks().forEach(track => track.stop());

      // Convert to blob and insert
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target.result;
          if (editor) {
            editor.chain().focus().insertContent(`<img src="${dataUrl}" style="max-width:100%;height:auto;border:1px solid #ddd;border-radius:4px;"/>`).run();
            toast('Screenshot inserted', 'success');
            closeDialog('screenshot');
          }
        };
        reader.readAsDataURL(blob);
      }, 'image/png');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        toast('Screenshot permission denied', 'info');
      } else if (err.name === 'NotSupportedError') {
        toast('Screenshot capture not supported', 'error');
      } else {
        toast(`Screenshot failed: ${err.message}`, 'error');
      }
      closeDialog('screenshot');
    }
  };

  return (
    <Modal title="Screenshot" onClose={() => closeDialog('screenshot')} width={400}>
      <Stack gap={16}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>
            Click below to capture a screenshot of your screen or window.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            You'll be asked to select which screen or window to capture.
          </div>
        </div>

        <Stack gap={8} direction="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('screenshot')}>
            Cancel
          </Button>
          <Button onClick={handleScreenshot}>
            Capture Screenshot
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
