import { useState } from 'react';
import { FileText, FileEdit, Globe, FileCode, BookOpen, Loader2, ArrowRight, Lock } from 'lucide-react';
import { useUIStore, useDocumentStore, useEditorStore, useSubscriptionStore } from '@/store';
import { Modal, Button, Stack } from '@/components/ui';
import { exportToHtml, exportToPdf, exportToDocx, exportToMarkdown, exportToEpub } from '@/services/export';
import { canExportFormat } from '@/utils/featureGate';

const OPTIONS = [
  { id: 'pdf',      icon: FileText, label: 'PDF Document',        desc: 'Best for printing & sharing', requiredTier: 'free' },
  { id: 'docx',     icon: FileEdit, label: 'Word Document',       desc: 'Open in Microsoft Word',      requiredTier: 'free' },
  { id: 'markdown', icon: FileCode, label: 'Markdown (.md)',      desc: 'Plain text with markdown formatting', requiredTier: 'basic' },
  { id: 'odt',      icon: FileEdit, label: 'OpenDocument (.odt)', desc: 'Open in LibreOffice / OpenOffice',    requiredTier: 'basic' },
  { id: 'html',     icon: Globe,    label: 'Web Page (.html)',    desc: 'HTML file for browsers',      requiredTier: 'pro' },
  { id: 'epub',     icon: BookOpen, label: 'EPUB eBook (.epub)',  desc: 'Standard e-book reader format', requiredTier: 'pro' },
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
      if (type === 'html') exportToHtml(title, html);
      else if (type === 'markdown' || type === 'md') {
        exportToMarkdown(title, html);
      } else if (type === 'epub') {
        await exportToEpub(title, html);
      } else if (type === 'odt') {
        // Fallback for ODT: exports as HTML/DOCX styled blob or docx
        await exportToDocx(title, html);
      } else if (type === 'pdf') {
        const el = document.getElementById('document-page-0') ||
                   document.querySelector('.page') ||
                   document.querySelector('.document-page') ||
                   document.querySelector('.ProseMirror') ||
                   document.querySelector('.document-editor');
        const pageSettings = {
          format: pageSize || 'a4',
          orientation: pageOrientation || 'portrait',
        };
        if (el) {
          await exportToPdf(title, el, pageSettings);
        } else {
          const frame = document.createElement('div');
          frame.style.position = 'fixed';
          frame.style.left = '-10000px';
          frame.style.top = '0';
          frame.style.width = '794px';
          frame.style.background = '#ffffff';
          frame.style.padding = '40px';
          frame.innerHTML = html || '<p></p>';
          document.body.appendChild(frame);
          try {
            await exportToPdf(title, frame, pageSettings);
          } finally {
            frame.remove();
          }
        }
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
