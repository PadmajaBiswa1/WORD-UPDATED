import { useState, useEffect } from 'react';
import {
  ShieldCheck, Lock, Globe, Key, Search, Download,
  CheckCircle2, Plus, Trash2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { adminApi, getStoredUser } from '@/services/adminApi';

const ACTION_LABELS = {
  USER_ROLE_CHANGED: 'Role Updated',
  USER_INVITED: 'Member Invited',
  USER_STATUS_CHANGED: 'Status Modified',
  USER_REMOVED: 'Member Removed',
  ORGANIZATION_SETTINGS_UPDATED: 'Settings Updated',
  SECURITY_SETTINGS_UPDATED: 'Security Policy Changed',
  RENEWAL_REMINDER_SENT: 'Renewal Notice Dispatched',
  DOCUMENT_SHARING_REVOKED: 'Doc Sharing Revoked',
  ORG_INITIALIZED: 'Organization Initialized',
};

export function SecuritySection() {
  const currentUser = getStoredUser();
  const isOwner = currentUser?.role === 'Owner';

  const [settings, setSettings] = useState({
    enforce2FA: false,
    enforceSSO: false,
    ipAllowlist: [],
  });
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logSearch, setLogSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [newIp, setNewIp] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const [settingsRes, logsRes] = await Promise.all([
        adminApi.getSecuritySettings(),
        adminApi.getAuditLogs({ search: logSearch, action: actionFilter }),
      ]);
      setSettings(settingsRes.settings || {});
      setLogs(logsRes.logs || []);
      setTotalLogs(logsRes.total || 0);
    } catch (err) {
      console.error('Fetch security data failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, [logSearch, actionFilter]);

  const showToast = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4500);
  };

  const handleTogglePolicy = async (key) => {
    const nextVal = !settings[key];
    setBusy(true);
    try {
      await adminApi.updateSecuritySettings({ [key]: nextVal });
      setSettings((prev) => ({ ...prev, [key]: nextVal }));
      showToast(`${key === 'enforce2FA' ? 'Two-Factor Authentication' : 'Single Sign-On'} policy updated.`);
      fetchSecurityData();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAddIp = async (e) => {
    e.preventDefault();
    const candidate = newIp.trim();
    if (!candidate) return;

    const list = [...(settings.ipAllowlist || []), candidate];
    setBusy(true);
    try {
      await adminApi.updateSecuritySettings({ ipAllowlist: list });
      setSettings((prev) => ({ ...prev, ipAllowlist: list }));
      setNewIp('');
      showToast(`Added ${candidate} to IP allowlist.`);
      fetchSecurityData();
    } catch (err) {
      alert(`IP update failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveIp = async (ipToRemove) => {
    const list = (settings.ipAllowlist || []).filter((ip) => ip !== ipToRemove);
    setBusy(true);
    try {
      await adminApi.updateSecuritySettings({ ipAllowlist: list });
      setSettings((prev) => ({ ...prev, ipAllowlist: list }));
      showToast(`Removed ${ipToRemove} from IP allowlist.`);
      fetchSecurityData();
    } catch (err) {
      alert(`IP update failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleExportLogsCSV = () => {
    if (logs.length === 0) return;

    let csv = 'Timestamp,Actor Name,Actor Email,Actor Role,Action,Target Name,Target Type,Details,IP Address\n';
    logs.forEach((l) => {
      const detailsStr = JSON.stringify(l.details || {}).replace(/"/g, '""');
      csv += `"${l.createdAt}","${l.actor?.name}","${l.actor?.email}","${l.actor?.role}","${l.action}","${l.target?.name}","${l.target?.type}","${detailsStr}","${l.ipAddress}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etherx-org-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div style={styles.container}>
      {notice && (
        <div style={styles.toast}>
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* Security Policies Grid */}
      <div style={styles.policyGrid}>
        {/* 2FA Enforcement Card */}
        <div style={styles.policyCard}>
          <div style={styles.policyHeader}>
            <div style={styles.policyIcon}>
              <Key size={18} color="#d4af37" />
            </div>
            <div>
              <h3 style={styles.policyTitle}>Two-Factor Authentication (2FA)</h3>
              <p style={styles.policyDesc}>Enforce time-based OTP or hardware key verification for all team members</p>
            </div>
          </div>
          <div style={styles.cardFooter}>
            <span style={settings.enforce2FA ? styles.statusBadgeActive : styles.statusBadgeInactive}>
              {settings.enforce2FA ? 'ENFORCED' : 'OPTIONAL'}
            </span>
            <button
              style={{
                ...styles.switchBtn,
                background: settings.enforce2FA ? '#10b981' : '#374151',
              }}
              onClick={() => handleTogglePolicy('enforce2FA')}
              disabled={busy}
            >
              <span
                style={{
                  ...styles.switchThumb,
                  transform: settings.enforce2FA ? 'translateX(20px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        </div>

        {/* SSO Enforcement Card */}
        <div style={styles.policyCard}>
          <div style={styles.policyHeader}>
            <div style={styles.policyIcon}>
              <Lock size={18} color="#d4af37" />
            </div>
            <div>
              <h3 style={styles.policyTitle}>Enterprise Single Sign-On (SSO)</h3>
              <p style={styles.policyDesc}>Require SAML 2.0 / Okta / Azure AD authentication for organization logins</p>
            </div>
          </div>
          <div style={styles.cardFooter}>
            <span style={settings.enforceSSO ? styles.statusBadgeActive : styles.statusBadgeInactive}>
              {settings.enforceSSO ? 'ENFORCED' : 'DISABLED'}
            </span>
            <button
              style={{
                ...styles.switchBtn,
                background: settings.enforceSSO ? '#10b981' : '#374151',
              }}
              onClick={() => handleTogglePolicy('enforceSSO')}
              disabled={busy}
            >
              <span
                style={{
                  ...styles.switchThumb,
                  transform: settings.enforceSSO ? 'translateX(20px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* IP Allowlist Governance Card */}
      <div style={styles.allowlistCard}>
        <div style={styles.allowlistHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={18} color="#d4af37" />
            <h3 style={styles.policyTitle}>IP Address & CIDR Allowlisting</h3>
          </div>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            Restricts admin and document operations to specified corporate IP addresses
          </span>
        </div>

        <form onSubmit={handleAddIp} style={styles.ipForm}>
          <input
            style={styles.ipInput}
            type="text"
            placeholder="e.g. 192.168.1.0/24 or 203.0.113.45"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
          />
          <button type="submit" style={styles.addIpBtn} disabled={busy || !newIp.trim()}>
            <Plus size={15} />
            <span>Add CIDR / IP</span>
          </button>
        </form>

        <div style={styles.ipBadgeWrap}>
          {(settings.ipAllowlist || []).length === 0 ? (
            <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
              No IP restrictions configured. All IP addresses are permitted.
            </span>
          ) : (
            settings.ipAllowlist.map((ip) => (
              <span key={ip} style={styles.ipBadge}>
                <code>{ip}</code>
                <button
                  style={styles.removeIpBtn}
                  onClick={() => handleRemoveIp(ip)}
                  title={`Remove ${ip}`}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Comprehensive Audit Log Table */}
      <div style={styles.auditLogCard}>
        <div style={styles.auditHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#f9fafb', fontWeight: 600 }}>Security & Administrative Audit Trail</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
              Cryptographically verified history of all role changes, member additions, and policy updates
            </p>
          </div>

          <div style={styles.auditActions}>
            <div style={styles.searchWrap}>
              <Search size={15} color="#6b7280" />
              <input
                style={styles.searchInput}
                type="text"
                placeholder="Search audit trail..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
            </div>

            <select
              style={styles.selectAction}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">All Action Types</option>
              <option value="USER_ROLE_CHANGED">Role Changes</option>
              <option value="USER_INVITED">User Invitations</option>
              <option value="USER_STATUS_CHANGED">Status Changes</option>
              <option value="SECURITY_SETTINGS_UPDATED">Security Settings</option>
              <option value="RENEWAL_REMINDER_SENT">Renewal Reminders</option>
            </select>

            <button style={styles.exportCsvBtn} onClick={handleExportLogsCSV}>
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <th style={styles.th}>TIMESTAMP</th>
              <th style={styles.th}>ACTOR</th>
              <th style={styles.th}>ACTION</th>
              <th style={styles.th}>TARGET</th>
              <th style={styles.th}>DETAILS</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>IP ADDRESS</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={styles.emptyTd}>
                  No audit log entries matching your search.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const actionText = ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ');

                return (
                  <tr key={log.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ color: '#f3f4f6', fontSize: 13 }}>{log.actor?.name || 'Admin'}</strong>
                        <span style={{ fontSize: 11, color: '#d4af37' }}>{log.actor?.role}</span>
                      </div>
                    </td>

                    <td style={styles.td}>
                      <span style={styles.actionTag}>{actionText}</span>
                    </td>

                    <td style={styles.td}>
                      <span style={{ fontSize: 13, color: '#d1d5db' }}>
                        {log.target?.name || log.target?.id || 'System'}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <div style={styles.detailsCell}>
                        {log.details?.oldRole && log.details?.newRole ? (
                          <span style={{ color: '#10b981', fontWeight: 500 }}>
                            {log.details.oldRole} → {log.details.newRole}
                          </span>
                        ) : log.details?.email ? (
                          <span style={{ color: '#9ca3af' }}>{log.details.email}</span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>{JSON.stringify(log.details)}</span>
                        )}
                      </div>
                    </td>

                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <code style={{ fontSize: 11, color: '#8e9aa8' }}>{log.ipAddress || '127.0.0.1'}</code>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    color: '#10b981',
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 13,
  },
  policyGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
  },
  policyCard: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  policyHeader: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
  },
  policyIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  policyTitle: {
    margin: '0 0 4px',
    fontSize: 15,
    fontWeight: 600,
    color: '#f9fafb',
  },
  policyDesc: {
    margin: 0,
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 1.4,
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  statusBadgeActive: {
    fontSize: 10,
    fontWeight: 700,
    color: '#10b981',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    padding: '3px 8px',
    borderRadius: 4,
  },
  statusBadgeInactive: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9ca3af',
    background: 'rgba(156,163,175,0.12)',
    border: '1px solid rgba(156,163,175,0.2)',
    padding: '3px 8px',
    borderRadius: 4,
  },
  switchBtn: {
    width: 44,
    height: 24,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s',
  },
  switchThumb: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#ffffff',
    transition: 'transform 0.2s',
  },
  allowlistCard: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  allowlistHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  ipForm: {
    display: 'flex',
    gap: 12,
    maxWidth: 480,
  },
  ipInput: {
    flex: 1,
    background: '#0e1118',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '8px 12px',
    color: '#f9fafb',
    fontSize: 13,
    outline: 'none',
  },
  addIpBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  ipBadgeWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  ipBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(212,175,55,0.08)',
    border: '1px solid rgba(212,175,55,0.25)',
    color: '#d4af37',
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 12,
  },
  removeIpBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
  },
  auditLogCard: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  auditHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
    gap: 14,
  },
  auditActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#0e1118',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '6px 12px',
    width: 220,
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#f9fafb',
    fontSize: 12,
    width: '100%',
  },
  selectAction: {
    background: '#0e1118',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#e5e7eb',
    fontSize: 12,
    padding: '7px 10px',
    outline: 'none',
    cursor: 'pointer',
  },
  exportCsvBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'linear-gradient(135deg, #d4af37 0%, #aa8528 100%)',
    color: '#0b0d11',
    border: 'none',
    fontWeight: 600,
    fontSize: 12,
    padding: '7px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  thRow: {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
  },
  th: {
    padding: '12px 20px',
    fontSize: 11,
    color: '#8e9aa8',
    letterSpacing: '0.06em',
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  td: {
    padding: '14px 20px',
    verticalAlign: 'middle',
  },
  actionTag: {
    fontSize: 11,
    fontWeight: 600,
    color: '#f9fafb',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '3px 8px',
    borderRadius: 4,
  },
  detailsCell: {
    fontSize: 12,
    maxWidth: 320,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyTd: {
    padding: 40,
    textAlign: 'center',
    color: '#8e9aa8',
    fontSize: 13,
  },
};
