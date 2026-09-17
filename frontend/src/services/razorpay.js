// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Razorpay Integration Service
// ═══════════════════════════════════════════════════════════════

let razorpayScriptLoadingPromise = null;

export function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  if (razorpayScriptLoadingPromise) return razorpayScriptLoadingPromise;

  razorpayScriptLoadingPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      console.warn('⚠️ Could not load Razorpay SDK from CDN, using sandbox fallback mode.');
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return razorpayScriptLoadingPromise;
}

/**
 * Initiates Razorpay checkout flow.
 * If live script is loaded and Key is valid, displays Razorpay Checkout popup.
 * If running in sandbox/mock mode (or offline), renders an interactive checkout simulation modal.
 */
export async function openRazorpayCheckout({
  orderId,
  amount,
  currency = 'INR',
  keyId,
  tierId = 'pro',
  tierName = 'Pro',
  billingCycle = 'monthly',
  user = {},
  isSandbox = false,
  onSuccess = () => {},
  onError = () => {},
  onDismiss = () => {},
}) {
  const scriptLoaded = await loadRazorpayScript();
  const canUseNativeRazorpay = scriptLoaded && window.Razorpay && !isSandbox && keyId && !keyId.includes('mock');

  if (canUseNativeRazorpay) {
    const options = {
      key: keyId,
      amount,
      currency,
      name: 'EtherX Word',
      description: `Upgrade to EtherX ${tierName} (${billingCycle})`,
      image: '/assets/etherxlogo.png',
      order_id: orderId,
      handler: function (response) {
        onSuccess({
          razorpay_order_id: response.razorpay_order_id || orderId,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          tierId,
          billingCycle,
        });
      },
      prefill: {
        name: user.name || '',
        email: user.email || '',
      },
      notes: {
        tierId,
        billingCycle,
      },
      theme: {
        color: '#c9a84c',
      },
      modal: {
        ondismiss: function () {
          onDismiss();
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        onError(resp.error || new Error('Razorpay payment failed'));
      });
      rzp.open();
      return;
    } catch (err) {
      console.warn('Native Razorpay open error, falling back to sandbox simulator:', err);
    }
  }

  // ── Sandbox / Offline Simulator Modal ──
  renderSandboxPaymentModal({
    orderId,
    amount,
    currency,
    tierId,
    tierName,
    billingCycle,
    user,
    onSuccess,
    onError,
    onDismiss,
  });
}

function renderSandboxPaymentModal({
  orderId,
  amount,
  currency,
  tierId,
  tierName,
  billingCycle,
  user,
  onSuccess,
  onDismiss,
}) {
  const displayAmount = `₹${(amount / 100).toLocaleString('en-IN')}`;
  const modalId = 'etherx-razorpay-sandbox-modal';

  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = modalId;
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.zIndex = '999999';
  container.style.background = 'rgba(0, 0, 0, 0.75)';
  container.style.backdropFilter = 'blur(4px)';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.fontFamily = 'Inter, -apple-system, sans-serif';

  container.innerHTML = `
    <div style="background: #18181b; border: 1px solid #c9a84c; border-radius: 12px; width: 420px; max-width: 90vw; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.8); color: #f4f4f5; text-align: left;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #27272a; padding-bottom: 16px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 6px; background: #0c2340; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #528ff0; font-size: 14px;">
            R
          </div>
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #ffffff;">Razorpay Checkout</div>
            <div style="font-size: 11px; color: #a1a1aa;">EtherX Word • ${tierName} Subscription</div>
          </div>
        </div>
        <span style="font-size: 10px; text-transform: uppercase; background: rgba(201,168,76,0.15); color: #c9a84c; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Sandbox Mode</span>
      </div>

      <div style="background: #27272a; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
          <span style="color: #a1a1aa;">Plan:</span>
          <span style="font-weight: 600; color: #ffffff;">EtherX ${tierName} (${billingCycle})</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
          <span style="color: #a1a1aa;">Order ID:</span>
          <span style="font-family: monospace; font-size: 11px; color: #c9a84c;">${orderId.slice(0, 18)}...</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
          <span style="color: #a1a1aa;">Billed to:</span>
          <span style="color: #ffffff;">${user.name || user.email || 'Subscriber'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; border-top: 1px dashed #3f3f46; pt: 8px; margin-top: 8px; padding-top: 8px;">
          <span style="color: #ffffff;">Total Payable:</span>
          <span style="color: #c9a84c;">${displayAmount}</span>
        </div>
      </div>

      <div style="margin-bottom: 18px;">
        <label style="font-size: 11px; color: #a1a1aa; display: block; margin-bottom: 6px;">Simulated Payment Method (Razorpay INR):</label>
        <select id="rzp-sim-method" style="width: 100%; background: #09090b; border: 1px solid #3f3f46; color: #fff; padding: 9px 12px; border-radius: 6px; font-size: 13px; outline: none;">
          <option value="upi">UPI / QR (Google Pay, PhonePe, Paytm)</option>
          <option value="card">Credit / Debit Card (Visa, Mastercard, RuPay)</option>
          <option value="netbanking">Net Banking (SBI, HDFC, ICICI, Axis)</option>
        </select>
      </div>

      <div style="display: flex; gap: 10px;">
        <button id="rzp-sim-cancel" style="flex: 1; padding: 10px; background: transparent; border: 1px solid #3f3f46; color: #a1a1aa; border-radius: 6px; cursor: pointer; font-size: 13px;">
          Cancel
        </button>
        <button id="rzp-sim-pay" style="flex: 2; padding: 10px; background: #c9a84c; border: none; color: #000; font-weight: 700; border-radius: 6px; cursor: pointer; font-size: 13px; transition: background 0.2s;">
          Pay ${displayAmount}
        </button>
      </div>

      <div style="font-size: 10px; color: #71717a; text-align: center; margin-top: 14px;">
        Secured by Razorpay • Instant access upon completion
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const cancelBtn = container.querySelector('#rzp-sim-cancel');
  const payBtn = container.querySelector('#rzp-sim-pay');

  cancelBtn.onclick = () => {
    container.remove();
    onDismiss();
  };

  payBtn.onclick = () => {
    payBtn.disabled = true;
    payBtn.innerText = 'Processing Payment...';
    payBtn.style.opacity = '0.7';

    setTimeout(() => {
      container.remove();
      onSuccess({
        razorpay_order_id: orderId,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: `sig_mock_${Date.now()}`,
        tierId,
        billingCycle,
      });
    }, 900);
  };
}
