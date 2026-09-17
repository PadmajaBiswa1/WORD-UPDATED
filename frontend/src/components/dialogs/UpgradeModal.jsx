// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Upgrade Subscription Modal
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Check, X, ShieldCheck, Zap, ArrowRight, Lock } from 'lucide-react';
import { useSubscriptionStore } from '@/store';
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 7, 10, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: 'var(--font-ui, Inter, sans-serif)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeUpgradeModal();
      }}
    >
      <div
        style={{
          background: '#121316',
          border: '1px solid #2a2c33',
          borderRadius: 16,
          width: '100%',
          maxWidth: 780,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 25px rgba(201, 168, 76, 0.15)',
          color: '#f4f4f5',
          padding: 32,
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={closeUpgradeModal}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'transparent',
            border: 'none',
            color: '#71717a',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#27272a'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={20} />
        </button>

        {/* Header with trigger reason */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(201, 168, 76, 0.12)',
            border: '1px solid rgba(201, 168, 76, 0.3)',
            color: '#c9a84c',
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 12,
          }}>
            {upgradeReason ? <Lock size={13} /> : <Zap size={13} />}
            {upgradeReason ? 'Feature Locked' : 'Plans & Pricing'}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
            {upgradeReason ? 'Unlock the Full Power of EtherX Word' : 'EtherX Word Plans & Pricing'}
          </h2>
          <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0, maxWidth: 540, marginLeft: 'auto', marginRight: 'auto' }}>
            {upgradeReason || 'Choose the perfect plan for your writing and collaboration needs.'}
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'flex',
            background: '#1c1d22',
            padding: 4,
            borderRadius: 10,
            border: '1px solid #27272a',
            alignItems: 'center',
          }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                background: billingCycle === 'monthly' ? '#2e3038' : 'transparent',
                border: 'none',
                color: billingCycle === 'monthly' ? '#ffffff' : '#a1a1aa',
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
                background: billingCycle === 'yearly' ? '#2e3038' : 'transparent',
                border: 'none',
                color: billingCycle === 'yearly' ? '#c9a84c' : '#a1a1aa',
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
                background: 'rgba(201, 168, 76, 0.2)',
                color: '#c9a84c',
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Basic Tier Card */}
          <div style={{
            background: '#18191e',
            border: targetTier === 'basic' ? '1px solid #4fc3f7' : '1px solid #27272a',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#ffffff' }}>{basicTier.name}</h3>
                <p style={{ fontSize: 11, color: '#71717a', margin: '3px 0 0 0' }}>For growing writers & teams</p>
              </div>
              <span style={{
                background: 'rgba(79, 195, 247, 0.12)',
                color: '#4fc3f7',
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                fontWeight: 600,
              }}>
                {basicTier.badge}
              </span>
            </div>

            <div style={{ margin: '14px 0 18px 0' }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#ffffff' }}>
                {billingCycle === 'yearly' ? '₹1,299' : '₹149'}
              </span>
              <span style={{ fontSize: 12, color: '#71717a' }}>
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
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#d4d4d8' }}>
                  <Check size={14} color="#4fc3f7" strokeWidth={2.5} />
                  <span>{feat}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#52525b' }}>
                <X size={14} color="#52525b" />
                <span>Pragna AI writing assistant (Pro only)</span>
              </div>
            </div>

            <button
              onClick={() => handleUpgradeClick('basic')}
              disabled={loading || plan === 'basic'}
              style={{
                width: '100%',
                padding: '11px 16px',
                background: plan === 'basic' ? '#27272a' : 'transparent',
                border: '1px solid #4fc3f7',
                color: plan === 'basic' ? '#a1a1aa' : '#4fc3f7',
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
                if (plan !== 'basic') { e.currentTarget.style.background = '#4fc3f7'; e.currentTarget.style.color = '#000'; }
              }}
              onMouseLeave={(e) => {
                if (plan !== 'basic') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4fc3f7'; }
              }}
            >
              {plan === 'basic' ? 'Current Plan' : 'Upgrade to Basic via Razorpay'}
            </button>
          </div>

          {/* Pro Tier Card */}
          <div style={{
            background: 'linear-gradient(180deg, #1e1b14 0%, #151411 100%)',
            border: '1px solid #c9a84c',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 0 20px rgba(201, 168, 76, 0.1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#c9a84c' }}>{proTier.name}</h3>
                <p style={{ fontSize: 11, color: '#a1a1aa', margin: '3px 0 0 0' }}>Ultimate AI & Collaboration Power</p>
              </div>
              <span style={{
                background: 'rgba(201, 168, 76, 0.2)',
                color: '#c9a84c',
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
              <span style={{ fontSize: 28, fontWeight: 800, color: '#ffffff' }}>
                {billingCycle === 'yearly' ? '₹3,999' : '₹399'}
              </span>
              <span style={{ fontSize: 12, color: '#a1a1aa' }}>
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
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: i === 1 ? '#c9a84c' : '#f4f4f5', fontWeight: i === 1 ? 600 : 400 }}>
                  {i === 1 ? <Sparkles size={14} color="#c9a84c" /> : <Check size={14} color="#c9a84c" strokeWidth={2.5} />}
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
                background: plan === 'pro' ? '#27272a' : '#c9a84c',
                border: 'none',
                color: plan === 'pro' ? '#a1a1aa' : '#000000',
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
                if (plan !== 'pro') e.currentTarget.style.background = '#d9bb67';
              }}
              onMouseLeave={(e) => {
                if (plan !== 'pro') e.currentTarget.style.background = '#c9a84c';
              }}
            >
              <Zap size={14} fill={plan === 'pro' ? 'none' : '#000'} />
              {plan === 'pro' ? 'Current Plan' : 'Upgrade to Pro via Razorpay'}
            </button>
          </div>
        </div>

        {/* Footer info & dev helper */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #27272a',
          paddingTop: 16,
          fontSize: 11,
          color: '#71717a',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={14} color="#c9a84c" />
              Secured by Razorpay • UPI, Cards & NetBanking
            </span>
            <span>•</span>
            <button
              onClick={() => {
                closeUpgradeModal();
                navigate('/pricing', { state: { scrollTo: 'comparison-table' } });
              }}
              style={{ background: 'none', border: 'none', color: '#c9a84c', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 11 }}
            >
              View Full Comparison Table →
            </button>
          </div>

          {/* Dev Switch Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#52525b' }}>Demo Switch:</span>
            {['free', 'basic', 'pro'].map((t) => (
              <button
                key={t}
                onClick={() => handleDevSwitch(t)}
                style={{
                  background: plan === t ? '#c9a84c' : '#27272a',
                  color: plan === t ? '#000' : '#a1a1aa',
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
        </div>
      </div>
    </div>
  );
}
