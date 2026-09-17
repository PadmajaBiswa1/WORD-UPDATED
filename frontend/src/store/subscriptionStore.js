// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Subscription Zustand Store
// ═══════════════════════════════════════════════════════════════
import { create } from 'zustand';
import { SUBSCRIPTION_TIERS, getTier } from '@/config/subscriptionTiers';
import { getStoredUser } from '@/services/api';
import { openRazorpayCheckout } from '@/services/razorpay';

async function showToast(message, type = 'info') {
  try {
    const mod = await import('./index');
    mod.useUIStore?.getState()?.toast(message, type);
  } catch {
    console.log(`[Toast ${type}] ${message}`);
  }
}

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

function getToken() {
  return localStorage.getItem('etherx_token');
}

function getStoredPlan() {
  const user = getStoredUser();
  return String(user?.plan || 'free').toLowerCase();
}

function saveStoredUserPlan(plan, billingCycle, expiresAt) {
  try {
    const user = getStoredUser();
    const updated = {
      ...user,
      plan: String(plan).toLowerCase(),
      billingCycle: billingCycle || user.billingCycle || 'monthly',
      subscriptionExpiresAt: expiresAt || user.subscriptionExpiresAt,
    };
    localStorage.setItem('etherx_user', JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}

export const useSubscriptionStore = create((set, get) => ({
  plan: getStoredPlan(),
  billingCycle: 'monthly',
  subscriptionExpiresAt: null,
  loading: false,
  error: null,

  // Usage statistics
  usage: {
    docCount: 0,
    maxDocuments: 5,
    storageBytes: 0,
    maxStorageBytes: 500 * 1024 * 1024,
    storageDisplay: '500 MB',
    isDocLimitReached: false,
    isStorageLimitReached: false,
  },

  // Upgrade modal state
  upgradeModalOpen: false,
  upgradeReason: '',
  targetTier: 'pro',

  openUpgradeModal: (reason = '', targetTier = 'pro') => {
    set({
      upgradeModalOpen: true,
      upgradeReason: reason || '',
      targetTier: targetTier || 'pro',
    });
  },

  closeUpgradeModal: () => {
    set({
      upgradeModalOpen: false,
      upgradeReason: '',
    });
  },

  fetchSubscription: async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/subscription/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) return;
      const data = await res.json();

      set({
        plan: data.plan || 'free',
        billingCycle: data.billingCycle || 'monthly',
        subscriptionExpiresAt: data.subscriptionExpiresAt || null,
        usage: data.usage || get().usage,
      });

      saveStoredUserPlan(data.plan, data.billingCycle, data.subscriptionExpiresAt);
    } catch (err) {
      console.warn('fetchSubscription failed:', err.message);
    }
  },

  /**
   * Initiates Razorpay checkout flow to upgrade plan.
   */
  initiateUpgrade: async (tierId = 'pro', billingCycle = 'monthly') => {
    const token = getToken();
    const user = getStoredUser();
    if (!token) {
      showToast('Please sign in to upgrade your subscription', 'error');
      return { success: false };
    }

    set({ loading: true, error: null });

    try {
      // 1. Create Razorpay order on backend
      const orderRes = await fetch(`${API_BASE}/subscription/create-order`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tierId, billingCycle }),
      });

      if (!orderRes.ok) {
        const errText = await orderRes.text();
        throw new Error(errText || 'Failed to create order');
      }

      const orderData = await orderRes.json();

      // 2. Open Razorpay Checkout modal
      return new Promise((resolve) => {
        openRazorpayCheckout({
          orderId: orderData.orderId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          keyId: orderData.keyId,
          tierId,
          tierName: orderData.tierName || tierId.toUpperCase(),
          billingCycle,
          user,
          isSandbox: orderData.isSandbox,
          onSuccess: async (paymentData) => {
            try {
              // 3. Verify payment signature on backend
              const verifyRes = await fetch(`${API_BASE}/subscription/verify-payment`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(paymentData),
              });

              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.success) {
                throw new Error(verifyData.message || 'Payment verification failed');
              }

              // 4. Update stored token & user state
              if (verifyData.token) {
                localStorage.setItem('etherx_token', verifyData.token);
              }
              if (verifyData.user) {
                localStorage.setItem('etherx_user', JSON.stringify(verifyData.user));
              }

              set({
                plan: tierId.toLowerCase(),
                billingCycle,
                subscriptionExpiresAt: verifyData.user?.subscriptionExpiresAt || null,
                upgradeModalOpen: false,
                loading: false,
              });

              toast(`🎉 Upgraded to ${getTier(tierId).name}! All features unlocked.`, 'success');
              get().fetchSubscription();
              resolve({ success: true });
            } catch (err) {
              set({ loading: false, error: err.message });
              toast(`Verification error: ${err.message}`, 'error');
              resolve({ success: false, error: err.message });
            }
          },
          onError: (err) => {
            set({ loading: false, error: err?.message });
            toast(`Payment failed: ${err?.message || 'Transaction could not be completed'}`, 'error');
            resolve({ success: false, error: err?.message });
          },
          onDismiss: () => {
            set({ loading: false });
            resolve({ success: false, cancelled: true });
          },
        });
      });
    } catch (err) {
      set({ loading: false, error: err.message });
      showToast(`Upgrade error: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  },

  /**
   * Fast tier switch for testing and demos.
   */
  switchPlan: async (tierId = 'free', billingCycle = 'monthly') => {
    const token = getToken();

    try {
      const res = await fetch(`${API_BASE}/subscription/switch-tier`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tierId, billingCycle }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to switch plan');

      if (data.token) localStorage.setItem('etherx_token', data.token);
      if (data.user) localStorage.setItem('etherx_user', JSON.stringify(data.user));

      set({
        plan: tierId.toLowerCase(),
        billingCycle,
        subscriptionExpiresAt: data.user?.subscriptionExpiresAt || null,
        upgradeModalOpen: false,
      });

      showToast(`Plan switched to ${getTier(tierId).name}`, 'success');
      get().fetchSubscription();
      return { success: true };
    } catch (err) {
      // Offline fallback: save locally
      saveStoredUserPlan(tierId, billingCycle, null);
      set({ plan: tierId.toLowerCase(), billingCycle, upgradeModalOpen: false });
      showToast(`Plan set locally to ${getTier(tierId).name}`, 'info');
      return { success: true };
    }
  },
}));
