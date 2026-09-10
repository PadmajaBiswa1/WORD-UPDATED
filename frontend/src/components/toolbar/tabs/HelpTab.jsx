import { useUIStore } from '@/store';
import { Tooltip } from '@/components/ui';
import { RibbonGroup } from '../RibbonGroup';

function HeroBtn({ icon, label, onClick, title }) {
  return (
    <Tooltip text={title || label}>
      <button
        onClick={onClick}
        style={{
          border: '1px solid transparent',
          background: 'transparent',
          borderRadius: 3,
          cursor: 'pointer',
          color: 'var(--text-primary)',
          minWidth: 62,
          height: 74,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          padding: '4px 8px',
          fontFamily: 'var(--font-ui)',
          fontSize: 11,
          transition: 'background 0.1s, border-color 0.1s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: 11, lineHeight: 1.1, textAlign: 'center' }}>{label}</span>
      </button>
    </Tooltip>
  );
}

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
      <RibbonGroup label="Help & Support">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon="❓" label="Help" title="Help & Tutorials" onClick={() => openDialog('help')} />
          <HeroBtn icon="📞" label="Support" title="Contact Support" onClick={() => window.open('mailto:support@etherx.app?subject=EtherX%20Word%20Support', '_blank')} />
          <HeroBtn icon="💬" label="Feedback" title="Send Feedback" onClick={() => window.open('mailto:feedback@etherx.app?subject=EtherX%20Word%20Feedback', '_blank')} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Keyboard & Access">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon="⌨" label="Shortcuts" title="Keyboard Shortcuts Map (Ctrl+/)" onClick={() => openDialog('commandMap')} />
          <HeroBtn icon="⚙" label="Remap Keys" title="Customize Keyboard Shortcuts" onClick={() => openDialog('shortcuts')} />
          <HeroBtn icon="♿" label="Accessibility" title="Accessibility Guide & Tools" onClick={() => toast('Accessibility mode active: Full keyboard navigation supported', 'info')} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Training & Guides">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon="🎓" label="Training" title="Interactive Training & Guides" onClick={() => openDialog('whatsNew')} />
          <HeroBtn icon="🚀" label="Quick Start" title="Quick Start Walkthrough" onClick={() => openDialog('help')} />
          <HeroBtn icon="💡" label="Tips & Tricks" title="Productivity Tips & Tricks" onClick={() => toast('Tip: Press Alt to activate Ribbon Access Keys, or F7 for Spellcheck!', 'info')} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="What's New">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon="🆕" label="What's New" title="What's New in EtherX Word" onClick={() => openDialog('whatsNew')} />
          <HeroBtn icon="🗺" label="Roadmap" title="Feature Roadmap & Upcoming Updates" onClick={() => window.open('https://github.com/search?q=EtherXW&type=repositories', '_blank')} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Community">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon="👥" label="Community" title="GitHub & User Community" onClick={() => window.open('https://github.com/search?q=EtherXW&type=repositories', '_blank')} />
          <HeroBtn icon="✨" label="Suggest" title="Suggest a Feature" onClick={() => window.open('mailto:feedback@etherx.app?subject=Feature%20Suggestion', '_blank')} />
          <HeroBtn icon="🐞" label="Report Bug" title="Report an Issue or Bug" onClick={() => window.open('https://github.com/search?q=EtherXW&type=issues', '_blank')} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="About">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon="ℹ" label="About" title="About EtherX Word & Version Info" onClick={copyVersionInfo} />
          <HeroBtn icon="🔒" label="Privacy" title="Privacy Policy" onClick={() => window.open('https://etherx.app/privacy', '_blank')} />
          <HeroBtn icon="↻" label="Updates" title="Check for Updates" onClick={() => window.open('https://github.com/search?q=EtherXW&type=repositories', '_blank')} />
        </div>
      </RibbonGroup>
    </>
  );
}

