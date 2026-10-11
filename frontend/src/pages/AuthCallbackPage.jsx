import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/services/api';
import '@/styles/auth.css';

/** Landing page after Google/GitHub OAuth: the backend puts the JWT in the URL fragment. */
export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    // Drop the token from the address bar and history before doing anything else.
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      navigate('/signin', { replace: true });
      return;
    }

    localStorage.setItem('etherx_token', token);
    authApi.me()
      .then(({ user }) => {
        localStorage.setItem('etherx_user', JSON.stringify(user));
        navigate('/home', { replace: true });
      })
      .catch(() => {
        localStorage.removeItem('etherx_token');
        navigate('/signin', { replace: true });
      });
  }, [navigate]);

  return <div className="wx-auth" aria-busy="true" />;
}
