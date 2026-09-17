import { useUIStore, useDocumentStore, useEditorStore, useSubscriptionStore } from '@/store';
import { Modal, Button, Stack } from '@/components/ui';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

export function VersionHistoryDialog() {
  const { closeDialog, toast } = useUIStore();
  const { versions } = useDocumentStore();
  const { editor }   = useEditorStore();
  const plan = useSubscriptionStore((s) => s.plan);
  const openUpgradeModal = useSubscriptionStore((s) => s.openUpgradeModal);

  const restore = (v) => {
    editor?.commands.setContent(v.snapshot, true);
    toast(`Restored ${v.label}`, 'success');
    closeDialog('versionHistory');
  };

  const retentionText = plan === 'free'
    ? 'Free plan keeps versions for 48 hours.'
    : plan === 'basic'
      ? 'Basic plan keeps versions for 60 days.'
      : 'Pro plan includes unlimited lifetime version history.';

  return (
    <Modal title="Version History" onClose={() => closeDialog('versionHistory')} width={460}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        marginBottom: 12,
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={15} style={{ color: 'var(--text-gold)', flexShrink: 0 }} />
          <span>{retentionText}</span>
        </div>
        {plan !== 'pro' && (
          <button
            type="button"
            onClick={() => {
              closeDialog('versionHistory');
              openUpgradeModal('Unlock unlimited version history and restore points on EtherX Pro.', 'pro');
            }}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 8px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginLeft: 8,
            }}
          >
            Upgrade
          </button>
        )}
      </div>

      {versions.length === 0 ? (
        <div style={{ textAlign:'center', padding:'36px 20px', color:'var(--text-muted)', fontFamily:'var(--font-ui)', fontSize:13 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>⏱</div>
          <div>No saved versions yet.</div>
          <div style={{ fontSize:11, marginTop:6 }}>Versions auto-save every 5 minutes.</div>
        </div>
      ) : (
        <Stack gap={8}>
          {versions.map((v) => (
            <div key={v.id} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 14px', background:'var(--bg-elevated)',
              border:'1px solid var(--border)', borderRadius:'var(--radius-md)',
            }}>
              <div>
                <div style={{ fontFamily:'var(--font-ui)', fontWeight:600, fontSize:13, color:'var(--text-primary)', marginBottom:2 }}>{v.label}</div>
                <div style={{ fontFamily:'var(--font-ui)', fontSize:11, color:'var(--text-muted)' }}>
                  {format(new Date(v.savedAt), 'MMM d, yyyy · h:mm a')}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => restore(v)}>Restore</Button>
            </div>
          ))}
        </Stack>
      )}
    </Modal>
  );
}
