import emailjs from '@emailjs/browser';

export const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_v623gmc';
export const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'vXfCjd5UZkaRfr7E5';
export const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_anrgt1b';

// Dedicated templates for Sign Up (OTP verification) and Reset Password
export const EMAILJS_SIGNUP_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_SIGNUP_TEMPLATE_ID ||
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID ||
  'template_anrgt1b';

export const EMAILJS_RESET_PASSWORD_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_RESET_PASSWORD_TEMPLATE_ID ||
  import.meta.env.VITE_EMAILJS_RESET_TEMPLATE_ID ||
  'template_id5bqoi';

if (EMAILJS_PUBLIC_KEY) {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

export function getTemplateIdForPurpose(purpose) {
  const isReset = purpose === 'reset' || purpose === 'forgot-password' || purpose === 'reset-password';
  return isReset ? EMAILJS_RESET_PASSWORD_TEMPLATE_ID : EMAILJS_SIGNUP_TEMPLATE_ID;
}

function ensureEmailJsConfig(templateId = null) {
  const targetTemplateId = templateId || EMAILJS_TEMPLATE_ID;
  if (!EMAILJS_SERVICE_ID || !targetTemplateId || !EMAILJS_PUBLIC_KEY) {
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
  const isReset = purpose === 'reset' || purpose === 'forgot-password' || purpose === 'reset-password';
  const targetTemplateId = isReset ? EMAILJS_RESET_PASSWORD_TEMPLATE_ID : EMAILJS_SIGNUP_TEMPLATE_ID;

  ensureEmailJsConfig(targetTemplateId);

  const otpText = String(code || '').trim();
  const subject = isReset
    ? `Your EtherXWord reset code: ${otpText}`
    : `Your EtherXWord OTP: ${otpText}`;
  const message = isReset
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
    reset_code: otpText,
    resetCode: otpText,
    reset_otp: otpText,
    resetOtp: otpText,
    reset_token: otpText,
    token: otpText,
    expires_in: '10 minutes',
    expiresIn: '10 minutes',
    EXPIRES_IN: '10 minutes',
    Expires_In: '10 minutes',
    expire_in: '10 minutes',
    expireIn: '10 minutes',
    EXPIRE_IN: '10 minutes',
    Expire_In: '10 minutes',
    expires: '10 minutes',
    EXPIRES: '10 minutes',
    expiry: '10 minutes',
    EXPIRY: '10 minutes',
    expire: '10 minutes',
    EXPIRE: '10 minutes',
    expire_time: '10 minutes',
    expires_time: '10 minutes',
    expiry_time: '10 minutes',
    duration: '10 minutes',
    minutes: '10 minutes',
    mins: '10 minutes',
    limit: '10 minutes',
    time_limit: '10 minutes',
    otp_expiry: '10 minutes',
    otp_expires: '10 minutes',
    valid_for: '10 minutes',
    VALID_FOR: '10 minutes',
    expires_at: '10 minutes',
    EXPIRES_AT: '10 minutes',
    expiresAt: '10 minutes',
    purpose,
    action_label: isReset ? 'reset your password' : 'verify your account',
    action: isReset ? 'reset your password' : 'verify your account',
    subject,
    message,
    body: message,
    text: message,
  });

  console.log(`[EmailJS] Sending OTP with template: ${targetTemplateId} (${isReset ? 'Reset Password' : 'Sign Up'}) to:`, toEmail);

  return emailjs.send(EMAILJS_SERVICE_ID, targetTemplateId, templateParams, {
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
