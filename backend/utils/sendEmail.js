const axios = require('axios');

function getEmailJsConfig() {
  return {
    serviceId: process.env.EMAILJS_SERVICE_ID,
    templateId: process.env.EMAILJS_TEMPLATE_ID,
    publicKey: process.env.EMAILJS_PUBLIC_KEY,
    privateKey: process.env.EMAILJS_PRIVATE_KEY,
  };
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmailJs(templateParams, toEmail, timeoutMs = 30000) {
  const { serviceId, templateId, publicKey, privateKey } = getEmailJsConfig();

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    throw new Error('EmailJS credentials are not configured. Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, and EMAILJS_PRIVATE_KEY in backend/.env');
  }

  console.log('[EmailJS] Sending message to:', toEmail);
  console.log('[EmailJS] Service ID:', serviceId);
  console.log('[EmailJS] Template ID:', templateId);

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    accessToken: privateKey,
    template_params: {
      to_email: toEmail,
      ...templateParams,
    },
  };

  const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
    timeout: timeoutMs,
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`EmailJS request failed with status ${response.status}`);
  }

  return {
    messageId: `emailjs:${serviceId}:${templateId}`,
    response: response.data,
  };
}

async function sendOTPEmail(email, otp, type) {
  const action = type === 'verify' ? 'verify your account' : 'reset your password';

  try {
    const result = await sendEmailJs(
      {
        otp_code: otp,
        passcode: otp,
        otp: otp,
        action,
        action_label: action,
        expires_in: '10 minutes',
        expiresIn: '10 minutes',
        EXPIRES_IN: '10 minutes',
        Expires_In: '10 minutes',
        expires: '10 minutes',
        EXPIRES: '10 minutes',
        expiry: '10 minutes',
        EXPIRY: '10 minutes',
        expire: '10 minutes',
        EXPIRE: '10 minutes',
        valid_for: '10 minutes',
        VALID_FOR: '10 minutes',
        expires_at: '10 minutes',
        EXPIRES_AT: '10 minutes',
        expiresAt: '10 minutes',
        message: `Use the code below to ${action}. It expires in 10 minutes.`,
      },
      email,
    );

    console.log('✅ OTP email sent to', email, '| MessageId:', result.messageId);
    return result;
  } catch (err) {
    console.error('❌ Failed to send OTP email:', err.message);
    throw err;
  }
}

async function sendInviteEmail({ toEmail, inviterName, documentTitle, shareUrl, role = 'viewer' }) {
  const inviteAttemptId = `invite-${Date.now()}`;
  try {
    console.log(`[${inviteAttemptId}] 📬 Starting EmailJS invite process...`);

    if (!toEmail) throw new Error('Invite email is required');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail)) {
      throw new Error(`Invalid email format: ${toEmail}`);
    }

    const safeInviter = inviterName || 'A collaborator';
    const safeTitle = documentTitle || 'Untitled Document';
    const safeRole = role || 'viewer';

    const result = await sendEmailJs(
      {
        inviter_name: safeInviter,
        document_title: safeTitle,
        role: safeRole,
        share_url: shareUrl,
        message: `${safeInviter} invited you to collaborate on ${safeTitle}`,
      },
      toEmail,
    );

    console.log(`[${inviteAttemptId}] ✅ EmailJS invite sent successfully! MessageId: ${result.messageId}`);
    return result;
  } catch (err) {
    const errorMsg = err?.message || 'Unknown error';
    console.error(`[${inviteAttemptId}] ❌ ERROR in sendInviteEmail:`, errorMsg);
    throw err;
  }
}

module.exports = { generateOTP, sendOTPEmail, sendInviteEmail };
