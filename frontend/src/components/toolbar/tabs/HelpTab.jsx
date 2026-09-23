import { useUIStore } from '@/store';
import { HelpCircle, Keyboard, Sparkles } from 'lucide-react';
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
        <div style={{ fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: 11, lineHeight: 1.1, textAlign: 'center' }}>{label}</span>
      </button>
    </Tooltip>
  );
}

export function HelpTab() {
  const { openDialog } = useUIStore();

  return (
    <>
      <RibbonGroup label="Help">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn
            icon={<HelpCircle size={20} strokeWidth={1.75} />}
            label="Help"
            title="Help & Tutorials"
            onClick={() => openDialog('help')}
          />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Shortcuts">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn
            icon={<Keyboard size={20} strokeWidth={1.75} />}
            label="Shortcuts"
            title="Keyboard Shortcuts Map (Ctrl+/)"
            onClick={() => openDialog('commandMap')}
          />
        </div>
      </RibbonGroup>

      <RibbonGroup label="What's New">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn
            icon={<Sparkles size={20} strokeWidth={1.75} />}
            label="What's New"
            title="What's New in EtherX Word"
            onClick={() => openDialog('whatsNew')}
          />
        </div>
      </RibbonGroup>
    </>
  );
}

