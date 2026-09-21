import { useState } from 'react';
import { useUIStore } from '@/store';
import { Modal, Button, Stack } from '@/components/ui';
import {
  Sparkles,
  Rocket,
  ListChecks,
  Bot,
  Zap,
  Cloud,
  Palette,
  MousePointer,
  GitCompare,
  Globe,
  Keyboard,
  MessageSquare,
  Gauge,
  ShieldCheck,
  History,
  Mail,
  Lightbulb,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const FEATURES = [
  {
    id: 'pragna-ai',
    title: 'Pragna AI Copilot Integration',
    icon: Bot,
    unique: 'ETHERXWORD EXCLUSIVE',
    description: 'Fully integrated Pragna AI document intelligence. Access an interactive AI chat sidebar, trigger inline drafting & edits (Alt+A), rephrase tone, generate summaries and structured tables, and research the live web with grounded citations.',
    traditional: 'Microsoft Copilot requires costly additional enterprise add-on licenses and organization lock-in',
    etherx: 'Built-in intelligent AI assistant directly in the editor canvas and sidebar with zero configuration'
  },
  {
    id: 'real-time-collab',
    title: 'Real-Time Collaboration (No Sign-Up)',
    icon: Zap,
    unique: 'ETHERXWORD EXCLUSIVE',
    description: 'Share a link and start collaborating instantly — no accounts, no sign-ups, no waiting. Perfect for teams, clients, and ad-hoc projects.',
    traditional: 'Word Online requires Microsoft accounts for all collaborators',
    etherx: 'Copy link → Share → Instant collaboration with anyone'
  },
  {
    id: 'cloud-native',
    title: 'Cloud-Native & Real-Time Sync',
    icon: Cloud,
    unique: 'ETHERXWORD EXCLUSIVE',
    description: 'Built from ground up for the cloud. Documents sync globally. No tedious uploads or downloads — just seamless real-time editing.',
    traditional: 'Local files require manual saves, syncing, and file locks',
    etherx: 'Auto-save every 3 seconds. Always up-to-date and globally synchronized'
  },
  {
    id: 'modern-ui',
    title: 'Modern, Responsive UI & Dark Mode',
    icon: Palette,
    unique: 'ETHERXWORD EXCLUSIVE',
    description: 'Fast, responsive interface that works perfectly on desktop, tablet, and mobile. Dark mode by default with distraction-free Focus view.',
    traditional: 'Heavy ribbon interface with slower canvas rendering',
    etherx: 'Lightweight, optimized for speed. Hardware-accelerated with Focus mode'
  },
  {
    id: 'live-cursors',
    title: 'Live Cursor Tracking',
    icon: MousePointer,
    unique: 'ETHERXWORD EXCLUSIVE',
    description: 'See exactly where collaborators are typing and selecting with live colored cursors and name badges. Perfect for pair-editing and remote meetings.',
    traditional: 'Limited presence visibility often causing edit collisions and confusion',
    etherx: 'Crystal-clear live cursors and selection badges for all collaborators'
  },
  {
    id: 'true-collab-track',
    title: 'True Collaborative Tracking',
    icon: GitCompare,
    unique: 'ETHERXWORD EXCLUSIVE',
    description: 'See changes live as they happen with collaborative change tracking, author attribution, and diff previews, not just post-hoc versioning.',
    traditional: 'Track Changes requires merge workflows and file swapping',
    etherx: 'Live change tracking + full version history and diff snapshots'
  },
  {
    id: 'ipfs-storage',
    title: 'Decentralized Storage (IPFS)',
    icon: Globe,
    unique: 'ETHERXWORD EXCLUSIVE',
    description: 'Pin documents to IPFS for permanent, verifiable, censorship-resistant storage. Truly own your documents and data.',
    traditional: 'Centralized proprietary cloud storage only',
    etherx: 'Hybrid architecture: fast cloud database + IPFS pinning for data ownership'
  },
  {
    id: 'keyboard-first',
    title: 'Keyboard-First Power User Support',
    icon: Keyboard,
    unique: 'BETTER THAN WORD',
    description: 'Extensive keyboard shortcut support, full keyboard navigation, Ribbon access keys, and custom shortcut remapping.',
    traditional: 'Heavy mouse dependency and rigid shortcut mappings',
    etherx: 'Full keyboard navigation, command palette (Ctrl+/), and custom shortcuts'
  },
  {
    id: 'integrated-collab',
    title: 'Integrated Comments & Feedback',
    icon: MessageSquare,
    unique: 'BETTER THAN WORD',
    description: 'Threaded comments, replies, text anchors, and resolution tracking without external tools.',
    traditional: 'Comments can clutter document layouts and get messy in complex files',
    etherx: 'Clean, threaded comment sidebar drawer with resolve status'
  },
  {
    id: 'performance',
    title: 'Lightning Fast Performance',
    icon: Gauge,
    unique: 'BETTER THAN WORD',
    description: 'Instant document loading and sub-millisecond typing responsiveness. Smooth 60fps scrolling even with massive documents.',
    traditional: 'Can lag and suffer performance drops on large or media-heavy documents',
    etherx: 'Optimized rendering pipeline with lightweight virtualized layout metrics'
  },
  {
    id: 'privacy-first',
    title: 'Privacy-First Design & Encryption',
    icon: ShieldCheck,
    unique: 'BETTER THAN WORD',
    description: 'Zero telemetry collection, client-side encryption options, and full ownership of your documents and drafts.',
    traditional: 'Microsoft collects diagnostics, telemetries, and usage metrics',
    etherx: 'Open source ethos. No tracking. Client-side security and encryption options'
  },
  {
    id: 'versioning',
    title: 'Full Version History',
    icon: History,
    unique: 'BETTER THAN WORD',
    description: 'Revert to any previous version instantly. Inspect snapshot changes and author contributions over time.',
    traditional: 'Limited version history requiring premium cloud accounts',
    etherx: 'Complete changelog and snapshots with collaborative details'
  },
  {
    id: 'merge-personalization',
    title: 'Smart Mail Merge',
    icon: Mail,
    unique: 'FEATURE PARITY',
    description: 'Mail merge with real-time field preview. Test and inspect recipient values before batch generation.',
    traditional: 'Word has mail merge but the multi-step process feels clunky and dated',
    etherx: 'Streamlined workflow with live field preview and batch output'
  }
];

const CATEGORIES = [
  { id: 'exclusive', label: 'EtherXWord Exclusive', icon: Sparkles },
  { id: 'better', label: 'Better Than Word', icon: Rocket },
  { id: 'feature-parity', label: 'Feature Parity', icon: ListChecks }
];

export function WhatsNewDialog() {
  const { closeDialog } = useUIStore();
  const [selectedCategory, setSelectedCategory] = useState('exclusive');
  
  const filteredFeatures = selectedCategory === 'exclusive' 
    ? FEATURES.filter(f => f.unique.includes('EXCLUSIVE'))
    : selectedCategory === 'better'
    ? FEATURES.filter(f => f.unique.includes('BETTER'))
    : FEATURES.filter(f => f.unique.includes('PARITY'));

  const getCategoryCount = (catId) => {
    if (catId === 'exclusive') return FEATURES.filter(f => f.unique.includes('EXCLUSIVE')).length;
    if (catId === 'better') return FEATURES.filter(f => f.unique.includes('BETTER')).length;
    return FEATURES.filter(f => f.unique.includes('PARITY')).length;
  };

  return (
    <Modal title="What's New in EtherXWord" onClose={() => closeDialog('whatsNew')} width={800}>
      <Stack gap={16}>
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '8px 16px',
                  background: isSelected ? 'var(--bg-active)' : 'transparent',
                  border: `2px solid ${isSelected ? 'var(--gold)' : 'transparent'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: isSelected ? 'var(--gold)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon size={14} strokeWidth={2} style={{ color: isSelected ? 'var(--gold)' : 'currentColor' }} />
                <span>{cat.label}</span>
                <span style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isSelected ? 'var(--gold)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--text-on-gold, #111)' : 'var(--text-muted)',
                  fontWeight: 700,
                  marginLeft: 2,
                }}>
                  {getCategoryCount(cat.id)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Feature List */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: 8 }}>
          <Stack gap={14}>
            {filteredFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.id}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'var(--transition)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--gold)';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                  }}
                >
                  {/* Feature Title Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--radius-sm, 6px)',
                        background: 'rgba(212, 175, 55, 0.12)',
                        border: '1px solid rgba(212, 175, 55, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--gold)',
                        flexShrink: 0,
                      }}>
                        <Icon size={17} strokeWidth={2} />
                      </div>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-ui)',
                      }}>
                        {feature.title}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '4px 8px',
                      background: 'var(--gold)',
                      color: 'var(--text-on-gold, #111)',
                      borderRadius: 'var(--radius-sm, 4px)',
                      fontFamily: 'var(--font-ui)',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {feature.unique}
                    </span>
                  </div>

                  {/* Description */}
                  <div style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-ui)',
                    lineHeight: '1.5',
                    marginBottom: 10,
                  }}>
                    {feature.description}
                  </div>

                  {/* Comparison */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{
                      padding: '8px 10px',
                      background: 'rgba(200, 100, 100, 0.08)',
                      borderLeft: '3px solid #c86464',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-ui)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: '#c86464', marginBottom: 4 }}>
                        <XCircle size={13} strokeWidth={2} />
                        <span>Traditional Word:</span>
                      </div>
                      {feature.traditional}
                    </div>
                    <div style={{
                      padding: '8px 10px',
                      background: 'rgba(212, 175, 55, 0.08)',
                      borderLeft: '3px solid var(--gold)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-ui)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: 'var(--gold)', marginBottom: 4 }}>
                        <CheckCircle2 size={13} strokeWidth={2} />
                        <span>EtherXWord:</span>
                      </div>
                      {feature.etherx}
                    </div>
                  </div>
                </div>
              );
            })}
          </Stack>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 14px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
          borderLeft: '4px solid var(--gold)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <Lightbulb size={18} strokeWidth={2} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>Tip:</strong> EtherXWord is designed for modern, AI-powered collaboration. Ask Pragna AI in the sidebar or start a shared document to experience the future of document editing!
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="subtle" onClick={() => closeDialog('whatsNew')}>Close</Button>
        </div>
      </Stack>
    </Modal>
  );
}
