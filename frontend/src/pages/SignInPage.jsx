import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/services/api';
import { AuthLayout, OAuthButtons, PasswordInput, SubmitButton, Tick, VALID_EMAIL, oauthErrorFromUrl } from '@/components/auth/AuthLayout';

const REMEMBER_KEY = 'etherxword_remember_email';

function readRemembered() {
  try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
}

export function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState(readRemembered);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => !!readRemembered());
  const [error, setError]       = useState(oauthErrorFromUrl);
  const [bad, setBad]           = useState(''); // email | pw
  const [busy, setBusy]         = useState(false);

  const fail = (message, field = '') => { setError(message); setBad(field); };
  const clear = () => { setError(''); setBad(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const cleanEmail = email.trim();
    if (!VALID_EMAIL.test(cleanEmail)) return fail('Enter a valid email.', 'email');
    if (!password) return fail('Enter your password.', 'pw');

    setBusy(true);
    clear();
    try {
      const response = await authApi.signin({ email: cleanEmail, password });
      localStorage.setItem('etherx_token', response.token);
      localStorage.setItem('etherx_user', JSON.stringify(response.user));
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, cleanEmail);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        // storage unavailable: nothing to remember
      }
      navigate('/home');
    } catch (err) {
      fail(err.message || 'Invalid email or password.');
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to EtherxWord."
      footer={<>New to EtherxWord? <Link to="/signup">Create an account</Link></>}
    >
      <OAuthButtons />
      <form className="wx-auth-form" onSubmit={handleSubmit} noValidate>
        <input
          className="wx-auth-input" type="email" value={email} placeholder="Email" autoComplete="email" aria-label="Email"
          data-bad={bad === 'email'} aria-invalid={bad === 'email'}
          onChange={(e) => { setEmail(e.target.value); clear(); }}
        />
        <PasswordInput
          value={password} bad={bad === 'pw'} autoComplete="current-password"
          onChange={(e) => { setPassword(e.target.value); clear(); }}
        />

        {error && <p className="wx-auth-error" role="alert">{error}</p>}

        <div className="wx-auth-row">
          <button type="button" className="wx-auth-check" onClick={() => setRemember((on) => !on)} aria-pressed={remember}>
            <Tick on={remember} />Remember me
          </button>
          <Link className="wx-auth-link-muted" to="/forgot-password">Forgot password?</Link>
        </div>

        <SubmitButton busy={busy} label="Sign in" busyLabel="Signing in…" />
      </form>
    </AuthLayout>
  );
}
