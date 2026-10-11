import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '@/services/api';
import EtherxWordLogo from '@/components/brand/EtherxWordLogo';
import '@/styles/auth.css';

export const VALID_EMAIL = /^\S+@\S+\.\S+$/;

/** Page frame shared by sign in and create account. */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="wx-auth">
      <header className="wx-auth-header">
        <Link to="/signin" aria-label="EtherxWord home">
          <EtherxWordLogo className="wx-auth-logo" />
        </Link>
      </header>
      <main className="wx-auth-main">
        <div className="wx-auth-panel">
          <div className="wx-auth-heading">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
          {footer && <p className="wx-auth-switch">{footer}</p>}
        </div>
      </main>
    </div>
  );
}

export function PasswordInput({ value, onChange, bad, autoComplete, placeholder = 'Password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="wx-auth-password">
      <input
        className="wx-auth-input" type={show ? 'text' : 'password'} value={value} placeholder={placeholder} aria-label={placeholder}
        autoComplete={autoComplete} data-bad={!!bad} aria-invalid={!!bad} onChange={onChange}
      />
      <button type="button" onClick={() => setShow((on) => !on)} title={show ? 'Hide password' : 'Show password'} aria-label={show ? 'Hide password' : 'Show password'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{show && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  );
}

const OAUTH_ERRORS = {
  google_auth_failed: 'Google sign-in failed or was cancelled.',
  github_auth_failed: 'GitHub sign-in failed or was cancelled.',
  google_not_configured: 'Google sign-in is not set up yet. Use your email.',
  github_not_configured: 'GitHub sign-in is not set up yet. Use your email.',
};

/** Error set by the backend OAuth callback via `?error=`, if any. */
export function oauthErrorFromUrl() {
  return OAUTH_ERRORS[new URLSearchParams(window.location.search).get('error')] || '';
}

/** Google + GitHub buttons; links go through the backend, which redirects to the provider. */
export function OAuthButtons({ signUp }) {
  return (
    <>
      <div className="wx-auth-oauth">
        <a className="wx-auth-google" href={`${API_BASE}/auth/google`}>
          <GoogleMark />
          <span>{signUp ? 'Sign up with Google' : 'Continue with Google'}</span>
        </a>
        <a className="wx-auth-secondary" href={`${API_BASE}/auth/github`}>
          <GitHubMark />
          <span>{signUp ? 'Sign up with GitHub' : 'Continue with GitHub'}</span>
        </a>
      </div>
      <div className="wx-auth-or"><span />OR<span /></div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.46H12v4.66h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.83z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.88-3.01c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09C3.26 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.31 14.32c-.24-.72-.38-1.49-.38-2.32s.14-1.6.38-2.32V6.59H1.3A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.3 5.41l4.01-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.3 0 3.26 2.7 1.3 6.59l4.01 3.09c.94-2.82 3.58-4.93 6.69-4.93z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58C20.56 21.79 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export function SubmitButton({ busy, label, busyLabel }) {
  return (
    <button type="submit" className="wx-auth-submit" disabled={busy}>
      {busy && <span className="wx-auth-spinner" aria-hidden="true" />}
      <span>{busy ? busyLabel : label}</span>
    </button>
  );
}

export function Tick({ on }) {
  return (
    <span className="wx-auth-box" data-on={on}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
    </span>
  );
}
