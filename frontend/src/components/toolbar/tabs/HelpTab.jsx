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

  const col = { display: 'flex', flexDirection: 'column', flexWrap: 'wrap', maxHeight: 82, height: 82, gap: 2, alignContent: 'flex-start' };
  const hbtn = { height: 25, display: 'inline-flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap', fontSize: 11, padding: '0 6px' };

  return (
    <>
      <RibbonGroup label="Help">
        <div style={col}>
          <Tooltip text="Help & Tutorials"><Button style={hbtn} onClick={() => openDialog('help')}>? Help</Button></Tooltip>
          <Tooltip text="Keyboard Shortcuts Map"><Button style={hbtn} onClick={() => openDialog('commandMap')}>⌨ Shortcuts</Button></Tooltip>
          <Tooltip text="Remap Keyboard Shortcuts"><Button style={hbtn} onClick={() => openDialog('shortcuts')}>⚙ Remap Keys</Button></Tooltip>
          <Tooltip text="Contact Support"><Button style={hbtn} onClick={() => window.open('mailto:support@etherx.app?subject=EtherX%20Word%20Support', '_blank')}>📞 Support</Button></Tooltip>
          <Tooltip text="Feedback"><Button style={hbtn} onClick={() => window.open('mailto:feedback@etherx.app?subject=EtherX%20Word%20Feedback', '_blank')}>💬 Feedback</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Show Training">
        <div style={col}>
          <Tooltip text="Show Training"><Button style={hbtn} onClick={() => openDialog('whatsNew')}>🎓 Training</Button></Tooltip>
          <Tooltip text="What's New in EtherXWord"><Button style={hbtn} onClick={() => openDialog('whatsNew')}>🆕 What's New</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Community">
        <div style={col}>
          <Tooltip text="GitHub Repository"><Button style={hbtn} onClick={() => window.open('https://github.com/search?q=EtherXW&type=repositories', '_blank')}>👥 Community</Button></Tooltip>
          <Tooltip text="Suggest a Feature"><Button style={hbtn} onClick={() => window.open('mailto:feedback@etherx.app?subject=Feature%20Suggestion', '_blank')}>💡 Suggest</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="About">
        <div style={col}>
          <Tooltip text="About EtherX Word"><Button style={hbtn} onClick={copyVersionInfo}>ℹ About</Button></Tooltip>
          <Tooltip text="Privacy Policy"><Button style={hbtn} onClick={() => window.open('https://etherx.app/privacy', '_blank')}>🔒 Privacy</Button></Tooltip>
          <Tooltip text="Check for Updates"><Button style={hbtn} onClick={() => window.open('https://github.com/search?q=EtherXW&type=repositories', '_blank')}>↻ Updates</Button></Tooltip>
        </div>
      </RibbonGroup>
    </>
  );
}

