import { useState } from 'react';
import { useUIStore } from '@/store';
import { Modal, Button } from '@/components/ui';

const step = { margin: '4px 0 0 18px', padding: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)' };

// Help > Get Mobile App. EtherX Word installs as an app (PWA) on phones, tablets
// and desktops; this explains how and sends the link to the phone.
export function MobileAppDialog() {
  const { closeDialog, toast } = useUIStore();
  const [prompt, setPrompt] = useState(() => window.__etherxInstallPrompt || null);
  const link = window.location.origin;
  const close = () => closeDialog('mobileApp');

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
    window.__etherxInstallPrompt = null;
    setPrompt(null);
    toast(outcome === 'accepted' ? 'EtherX Word installed' : 'Install cancelled', 'info');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copied', 'success'); } catch { toast(link, 'info'); }
  };

  return (
    <Modal title="Get the EtherX Word app" onClose={close} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-ui)' }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          EtherX Word installs straight from your browser as an app, with its own icon, and your documents stay in sync.
        </div>
        {prompt && <Button variant="primary" onClick={install}>Install on this device</Button>}
        <div>
          <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>iPhone or iPad</strong>
          <ol style={step}><li>Open {link} in Safari.</li><li>Tap Share, then Add to Home Screen.</li></ol>
        </div>
        <div>
          <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Android</strong>
          <ol style={step}><li>Open {link} in Chrome.</li><li>Tap the ⋮ menu, then Install app.</li></ol>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={copy}>Copy link</Button>
          <Button onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent('EtherX Word')}&body=${encodeURIComponent(`Open this on your phone to install EtherX Word: ${link}`)}`; }}>Email link</Button>
          <Button variant="primary" onClick={close}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
