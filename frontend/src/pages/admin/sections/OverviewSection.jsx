import { useState, useEffect } from 'react';
import {
  Users, HardDrive, Sparkles, Shield, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, UserPlus, RefreshCw, Key
} from 'lucide-react';
import { adminApi } from '@/services/adminApi';

export function OverviewSection({ onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getOverview();
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div style={styles.loaderWrap}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#d4af37' }} />
        <span style={{ color: '#8e9aa8', fontSize: 14 }}>Loading organization overview…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorCard}>
        <AlertTriangle size={20} color="#d4af37" />
        <span>Failed to load overview: {error}</span>
        <button style={styles.retryBtn} onClick={fetchOverview}>Retry</button>
      </div>
    );
  }

  const { organization, kpis, securityStatus, recentAuditLogs, isOwner } = data || {};

  return (
    <div style={styles.container}>
      {/* Organization Header Banner */}
      <div style={styles.banner}>
        <div style={styles.bannerLeft}>
          <div style={styles.orgBadge}>PRO ORGANIZATION</div>
          <h1 style={styles.orgTitle}>{organization?.name || 'EtherX Global Technologies'}</h1>
          <p style={styles.orgMeta}>
            Domain: <strong style={{ color: '#d4af37' }}>{organization?.domain}</strong> • Seats: <strong>{organization?.seatsUsed}</strong> / {organization?.seatsTotal} Assigned • Renewal in <strong>{organization?.daysUntilRenewal} days</strong>
          </p>
        </div>
        <div style={styles.bannerActions}>
          <button style={styles.primaryActionBtn} onClick={() => onNavigateTab('users')}>
            <UserPlus size={16} />
            <span>Invite Members</span>
          </button>
          <button style={styles.secondaryActionBtn} onClick={() => onNavigateTab('subscription')}>
            <Key size={16} />
            <span>Manage Seats</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={styles.kpiGrid}>
        {/* Total Members */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTop}>
            <span style={styles.kpiLabel}>ORGANIZATION MEMBERS</span>
            <div style={{ ...styles.kpiIconWrap, background: 'rgba(212,175,55,0.15)', color: '#d4af37' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={styles.kpiValue}>{kpis?.totalMembers || 0}</div>
          <div style={styles.kpiSub}>
            <span style={{ color: '#d4af37', fontWeight: 600 }}>{kpis?.activeMembers} Active</span> • {kpis?.deactivatedMembers} Deactivated
          </div>
        </div>

        {/* Daily Active Users */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTop}>
            <span style={styles.kpiLabel}>ACTIVE USERS (DAU / MAU)</span>
            <div style={{ ...styles.kpiIconWrap, background: 'rgba(212,175,55,0.15)', color: '#d4af37' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={styles.kpiValue}>{kpis?.dau || 0} <span style={{ fontSize: 16, color: '#8e9aa8', fontWeight: 400 }}>/ {kpis?.mau || 0}</span></div>
          <div style={styles.kpiSub}>
            <span style={{ color: '#d4af37' }}>{Math.round(((kpis?.dau || 1) / (kpis?.totalMembers || 1)) * 100)}% engagement rate</span>
          </div>
        </div>

        {/* Storage Consumed */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTop}>
            <span style={styles.kpiLabel}>CLOUD STORAGE USED</span>
            <div style={{ ...styles.kpiIconWrap, background: 'rgba(212,175,55,0.15)', color: '#d4af37' }}>
              <HardDrive size={18} />
            </div>
          </div>
          <div style={styles.kpiValue}>{kpis?.storageUsedDisplay || '0 GB'}</div>
          <div style={styles.kpiSub}>
            <span style={{ color: '#d4af37' }}>Pro Tier: Unlimited Storage</span>
          </div>
        </div>

        {/* AI Credits Consumed */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTop}>
            <span style={styles.kpiLabel}>PRAGNA AI CREDITS</span>
            <div style={{ ...styles.kpiIconWrap, background: 'rgba(212,175,55,0.15)', color: '#d4af37' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div style={styles.kpiValue}>
            {kpis?.aiCreditsUsed?.toLocaleString()} <span style={{ fontSize: 14, color: '#8e9aa8', fontWeight: 400 }}>/ {kpis?.aiCreditsLimit?.toLocaleString()}</span>
          </div>
          <div style={styles.kpiSub}>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressBar, width: `${kpis?.aiCreditsPercent || 20}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Split Section: Quick Activity Feed & Security Posture */}
      <div style={styles.splitGrid}>
        {/* Recent Audit Logs */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="#d4af37" />
              <h3 style={styles.panelTitle}>Recent Administrative Activity</h3>
            </div>
            <button style={styles.linkBtn} onClick={() => onNavigateTab('security')}>
              <span>View All Logs</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div style={styles.logList}>
            {(recentAuditLogs || []).map((log) => (
              <div key={log.id} style={styles.logItem}>
                <div style={styles.logDot} />
                <div style={styles.logContent}>
                  <div style={styles.logHeaderLine}>
                    <strong style={{ color: '#f3f4f6', fontSize: 13 }}>{log.action.replace(/_/g, ' ')}</strong>
                    <span style={styles.logTime}>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={styles.logDetail}>
                    Performed by <strong style={{ color: '#d4af37' }}>{log.actor?.name}</strong> ({log.actor?.role})
                    {log.target?.name ? ` on ${log.target.name}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security & Organization Status */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} color="#d4af37" />
              <h3 style={styles.panelTitle}>Security & Access Posture</h3>
            </div>
            <button style={styles.linkBtn} onClick={() => onNavigateTab('security')}>
              <span>Configure</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={styles.statusList}>
            <div style={styles.statusRow}>
              <div>
                <div style={styles.statusTitle}>Two-Factor Authentication (2FA)</div>
                <div style={styles.statusDesc}>Mandatory verification for all org members</div>
              </div>
              <span style={securityStatus?.enforce2FA ? styles.badgeActive : styles.badgeInactive}>
                {securityStatus?.enforce2FA ? 'ENFORCED' : 'OPTIONAL'}
              </span>
            </div>

            <div style={styles.statusRow}>
              <div>
                <div style={styles.statusTitle}>Single Sign-On (SSO)</div>
                <div style={styles.statusDesc}>SAML 2.0 / Okta / Google Workspace gateway</div>
              </div>
              <span style={securityStatus?.enforceSSO ? styles.badgeActive : styles.badgeInactive}>
                {securityStatus?.enforceSSO ? 'ACTIVE' : 'NOT CONFIGURED'}
              </span>
            </div>

            <div style={styles.statusRow}>
              <div>
                <div style={styles.statusTitle}>Org External Link-Sharing</div>
                <div style={styles.statusDesc}>Allows documents to generate public view links</div>
              </div>
              <span style={securityStatus?.allowExternalSharing ? styles.badgeActive : styles.badgeDanger}>
                {securityStatus?.allowExternalSharing ? 'ALLOWED' : 'RESTRICTED'}
              </span>
            </div>

            <div style={styles.statusRow}>
              <div>
                <div style={styles.statusTitle}>IP Allowlisting</div>
                <div style={styles.statusDesc}>Restricts admin logins to authorized CIDR ranges</div>
              </div>
              <span style={styles.badgeNeutral}>
                {securityStatus?.ipAllowlistCount || 0} CIDR Ranges
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  loaderWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 12,
  },
  errorCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(212,175,55,0.1)',
    border: '1px solid rgba(212,175,55,0.3)',
    color: '#d4af37',
    padding: 16,
    borderRadius: 8,
  },
  retryBtn: {
    marginLeft: 'auto',
    background: 'linear-gradient(135deg, #d4af37 0%, #aa8528 100%)',
    color: '#0b0d11',
    fontWeight: 600,
    border: 'none',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 12,
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 28px',
    background: 'linear-gradient(135deg, #131720 0%, #1a202c 100%)',
    border: '1px solid rgba(212,175,55,0.25)',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  bannerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  orgBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#d4af37',
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.3)',
    padding: '3px 9px',
    borderRadius: 99,
  },
  orgTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: '#f9fafb',
    letterSpacing: '-0.01em',
  },
  orgMeta: {
    margin: 0,
    fontSize: 13,
    color: '#9ca3af',
  },
  bannerActions: {
    display: 'flex',
    gap: 12,
  },
  primaryActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'linear-gradient(135deg, #d4af37 0%, #aa8528 100%)',
    color: '#0b0d11',
    border: 'none',
    fontWeight: 600,
    fontSize: 13,
    padding: '10px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(212,175,55,0.3)',
  },
  secondaryActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255,255,255,0.06)',
    color: '#e5e7eb',
    border: '1px solid rgba(255,255,255,0.12)',
    fontWeight: 500,
    fontSize: 13,
    padding: '10px 16px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: 16,
  },
  kpiCard: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  kpiTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#9ca3af',
  },
  kpiIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f9fafb',
    letterSpacing: '-0.02em',
  },
  kpiSub: {
    fontSize: 12,
    color: '#9ca3af',
  },
  progressTrack: {
    height: 6,
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #d4af37 0%, #c9a84c 100%)',
    borderRadius: 4,
  },
  splitGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
  },
  panel: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  panelTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#f3f4f6',
  },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: '#d4af37',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  logList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  logItem: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#d4af37',
    marginTop: 6,
    flexShrink: 0,
    boxShadow: '0 0 6px rgba(212,175,55,0.5)',
  },
  logContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  logHeaderLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logTime: {
    fontSize: 11,
    color: '#6b7280',
  },
  logDetail: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statusList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.04)',
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#f3f4f6',
  },
  statusDesc: {
    fontSize: 11,
    color: '#8e9aa8',
  },
  badgeActive: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#d4af37',
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.3)',
    padding: '3px 8px',
    borderRadius: 4,
  },
  badgeInactive: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#d4af37',
    background: 'rgba(212,175,55,0.06)',
    border: '1px solid rgba(212,175,55,0.18)',
    padding: '3px 8px',
    borderRadius: 4,
  },
  badgeDanger: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#d4af37',
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.3)',
    padding: '3px 8px',
    borderRadius: 4,
  },
  badgeNeutral: {
    fontSize: 10,
    fontWeight: 600,
    color: '#d4af37',
    background: 'rgba(212,175,55,0.08)',
    border: '1px solid rgba(212,175,55,0.2)',
    padding: '3px 8px',
    borderRadius: 4,
  },
};
