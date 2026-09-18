import { useState, useEffect, useMemo } from 'react';
import {
  FileText, Globe, Lock, Users, Search, AlertTriangle,
  CheckCircle2, RefreshCw, Eye, Link, Ban
} from 'lucide-react';
import { adminApi, getStoredUser } from '@/services/adminApi';

export function DocumentsSharingSection() {
  const currentUser = getStoredUser();
  const isOwner = currentUser?.role === 'Owner';

  const [documents, setDocuments] = useState([]);
  const [allowExternalSharing, setAllowExternalSharing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [busyDocId, setBusyDocId] = useState(null);
  const [policyBusy, setPolicyBusy] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getDocuments();
      setDocuments(res.documents || []);
      setAllowExternalSharing(res.allowExternalSharing);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const showToast = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const handleToggleOrgSharing = async () => {
    const nextVal = !allowExternalSharing;
    setPolicyBusy(true);
    try {
      await adminApi.updateSharingPolicy(nextVal);
      setAllowExternalSharing(nextVal);
      showToast(nextVal ? 'Org-wide public link-sharing enabled.' : 'Org-wide public link-sharing disabled.');
    } catch (err) {
      alert(`Policy update error: ${err.message}`);
    } finally {
      setPolicyBusy(false);
    }
  };

  const handleToggleDocLink = async (doc) => {
    const nextLinkState = !doc.shareLinkEnabled;
    setBusyDocId(doc.id);
    try {
      await adminApi.updateDocumentSharing(doc.id, nextLinkState);
      showToast(nextLinkState ? `Enabled public link for "${doc.title}"` : `Revoked public access for "${doc.title}"`);
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, shareLinkEnabled: nextLinkState, sharingLevel: nextLinkState ? 'Public Link' : 'Team Restricted' } : d))
      );
    } catch (err) {
      alert(`Sharing update failed: ${err.message}`);
    } finally {
      setBusyDocId(null);
    }
  };

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.trim().toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.owner?.name && d.owner.name.toLowerCase().includes(q)) ||
        (d.owner?.email && d.owner.email.toLowerCase().includes(q))
    );
  }, [documents, search]);

  if (loading && documents.length === 0) {
    return <div style={styles.loaderWrap}>Loading organization documents…</div>;
  }

  return (
    <div style={styles.container}>
      {notice && (
        <div style={styles.toast}>
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* Org-wide Sharing Governance Banner */}
      <div style={styles.policyCard}>
        <div style={styles.policyLeft}>
          <div style={styles.policyIcon}>
            <Globe size={22} color="#d4af37" />
          </div>
          <div>
            <h3 style={styles.policyTitle}>Organization Link-Sharing Governance</h3>
            <p style={styles.policyDesc}>
              Controls whether organization members can generate publicly accessible share links. When disabled, document links are strictly restricted to verified organization members.
            </p>
          </div>
        </div>

        <div style={styles.policyRight}>
          <div style={styles.toggleWrap}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#d4af37' }}>
              {allowExternalSharing ? 'External Sharing Allowed' : 'Strict Internal Only'}
            </span>
            <button
              style={{
                ...styles.switchBtn,
                background: allowExternalSharing ? '#d4af37' : '#374151',
              }}
              onClick={handleToggleOrgSharing}
              disabled={policyBusy}
            >
              <span
                style={{
                  ...styles.switchThumb,
                  transform: allowExternalSharing ? 'translateX(20px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <Search size={16} color="#6b7280" />
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search documents by title or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          Total Organization Documents: <strong style={{ color: '#f9fafb' }}>{documents.length}</strong>
        </div>
      </div>

      {/* Documents Table */}
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <th style={styles.th}>DOCUMENT TITLE</th>
              <th style={styles.th}>OWNER / AUTHOR</th>
              <th style={styles.th}>LAST MODIFIED</th>
              <th style={styles.th}>SIZE</th>
              <th style={styles.th}>SHARING LEVEL</th>
              <th style={styles.th}>COLLABORATORS</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>SHARING ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={7} style={styles.emptyTd}>
                  No documents found matching your search.
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => {
                const isBusy = busyDocId === doc.id;
                const isPublic = doc.shareLinkEnabled;

                return (
                  <tr key={doc.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.titleCell}>
                        <FileText size={16} color="#d4af37" style={{ flexShrink: 0 }} />
                        <span style={styles.docTitle}>{doc.title}</span>
                      </div>
                    </td>

                    <td style={styles.td}>
                      <span style={{ fontSize: 13, color: '#e5e7eb' }}>
                        {doc.owner?.name || 'Demo User'}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>
                        {new Date(doc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>
                        {doc.sizeBytes ? `${(doc.sizeBytes / 1024).toFixed(1)} KB` : '< 10 KB'}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.sharingBadge,
                          color: '#d4af37',
                          background: isPublic ? 'rgba(212,175,55,0.14)' : 'rgba(212,175,55,0.06)',
                          borderColor: isPublic ? 'rgba(212,175,55,0.35)' : 'rgba(212,175,55,0.18)',
                        }}
                      >
                        {isPublic ? <Globe size={12} /> : <Lock size={12} />}
                        <span>{isPublic ? 'Public Link' : 'Restricted'}</span>
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span style={{ fontSize: 12, color: '#d1d5db' }}>
                        {doc.collaboratorsCount || 0} collaborators
                      </span>
                    </td>

                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button
                        style={{
                          ...styles.actionBtn,
                          color: '#d4af37',
                          borderColor: 'rgba(212,175,55,0.3)',
                          background: 'rgba(212,175,55,0.08)',
                        }}
                        onClick={() => handleToggleDocLink(doc)}
                        disabled={isBusy}
                      >
                        {isPublic ? (
                          <>
                            <Ban size={13} />
                            <span>Revoke Link</span>
                          </>
                        ) : (
                          <>
                            <Link size={13} />
                            <span>Enable Link</span>
                          </>
                        )}
                      </button>
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
    gap: 20,
  },
  loaderWrap: {
    padding: 60,
    textAlign: 'center',
    color: '#8e9aa8',
    fontSize: 14,
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.3)',
    color: '#d4af37',
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 13,
  },
  policyCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 22,
    background: '#12161f',
    border: '1px solid rgba(212,175,55,0.25)',
    borderRadius: 12,
    gap: 20,
    flexWrap: 'wrap',
  },
  policyLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    maxWidth: 680,
  },
  policyIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  policyTitle: {
    margin: '0 0 4px',
    fontSize: 16,
    fontWeight: 600,
    color: '#f9fafb',
  },
  policyDesc: {
    margin: 0,
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 1.4,
  },
  policyRight: {
    display: 'flex',
    alignItems: 'center',
  },
  toggleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
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
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '8px 14px',
    width: 340,
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#f9fafb',
    fontSize: 13,
    width: '100%',
  },
  tableCard: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  thRow: {
    background: 'rgba(255,255,255,0.02)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  th: {
    padding: '12px 18px',
    fontSize: 11,
    color: '#8e9aa8',
    letterSpacing: '0.06em',
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  td: {
    padding: '14px 18px',
    verticalAlign: 'middle',
  },
  titleCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  docTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#f9fafb',
  },
  sharingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 6,
    border: '1px solid',
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  emptyTd: {
    padding: 40,
    textAlign: 'center',
    color: '#8e9aa8',
    fontSize: 13,
  },
};
