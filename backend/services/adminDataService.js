const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const ADMIN_STORE_FILE = path.join(__dirname, '..', 'data', 'admin_store.json');
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function isMongoConnected() {
  return Boolean(mongoose.connection && mongoose.connection.readyState === 1);
}

function getDefaultSeedData() {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  return {
    organization: {
      id: 'org_etherx_pro',
      name: 'EtherX Global Technologies',
      domain: 'etherx.com',
      tier: 'pro',
      seatsTotal: 25,
      seatsUsed: 7,
      settings: {
        allowExternalSharing: true,
        enforce2FA: false,
        enforceSSO: false,
        ipAllowlist: ['192.168.1.0/24', '10.0.4.0/22'],
      },
      subscription: {
        plan: 'pro',
        billingCycle: 'annual',
        status: 'active',
        price: 3999,
        currency: 'INR',
        renewalDate: new Date(now + 184 * dayMs).toISOString(),
        gracePeriodEnd: null,
      },
      createdAt: new Date(now - 180 * dayMs).toISOString(),
    },
    members: [
      {
        id: 'mem_padmaja',
        userId: 'user_padmaja',
        name: 'Padmaja Biswal',
        email: 'biswalpadmaja411@gmail.com',
        role: 'Owner',
        department: 'Executive',
        status: 'active',
        storageBytes: 1428571428, // ~1.4 GB
        aiCreditsUsed: 3450,
        lastActiveAt: new Date(now - 12 * 60 * 1000).toISOString(),
        joinedAt: new Date(now - 180 * dayMs).toISOString(),
      },
      {
        id: 'mem_demo',
        userId: 'user_demo',
        name: 'Demo User',
        email: 'demo@etherx.com',
        role: 'Owner',
        department: 'Engineering',
        status: 'active',
        storageBytes: 984500000, // ~984 MB
        aiCreditsUsed: 2890,
        lastActiveAt: new Date(now - 4 * 60 * 1000).toISOString(),
        joinedAt: new Date(now - 180 * dayMs).toISOString(),
      },
      {
        id: 'mem_sarah',
        userId: 'user_sarah',
        name: 'Sarah Jenkins',
        email: 'sarah.j@etherx.com',
        role: 'Admin',
        department: 'Product',
        status: 'active',
        storageBytes: 642000000,
        aiCreditsUsed: 1940,
        lastActiveAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        joinedAt: new Date(now - 120 * dayMs).toISOString(),
      },
      {
        id: 'mem_michael',
        userId: 'user_michael',
        name: 'Michael Chang',
        email: 'm.chang@etherx.com',
        role: 'Editor',
        department: 'Design',
        status: 'active',
        storageBytes: 1240000000,
        aiCreditsUsed: 870,
        lastActiveAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
        joinedAt: new Date(now - 90 * dayMs).toISOString(),
      },
      {
        id: 'mem_alex',
        userId: 'user_alex',
        name: 'Alex Morgan',
        email: 'a.morgan@etherx.com',
        role: 'Editor',
        department: 'Engineering',
        status: 'active',
        storageBytes: 810000000,
        aiCreditsUsed: 1420,
        lastActiveAt: new Date(now - 1 * dayMs).toISOString(),
        joinedAt: new Date(now - 75 * dayMs).toISOString(),
      },
      {
        id: 'mem_elena',
        userId: 'user_elena',
        name: 'Elena Rostov',
        email: 'elena.r@etherx.com',
        role: 'Viewer',
        department: 'Legal',
        status: 'active',
        storageBytes: 140000000,
        aiCreditsUsed: 120,
        lastActiveAt: new Date(now - 2 * dayMs).toISOString(),
        joinedAt: new Date(now - 40 * dayMs).toISOString(),
      },
      {
        id: 'mem_david',
        userId: 'user_david',
        name: 'David Vance',
        email: 'd.vance@etherx.com',
        role: 'Viewer',
        department: 'Marketing',
        status: 'deactivated',
        storageBytes: 95000000,
        aiCreditsUsed: 40,
        lastActiveAt: new Date(now - 28 * dayMs).toISOString(),
        joinedAt: new Date(now - 60 * dayMs).toISOString(),
      },
    ],
    auditLogs: [
      {
        id: 'log_1',
        orgId: 'org_etherx_pro',
        actor: { id: 'user_padmaja', name: 'Padmaja Biswal', email: 'biswalpadmaja411@gmail.com', role: 'Owner' },
        action: 'ORG_INITIALIZED',
        target: { id: 'org_etherx_pro', name: 'EtherX Global Technologies', type: 'organization' },
        details: { tier: 'pro', seats: 25, billing: 'annual' },
        ipAddress: '127.0.0.1',
        createdAt: new Date(now - 180 * dayMs).toISOString(),
      },
      {
        id: 'log_2',
        orgId: 'org_etherx_pro',
        actor: { id: 'user_padmaja', name: 'Padmaja Biswal', email: 'biswalpadmaja411@gmail.com', role: 'Owner' },
        action: 'USER_ROLE_CHANGED',
        target: { id: 'mem_sarah', name: 'Sarah Jenkins', type: 'user' },
        details: { oldRole: 'Editor', newRole: 'Admin' },
        ipAddress: '127.0.0.1',
        createdAt: new Date(now - 110 * dayMs).toISOString(),
      },
      {
        id: 'log_3',
        orgId: 'org_etherx_pro',
        actor: { id: 'user_sarah', name: 'Sarah Jenkins', email: 'sarah.j@etherx.com', role: 'Admin' },
        action: 'USER_INVITED',
        target: { id: 'mem_alex', name: 'Alex Morgan', type: 'user' },
        details: { role: 'Editor', department: 'Engineering' },
        ipAddress: '127.0.0.1',
        createdAt: new Date(now - 75 * dayMs).toISOString(),
      },
      {
        id: 'log_4',
        orgId: 'org_etherx_pro',
        actor: { id: 'user_padmaja', name: 'Padmaja Biswal', email: 'biswalpadmaja411@gmail.com', role: 'Owner' },
        action: 'SECURITY_SETTINGS_UPDATED',
        target: { id: 'org_etherx_pro', name: 'Security Policy', type: 'policy' },
        details: { ipAllowlistUpdated: true, ipsCount: 2 },
        ipAddress: '127.0.0.1',
        createdAt: new Date(now - 25 * dayMs).toISOString(),
      },
      {
        id: 'log_5',
        orgId: 'org_etherx_pro',
        actor: { id: 'user_sarah', name: 'Sarah Jenkins', email: 'sarah.j@etherx.com', role: 'Admin' },
        action: 'USER_STATUS_CHANGED',
        target: { id: 'mem_david', name: 'David Vance', type: 'user' },
        details: { oldStatus: 'active', newStatus: 'deactivated', reason: 'Contract ended' },
        ipAddress: '127.0.0.1',
        createdAt: new Date(now - 5 * dayMs).toISOString(),
      },
    ],
  };
}

function readAdminStore() {
  try {
    if (!fs.existsSync(ADMIN_STORE_FILE)) {
      const seed = getDefaultSeedData();
      writeAdminStore(seed);
      return seed;
    }
    const raw = fs.readFileSync(ADMIN_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed.organization || !Array.isArray(parsed.members)) {
      const seed = getDefaultSeedData();
      writeAdminStore(seed);
      return seed;
    }
    return parsed;
  } catch (err) {
    console.warn('readAdminStore error, resetting to seed:', err.message);
    const seed = getDefaultSeedData();
    writeAdminStore(seed);
    return seed;
  }
}

function writeAdminStore(data) {
  try {
    const dir = path.dirname(ADMIN_STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ADMIN_STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('writeAdminStore error:', err.message);
  }
}

// Sync user roles into users.json as well so auth routes reflect them
function syncRoleToUserStore(email, role, status = 'active', department = 'General') {
  try {
    if (!fs.existsSync(USERS_FILE)) return;
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const users = JSON.parse(raw || '[]');
    if (!Array.isArray(users)) return;
    let changed = false;
    for (const u of users) {
      if (u.email?.toLowerCase() === email?.toLowerCase()) {
        u.role = role;
        u.status = status;
        u.department = department;
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('syncRoleToUserStore error:', err.message);
  }
}

class AdminDataService {
  constructor() {
    // Ensure initial store is created and seeded
    readAdminStore();
  }

  getOrganization() {
    const store = readAdminStore();
    return store.organization;
  }

  updateOrganization(patch, actor) {
    const store = readAdminStore();
    store.organization = {
      ...store.organization,
      ...patch,
      settings: { ...store.organization.settings, ...(patch.settings || {}) },
      subscription: { ...store.organization.subscription, ...(patch.subscription || {}) },
    };
    writeAdminStore(store);

    if (actor) {
      this.addAuditLog({
        actor,
        action: 'ORGANIZATION_SETTINGS_UPDATED',
        target: { id: store.organization.id, name: store.organization.name, type: 'organization' },
        details: patch,
      });
    }

    return store.organization;
  }

  getMembers({ search, role, department, status } = {}) {
    const store = readAdminStore();
    let list = [...store.members];

    if (search) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
    }
    if (role && role !== 'all') {
      list = list.filter((m) => m.role.toLowerCase() === role.toLowerCase());
    }
    if (department && department !== 'all') {
      list = list.filter((m) => m.department.toLowerCase() === department.toLowerCase());
    }
    if (status && status !== 'all') {
      list = list.filter((m) => m.status.toLowerCase() === status.toLowerCase());
    }

    return list;
  }

  getMember(idOrEmail) {
    const store = readAdminStore();
    const needle = String(idOrEmail || '').toLowerCase();
    return store.members.find(
      (m) => m.id === idOrEmail || m.userId === idOrEmail || m.email.toLowerCase() === needle
    ) || null;
  }

  countOwners() {
    const store = readAdminStore();
    return store.members.filter((m) => m.role === 'Owner' && m.status === 'active').length;
  }

  addMember({ name, email, role = 'Viewer', department = 'General' }, actor) {
    const store = readAdminStore();
    const normalizedEmail = email.trim().toLowerCase();

    const existing = store.members.find((m) => m.email.toLowerCase() === normalizedEmail);
    if (existing) {
      throw new Error(`A member with email ${normalizedEmail} already exists in the organization.`);
    }

    const newMember = {
      id: `mem_${Date.now().toString(36)}`,
      userId: `user_${Date.now().toString(36)}`,
      name: name.trim(),
      email: normalizedEmail,
      role: role || 'Viewer',
      department: department || 'General',
      status: 'active',
      storageBytes: 0,
      aiCreditsUsed: 0,
      lastActiveAt: new Date().toISOString(),
      joinedAt: new Date().toISOString(),
      invitedBy: actor?.name || 'Administrator',
    };

    store.members.push(newMember);
    store.organization.seatsUsed = store.members.length;
    writeAdminStore(store);

    syncRoleToUserStore(newMember.email, newMember.role, newMember.status, newMember.department);

    this.addAuditLog({
      actor,
      action: 'USER_INVITED',
      target: { id: newMember.id, name: newMember.name, type: 'user' },
      details: { email: newMember.email, role: newMember.role, department: newMember.department },
    });

    return newMember;
  }

  addBulkMembers(membersList, actor) {
    const results = [];
    const errors = [];

    for (const item of membersList) {
      try {
        if (!item.email || !item.name) continue;
        const member = this.addMember(item, actor);
        results.push(member);
      } catch (err) {
        errors.push({ email: item.email, error: err.message });
      }
    }

    return { added: results, count: results.length, errors };
  }

  updateMemberRole(idOrEmail, newRole, actor) {
    const store = readAdminStore();
    const member = store.members.find(
      (m) => m.id === idOrEmail || m.userId === idOrEmail || m.email.toLowerCase() === String(idOrEmail).toLowerCase()
    );

    if (!member) {
      throw new Error('Member not found');
    }

    const oldRole = member.role;
    if (oldRole === newRole) {
      return member;
    }

    // Safeguard: Check if this action leaves the organization with 0 Owners
    if (oldRole === 'Owner' && newRole !== 'Owner') {
      const activeOwners = store.members.filter(
        (m) => m.role === 'Owner' && m.status === 'active' && m.id !== member.id
      ).length;
      if (activeOwners < 1) {
        throw new Error('Action blocked: Cannot demote the last remaining Owner of the organization.');
      }
    }

    member.role = newRole;
    writeAdminStore(store);
    syncRoleToUserStore(member.email, member.role, member.status, member.department);

    this.addAuditLog({
      actor,
      action: 'USER_ROLE_CHANGED',
      target: { id: member.id, name: member.name, type: 'user' },
      details: { oldRole, newRole, email: member.email },
    });

    return member;
  }

  updateMemberStatus(idOrEmail, newStatus, actor) {
    const store = readAdminStore();
    const member = store.members.find(
      (m) => m.id === idOrEmail || m.userId === idOrEmail || m.email.toLowerCase() === String(idOrEmail).toLowerCase()
    );

    if (!member) {
      throw new Error('Member not found');
    }

    const oldStatus = member.status;
    if (oldStatus === newStatus) {
      return member;
    }

    // Safeguard: Cannot deactivate the last Owner
    if (member.role === 'Owner' && newStatus === 'deactivated') {
      const remainingActiveOwners = store.members.filter(
        (m) => m.role === 'Owner' && m.status === 'active' && m.id !== member.id
      ).length;
      if (remainingActiveOwners < 1) {
        throw new Error('Action blocked: Cannot deactivate the last remaining Owner of the organization.');
      }
    }

    member.status = newStatus;
    writeAdminStore(store);
    syncRoleToUserStore(member.email, member.role, member.status, member.department);

    this.addAuditLog({
      actor,
      action: 'USER_STATUS_CHANGED',
      target: { id: member.id, name: member.name, type: 'user' },
      details: { oldStatus, newStatus, email: member.email },
    });

    return member;
  }

  removeMember(idOrEmail, actor) {
    const store = readAdminStore();
    const index = store.members.findIndex(
      (m) => m.id === idOrEmail || m.userId === idOrEmail || m.email.toLowerCase() === String(idOrEmail).toLowerCase()
    );

    if (index === -1) {
      throw new Error('Member not found');
    }

    const member = store.members[index];

    // Safeguard: Cannot remove the last Owner
    if (member.role === 'Owner') {
      const remainingOwners = store.members.filter(
        (m) => m.role === 'Owner' && m.id !== member.id && m.status === 'active'
      ).length;
      if (remainingOwners < 1) {
        throw new Error('Action blocked: Cannot remove the last remaining Owner of the organization.');
      }
    }

    store.members.splice(index, 1);
    store.organization.seatsUsed = store.members.length;
    writeAdminStore(store);

    this.addAuditLog({
      actor,
      action: 'USER_REMOVED',
      target: { id: member.id, name: member.name, type: 'user' },
      details: { email: member.email, role: member.role, department: member.department },
    });

    return { success: true, removed: member };
  }

  addAuditLog({ actor, action, target, details, ipAddress = '127.0.0.1' }) {
    const store = readAdminStore();
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orgId: store.organization.id || 'org_etherx_pro',
      actor: {
        id: actor?.id || actor?._id || 'unknown',
        name: actor?.name || 'Administrator',
        email: actor?.email || '',
        role: actor?.role || 'Admin',
      },
      action,
      target: target || { id: null, name: null, type: 'system' },
      details: details || {},
      ipAddress: ipAddress || '127.0.0.1',
      createdAt: new Date().toISOString(),
    };

    store.auditLogs.unshift(entry);
    if (store.auditLogs.length > 500) {
      store.auditLogs = store.auditLogs.slice(0, 500);
    }
    writeAdminStore(store);
    return entry;
  }

  getAuditLogs({ limit = 50, offset = 0, search = '', action = '' } = {}) {
    const store = readAdminStore();
    let logs = [...store.auditLogs];

    if (action && action !== 'all') {
      logs = logs.filter((l) => l.action.toLowerCase() === action.toLowerCase());
    }
    if (search) {
      const q = search.trim().toLowerCase();
      logs = logs.filter(
        (l) =>
          l.actor?.name?.toLowerCase().includes(q) ||
          l.actor?.email?.toLowerCase().includes(q) ||
          l.action?.toLowerCase().includes(q) ||
          l.target?.name?.toLowerCase().includes(q)
      );
    }

    const total = logs.length;
    const paginated = logs.slice(offset, offset + limit);

    return { logs: paginated, total, limit, offset };
  }

  getTeams() {
    const store = readAdminStore();
    const departmentsMap = {};

    for (const m of store.members) {
      const dept = m.department || 'General';
      if (!departmentsMap[dept]) {
        departmentsMap[dept] = {
          name: dept,
          memberCount: 0,
          storageBytes: 0,
          aiCreditsUsed: 0,
          members: [],
        };
      }
      departmentsMap[dept].memberCount += 1;
      departmentsMap[dept].storageBytes += m.storageBytes || 0;
      departmentsMap[dept].aiCreditsUsed += m.aiCreditsUsed || 0;
      departmentsMap[dept].members.push({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        status: m.status,
      });
    }

    return Object.values(departmentsMap);
  }

  getAnalytics(days = 30) {
    const store = readAdminStore();
    const count = Math.min(Math.max(days, 7), 90);
    const labels = [];
    const documentsCreated = [];
    const aiCredits = [];
    const storageGrowth = [];

    let currentStorageGB = 4.2;

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      labels.push(label);

      // Deterministic realistic curve
      const dayFactor = (i % 7 < 5) ? 1 : 0.3; // Weekdays vs weekends
      const docs = Math.round((8 + ((i * 3) % 12)) * dayFactor);
      const credits = Math.round((280 + ((i * 47) % 310)) * dayFactor);
      currentStorageGB += (docs * 0.015);

      documentsCreated.push(docs);
      aiCredits.push(credits);
      storageGrowth.push(parseFloat(currentStorageGB.toFixed(2)));
    }

    // Top consumers
    const topStorageUsers = [...store.members]
      .sort((a, b) => b.storageBytes - a.storageBytes)
      .slice(0, 5)
      .map((m) => ({
        name: m.name,
        email: m.email,
        department: m.department,
        storageBytes: m.storageBytes,
        storageDisplay: `${(m.storageBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      }));

    const topAiUsers = [...store.members]
      .sort((a, b) => b.aiCreditsUsed - a.aiCreditsUsed)
      .slice(0, 5)
      .map((m) => ({
        name: m.name,
        email: m.email,
        department: m.department,
        aiCreditsUsed: m.aiCreditsUsed,
      }));

    const activeMembers = store.members.filter((m) => m.status === 'active');
    const inactiveMembers = store.members.filter((m) => m.status !== 'active');

    return {
      timeframeDays: count,
      labels,
      metrics: {
        documentsCreated,
        aiCredits,
        storageGrowth,
      },
      topStorageUsers,
      topAiUsers,
      activeUsers: {
        dau: 5,
        mau: store.members.length,
        activeList: activeMembers,
        inactiveList: inactiveMembers,
      },
    };
  }
}

const adminDataService = new AdminDataService();
module.exports = adminDataService;
