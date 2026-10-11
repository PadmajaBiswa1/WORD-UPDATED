import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/services/api';
import { sendOtpEmail } from '@/services/emailjs';
import { AuthLayout, OAuthButtons, PasswordInput, SubmitButton, VALID_EMAIL } from '@/components/auth/AuthLayout';

const STRENGTH_COLORS = ['var(--auth-rule)', '#d8443d', '#d9b54a', '#b5c75a', '#6fcf8f'];
const passwordScore = (pw) =>
  !pw ? 0 : [pw.length >= 8, /[A-Z]/.test(pw) && /[a-z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;

export function SignUpPage() {
  const navigate = useNavigate();

  const [step, setStep]         = useState('form'); // 'form' | 'otp'
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp]           = useState('');
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');
  const [bad, setBad]           = useState(''); // name | email | pw | otp
  const [busy, setBusy]         = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const score = passwordScore(password);
  const fail = (message, field = '') => { setError(message); setBad(field); };
  const clear = () => { setError(''); setBad(''); };

  // Deliver the OTP in the background so the UI never waits on the email provider.
  const dispatchOtp = (response) => {
    if (!response?.otp) return;
    sendOtpEmail({ toEmail: email.trim(), toName: name.trim(), code: response.otp, purpose: 'verify' })
      .catch((err) => console.warn('[EmailJS] Background OTP send warning:', err));
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (busy) return;
    const cleanEmail = email.trim();
    if (!name.trim()) return fail('Enter your name.', 'name');
    if (!VALID_EMAIL.test(cleanEmail)) return fail('Enter a valid email.', 'email');
    if (password.length < 8 || score < 2) return fail('Use at least 8 characters with a mix of letters and numbers.', 'pw');

    setBusy(true);
    clear();
    try {
      const response = await authApi.signup({ name: name.trim(), email: cleanEmail, password });
      setStep('otp');
      setCooldown(30);
      dispatchOtp(response);
    } catch (err) {
      fail(err.message || 'Could not create your account. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (otp.length < 6) return fail('Enter the 6-digit code.', 'otp');
    setBusy(true);
    clear();
    try {
      const { token, user } = await authApi.verifyOtp({ email: email.trim(), otp });
      localStorage.setItem('etherx_token', token);
      localStorage.setItem('etherx_user', JSON.stringify(user));
      navigate('/home');
    } catch (err) {
      fail(err.message || 'Verification failed.', 'otp');
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    clear();
    setNotice('');
    try {
      const response = await authApi.resendOtp({ email: email.trim(), type: 'verify' });
      setCooldown(30);
      setNotice('A new code has been sent.');
      dispatchOtp(response);
    } catch (err) {
      fail(err.message || 'Failed to resend code.');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'otp') {
    return (
      <AuthLayout
        title="Verify your email"
        subtitle={<>Enter the 6-digit code sent to <strong>{email.trim()}</strong></>}
        footer={<>Already have an account? <Link to="/signin">Sign in</Link></>}
      >
        <form className="wx-auth-form" onSubmit={handleVerify} noValidate>
          <input
            className="wx-auth-input wx-auth-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={otp} placeholder="000000" aria-label="6-digit verification code"
            data-bad={bad === 'otp'} aria-invalid={bad === 'otp'}
            onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); clear(); }}
          />
          {notice && <p className="wx-auth-notice" role="status">{notice}</p>}
          {error && <p className="wx-auth-error" role="alert">{error}</p>}
          <SubmitButton busy={busy} label="Verify & create account" busyLabel="Verifying…" />
          <div className="wx-auth-row">
            <button type="button" className="wx-auth-link-muted" onClick={handleResend} disabled={cooldown > 0 || busy}>
              {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
            </button>
            <button type="button" className="wx-auth-link-muted" onClick={() => { setStep('form'); setOtp(''); setNotice(''); clear(); }}>
              Change email
            </button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start writing with EtherxWord in seconds."
      footer={<>Already have an account? <Link to="/signin">Sign in</Link></>}
    >
      <OAuthButtons signUp />
      <form className="wx-auth-form" onSubmit={handleSignup} noValidate>
        <input
          className="wx-auth-input" value={name} placeholder="Full name" autoComplete="name" aria-label="Full name"
          data-bad={bad === 'name'} aria-invalid={bad === 'name'}
          onChange={(e) => { setName(e.target.value); clear(); }}
        />
        <input
          className="wx-auth-input" type="email" value={email} placeholder="Email" autoComplete="email" aria-label="Email"
          data-bad={bad === 'email'} aria-invalid={bad === 'email'}
          onChange={(e) => { setEmail(e.target.value); clear(); }}
        />
        <PasswordInput
          value={password} bad={bad === 'pw'} autoComplete="new-password"
          onChange={(e) => { setPassword(e.target.value); clear(); }}
        />
        <div className="wx-auth-strength" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => <span key={i} style={{ background: i <= score ? STRENGTH_COLORS[score] : STRENGTH_COLORS[0] }} />)}
        </div>

        {error && <p className="wx-auth-error" role="alert">{error}</p>}

        <SubmitButton busy={busy} label="Create account" busyLabel="Creating account…" />
      </form>
    </AuthLayout>
  );
}
