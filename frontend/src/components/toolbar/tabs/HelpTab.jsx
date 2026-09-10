import { useUIStore } from '@/store';
import { Button, Tooltip } from '@/components/ui';
import { RibbonGroup } from '../RibbonGroup';

export function HelpTab() {
  const { toast, openDialog } = useUIStore();

  const copyVersionInfo = async () => {
    const details = `EtherX Word\nBuild Date: ${new Date().toISOString()}\nUser Agent: ${navigator.userAgent}`;
    try {
      await navigator.clipboard.writeText(details);
      toast('Version info copied', 'success');
    } catch {
      toast('Clipboard blocked. Copy manually from console.', 'warning');
      console.info(details);
    }
  };

  return (
    <>
      <RibbonGroup label="Help">
        <Tooltip text="Help & Tutorials"><Button onClick={() => openDialog('help')}>? Help</Button></Tooltip>
        <Tooltip text="Keyboard Shortcuts Map"><Button onClick={() => openDialog('commandMap')}>⌨ Shortcuts</Button></Tooltip>
        <Tooltip text="Remap Keyboard Shortcuts"><Button onClick={() => openDialog('shortcuts')}>⚙ Remap Keys</Button></Tooltip>
        <Tooltip text="Contact Support"><Button onClick={() => window.open('mailto:support@etherx.app?subject=EtherX%20Word%20Support', '_blank')}>📞 Support</Button></Tooltip>
        <Tooltip text="Feedback"><Button onClick={() => window.open('mailto:feedback@etherx.app?subject=EtherX%20Word%20Feedback', '_blank')}>💬 Feedback</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Show Training">
        <Tooltip text="Show Training"><Button onClick={() => openDialog('whatsNew')}>🎓 Training</Button></Tooltip>
        <Tooltip text="What\'s New in EtherXWord"><Button onClick={() => openDialog('whatsNew')}>🆕 What\'s New</Button></Tooltip>
      </RibbonGroup>

      <RibbonGroup label="Community">
        <Tooltip text="GitHub Repository"><Button onClick={() => window.open('https://github.com/search?q=EtherXW&type=repositories', '_blank')}>👥 Community</Button></Tooltip>
        <Tooltip text="Suggest a Feature"><Button onClick={() => window.open('mailto:feedback@etherx.app?subject=Feature%20Suggestion', '_blank')}>💡 Suggest</Button></Tooltip>
      </RibbonGroup>


      <RibbonGroup label="About">
        <Tooltip text="About EtherX Word"><Button onClick={copyVersionInfo}>ℹ About</Button></Tooltip>
        <Tooltip text="Privacy Policy"><Button onClick={() => window.open('https://etherx.app/privacy', '_blank')}>🔒 Privacy</Button></Tooltip>
        <Tooltip text="Check for Updates"><Button onClick={() => window.open('https://github.com/search?q=EtherXW&type=repositories', '_blank')}>↻ Updates</Button></Tooltip>
      </RibbonGroup>
    </>
  );
}
