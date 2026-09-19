import { useState } from 'react';
import { FileText, FileEdit, Globe, FileCode, BookOpen, Loader2, ArrowRight, Lock } from 'lucide-react';
import { useUIStore, useDocumentStore, useEditorStore, useSubscriptionStore } from '@/store';
import { Modal, Button, Stack } from '@/components/ui';
import { exportToHtml, exportToPdf, exportToDocx, downloadMarkdown, exportToEpub } from '@/services/export';
import { canExportFormat } from '@/utils/featureGate';

const OPTIONS = [
  { id: 'pdf',      label: 'PDF Document',         ext: '.pdf',  desc: 'Best for sharing and printing',       icon: FileText, requiredTier: 'free' },
  { id: 'docx',     label: 'Word Document',        ext: '.docx', desc: 'Editable in Microsoft Word',          icon: FileEdit, requiredTier: 'free' },
  { id: 'html',     label: 'Web Page',             ext: '.html', desc: 'Single file web page',                icon: Globe,    requiredTier: 'pro' },
  { id: 'markdown', label: 'Markdown',             ext: '.md',   desc: 'Plain text with lightweight markup',  icon: FileCode, requiredTier: 'basic' },
  { id: 'epub',     label: 'EPUB Publication',     ext: '.epub', desc: 'Electronic book format',              icon: BookOpen, requiredTier: 'pro' },
];

export function ExportDialog() {
  const { closeDialog, toast, pageSize, pageOrientation } = useUIStore();
  const { title }   = useDocumentStore();
  const { editor }  = useEditorStore();
  const { plan, openUpgradeModal } = useSubscriptionStore();
  const [loading, setLoading] = useState(null);

  const doExport = async (type) => {
    // Feature gating check
    if (!canExportFormat(plan, type)) {
      const isProOnly = ['html', 'epub'].includes(type);
      openUpgradeModal(
        `Exporting to ${type.toUpperCase()} requires an active ${isProOnly ? 'Pro' : 'Basic'} subscription.`,
        isProOnly ? 'pro' : 'basic'
      );
      return;
    }

    setLoading(type);
    try {
      const html = editor?.getHTML() || '';
      if (type === 'html') {
        exportToHtml(title, html);
      } else if (type === 'markdown' || type === 'md') {
        downloadMarkdown(title, html);
      } else if (type === 'epub') {
        await exportToEpub(title, html);
      } else if (type === 'odt') {
        await exportToDocx(title, html);
      } else if (type === 'pdf') {
        const pageSettings = {
          format: pageSize || 'a4',
          orientation: pageOrientation || 'portrait',
        };
        await exportToPdf(title, html, pageSettings);
      } else if (type === 'docx') {
        await exportToDocx(title, html);
      }
      toast(`Exported as ${type.toUpperCase()}`, 'success');
      closeDialog('exportDoc');
    } catch (err) {
      toast(`Export failed: ${err.message}`, 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal title="Export Document" onClose={() => closeDialog('exportDoc')} width={440}>
      <Stack gap={10}>
        {OPTIONS.map((opt) => {
          const isAllowed = canExportFormat(plan, opt.id);
          const badgeText = opt.requiredTier === 'pro' ? 'PRO' : opt.requiredTier === 'basic' ? 'BASIC' : null;

          return (
            <button
              key={opt.id}
              onClick={() => doExport(opt.id)}
              disabled={!!loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 16px',
                background: 'var(--bg-elevated)',
                border: isAllowed ? '1px solid var(--border)' : '1px solid #27272a',
                borderRadius: 'var(--radius-md)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading && loading !== opt.id ? 0.5 : 1,
                transition: 'var(--transition)',
                width: '100%',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = isAllowed ? 'var(--gold)' : '#c9a84c';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isAllowed ? 'var(--border)' : '#27272a';
                e.currentTarget.style.background = 'var(--bg-elevated)';
              }}
            >
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 8,
                background: isAllowed ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.04)',
                color: isAllowed ? 'var(--gold)' : '#71717a',
                flexShrink: 0,
              }}>
                <opt.icon size={20} strokeWidth={1.75} />
              </span>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: isAllowed ? 'var(--text-primary)' : 'var(--text-muted)',
                  marginBottom: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span>{loading === opt.id ? 'Exporting…' : opt.label}</span>
                  {!isAllowed && badgeText && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: badgeText === 'PRO' ? 'rgba(201,168,76,0.18)' : 'rgba(79,195,247,0.15)',
                      color: badgeText === 'PRO' ? '#c9a84c' : '#4fc3f7',
                      border: badgeText === 'PRO' ? '1px solid rgba(201,168,76,0.4)' : '1px solid rgba(79,195,247,0.3)',
                    }}>
                      {badgeText}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{opt.desc}</div>
              </div>

              <div style={{ marginLeft: 'auto', color: isAllowed ? 'var(--gold)' : '#71717a', display: 'inline-flex', alignItems: 'center' }}>
                {loading === opt.id ? (
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-flex', alignItems: 'center' }}>
                    <Loader2 size={18} />
                  </span>
                ) : !isAllowed ? (
                  <Lock size={16} color="#71717a" />
                ) : (
                  <ArrowRight size={18} />
                )}
              </div>
            </button>
          );
        })}
        <Button variant="subtle" onClick={() => closeDialog('exportDoc')} style={{ marginTop: 4 }}>Cancel</Button>
      </Stack>
    </Modal>
  );
}
