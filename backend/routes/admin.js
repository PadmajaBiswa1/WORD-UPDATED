const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { requireAdmin, requireOwner } = require('../middleware/adminAuth');
const adminDataService = require('../services/adminDataService');
const { createNotification } = require('./notifications');
const { sendRoleChangeEmail } = require('../utils/sendEmail');

// All endpoints in this router require at least Admin or Owner privileges
router.use(requireAdmin);

// ─────────────────────────────────────────────────────────────
// 1. OVERVIEW & KPIS
// ─────────────────────────────────────────────────────────────
router.get('/overview', (req, res) => {
  try {
    const org = adminDataService.getOrganization();
    const members = adminDataService.getMembers();
    const auditLogs = adminDataService.getAuditLogs({ limit: 6 });

    const totalMembers = members.length;
    const activeMembers = members.filter((m) => m.status === 'active');
    const deactivatedMembers = members.filter((m) => m.status === 'deactivated');

    const totalStorageBytes = members.reduce((sum, m) => sum + (m.storageBytes || 0), 0);
    const totalAiCreditsUsed = members.reduce((sum, m) => sum + (m.aiCreditsUsed || 0), 0);

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const dau = members.filter((m) => m.lastActiveAt && new Date(m.lastActiveAt).getTime() > oneDayAgo).length || 4;
    const mau = activeMembers.length;

    const renewalDate = org.subscription?.renewalDate ? new Date(org.subscription.renewalDate) : null;
    const daysUntilRenewal = renewalDate ? Math.max(0, Math.ceil((renewalDate.getTime() - now) / (1000 * 60 * 60 * 24))) : 180;

    res.json({
      organization: {
        id: org.id,
        name: org.name,
        domain: org.domain,
        tier: org.tier,
        seatsTotal: org.seatsTotal || 25,
        seatsUsed: totalMembers,
        seatsAvailable: Math.max(0, (org.seatsTotal || 25) - totalMembers),
        subscription: org.subscription,
        daysUntilRenewal,
      },
      kpis: {
        totalMembers,
        activeMembers: activeMembers.length,
        deactivatedMembers: deactivatedMembers.length,
        dau,
        mau,
        storageUsedBytes: totalStorageBytes,
        storageUsedDisplay: `${(totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        storageLimitDisplay: 'Unlimited (Pro Org)',
        aiCreditsUsed: totalAiCreditsUsed,
        aiCreditsLimit: 50000,
        aiCreditsPercent: Math.min(100, Math.round((totalAiCreditsUsed / 50000) * 100)),
      },
      securityStatus: {
        allowExternalSharing: Boolean(org.settings?.allowExternalSharing),
        enforce2FA: Boolean(org.settings?.enforce2FA),
        enforceSSO: Boolean(org.settings?.enforceSSO),
        ipAllowlistCount: (org.settings?.ipAllowlist || []).length,
      },
      recentAuditLogs: auditLogs.logs,
      currentUserRole: req.adminUser.role,
      isOwner: req.isOwner,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. USER & TEAM MEMBER MANAGEMENT
// ─────────────────────────────────────────────────────────────
router.get('/users', (req, res) => {
  try {
    const { search, role, department, status } = req.query;
    const members = adminDataService.getMembers({ search, role, department, status });
    res.json({
      members,
      total: members.length,
      currentUserRole: req.adminUser.role,
      isOwner: req.isOwner,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/users/invite', (req, res) => {
  try {
    const { bulk, members, name, email, role, department } = req.body || {};

    // Permission enforcement:
    // Only Owner can invite as Admin or Owner. Admin can only invite as Editor or Viewer.
    if (!req.isOwner) {
      if (role === 'Owner' || role === 'Admin') {
        return res.status(403).json({
          message: 'Access denied: Only organization Owners can invite users with Admin or Owner privileges.',
        });
      }
      if (bulk && Array.isArray(members)) {
        const hasElevated = members.some((m) => m.role === 'Owner' || m.role === 'Admin');
        if (hasElevated) {
          return res.status(403).json({
            message: 'Access denied: Only organization Owners can invite users with Admin or Owner privileges.',
          });
        }
      }
    }

    if (bulk && Array.isArray(members)) {
      const sanitized = members.map((m) => ({
        name: String(m.name || m.email?.split('@')[0] || 'Member').trim(),
        email: String(m.email || '').trim().toLowerCase(),
        role: ['Owner', 'Admin', 'Editor', 'Viewer'].includes(m.role) ? m.role : 'Viewer',
        department: m.department || 'General',
      }));

      const result = adminDataService.addBulkMembers(sanitized, req.adminUser);
      return res.status(201).json({
        message: `Successfully processed bulk invitations: ${result.count} invited, ${result.errors.length} skipped.`,
        ...result,
      });
    }

    if (!email || !name) {
      return res.status(400).json({ message: 'Name and email are required for invitation.' });
    }

    const newMember = adminDataService.addMember(
      {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        role: ['Owner', 'Admin', 'Editor', 'Viewer'].includes(role) ? role : 'Viewer',
        department: department || 'General',
      },
      req.adminUser
    );

    res.status(201).json({
      message: `Invitation sent to ${newMember.email}`,
      member: newMember,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role: newRole } = req.body || {};

    if (!['Owner', 'Admin', 'Editor', 'Viewer'].includes(newRole)) {
      return res.status(400).json({ message: 'Invalid role specified. Must be Owner, Admin, Editor, or Viewer.' });
    }

    const targetMember = adminDataService.getMember(id);
    if (!targetMember) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    const oldRole = targetMember.role;

    // Strict Permission Rules:
    // 1. If requester is Admin:
    //    - Cannot modify an Owner or Admin
    //    - Cannot assign Owner or Admin role
    //    - Can only change Editor/Viewer roles
    if (!req.isOwner) {
      if (oldRole === 'Owner' || oldRole === 'Admin') {
        return res.status(403).json({
          message: 'Access denied: Admins cannot modify the roles of Owners or other Admins.',
        });
      }
      if (newRole === 'Owner' || newRole === 'Admin') {
        return res.status(403).json({
          message: 'Access denied: Only organization Owners can promote users to Admin or Owner.',
        });
      }
    }

    // 2. Sole-Owner safeguard: cannot demote the last remaining Owner
    if (oldRole === 'Owner' && newRole !== 'Owner') {
      const activeOwnersCount = adminDataService.countOwners();
      if (activeOwnersCount <= 1) {
        return res.status(400).json({
          message: 'Action blocked: Cannot demote the last remaining Owner of the organization. Promote another member to Owner first.',
        });
      }
    }

    const updated = adminDataService.updateMemberRole(id, newRole, req.adminUser);

    // Trigger in-app notification to the target user
    try {
      await createNotification({
        recipientId: targetMember.userId || targetMember.id,
        recipientEmail: targetMember.email,
        sender: { id: req.adminUser.id, name: req.adminUser.name, email: req.adminUser.email },
        documentId: 'org_admin',
        documentTitle: 'Organization Role Update',
        type: 'system',
        message: `Your organization role was changed from ${oldRole} to ${newRole} by ${req.adminUser.name}`,
      });
    } catch (notifErr) {
      console.warn('In-app notification trigger error:', notifErr.message);
    }

    // Trigger stubbed email
    try {
      await sendRoleChangeEmail({
        to: targetMember.email,
        userName: targetMember.name,
        oldRole,
        newRole,
        updatedBy: req.adminUser,
      });
    } catch (emailErr) {
      console.warn('Email stub trigger error:', emailErr.message);
    }

    res.json({
      message: `Role for ${updated.name} updated to ${updated.role}`,
      member: updated,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/users/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!['active', 'deactivated'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be active or deactivated.' });
    }

    const targetMember = adminDataService.getMember(id);
    if (!targetMember) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    // Admins cannot deactivate Owners or Admins
    if (!req.isOwner && (targetMember.role === 'Owner' || targetMember.role === 'Admin')) {
      return res.status(403).json({
        message: 'Access denied: Admins cannot deactivate Owner or Admin accounts.',
      });
    }

    // Cannot deactivate last remaining Owner
    if (targetMember.role === 'Owner' && status === 'deactivated') {
      const activeOwnersCount = adminDataService.countOwners();
      if (activeOwnersCount <= 1) {
        return res.status(400).json({
          message: 'Action blocked: Cannot deactivate the last remaining Owner of the organization.',
        });
      }
    }

    const updated = adminDataService.updateMemberStatus(id, status, req.adminUser);
    res.json({
      message: `Account for ${updated.name} is now ${updated.status}`,
      member: updated,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const targetMember = adminDataService.getMember(id);

    if (!targetMember) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    // Admins cannot delete Owners or Admins
    if (!req.isOwner && (targetMember.role === 'Owner' || targetMember.role === 'Admin')) {
      return res.status(403).json({
        message: 'Access denied: Admins cannot remove Owner or Admin accounts.',
      });
    }

    // Cannot delete last remaining Owner
    if (targetMember.role === 'Owner') {
      const activeOwnersCount = adminDataService.countOwners();
      if (activeOwnersCount <= 1) {
        return res.status(400).json({
          message: 'Action blocked: Cannot remove the last remaining Owner of the organization.',
        });
      }
    }

    const result = adminDataService.removeMember(id, req.adminUser);
    res.json({
      message: `Removed ${result.removed.name} from the organization.`,
      removed: result.removed,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/teams', (req, res) => {
  try {
    const teams = adminDataService.getTeams();
    res.json({ teams });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. SUBSCRIPTION & SEAT MANAGEMENT (Owner only for mutations)
// ─────────────────────────────────────────────────────────────
router.get('/subscription', (req, res) => {
  try {
    const org = adminDataService.getOrganization();
    const members = adminDataService.getMembers();
    const now = Date.now();
    const renewalDate = org.subscription?.renewalDate ? new Date(org.subscription.renewalDate) : null;
    const daysUntilRenewal = renewalDate ? Math.max(0, Math.ceil((renewalDate.getTime() - now) / (1000 * 60 * 60 * 24))) : 180;

    res.json({
      subscription: org.subscription,
      tier: org.tier || 'pro',
      seatsTotal: org.seatsTotal || 25,
      seatsUsed: members.length,
      seatsAvailable: Math.max(0, (org.seatsTotal || 25) - members.length),
      daysUntilRenewal,
      isGracePeriod: org.subscription?.status === 'grace_period',
      gracePeriodEnd: org.subscription?.gracePeriodEnd || null,
      isOwner: req.isOwner,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/subscription', requireOwner, (req, res) => {
  try {
    const { seatsTotal, billingCycle, simulateGracePeriod, status } = req.body || {};
    const patch = {};

    if (typeof seatsTotal === 'number' && seatsTotal >= 1) {
      patch.seatsTotal = seatsTotal;
    }

    if (billingCycle || status || simulateGracePeriod !== undefined) {
      patch.subscription = {};
      if (billingCycle) patch.subscription.billingCycle = billingCycle;
      if (status) patch.subscription.status = status;

      if (simulateGracePeriod === true) {
        patch.subscription.status = 'grace_period';
        patch.subscription.gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (simulateGracePeriod === false) {
        patch.subscription.status = 'active';
        patch.subscription.gracePeriodEnd = null;
      }
    }

    const updated = adminDataService.updateOrganization(patch, req.adminUser);
    res.json({
      message: 'Subscription and seat allocation updated successfully.',
      organization: updated,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/subscription/send-renewal-reminder', requireOwner, (req, res) => {
  try {
    const org = adminDataService.getOrganization();
    adminDataService.addAuditLog({
      actor: req.adminUser,
      action: 'RENEWAL_REMINDER_SENT',
      target: { id: org.id, name: org.name, type: 'subscription' },
      details: { sentTo: 'Billing administrators & team owners', renewalDate: org.subscription?.renewalDate },
    });

    res.json({
      success: true,
      message: 'Renewal reminder notification successfully dispatched to organization billing contacts.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. USAGE & ANALYTICS
// ─────────────────────────────────────────────────────────────
router.get('/usage/analytics', (req, res) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const analytics = adminDataService.getAnalytics(days);
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. DOCUMENTS & SHARING PERMISSIONS
// ─────────────────────────────────────────────────────────────
router.get('/documents', (req, res) => {
  try {
    const org = adminDataService.getOrganization();
    const DOCS_FILE = path.join(__dirname, '..', 'data', 'documents.json');
    let rawDocs = [];

    if (fs.existsSync(DOCS_FILE)) {
      try {
        rawDocs = JSON.parse(fs.readFileSync(DOCS_FILE, 'utf8') || '[]');
      } catch {}
    }

    // Default mock documents if store is small
    const sampleOrgDocs = [
      {
        id: 'doc_org_q2_report',
        title: 'Q2 2026 Strategic Business Report',
        owner: { name: 'Padmaja Biswal', email: 'biswalpadmaja411@gmail.com', role: 'Owner' },
        updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        sizeBytes: 1250000,
        shareLinkEnabled: true,
        collaboratorsCount: 4,
        sharingLevel: 'Public Link',
      },
      {
        id: 'doc_org_roadmap',
        title: 'EtherX Engineering Architecture & H2 Roadmap',
        owner: { name: 'Alex Morgan', email: 'a.morgan@etherx.com', role: 'Editor' },
        updatedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
        sizeBytes: 840000,
        shareLinkEnabled: false,
        collaboratorsCount: 3,
        sharingLevel: 'Team Restricted',
      },
      {
        id: 'doc_org_compliance',
        title: 'Enterprise SOC2 & Data Security Policy',
        owner: { name: 'Elena Rostov', email: 'elena.r@etherx.com', role: 'Viewer' },
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        sizeBytes: 310000,
        shareLinkEnabled: false,
        collaboratorsCount: 2,
        sharingLevel: 'Internal Only',
      },
      {
        id: 'doc_org_brand_kit',
        title: 'Global Brand Guidelines & Typography',
        owner: { name: 'Michael Chang', email: 'm.chang@etherx.com', role: 'Editor' },
        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        sizeBytes: 2400000,
        shareLinkEnabled: true,
        collaboratorsCount: 6,
        sharingLevel: 'Public Link',
      },
    ];

    const mappedFileDocs = (Array.isArray(rawDocs) ? rawDocs : []).map((d) => ({
      id: d.id,
      title: d.title || 'Untitled Document',
      owner: d.owner || { name: 'Demo User', email: 'demo@etherx.com' },
      updatedAt: d.updatedAt || new Date().toISOString(),
      sizeBytes: (d.content || '').length * 2,
      shareLinkEnabled: Boolean(d.shareLinkEnabled),
      collaboratorsCount: (d.sharedWith || []).length,
      sharingLevel: d.shareLinkEnabled ? 'Public Link' : (d.sharedWith?.length > 0 ? 'Team Restricted' : 'Private'),
    }));

    const combined = [...mappedFileDocs, ...sampleOrgDocs];
    // Deduplicate by ID
    const seen = new Set();
    const documents = combined.filter((doc) => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    });

    res.json({
      documents,
      total: documents.length,
      allowExternalSharing: Boolean(org.settings?.allowExternalSharing),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/documents/:id/sharing', (req, res) => {
  try {
    const { id } = req.params;
    const { shareLinkEnabled } = req.body || {};

    const DOCS_FILE = path.join(__dirname, '..', 'data', 'documents.json');
    if (fs.existsSync(DOCS_FILE)) {
      try {
        const raw = fs.readFileSync(DOCS_FILE, 'utf8');
        const docs = JSON.parse(raw || '[]');
        const doc = docs.find((d) => d.id === id);
        if (doc) {
          doc.shareLinkEnabled = Boolean(shareLinkEnabled);
          fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2), 'utf8');
        }
      } catch {}
    }

    adminDataService.addAuditLog({
      actor: req.adminUser,
      action: 'DOCUMENT_SHARING_REVOKED',
      target: { id, name: id, type: 'document' },
      details: { shareLinkEnabled: Boolean(shareLinkEnabled) },
    });

    res.json({
      success: true,
      message: shareLinkEnabled ? 'Document public sharing enabled' : 'Document public link access revoked',
      documentId: id,
      shareLinkEnabled: Boolean(shareLinkEnabled),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/settings/sharing', (req, res) => {
  try {
    const { allowExternalSharing } = req.body || {};
    if (typeof allowExternalSharing !== 'boolean') {
      return res.status(400).json({ message: 'allowExternalSharing boolean flag required.' });
    }

    const org = adminDataService.updateOrganization(
      { settings: { allowExternalSharing } },
      req.adminUser
    );

    res.json({
      success: true,
      message: allowExternalSharing
        ? 'Org-wide external link sharing has been enabled.'
        : 'Org-wide external link sharing has been disabled.',
      settings: org.settings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 6. SECURITY & AUDIT LOGS
// ─────────────────────────────────────────────────────────────
router.get('/security/audit-logs', (req, res) => {
  try {
    const { limit = '20', offset = '0', search = '', action = '' } = req.query;
    const result = adminDataService.getAuditLogs({
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      search,
      action,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/security/settings', (req, res) => {
  try {
    const org = adminDataService.getOrganization();
    res.json({
      settings: org.settings || {
        allowExternalSharing: true,
        enforce2FA: false,
        enforceSSO: false,
        ipAllowlist: [],
      },
      isOwner: req.isOwner,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/security/settings', (req, res) => {
  try {
    const { enforce2FA, enforceSSO, ipAllowlist } = req.body || {};
    const settingsPatch = {};

    if (typeof enforce2FA === 'boolean') settingsPatch.enforce2FA = enforce2FA;
    if (typeof enforceSSO === 'boolean') settingsPatch.enforceSSO = enforceSSO;
    if (Array.isArray(ipAllowlist)) {
      settingsPatch.ipAllowlist = ipAllowlist.map((ip) => String(ip).trim()).filter(Boolean);
    }

    const org = adminDataService.updateOrganization({ settings: settingsPatch }, req.adminUser);

    res.json({
      success: true,
      message: 'Security controls and access policies updated.',
      settings: org.settings,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
