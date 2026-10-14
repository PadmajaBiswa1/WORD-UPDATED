// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Upgrade Subscription Modal
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Check, X, ShieldCheck, Zap } from 'lucide-react';
import { useSubscriptionStore } from '@/store';
import { Modal } from '@/components/ui';
import { SUBSCRIPTION_TIERS } from '@/config/subscriptionTiers';

export function UpgradeModal() {
  const navigate = useNavigate();
  const {
    upgradeModalOpen,
    closeUpgradeModal,
    upgradeReason,
    targetTier,
    plan,
    initiateUpgrade,
    switchPlan,
    loading,
  } = useSubscriptionStore();

  const [billingCycle, setBillingCycle] = useState('monthly');

  if (!upgradeModalOpen) return null;

  const basicTier = SUBSCRIPTION_TIERS.basic;
  const proTier = SUBSCRIPTION_TIERS.pro;

  const handleUpgradeClick = async (tierId) => {
    await initiateUpgrade(tierId, billingCycle);
  };

  const handleDevSwitch = async (tierId) => {
    await switchPlan(tierId, billingCycle);
  };

  return (
    <Modal title="Plans & pricing" icon={Zap} width={780} onClose={closeUpgradeModal}
      description={upgradeReason || 'Choose a plan for your writing and collaboration needs.'}>
        {/* Billing Cycle Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'flex',
            background: 'var(--popup-input-bg)',
            padding: 4,
            borderRadius: 10,
            border: '1px solid var(--border-strong)',
            alignItems: 'center',
          }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                background: billingCycle === 'monthly' ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                color: billingCycle === 'monthly' ? 'var(--text-primary)' : 'var(--text-secondary)',
                padding: '7px 16px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              style={{
                background: billingCycle === 'yearly' ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                color: billingCycle === 'yearly' ? 'var(--gold)' : 'var(--text-secondary)',
                padding: '7px 16px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              Annual Billing
              <span style={{
                fontSize: 10,
                background: 'var(--gold-dim)',
                color: 'var(--gold)',
                padding: '1px 6px',
                borderRadius: 4,
                fontWeight: 700,
              }}>
                Save up to 27%
              </span>
            </button>
          </div>
        </div>

        {/* Two Tier Cards Side by Side */}
        <div className="upgrade-plan-grid">
          {/* Basic Tier Card */}
          <div style={{
            background: 'var(--popup-input-bg)',
            border: targetTier === 'basic' ? '1px solid var(--gold)' : '1px solid var(--border-strong)',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{basicTier.name}</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>For growing writers & teams</p>
              </div>
              <span style={{
                background: 'var(--gold-dim)',
                color: 'var(--gold)',
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                fontWeight: 600,
              }}>
                {basicTier.badge}
              </span>
            </div>

            <div style={{ margin: '14px 0 18px 0' }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
                {billingCycle === 'yearly' ? '₹1,299' : '₹149'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {billingCycle === 'yearly' ? ' / year' : ' / month'}
              </span>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
              {[
                'Unlimited documents',
                '15 GB cloud storage',
                'DOCX, PDF, ODT & Markdown export',
                'Real-time collaboration (up to 3 per doc)',
                '60-day version history',
                'Expanded template library',
                'Offline mode with autosync',
              ].map((feat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <Check size={14} color="var(--gold)" strokeWidth={2.5} />
                  <span>{feat}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <X size={14} color="var(--text-muted)" />
                <span>Pragna AI writing assistant (Pro only)</span>
              </div>
            </div>

            <button
              onClick={() => handleUpgradeClick('basic')}
              disabled={loading || plan === 'basic'}
              style={{
                width: '100%',
                padding: '11px 16px',
                background: plan === 'basic' ? 'var(--border-strong)' : 'transparent',
                border: '1px solid var(--gold)',
                color: plan === 'basic' ? 'var(--text-secondary)' : 'var(--gold)',
                fontWeight: 600,
                fontSize: 13,
                borderRadius: 8,
                cursor: plan === 'basic' || loading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (plan !== 'basic') { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--text-on-gold)'; }
              }}
              onMouseLeave={(e) => {
                if (plan !== 'basic') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gold)'; }
              }}
            >
              {plan === 'basic' ? 'Current Plan' : 'Upgrade to Basic via Razorpay'}
            </button>
          </div>

          {/* Pro Tier Card */}
          <div style={{
            background: 'var(--gold-dim)',
            border: '1px solid var(--gold)',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 0 20px rgba(201, 168, 76, 0.1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--gold)' }}>{proTier.name}</h3>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>Ultimate AI & Collaboration Power</p>
              </div>
              <span style={{
                background: 'var(--gold-dim)',
                color: 'var(--gold)',
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                fontWeight: 700,
                border: '1px solid rgba(201, 168, 76, 0.3)',
              }}>
                {proTier.badge}
              </span>
            </div>

            <div style={{ margin: '14px 0 18px 0' }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
                {billingCycle === 'yearly' ? '₹3,999' : '₹399'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {billingCycle === 'yearly' ? ' / year' : ' / month'}
              </span>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
              {[
                'Everything in Basic +',
                'Pragna AI writing suite (grammar, rewrite, summarize)',
                'Unlimited storage & unlimited documents',
                'Unlimited real-time collaboration',
                'Track changes, comments & @mentions',
                'Full version history + restore & audit trail',
                'Custom templates & brand kits',
                'Priority 24/7 support',
              ].map((feat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: i === 1 ? 'var(--gold)' : 'var(--text-primary)', fontWeight: i === 1 ? 600 : 400 }}>
                  {i === 1 ? <Sparkles size={14} color="var(--gold)" /> : <Check size={14} color="var(--gold)" strokeWidth={2.5} />}
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleUpgradeClick('pro')}
              disabled={loading || plan === 'pro'}
              style={{
                width: '100%',
                padding: '11px 16px',
                background: plan === 'pro' ? 'var(--border-strong)' : 'var(--gold)',
                border: 'none',
                color: plan === 'pro' ? 'var(--text-secondary)' : 'var(--text-on-gold)',
                fontWeight: 700,
                fontSize: 13,
                borderRadius: 8,
                cursor: plan === 'pro' || loading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (plan !== 'pro') e.currentTarget.style.background = 'var(--gold-hover)';
              }}
              onMouseLeave={(e) => {
                if (plan !== 'pro') e.currentTarget.style.background = 'var(--gold)';
              }}
            >
              <Zap size={14} fill={plan === 'pro' ? 'none' : 'var(--text-on-gold)'} />
              {plan === 'pro' ? 'Current Plan' : 'Upgrade to Pro via Razorpay'}
            </button>
          </div>
        </div>

        {/* Footer info & dev helper */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
          alignItems: 'center',
          borderTop: '1px solid var(--border-strong)',
          paddingTop: 16,
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={14} color="var(--gold)" />
              Secured by Razorpay • UPI, Cards & NetBanking
            </span>
            <span>•</span>
            <button
              onClick={() => {
                closeUpgradeModal();
                navigate('/pricing', { state: { scrollTo: 'comparison-table' } });
              }}
              style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 11 }}
            >
              View Full Comparison Table →
            </button>
          </div>

          {/* Dev-only plan switch (the server refuses it in production) */}
          {import.meta.env.DEV && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Demo Switch:</span>
              {['free', 'basic', 'pro'].map((t) => (
                <button
                  key={t}
                  onClick={() => handleDevSwitch(t)}
                  style={{
                    background: plan === t ? 'var(--gold)' : 'var(--border-strong)',
                    color: plan === t ? 'var(--text-on-gold)' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 7px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
    </Modal>
  );
}
