import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignInPage }        from '@/pages/SignInPage';
import { SignUpPage }        from '@/pages/SignUpPage';
import { ForgotPasswordPage} from '@/pages/ForgotPasswordPage';
import { HomePage }          from '@/pages/HomePage';
import { EditorPage }        from '@/pages/EditorPage';
import { PricingPage }       from '@/pages/PricingPage';
import { AdminLayout }        from '@/pages/admin/AdminLayout';
import { UpgradeModal }      from '@/components/dialogs/UpgradeModal';
import { initGlobalPrintHandler } from '@/utils/printUtils';

initGlobalPrintHandler();

class EditorErrorBoundary extends React.PureComponent {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('EditorErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || 'Unknown error';
      const stack = this.state.error?.stack || '';
      return (
        <div style={{ padding: 40, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#e05c5c', marginBottom: 16 }}>Something went wrong</h2>
          <pre style={{ background: '#1a0000', color: '#ff9999', padding: 16, borderRadius: 4, overflowX: 'auto', fontSize: 12, marginBottom: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg}{stack ? '\n\n' + stack : ''}</pre>
          <button style={{ padding: '8px 16px', cursor: 'pointer' }} onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RequireAuth({ children }) {
  const token = localStorage.getItem('etherx_token');
  return token ? children : <Navigate to="/signin" replace />;
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('etherx_token');
  if (!token) return <Navigate to="/signin" replace />;
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('etherx_user') || '{}');
  } catch {}
  const email = String(user.email || '').toLowerCase();
  const isSeedOwner = email === 'biswalpadmaja411@gmail.com' || email === 'demo@etherx.com';
  const role = user.role || (isSeedOwner ? 'Owner' : 'Viewer');

  // Stealth Route Guard: silently redirects non-admin users to /home
  if (role !== 'Owner' && role !== 'Admin') {
    return <Navigate to="/home" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<Navigate to="/signin" replace />} />
        <Route path="/signin"        element={<SignInPage />} />
        <Route path="/signup"        element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/home"          element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/pricing"       element={<PricingPage />} />
        <Route path="/admin/*"       element={<AdminRoute><AdminLayout /></AdminRoute>} />
        <Route path="/doc/:id"       element={<EditorErrorBoundary><RequireAuth><EditorPage /></RequireAuth></EditorErrorBoundary>} />
        <Route path="/shared/:id"    element={<EditorErrorBoundary><EditorPage isShared={true} /></EditorErrorBoundary>} />
        <Route path="*"              element={<Navigate to="/signin" replace />} />
      </Routes>
      <UpgradeModal />
    </BrowserRouter>
  );
}
