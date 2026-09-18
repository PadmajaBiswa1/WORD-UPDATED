import { useState, useEffect, useMemo } from 'react';
import {
  Search, UserPlus, Filter, Shield, MoreVertical, CheckCircle2,
  XCircle, Trash2, Edit2, UploadCloud, Users, AlertTriangle, X,
  Building, Check, AlertCircle, FileText
} from 'lucide-react';
import { adminApi, getStoredUser } from '@/services/adminApi';

const ROLE_COLORS = {
  Owner: { text: '#d4af37', bg: 'rgba(212,175,55,0.14)', border: 'rgba(212,175,55,0.35)' },
  Admin: { text: '#d4af37', bg: 'rgba(212,175,55,0.14)', border: 'rgba(212,175,55,0.35)' },
  Editor: { text: '#d4af37', bg: 'rgba(212,175,55,0.14)', border: 'rgba(212,175,55,0.35)' },
  Viewer: { text: '#d4af37', bg: 'rgba(212,175,55,0.14)', border: 'rgba(212,175,55,0.35)' },
};

const DEPARTMENTS = ['All', 'Executive', 'Engineering', 'Product', 'Design', 'Marketing', 'Legal', 'General'];

export function UsersRolesSection() {
  const currentUser = getStoredUser();
  const isOwner = currentUser?.role === 'Owner';

  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Filters & View
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'teams'

  // Modals
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [bulkInviteTab, setBulkInviteTab] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Editor', department: 'Engineering' });
  const [bulkText, setBulkText] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  // Role Edit Modal
  const [editingMember, setEditingMember] = useState(null);
  const [targetRole, setTargetRole] = useState('Editor');
  const [roleBusy, setRoleBusy] = useState(false);

  // Delete Confirm Modal
  const [deletingMember, setDeletingMember] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchUsersAndTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, teamsRes] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getTeams(),
      ]);
      setMembers(usersRes.members || []);
      setTeams(teamsRes.teams || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndTeams();
  }, []);

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || m.role.toLowerCase() === roleFilter.toLowerCase();
      const matchesDept = deptFilter === 'all' || m.department.toLowerCase() === deptFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || m.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });
  }, [members, search, roleFilter, deptFilter, statusFilter]);

  // Invite single user
  const handleSingleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.name) return;
    setInviteBusy(true);
    try {
      await adminApi.inviteUser(inviteForm);
      showNotification(`Invitation sent to ${inviteForm.email}`);
      setInviteModalOpen(false);
      setInviteForm({ name: '', email: '', role: 'Editor', department: 'Engineering' });
      fetchUsersAndTeams();
    } catch (err) {
      alert(`Invite failed: ${err.message}`);
    } finally {
      setInviteBusy(false);
    }
  };

  // Bulk CSV / list invite
  const handleBulkInvite = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    setInviteBusy(true);

    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedList = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      const email = parts[0] || '';
      const name = parts[1] || email.split('@')[0];
      const role = parts[2] || 'Editor';
      const department = parts[3] || 'General';
      return { email, name, role, department };
    });

    try {
      const res = await adminApi.inviteUser({ bulk: true, members: parsedList });
      showNotification(res.message || `Successfully processed ${parsedList.length} invitations`);
      setInviteModalOpen(false);
      setBulkText('');
      fetchUsersAndTeams();
    } catch (err) {
      alert(`Bulk invite error: ${err.message}`);
    } finally {
      setInviteBusy(false);
    }
  };

  // Update role
  const handleSaveRole = async () => {
    if (!editingMember || !targetRole) return;
    setRoleBusy(true);
    try {
      await adminApi.updateUserRole(editingMember.id, targetRole);
      showNotification(`Role for ${editingMember.name} updated to ${targetRole}`);
      setEditingMember(null);
      fetchUsersAndTeams();
    } catch (err) {
      alert(`Role change failed: ${err.message}`);
    } finally {
      setRoleBusy(false);
    }
  };

  // Toggle account activation
  const handleToggleStatus = async (member) => {
    const nextStatus = member.status === 'active' ? 'deactivated' : 'active';
    try {
      await adminApi.updateUserStatus(member.id, nextStatus);
      showNotification(`Account for ${member.name} is now ${nextStatus}`);
      fetchUsersAndTeams();
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  // Remove member
  const handleConfirmDelete = async () => {
    if (!deletingMember) return;
    setDeleteBusy(true);
    try {
      await adminApi.removeUser(deletingMember.id);
      showNotification(`Removed ${deletingMember.name} from the organization`);
      setDeletingMember(null);
      fetchUsersAndTeams();
    } catch (err) {
      alert(`Removal failed: ${err.message}`);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Toast Banner */}
      {successMsg && (
        <div style={styles.successBanner}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Action & Filter Bar */}
      <div style={styles.topToolbar}>
        <div style={styles.searchWrap}>
          <Search size={16} color="#6b7280" />
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search members by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={styles.filterControls}>
          {/* Department Filter */}
          <select
            style={styles.selectFilter}
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.filter((d) => d !== 'All').map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            style={styles.selectFilter}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="Owner">Owner</option>
            <option value="Admin">Admin</option>
            <option value="Editor">Editor</option>
            <option value="Viewer">Viewer</option>
          </select>

          {/* Status Filter */}
          <select
            style={styles.selectFilter}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="deactivated">Deactivated</option>
          </select>

          {/* View Mode Toggle */}
          <div style={styles.viewToggle}>
            <button
              style={{ ...styles.toggleBtn, ...(viewMode === 'table' ? styles.toggleBtnActive : {}) }}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              Table
            </button>
            <button
              style={{ ...styles.toggleBtn, ...(viewMode === 'teams' ? styles.toggleBtnActive : {}) }}
              onClick={() => setViewMode('teams')}
              title="Department Grouping View"
            >
              Teams
            </button>
          </div>

          <button style={styles.inviteBtn} onClick={() => setInviteModalOpen(true)}>
            <UserPlus size={16} />
            <span>Invite Users</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Table or Teams */}
      {loading ? (
        <div style={styles.loadingWrap}>Loading member directory…</div>
      ) : viewMode === 'table' ? (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>MEMBER</th>
                <th style={styles.th}>ROLE</th>
                <th style={styles.th}>DEPARTMENT</th>
                <th style={styles.th}>STATUS</th>
                <th style={styles.th}>STORAGE</th>
                <th style={styles.th}>AI CREDITS</th>
                <th style={styles.th}>JOINED</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={styles.emptyTd}>
                    No members match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.Viewer;
                  const isTargetOwner = member.role === 'Owner';
                  const isTargetAdmin = member.role === 'Admin';
                  const canEditThisUser = isOwner || (!isTargetOwner && !isTargetAdmin);

                  return (
                    <tr key={member.id} style={styles.tr}>
                      {/* Name & Email */}
                      <td style={styles.td}>
                        <div style={styles.memberCell}>
                          <div style={styles.avatar}>
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={styles.memberText}>
                            <span style={styles.memberName}>{member.name}</span>
                            <span style={styles.memberEmail}>{member.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Pill */}
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.rolePill,
                            color: roleStyle.text,
                            background: roleStyle.bg,
                            borderColor: roleStyle.border,
                          }}
                        >
                          {member.role}
                        </span>
                      </td>

                      {/* Department */}
                      <td style={styles.td}>
                        <span style={styles.deptBadge}>{member.department || 'General'}</span>
                      </td>

                      {/* Status */}
                      <td style={styles.td}>
                        <span
                          style={
                            member.status === 'active'
                              ? styles.statusActive
                              : styles.statusDeactivated
                          }
                        >
                          {member.status === 'active' ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>

                      {/* Storage */}
                      <td style={styles.td}>
                        <span style={{ fontSize: 12, color: '#d1d5db' }}>
                          {(member.storageBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                        </span>
                      </td>

                      {/* AI Credits */}
                      <td style={styles.td}>
                        <span style={{ fontSize: 12, color: '#d1d5db' }}>
                          {(member.aiCreditsUsed || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td style={styles.td}>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          {new Date(member.joinedAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <div style={styles.actionBtnsWrap}>
                          {/* Role Change */}
                          {canEditThisUser ? (
                            <button
                              style={styles.actionIconBtn}
                              title="Change Role"
                              onClick={() => {
                                setEditingMember(member);
                                setTargetRole(member.role);
                              }}
                            >
                              <Edit2 size={15} />
                            </button>
                          ) : (
                            <button
                              style={{ ...styles.actionIconBtn, opacity: 0.3, cursor: 'not-allowed' }}
                              title="Owner permissions required to modify this user"
                              disabled
                            >
                              <Shield size={15} />
                            </button>
                          )}

                          {/* Status Toggle */}
                          {canEditThisUser ? (
                            <button
                              style={{
                                ...styles.actionIconBtn,
                                color: '#d4af37',
                              }}
                              title={member.status === 'active' ? 'Deactivate Account' : 'Reactivate Account'}
                              onClick={() => handleToggleStatus(member)}
                            >
                              {member.status === 'active' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                            </button>
                          ) : null}

                          {/* Delete Member */}
                          {canEditThisUser ? (
                            <button
                              style={{ ...styles.actionIconBtn, color: '#d4af37' }}
                              title="Remove from Organization"
                              onClick={() => setDeletingMember(member)}
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Team / Department Grouping View */
        <div style={styles.teamsGrid}>
          {teams.map((team) => (
            <div key={team.name} style={styles.teamCard}>
              <div style={styles.teamCardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={styles.teamIcon}>
                    <Building size={18} color="#d4af37" />
                  </div>
                  <div>
                    <h3 style={styles.teamName}>{team.name}</h3>
                    <span style={styles.teamSub}>{team.memberCount} members assigned</span>
                  </div>
                </div>
                <div style={styles.teamStatsBadge}>
                  {(team.storageBytes / (1024 * 1024 * 1024)).toFixed(2)} GB • {team.aiCreditsUsed} AI credits
                </div>
              </div>

              <div style={styles.teamMembersList}>
                {team.members.map((m) => {
                  const roleStyle = ROLE_COLORS[m.role] || ROLE_COLORS.Viewer;
                  return (
                    <div key={m.id} style={styles.teamMemberItem}>
                      <div style={styles.teamMemberLeft}>
                        <div style={styles.miniAvatar}>{m.name.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#f9fafb' }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.email}</div>
                        </div>
                      </div>
                      <span
                        style={{
                          ...styles.rolePill,
                          fontSize: 10,
                          padding: '2px 7px',
                          color: roleStyle.text,
                          background: roleStyle.bg,
                          borderColor: roleStyle.border,
                        }}
                      >
                        {m.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={18} color="#d4af37" />
                <h3 style={styles.modalTitle}>Invite Organization Members</h3>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setInviteModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs: Single vs Bulk */}
            <div style={styles.modalTabRow}>
              <button
                style={{ ...styles.modalTab, ...(!bulkInviteTab ? styles.modalTabActive : {}) }}
                onClick={() => setBulkInviteTab(false)}
              >
                Single Invite
              </button>
              <button
                style={{ ...styles.modalTab, ...(bulkInviteTab ? styles.modalTabActive : {}) }}
                onClick={() => setBulkInviteTab(true)}
              >
                Bulk Import (CSV / List)
              </button>
            </div>

            {!bulkInviteTab ? (
              <form onSubmit={handleSingleInvite} style={styles.modalForm}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    style={styles.input}
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Work Email Address</label>
                  <input
                    style={styles.input}
                    type="email"
                    required
                    placeholder="jane@company.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  />
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Role & Permissions</label>
                    <select
                      style={styles.select}
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    >
                      <option value="Viewer">Viewer (Read-only)</option>
                      <option value="Editor">Editor (Create & Edit)</option>
                      {isOwner && <option value="Admin">Admin (Manage Members)</option>}
                      {isOwner && <option value="Owner">Owner (Full Control)</option>}
                    </select>
                    {!isOwner && (
                      <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        * Only Owners can invite new Admins or Owners.
                      </span>
                    )}
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Department</label>
                    <select
                      style={styles.select}
                      value={inviteForm.department}
                      onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                    >
                      {DEPARTMENTS.filter((d) => d !== 'All').map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={styles.modalActions}>
                  <button type="button" style={styles.cancelBtn} onClick={() => setInviteModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" style={styles.submitBtn} disabled={inviteBusy}>
                    {inviteBusy ? 'Sending Invite…' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleBulkInvite} style={styles.modalForm}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Paste CSV or Comma-Separated User List</label>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9ca3af' }}>
                    Format: <code>email, name, role, department</code> (one user per line)
                  </p>
                  <textarea
                    style={styles.textarea}
                    rows={6}
                    placeholder={"jane@corp.com, Jane Doe, Editor, Engineering\nbob@corp.com, Bob Smith, Viewer, Legal\nalice@corp.com, Alice Brown, Editor, Design"}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                  />
                </div>

                <div style={styles.modalActions}>
                  <button type="button" style={styles.cancelBtn} onClick={() => setInviteModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" style={styles.submitBtn} disabled={inviteBusy}>
                    {inviteBusy ? 'Processing List…' : 'Import & Send Invitations'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {editingMember && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: 440 }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Update Role: {editingMember.name}</h3>
              <button style={styles.modalCloseBtn} onClick={() => setEditingMember(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                Select the new permission level for <strong>{editingMember.email}</strong>. Every role change is audited and triggers an immediate in-app & email notification.
              </p>

              <div style={styles.roleOptions}>
                {[
                  { role: 'Viewer', desc: 'Read-only access to shared team documents. No editing or user management.' },
                  { role: 'Editor', desc: 'Can create, edit, export, and collaborate. No user management privileges.' },
                  ...(isOwner ? [
                    { role: 'Admin', desc: 'Can invite and manage Editors/Viewers, inspect analytics and security logs.' },
                    { role: 'Owner', desc: 'Unrestricted control over billing, subscription seats, and all admin roles.' },
                  ] : []),
                ].map((item) => (
                  <label
                    key={item.role}
                    style={{
                      ...styles.roleOptionCard,
                      ...(targetRole === item.role ? styles.roleOptionCardActive : {}),
                    }}
                  >
                    <input
                      type="radio"
                      name="targetRole"
                      value={item.role}
                      checked={targetRole === item.role}
                      onChange={(e) => setTargetRole(e.target.value)}
                      style={{ accentColor: '#d4af37' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <strong style={{ color: '#f3f4f6', fontSize: 13 }}>{item.role}</strong>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>

              {editingMember.role === 'Owner' && targetRole !== 'Owner' && (
                <div style={styles.warningBox}>
                  <AlertTriangle size={16} color="#d4af37" />
                  <span style={{ fontSize: 12, color: '#d4af37' }}>
                    Demoting an Owner requires at least one other active Owner to remain in the organization.
                  </span>
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setEditingMember(null)}>
                Cancel
              </button>
              <button style={styles.submitBtn} onClick={handleSaveRole} disabled={roleBusy}>
                {roleBusy ? 'Updating…' : 'Save New Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingMember && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: 420 }}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#d4af37" />
                <h3 style={{ ...styles.modalTitle, color: '#d4af37' }}>Confirm Member Removal</h3>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setDeletingMember(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 0', fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong style={{ color: '#f3f4f6' }}>{deletingMember.name}</strong> ({deletingMember.email}) from the organization?
              <br /><br />
              Their documents will remain intact, but they will lose access to all organization workspaces and Pro features.
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setDeletingMember(null)}>
                Cancel
              </button>
              <button
                style={{ ...styles.submitBtn, background: 'linear-gradient(135deg, #d4af37 0%, #aa8528 100%)' }}
                onClick={handleConfirmDelete}
                disabled={deleteBusy}
              >
                {deleteBusy ? 'Removing…' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.3)',
    color: '#d4af37',
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
  },
  topToolbar: {
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
    width: 320,
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#f9fafb',
    fontSize: 13,
    width: '100%',
  },
  filterControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  selectFilter: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#e5e7eb',
    fontSize: 12,
    padding: '8px 12px',
    outline: 'none',
    cursor: 'pointer',
  },
  viewToggle: {
    display: 'flex',
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 12px',
    borderRadius: 6,
    cursor: 'pointer',
  },
  toggleBtnActive: {
    background: 'rgba(212,175,55,0.15)',
    color: '#d4af37',
    fontWeight: 600,
  },
  inviteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'linear-gradient(135deg, #d4af37 0%, #aa8528 100%)',
    color: '#0b0d11',
    border: 'none',
    fontWeight: 600,
    fontSize: 13,
    padding: '8px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(212,175,55,0.25)',
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
    padding: '14px 18px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#8e9aa8',
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  td: {
    padding: '14px 18px',
    verticalAlign: 'middle',
  },
  memberCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2b3548 0%, #1a202c 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#d4af37',
    fontWeight: 700,
    fontSize: 12,
  },
  memberText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  memberName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#f9fafb',
  },
  memberEmail: {
    fontSize: 11,
    color: '#9ca3af',
  },
  rolePill: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    padding: '3px 9px',
    borderRadius: 99,
    border: '1px solid',
  },
  deptBadge: {
    fontSize: 11,
    color: '#d1d5db',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '3px 8px',
    borderRadius: 6,
  },
  statusActive: {
    fontSize: 10,
    fontWeight: 700,
    color: '#d4af37',
    background: 'rgba(212,175,55,0.12)',
    padding: '2px 7px',
    borderRadius: 4,
    border: '1px solid rgba(212,175,55,0.3)',
  },
  statusDeactivated: {
    fontSize: 10,
    fontWeight: 700,
    color: '#d4af37',
    background: 'rgba(212,175,55,0.06)',
    padding: '2px 7px',
    borderRadius: 4,
    border: '1px solid rgba(212,175,55,0.18)',
  },
  actionBtnsWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  actionIconBtn: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: '#9ca3af',
    padding: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTd: {
    padding: 40,
    textAlign: 'center',
    color: '#8e9aa8',
    fontSize: 13,
  },
  loadingWrap: {
    padding: 60,
    textAlign: 'center',
    color: '#8e9aa8',
    fontSize: 14,
  },
  teamsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 18,
  },
  teamCard: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  teamCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  teamIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#f9fafb',
  },
  teamSub: {
    fontSize: 11,
    color: '#9ca3af',
  },
  teamStatsBadge: {
    fontSize: 11,
    color: '#d4af37',
    background: 'rgba(212,175,55,0.08)',
    padding: '4px 8px',
    borderRadius: 6,
  },
  teamMembersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  teamMemberItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.04)',
  },
  teamMemberLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#1f2937',
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    background: '#131722',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  modalTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: '#f9fafb',
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
  },
  modalTabRow: {
    display: 'flex',
    gap: 10,
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  modalTab: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 10px',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
  },
  modalTabActive: {
    color: '#d4af37',
    borderBottomColor: '#d4af37',
    fontWeight: 600,
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    paddingTop: 16,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
  },
  formRow: {
    display: 'flex',
    gap: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e5e7eb',
  },
  input: {
    background: '#0e1118',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '9px 12px',
    color: '#f9fafb',
    fontSize: 13,
    outline: 'none',
  },
  select: {
    background: '#0e1118',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '9px 12px',
    color: '#f9fafb',
    fontSize: 13,
    outline: 'none',
    cursor: 'pointer',
  },
  textarea: {
    background: '#0e1118',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#f9fafb',
    fontSize: 12,
    fontFamily: 'monospace',
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
  },
  cancelBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #d4af37 0%, #aa8528 100%)',
    border: 'none',
    color: '#0b0d11',
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 18px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  roleOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  roleOptionCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    cursor: 'pointer',
  },
  roleOptionCardActive: {
    borderColor: '#d4af37',
    background: 'rgba(212,175,55,0.08)',
  },
  warningBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    background: 'rgba(212,175,55,0.1)',
    border: '1px solid rgba(212,175,55,0.25)',
    borderRadius: 6,
  },
};
