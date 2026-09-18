import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, BarChart3, FolderLock,
  ShieldCheck, ArrowLeft, Building2, Bell, CheckCircle2, Shield
} from 'lucide-react';
import { getStoredUser } from '@/services/adminApi';
import { OverviewSection } from './sections/OverviewSection';
import { UsersRolesSection } from './sections/UsersRolesSection';
import { SubscriptionSection } from './sections/SubscriptionSection';
import { UsageAnalyticsSection } from './sections/UsageAnalyticsSection';
import { DocumentsSharingSection } from './sections/DocumentsSharingSection';
import { SecuritySection } from './sections/SecuritySection';

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, desc: 'Executive KPIs & activity' },
  { key: 'users', label: 'Users & Roles', icon: Users, desc: 'Members, invites & permissions' },
  { key: 'subscription', label: 'Subscription', icon: CreditCard, desc: 'Seats, renewals & billing' },
  { key: 'analytics', label: 'Usage & Analytics', icon: BarChart3, desc: 'Velocity, storage & AI usage' },
  { key: 'documents', label: 'Documents & Sharing', icon: FolderLock, desc: 'Org documents & access policies' },
  { key: 'security', label: 'Security & Access', icon: ShieldCheck, desc: 'Audit log, 2FA, SSO & IP filters' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const user = getStoredUser();

  // Stealth Access Guard:
  // Only Owner and Admin roles are permitted. All others are silently redirected to /home.
  const hasAdminAccess = user?.role === 'Owner' || user?.role === 'Admin';
  if (!hasAdminAccess) {
    return <Navigate to="/home" replace />;
  }

  const [activeTab, setActiveTab] = useState('overview');

  const currentNav = NAV_ITEMS.find((item) => item.key === activeTab) || NAV_ITEMS[0];

  return (
    <div style={styles.root}>
      {/* Admin Sidebar */}
      <aside style={styles.sidebar}>
        {/* Brand Header */}
        <div style={styles.brandHeader}>
          <div style={styles.logoRow}>
            <img src="/assets/etherxwordlogo.png" alt="EtherX Word" style={styles.logoImg} />
            <span style={styles.consoleBadge}>ADMIN</span>
          </div>
          <div style={styles.orgChip}>
            <Building2 size={13} color="#d4af37" />
            <span style={styles.orgChipText}>EtherX Global (Pro Org)</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                style={{
                  ...styles.navBtn,
                  ...(isActive ? styles.navBtnActive : {}),
                }}
                onClick={() => setActiveTab(item.key)}
              >
                <item.icon size={17} color={isActive ? '#d4af37' : '#9ca3af'} />
                <div style={styles.navLabelWrap}>
                  <span style={isActive ? styles.navLabelActive : styles.navLabel}>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* User Card & Back Button */}
        <div style={styles.sidebarFooter}>
          <div style={styles.userCard}>
            <div style={styles.userAvatar}>
              {(user?.name || 'Admin').slice(0, 2).toUpperCase()}
            </div>
            <div style={styles.userInfo}>
              <span style={styles.userName}>{user?.name || 'Administrator'}</span>
              <span
                style={{
                  ...styles.roleBadge,
                  color: '#d4af37',
                  background: 'rgba(212,175,55,0.12)',
                }}
              >
                {user?.role?.toUpperCase() || 'ADMIN'}
              </span>
            </div>
          </div>

          <button style={styles.backBtn} onClick={() => navigate('/home')}>
            <ArrowLeft size={15} />
            <span>Return to Word</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Viewport */}
      <main style={styles.main}>
        {/* Top Header */}
        <header style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>
              <span>EtherX Console</span> / <strong style={{ color: '#d4af37' }}>{currentNav.label}</strong>
            </div>
            <h1 style={styles.headerTitle}>{currentNav.label}</h1>
            <p style={styles.headerDesc}>{currentNav.desc}</p>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.proOrgPill}>
              <span style={styles.proDot} />
              <span>Pro Enterprise Tier</span>
            </div>

            <button style={styles.wordAppBtn} onClick={() => navigate('/home')}>
              <ArrowLeft size={14} />
              <span>Back to Editor</span>
            </button>
          </div>
        </header>

        {/* Content View Container */}
        <div style={styles.content}>
          {activeTab === 'overview' && <OverviewSection onNavigateTab={setActiveTab} />}
          {activeTab === 'users' && <UsersRolesSection />}
          {activeTab === 'subscription' && <SubscriptionSection />}
          {activeTab === 'analytics' && <UsageAnalyticsSection />}
          {activeTab === 'documents' && <DocumentsSharingSection />}
          {activeTab === 'security' && <SecuritySection />}
        </div>
      </main>
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: '#090b0e',
    color: '#f9fafb',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sidebar: {
    width: 260,
    background: '#0e1117',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    padding: '20px 14px',
  },
  brandHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    paddingBottom: 20,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoImg: {
    height: 32,
    objectFit: 'contain',
  },
  consoleBadge: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.1em',
    color: '#090b0e',
    background: '#d4af37',
    padding: '2px 7px',
    borderRadius: 4,
  },
  orgChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    padding: '6px 10px',
    borderRadius: 6,
  },
  orgChipText: {
    fontSize: 11,
    fontWeight: 600,
    color: '#d1d5db',
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    overflowY: 'auto',
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  navBtnActive: {
    background: 'rgba(212,175,55,0.1)',
    borderColor: 'rgba(212,175,55,0.25)',
  },
  navLabelWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  navLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: '#9ca3af',
  },
  navLabelActive: {
    fontSize: 13,
    fontWeight: 600,
    color: '#f9fafb',
  },
  sidebarFooter: {
    paddingTop: 16,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.05)',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #d4af37 0%, #856214 100%)',
    color: '#090b0e',
    fontWeight: 700,
    fontSize: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#f9fafb',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.08em',
    padding: '1px 5px',
    borderRadius: 3,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '9px 12px',
    color: '#d1d5db',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#090b0e',
    overflowY: 'auto',
  },
  header: {
    padding: '24px 36px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    background: '#0e1117',
  },
  breadcrumb: {
    fontSize: 11,
    color: '#8e9aa8',
    letterSpacing: '0.04em',
    marginBottom: 4,
  },
  headerTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#f9fafb',
    letterSpacing: '-0.02em',
  },
  headerDesc: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#9ca3af',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  proOrgPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: 'rgba(212,175,55,0.08)',
    border: '1px solid rgba(212,175,55,0.25)',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    color: '#d4af37',
  },
  proDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#d4af37',
    boxShadow: '0 0 6px rgba(212,175,55,0.8)',
  },
  wordAppBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: '7px 12px',
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  content: {
    padding: '28px 36px 40px',
    flex: 1,
  },
};
