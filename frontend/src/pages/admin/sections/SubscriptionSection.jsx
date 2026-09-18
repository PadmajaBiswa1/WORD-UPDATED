import { useState, useEffect } from 'react';
import {
  CreditCard, Key, ShieldCheck, AlertTriangle, CheckCircle2,
  Calendar, RefreshCw, Bell, ArrowUpRight, Plus, Minus
} from 'lucide-react';
import { adminApi, getStoredUser } from '@/services/adminApi';

export function SubscriptionSection() {
  const currentUser = getStoredUser();
  const isOwner = currentUser?.role === 'Owner';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Seat adjust modal
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [newSeatCount, setNewSeatCount] = useState(25);

  const fetchSubscription = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getSubscription();
      setData(res);
      setNewSeatCount(res.seatsTotal || 25);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const showToast = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4500);
  };

  const handleUpdateSeats = async () => {
    if (!isOwner) return;
    setBusy(true);
    try {
      await adminApi.updateSubscription({ seatsTotal: newSeatCount });
      showToast(`Seat capacity updated to ${newSeatCount} seats.`);
      setSeatModalOpen(false);
      fetchSubscription();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleGracePeriod = async () => {
    if (!isOwner) return;
    setBusy(true);
    try {
      const isCurrentlyGrace = data?.isGracePeriod;
      await adminApi.updateSubscription({ simulateGracePeriod: !isCurrentlyGrace });
      showToast(
        !isCurrentlyGrace
          ? 'Grace period simulation activated (7 days remaining).'
          : 'Grace period resolved. Plan restored to active.'
      );
      fetchSubscription();
    } catch (err) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSendReminder = async () => {
    if (!isOwner) return;
    setBusy(true);
    try {
      const res = await adminApi.sendRenewalReminder();
      showToast(res.message || 'Renewal reminder dispatched to billing team.');
    } catch (err) {
      alert(`Reminder failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div style={styles.loaderWrap}>Loading subscription details…</div>;
  }

  if (error) {
    return <div style={styles.errorWrap}>Error loading subscription: {error}</div>;
  }

  const { subscription, tier, seatsTotal, seatsUsed, seatsAvailable, daysUntilRenewal, isGracePeriod } = data || {};
  const seatPercent = Math.min(100, Math.round((seatsUsed / (seatsTotal || 1)) * 100));

  return (
    <div style={styles.container}>
      {notice && (
        <div style={styles.toast}>
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* Grace Period Alert Banner */}
      {isGracePeriod && (
        <div style={styles.graceAlert}>
          <AlertTriangle size={22} color="#d4af37" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#d4af37' }}>
              Subscription Grace Period Active — Action Required
            </h4>
            <p style={{ margin: 0, fontSize: 12, color: '#d1d5db', lineHeight: 1.4 }}>
              Payment renewal simulation has triggered a 7-day grace period. Team features remain fully active, but please update billing details before the grace window expires to avoid workspace suspension.
            </p>
          </div>
          {isOwner && (
            <button style={styles.graceResolveBtn} onClick={handleToggleGracePeriod} disabled={busy}>
              Resolve Payment
            </button>
          )}
        </div>
      )}

      {/* Top Grid: Plan Overview & Seat Allocation */}
      <div style={styles.topGrid}>
        {/* Pro Plan Card */}
        <div style={styles.planCard}>
          <div style={styles.cardHeader}>
            <div>
              <span style={styles.planPill}>CURRENT SUBSCRIPTION</span>
              <h2 style={styles.planTitle}>EtherX Word Pro Organization</h2>
              <p style={styles.planPrice}>
                ₹3,999 <span style={{ fontSize: 14, color: '#9ca3af', fontWeight: 400 }}>/ year (Billed Annually)</span>
              </p>
            </div>
            <div style={styles.planBadge}>ACTIVE PRO</div>
          </div>

          <div style={styles.planFeatures}>
            <div style={styles.featureItem}><CheckCircle2 size={15} color="#d4af37" /> Unlimited cloud document storage</div>
            <div style={styles.featureItem}><CheckCircle2 size={15} color="#d4af37" /> Unlimited real-time collaboration with track changes</div>
            <div style={styles.featureItem}><CheckCircle2 size={15} color="#d4af37" /> Pragna AI writing assistant (50,000 monthly credits)</div>
            <div style={styles.featureItem}><CheckCircle2 size={15} color="#d4af37" /> Custom templates, brand kits, full version audit trail</div>
            <div style={styles.featureItem}><CheckCircle2 size={15} color="#d4af37" /> Centralized admin console & role permissions</div>
          </div>

          <div style={styles.planFooter}>
            <div style={styles.dateMeta}>
              <Calendar size={15} color="#9ca3af" />
              <span>Next Renewal Date: <strong>{new Date(subscription?.renewalDate || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong> ({daysUntilRenewal} days remaining)</span>
            </div>

            {isOwner && (
              <button style={styles.reminderBtn} onClick={handleSendReminder} disabled={busy} title="Send renewal notice">
                <Bell size={14} />
                <span>Send Renewal Reminder</span>
              </button>
            )}
          </div>
        </div>

        {/* Seat Allocation Card */}
        <div style={styles.seatsCard}>
          <div style={styles.cardHeader}>
            <div>
              <span style={styles.planPill}>TEAM CAPACITY</span>
              <h3 style={styles.seatsTitle}>Member Seat Allocation</h3>
            </div>
            <div style={{ ...styles.planBadge, background: 'rgba(212,175,55,0.12)', color: '#d4af37', borderColor: 'rgba(212,175,55,0.3)' }}>
              {seatsUsed} / {seatsTotal} SEATS
            </div>
          </div>

          {/* Seat Meter */}
          <div style={styles.meterContainer}>
            <div style={styles.meterLabels}>
              <span>{seatsUsed} assigned</span>
              <span>{seatsAvailable} available</span>
            </div>
            <div style={styles.meterTrack}>
              <div style={{ ...styles.meterFill, width: `${seatPercent}%` }} />
            </div>
          </div>

          <div style={styles.seatStatsGrid}>
            <div style={styles.statBox}>
              <span style={styles.statNum}>{seatsTotal}</span>
              <span style={styles.statLabel}>Total Purchased</span>
            </div>
            <div style={styles.statBox}>
              <span style={{ ...styles.statNum, color: '#d4af37' }}>{seatsUsed}</span>
              <span style={styles.statLabel}>Active Members</span>
            </div>
            <div style={styles.statBox}>
              <span style={{ ...styles.statNum, color: '#d4af37' }}>{seatsAvailable}</span>
              <span style={styles.statLabel}>Available Seats</span>
            </div>
          </div>

          {/* Action Row */}
          <div style={styles.seatActionRow}>
            {isOwner ? (
              <>
                <button style={styles.seatAdjustBtn} onClick={() => setSeatModalOpen(true)}>
                  <Plus size={15} />
                  <span>Add / Adjust Seats</span>
                </button>
                <button
                  style={{
                    ...styles.simulateBtn,
                    borderColor: 'rgba(212,175,55,0.35)',
                    color: '#d4af37',
                  }}
                  onClick={handleToggleGracePeriod}
                  disabled={busy}
                >
                  <RefreshCw size={14} />
                  <span>{isGracePeriod ? 'Clear Grace Simulation' : 'Simulate Payment Grace'}</span>
                </button>
              </>
            ) : (
              <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                * Organization billing and seat adjustments are restricted to Owners.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Razorpay Billing & Invoicing Section */}
      <div style={styles.billingSection}>
        <div style={styles.sectionTitleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={18} color="#d4af37" />
            <h3 style={{ margin: 0, fontSize: 16, color: '#f9fafb' }}>Billing & Invoicing History</h3>
          </div>
          <span style={styles.badgeRazorpay}>Razorpay INR Gateway Enabled</span>
        </div>

        <div style={styles.invoiceTableWrap}>
          <table style={styles.invoiceTable}>
            <thead>
              <tr style={styles.invoiceThRow}>
                <th style={styles.invoiceTh}>INVOICE #</th>
                <th style={styles.invoiceTh}>BILLING PERIOD</th>
                <th style={styles.invoiceTh}>AMOUNT</th>
                <th style={styles.invoiceTh}>PAYMENT METHOD</th>
                <th style={styles.invoiceTh}>STATUS</th>
                <th style={{ ...styles.invoiceTh, textAlign: 'right' }}>RECEIPT</th>
              </tr>
            </thead>
            <tbody>
              <tr style={styles.invoiceTr}>
                <td style={styles.invoiceTd}><strong style={{ color: '#f3f4f6' }}>INV-2026-004</strong></td>
                <td style={styles.invoiceTd}>Apr 2026 – Apr 2027 (Annual)</td>
                <td style={styles.invoiceTd}><strong style={{ color: '#d4af37' }}>₹3,999.00</strong></td>
                <td style={styles.invoiceTd}>Razorpay UPI / Netbanking</td>
                <td style={styles.invoiceTd}><span style={styles.paidBadge}>PAID</span></td>
                <td style={{ ...styles.invoiceTd, textAlign: 'right' }}>
                  <button style={styles.receiptBtn} onClick={() => showToast('Receipt downloaded.')}>
                    Download
                  </button>
                </td>
              </tr>
              <tr style={styles.invoiceTr}>
                <td style={styles.invoiceTd}><strong style={{ color: '#f3f4f6' }}>INV-2025-001</strong></td>
                <td style={styles.invoiceTd}>Apr 2025 – Apr 2026 (Annual)</td>
                <td style={styles.invoiceTd}><strong style={{ color: '#d4af37' }}>₹3,999.00</strong></td>
                <td style={styles.invoiceTd}>Razorpay Corporate Card</td>
                <td style={styles.invoiceTd}><span style={styles.paidBadge}>PAID</span></td>
                <td style={{ ...styles.invoiceTd, textAlign: 'right' }}>
                  <button style={styles.receiptBtn} onClick={() => showToast('Receipt downloaded.')}>
                    Download
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Seats Modal */}
      {seatModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Adjust Organization Seats</h3>
              <button style={styles.modalCloseBtn} onClick={() => setSeatModalOpen(false)}>✕</button>
            </div>

            <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                Specify the maximum number of user seats allocated to this organization. Current assigned count: <strong>{seatsUsed}</strong>.
              </p>

              <div style={styles.stepperWrap}>
                <button
                  style={styles.stepperBtn}
                  onClick={() => setNewSeatCount(Math.max(seatsUsed, newSeatCount - 1))}
                  disabled={newSeatCount <= seatsUsed}
                >
                  <Minus size={16} />
                </button>
                <span style={styles.stepperValue}>{newSeatCount} Seats</span>
                <button
                  style={styles.stepperBtn}
                  onClick={() => setNewSeatCount(newSeatCount + 5)}
                >
                  <Plus size={16} />
                </button>
              </div>

              <div style={styles.seatTierCalc}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#d1d5db' }}>
                  <span>Base Pro Organization:</span>
                  <span>₹3,999 / year</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#d1d5db' }}>
                  <span>Total Seats Allocated:</span>
                  <strong style={{ color: '#d4af37' }}>{newSeatCount} seats</strong>
                </div>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setSeatModalOpen(false)}>Cancel</button>
              <button style={styles.submitBtn} onClick={handleUpdateSeats} disabled={busy}>
                {busy ? 'Updating…' : 'Confirm Seats'}
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
    gap: 24,
  },
  loaderWrap: {
    padding: 60,
    textAlign: 'center',
    color: '#8e9aa8',
    fontSize: 14,
  },
  errorWrap: {
    padding: 20,
    background: 'rgba(212,175,55,0.1)',
    color: '#d4af37',
    borderRadius: 8,
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
  graceAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '16px 20px',
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.35)',
    borderRadius: 10,
  },
  graceResolveBtn: {
    background: 'linear-gradient(135deg, #d4af37 0%, #aa8528 100%)',
    color: '#0b0d11',
    border: 'none',
    fontWeight: 700,
    fontSize: 12,
    padding: '8px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    flexShrink: 0,
  },
  topGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: 20,
  },
  planCard: {
    background: '#12161f',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: 12,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  planPill: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#d4af37',
  },
  planTitle: {
    margin: '4px 0 6px',
    fontSize: 20,
    fontWeight: 700,
    color: '#f9fafb',
  },
  planPrice: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: '#d4af37',
  },
  planBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#d4af37',
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.3)',
    padding: '4px 10px',
    borderRadius: 99,
  },
  planFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '14px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#d1d5db',
  },
  planFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  dateMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#9ca3af',
  },
  reminderBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 12px',
    cursor: 'pointer',
  },
  seatsCard: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  seatsTitle: {
    margin: '4px 0 0',
    fontSize: 18,
    fontWeight: 600,
    color: '#f9fafb',
  },
  meterContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  meterLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#9ca3af',
  },
  meterTrack: {
    height: 8,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #d4af37 0%, #aa8528 100%)',
    borderRadius: 4,
  },
  seatStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  statBox: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: '12px 10px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statNum: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f9fafb',
  },
  statLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  seatActionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 'auto',
  },
  seatAdjustBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'linear-gradient(135deg, #d4af37 0%, #aa8528 100%)',
    color: '#0b0d11',
    border: 'none',
    fontWeight: 600,
    fontSize: 13,
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  simulateBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid',
    fontWeight: 500,
    fontSize: 12,
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  billingSection: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  badgeRazorpay: {
    fontSize: 11,
    color: '#d4af37',
    background: 'rgba(212,175,55,0.1)',
    border: '1px solid rgba(212,175,55,0.25)',
    padding: '3px 9px',
    borderRadius: 4,
    fontWeight: 600,
  },
  invoiceTableWrap: {
    overflowX: 'auto',
  },
  invoiceTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  invoiceThRow: {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  invoiceTh: {
    padding: '10px 14px',
    fontSize: 11,
    color: '#8e9aa8',
    letterSpacing: '0.06em',
  },
  invoiceTr: {
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  invoiceTd: {
    padding: '14px',
    fontSize: 13,
    color: '#d1d5db',
    verticalAlign: 'middle',
  },
  paidBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#d4af37',
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.25)',
    padding: '2px 8px',
    borderRadius: 4,
  },
  receiptBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#d4af37',
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 6,
    cursor: 'pointer',
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
    maxWidth: 420,
    background: '#131722',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: 12,
    padding: 24,
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
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
    fontSize: 16,
  },
  stepperWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: '14px 0',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#d4af37',
  },
  seatTierCalc: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
  },
  cancelBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#e5e7eb',
    fontSize: 13,
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
};
