import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/services/api';
import { sendOtpEmail } from '@/services/emailjs';

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a18.7 18.7 0 0 1-4.2 4.9" />
      <path d="M6.2 6.2C3.3 8.5 2 12 2 12s3.5 7 10 7c1 0 2-.1 3-.4" />
    </svg>
  );
}

export function SignUpPage() {
  const navigate = useNavigate();

  const [step, setStep]     = useState('form'); // 'form' | 'otp'
  const [form, setForm]     = useState({ name: '', email: '', password: '', confirm: '' });
  const [otp, setOtp]       = useState('');
  const [focused, setFocused] = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [showPassword, setShowPassword] = useState({ password: false, confirm: false });

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      const response = await authApi.signup({ name: form.name, email: form.email, password: form.password });
      setStep('otp');

      if (response?.otp) {
        await sendOtpEmail({
          toEmail: form.email,
          toName: form.name,
          code: response.otp,
          purpose: 'verify',
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await authApi.verifyOtp({ email: form.email, otp });
      localStorage.setItem('etherx_token', token);
      localStorage.setItem('etherx_user', JSON.stringify(user));
      navigate('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      const response = await authApi.resendOtp({ email: form.email, type: 'verify' });
      if (response?.otp) {
        await sendOtpEmail({
          toEmail: form.email,
          toName: form.name,
          code: response.otp,
          purpose: 'verify',
        });
      }
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const fields = [
    { key: 'name',     label: 'Full Name',       type: 'text',     placeholder: 'Your name' },
    { key: 'email',    label: 'Email',            type: 'email',    placeholder: 'you@example.com' },
    { key: 'password', label: 'Password',         type: 'password', placeholder: '••••••••' },
    { key: 'confirm',  label: 'Confirm Password', type: 'password', placeholder: '••••••••' },
  ];

  return (
    <div className="auth-bg">
      <div className="auth-card anim-scale-in">
        <div className="auth-logo-wrap">
          <img src="/assets/etherxword-logo.png" alt="EtherxWord" className="auth-logo" />
        </div>

        {step === 'form' ? (
          <>
            <h1 className="auth-title">Create account</h1>
            <p className="auth-sub">Join EtherxWord today</p>
            <form onSubmit={handleSignup} className="auth-form">
              {error && <div className="auth-error">{error}</div>}
              {fields.map(({ key, label, type, placeholder }) => (
                <div className="auth-field" key={key}>
                  <label className="auth-label">{label}</label>
                  {type === 'password' ? (
                    <div className="auth-password-wrap">
                      <input
                        type={showPassword[key] ? 'text' : 'password'}
                        required placeholder={placeholder}
                        value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        className={`auth-input auth-password-input${focused === key ? ' focused' : ''}`}
                        onFocus={() => setFocused(key)} onBlur={() => setFocused('')}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowPassword((value) => ({ ...value, [key]: !value[key] }))}
                        aria-label={showPassword[key] ? `Hide ${label}` : `Show ${label}`}
                        title={showPassword[key] ? `Hide ${label}` : `Show ${label}`}
                      >
                        <EyeIcon open={showPassword[key]} />
                      </button>
                    </div>
                  ) : (
                    <input
                      type={type} required placeholder={placeholder}
                      value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className={`auth-input${focused === key ? ' focused' : ''}`}
                      onFocus={() => setFocused(key)} onBlur={() => setFocused('')}
                    />
                  )}
                </div>
              ))}
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? 'Creating…' : 'Create Account'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="auth-title">Verify your email</h1>
            <p className="auth-sub">We sent a 6-digit code to <strong>{form.email}</strong></p>
            <form onSubmit={handleVerify} className="auth-form">
              {error && <div className="auth-error">{error}</div>}
              {resent && <div className="auth-success">OTP resent!</div>}
              <div className="auth-field">
                <label className="auth-label">OTP Code</label>
                <input
                  type="text" required placeholder="123456" maxLength={6}
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className={`auth-input${focused === 'otp' ? ' focused' : ''}`}
                  onFocus={() => setFocused('otp')} onBlur={() => setFocused('')}
                  style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }}
                />
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>
            </form>
            <p className="auth-footer">
              Didn't receive it?{' '}
              <button onClick={handleResend} className="auth-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Resend OTP
              </button>
            </p>
          </>
        )}

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/signin" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
