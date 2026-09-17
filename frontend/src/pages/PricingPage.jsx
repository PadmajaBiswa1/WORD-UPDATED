// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Plans & Pricing Page (/pricing)
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Check, X, Sparkles, Shield, ArrowLeft, Zap, Lock,
  HelpCircle, ChevronDown, ChevronUp, FileText, Users, HardDrive, Clock, ExternalLink
} from 'lucide-react';
import { useSubscriptionStore } from '@/store';
import { SUBSCRIPTION_TIERS, TIER_ORDER } from '@/config/subscriptionTiers';
import { getStoredUser } from '@/services/api';

export function PricingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { plan, billingCycle: currentCycle, initiateUpgrade, switchPlan, fetchSubscription, loading } = useSubscriptionStore();
  const [billingCycle, setBillingCycle] = useState(currentCycle || 'monthly');
  const [openFaq, setOpenFaq] = useState(null);
  const user = getStoredUser();

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    if (location.state?.scrollTo === 'comparison-table') {
      const timer = setTimeout(() => {
        const el = document.getElementById('comparison-table');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const handleAction = async (tierId) => {
    if (tierId === plan) return;
    if (tierId === 'free') {
      await switchPlan('free', billingCycle);
    } else {
      await initiateUpgrade(tierId, billingCycle);
    }
  };

  const faqs = [
    {
      q: 'Which payment methods are accepted for EtherX subscriptions?',
      a: 'We process all payments via Razorpay in Indian Rupees (INR). You can pay via UPI (Google Pay, PhonePe, Paytm, BHIM), all major Credit/Debit Cards (Visa, Mastercard, RuPay, Amex), and Net Banking across 50+ Indian banks.',
    },
    {
      q: 'What happens when I reach the 5-document limit on the Free plan?',
      a: 'Your existing documents remain safe, accessible, and editable forever. To create your 6th document or upload more files, simply upgrade to Basic (₹149/mo) or Pro (₹399/mo) for unlimited documents.',
    },
    {
      q: 'How does real-time collaboration work across plans?',
      a: 'The Free tier is for single-user editing. The Basic plan allows you to invite up to 3 collaborators per document for live co-authoring. The Pro plan provides unlimited collaborators, track changes, comment threads, and @mentions.',
    },
    {
      q: 'What AI tools are included in EtherX Pro?',
      a: 'EtherX Pro includes our full Pragna AI writing assistant: real-time grammar and spell polish, contextual rephrasing (formal, concise, persuasive), instant document summarization, draft generation, and web-grounded research assistance.',
    },
    {
      q: 'Can I cancel or change plans anytime?',
      a: 'Yes, you can upgrade, downgrade, or cancel your subscription at any time without penalty. When downgrading, your existing documents remain preserved.',
    },
  ];

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      overflowY: 'auto',
      overflowX: 'hidden',
      background: '#090a0f',
      color: '#f4f4f5',
      fontFamily: 'var(--font-ui, Inter, -apple-system, sans-serif)',
      display: 'flex',
      flexDirection: 'column',
      scrollBehavior: 'smooth',
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* ── Top Navigation Bar ── */}
      <header style={{
        height: 64,
        borderBottom: '1px solid #1c1e24',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        background: '#0e1015',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              background: 'transparent',
              border: '1px solid #27272a',
              color: '#a1a1aa',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#c9a84c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#27272a'; }}
          >
            <ArrowLeft size={16} />
            Back to Documents
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/assets/etherxlogo.png" alt="EtherX" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#ffffff', letterSpacing: '0.2px' }}>
              EtherX <span style={{ color: '#c9a84c' }}>Word</span>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            fontSize: 12,
            color: '#a1a1aa',
            background: '#18191f',
            padding: '5px 12px',
            borderRadius: 20,
            border: '1px solid #2a2c35',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>Current Plan:</span>
            <span style={{
              fontWeight: 700,
              textTransform: 'uppercase',
              color: plan === 'pro' ? '#c9a84c' : plan === 'basic' ? '#4fc3f7' : '#a1a1aa',
            }}>
              {plan}
            </span>
          </div>

          {user?.name ? (
            <span style={{ fontSize: 13, color: '#d4d4d8' }}>{user.name}</span>
          ) : (
            <Link to="/signin" style={{ color: '#c9a84c', fontSize: 13, textDecoration: 'none' }}>
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section style={{ textAlign: 'center', padding: '56px 20px 32px 20px', maxWidth: 840, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(201, 168, 76, 0.12)',
          border: '1px solid rgba(201, 168, 76, 0.3)',
          color: '#c9a84c',
          padding: '4px 14px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 16,
        }}>
          <Sparkles size={13} />
          Plans & Pricing (INR Billing)
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 800, margin: '0 0 14px 0', color: '#ffffff', letterSpacing: '-0.5px' }}>
          Predictable pricing for individuals and modern teams
        </h1>
        <p style={{ fontSize: 16, color: '#a1a1aa', margin: '0 auto', maxWidth: 640, lineHeight: 1.6 }}>
          Whether you need lightweight personal document writing or full-fledged AI copilot editing with real-time collaboration, EtherX has a tier tailored for you.
        </p>

        {/* Billing Cycle Toggle */}
        <div style={{ display: 'inline-flex', marginTop: 32 }}>
          <div style={{
            display: 'flex',
            background: '#15161c',
            padding: 4,
            borderRadius: 12,
            border: '1px solid #282a32',
            alignItems: 'center',
          }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                background: billingCycle === 'monthly' ? '#272932' : 'transparent',
                border: 'none',
                color: billingCycle === 'monthly' ? '#ffffff' : '#8e909a',
                padding: '9px 20px',
                borderRadius: 8,
                fontSize: 13,
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
                background: billingCycle === 'yearly' ? '#272932' : 'transparent',
                border: 'none',
                color: billingCycle === 'yearly' ? '#c9a84c' : '#8e909a',
                padding: '9px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
            >
              Annual Billing
              <span style={{
                fontSize: 10,
                background: 'rgba(201, 168, 76, 0.2)',
                color: '#c9a84c',
                padding: '2px 7px',
                borderRadius: 4,
                fontWeight: 700,
              }}>
                Save up to 27%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── 3 Side-by-Side Pricing Cards ── */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px 60px 24px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
          alignItems: 'stretch',
        }}>
          {/* TIER 1: FREE */}
          <div style={{
            background: '#111217',
            border: plan === 'free' ? '2px solid #52525b' : '1px solid #23252d',
            borderRadius: 16,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}>
            {plan === 'free' && (
              <span style={{
                position: 'absolute', top: -12, left: 24,
                background: '#3f3f46', color: '#fff', fontSize: 10,
                fontWeight: 700, padding: '2px 10px', borderRadius: 10, textTransform: 'uppercase',
              }}>
                Current Plan
              </span>
            )}
            <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>Free</h3>
            <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 20px 0', minHeight: 36 }}>
              {SUBSCRIPTION_TIERS.free.tagline}
            </p>

            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 38, fontWeight: 800, color: '#ffffff' }}>₹0</span>
              <span style={{ fontSize: 13, color: '#71717a', marginLeft: 4 }}>/ forever</span>
            </div>

            <button
              onClick={() => handleAction('free')}
              disabled={plan === 'free' || loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                background: plan === 'free' ? '#27272a' : 'transparent',
                border: '1px solid #3f3f46',
                color: plan === 'free' ? '#a1a1aa' : '#ffffff',
                fontWeight: 600, fontSize: 14, cursor: plan === 'free' ? 'default' : 'pointer',
                marginBottom: 28, transition: 'all 0.15s ease',
              }}
            >
              {plan === 'free' ? 'Current Plan' : 'Downgrade to Free'}
            </button>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {SUBSCRIPTION_TIERS.free.featureHighlights.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                  color: item.included ? '#d4d4d8' : '#52525b',
                }}>
                  {item.included ? (
                    <Check size={16} color="#a1a1aa" strokeWidth={2.5} />
                  ) : (
                    <X size={16} color="#3f3f46" />
                  )}
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TIER 2: BASIC */}
          <div style={{
            background: '#12141c',
            border: plan === 'basic' ? '2px solid #4fc3f7' : '1px solid #1f2536',
            borderRadius: 16,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}>
            <span style={{
              position: 'absolute', top: -12, left: 24,
              background: '#0288d1', color: '#fff', fontSize: 10,
              fontWeight: 700, padding: '2px 10px', borderRadius: 10, textTransform: 'uppercase',
            }}>
              {plan === 'basic' ? 'Current Plan' : 'Most Popular'}
            </span>

            <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>Basic</h3>
            <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 20px 0', minHeight: 36 }}>
              {SUBSCRIPTION_TIERS.basic.tagline}
            </p>

            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 38, fontWeight: 800, color: '#ffffff' }}>
                {billingCycle === 'yearly' ? '₹1,299' : '₹149'}
              </span>
              <span style={{ fontSize: 13, color: '#71717a', marginLeft: 4 }}>
                {billingCycle === 'yearly' ? '/ year' : '/ month'}
              </span>
            </div>

            <button
              onClick={() => handleAction('basic')}
              disabled={plan === 'basic' || loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                background: plan === 'basic' ? '#27272a' : '#0288d1',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600, fontSize: 14, cursor: plan === 'basic' ? 'default' : 'pointer',
                marginBottom: 28, transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (plan !== 'basic') e.currentTarget.style.background = '#039be5'; }}
              onMouseLeave={(e) => { if (plan !== 'basic') e.currentTarget.style.background = '#0288d1'; }}
            >
              {plan === 'basic' ? 'Current Plan' : 'Upgrade to Basic via Razorpay'}
            </button>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {SUBSCRIPTION_TIERS.basic.featureHighlights.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                  color: item.included ? '#d4d4d8' : '#52525b',
                }}>
                  {item.included ? (
                    <Check size={16} color="#4fc3f7" strokeWidth={2.5} />
                  ) : (
                    <X size={16} color="#3f3f46" />
                  )}
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TIER 3: PRO */}
          <div style={{
            background: 'linear-gradient(180deg, #1f1b13 0%, #141310 100%)',
            border: '2px solid #c9a84c',
            borderRadius: 16,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 0 35px rgba(201, 168, 76, 0.15)',
          }}>
            <span style={{
              position: 'absolute', top: -12, left: 24,
              background: '#c9a84c', color: '#000', fontSize: 10,
              fontWeight: 800, padding: '2px 12px', borderRadius: 10, textTransform: 'uppercase',
            }}>
              {plan === 'pro' ? 'Current Plan' : 'Best Value'}
            </span>

            <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px 0', color: '#c9a84c' }}>Pro</h3>
            <p style={{ fontSize: 13, color: '#a1a1aa', margin: '0 0 20px 0', minHeight: 36 }}>
              {SUBSCRIPTION_TIERS.pro.tagline}
            </p>

            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 38, fontWeight: 800, color: '#ffffff' }}>
                {billingCycle === 'yearly' ? '₹3,999' : '₹399'}
              </span>
              <span style={{ fontSize: 13, color: '#a1a1aa', marginLeft: 4 }}>
                {billingCycle === 'yearly' ? '/ year' : '/ month'}
              </span>
            </div>

            <button
              onClick={() => handleAction('pro')}
              disabled={plan === 'pro' || loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                background: plan === 'pro' ? '#27272a' : '#c9a84c',
                border: 'none',
                color: plan === 'pro' ? '#a1a1aa' : '#000000',
                fontWeight: 700, fontSize: 14, cursor: plan === 'pro' ? 'default' : 'pointer',
                marginBottom: 28, transition: 'all 0.15s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
              onMouseEnter={(e) => { if (plan !== 'pro') e.currentTarget.style.background = '#d9bb67'; }}
              onMouseLeave={(e) => { if (plan !== 'pro') e.currentTarget.style.background = '#c9a84c'; }}
            >
              <Zap size={16} fill={plan === 'pro' ? 'none' : '#000'} />
              {plan === 'pro' ? 'Current Plan' : 'Upgrade to Pro via Razorpay'}
            </button>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {SUBSCRIPTION_TIERS.pro.featureHighlights.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                  color: item.included ? '#ffffff' : '#52525b',
                  fontWeight: idx === 5 ? 600 : 400,
                }}>
                  {idx === 5 ? (
                    <Sparkles size={16} color="#c9a84c" />
                  ) : (
                    <Check size={16} color="#c9a84c" strokeWidth={2.5} />
                  )}
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Comparison Matrix Table ── */}
      <section id="comparison-table" style={{ maxWidth: 1040, margin: '0 auto 60px auto', padding: '0 24px', width: '100%', boxSizing: 'border-box' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 28, color: '#ffffff' }}>
          Detailed Feature Comparison
        </h2>

        <div style={{
          background: '#111216',
          border: '1px solid #23252d',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#171922', borderBottom: '1px solid #282a36' }}>
                <th style={{ padding: '16px 20px', color: '#a1a1aa', fontWeight: 600, width: '40%' }}>Feature</th>
                <th style={{ padding: '16px 20px', color: '#ffffff', fontWeight: 600, width: '20%', textAlign: 'center' }}>Free</th>
                <th style={{ padding: '16px 20px', color: '#4fc3f7', fontWeight: 600, width: '20%', textAlign: 'center' }}>Basic</th>
                <th style={{ padding: '16px 20px', color: '#c9a84c', fontWeight: 700, width: '20%', textAlign: 'center' }}>Pro</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Document Limit', free: 'Max 5 documents', basic: 'Unlimited', pro: 'Unlimited' },
                { name: 'Cloud Storage', free: '500 MB', basic: '15 GB', pro: 'Unlimited' },
                { name: 'Export Formats', free: 'PDF, DOCX', basic: 'DOCX, PDF, ODT, MD', pro: 'All (PDF, DOCX, ODT, MD, HTML, EPUB)' },
                { name: 'Real-Time Collaboration', free: 'Single-user only', basic: 'Up to 3 per doc', pro: 'Unlimited collaborators' },
                { name: 'Comments & @Mentions', free: '❌ No', basic: 'Comments only', pro: 'Comments + @Mentions' },
                { name: 'Track Changes & Audit Trail', free: '❌ No', basic: '❌ No', pro: '✅ Included' },
                { name: 'Version History Retention', free: '48 hours', basic: '60 days', pro: 'Full history + restore' },
                { name: 'Pragna AI Writing Suite', free: '❌ No', basic: '❌ No', pro: '✅ Unlimited (Grammar, Polish, Rewrite)' },
                { name: 'Templates Library', free: '3–5 basic templates', basic: 'Expanded library', pro: 'Custom + Brand kits' },
                { name: 'Auto Table of Contents', free: 'Basic', basic: 'Standard', pro: 'Advanced Auto-generated' },
                { name: 'Offline Mode with Autosync', free: '❌ No', basic: '✅ Basic', pro: '✅ Advanced' },
                { name: 'Support', free: 'Community', basic: 'Email support', pro: '24/7 Priority support' },
              ].map((row, idx) => (
                <tr key={idx} style={{
                  borderBottom: '1px solid #1c1d25',
                  background: idx % 2 === 0 ? 'transparent' : '#14151b',
                }}>
                  <td style={{ padding: '14px 20px', color: '#e4e4e7', fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'center', color: '#a1a1aa' }}>{row.free}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'center', color: '#e4e4e7' }}>{row.basic}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'center', color: '#c9a84c', fontWeight: 600 }}>{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section style={{ maxWidth: 840, margin: '0 auto 60px auto', padding: '0 24px', width: '100%', boxSizing: 'border-box' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 28, color: '#ffffff' }}>
          Frequently Asked Questions
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                onClick={() => setOpenFaq(isOpen ? null : idx)}
                style={{
                  background: '#111217',
                  border: '1px solid #23252d',
                  borderRadius: 10,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#ffffff' }}>{faq.q}</span>
                  {isOpen ? <ChevronUp size={18} color="#c9a84c" /> : <ChevronDown size={18} color="#71717a" />}
                </div>
                {isOpen && (
                  <p style={{ margin: '12px 0 0 0', fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Developer Testing Bar ── */}
      <footer style={{
        marginTop: 'auto',
        background: '#0d0e12',
        borderTop: '1px solid #1c1e24',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 12,
        color: '#71717a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={16} color="#c9a84c" />
          <span>Razorpay INR payment gateway integration ready. Instant simulated activation in sandbox mode.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#a1a1aa' }}>Dev Tier Switch:</span>
          {TIER_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => switchPlan(t, billingCycle)}
              style={{
                background: plan === t ? '#c9a84c' : '#1c1d22',
                color: plan === t ? '#000' : '#a1a1aa',
                border: '1px solid #2a2c34',
                padding: '3px 9px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
