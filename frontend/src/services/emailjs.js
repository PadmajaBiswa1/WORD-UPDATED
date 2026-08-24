import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

if (EMAILJS_PUBLIC_KEY) {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

function ensureEmailJsConfig() {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    throw new Error('EmailJS is not configured in the frontend environment');
  }
}

function baseTemplateParams({ toEmail, toName, message, subject, ...extra }) {
  return {
    to_email: toEmail,
    email: toEmail,
    recipient: toEmail,
    user_email: toEmail,
    to_name: toName || toEmail,
    name: toName || toEmail,
    subject,
    message,
    ...extra,
  };
}

export async function sendOtpEmail({ toEmail, toName, code, purpose }) {
  ensureEmailJsConfig();

  const otpText = String(code || '').trim();
  const subject = purpose === 'reset'
    ? `Your EtherXWord reset code: ${otpText}`
    : `Your EtherXWord OTP: ${otpText}`;
  const message = purpose === 'reset'
    ? `Your EtherXWord password reset code is ${otpText}. It expires in 10 minutes.`
    : `Your EtherXWord verification code is ${otpText}. It expires in 10 minutes.`;

  const templateParams = baseTemplateParams({
    toEmail,
    toName,
    code,
    otp: otpText,
    otp_code: otpText,
    verification_code: otpText,
    verificationCode: otpText,
    passcode: otpText,
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
    purpose,
    action_label: purpose === 'reset' ? 'reset your password' : 'verify your account',
    action: purpose === 'reset' ? 'reset your password' : 'verify your account',
    subject,
    message,
    body: message,
    text: message,
  });

  console.log('[EmailJS] Sending OTP with templateParams:', templateParams);

  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, {
    publicKey: EMAILJS_PUBLIC_KEY,
  });
}

export async function sendInviteEmail({ toEmail, toName, inviterName, documentTitle, shareUrl, role }) {
  ensureEmailJsConfig();

  const templateParams = baseTemplateParams({
    toEmail,
    toName,
    inviter_name: inviterName,
    inviterName,
    document_title: documentTitle,
    documentTitle,
    share_url: shareUrl,
    shareUrl,
    role,
    from_name: inviterName,
    reply_to: toEmail,
    message: `${inviterName || 'A collaborator'} invited you to collaborate on ${documentTitle || 'Untitled Document'}`,
  });

  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, {
    publicKey: EMAILJS_PUBLIC_KEY,
  });
}
