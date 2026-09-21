import React from 'react';
import ReactDOM from 'react-dom/client';
import { useEffect, useState } from 'react';
import App from './App';
import { applyTheme } from './theme/tokens';
import { SplashScreen } from './components/ui/SplashScreen';
import './theme/global.css';

// Apply the fixed dark appearance before first render to avoid a flash.
applyTheme();

function Root() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 2800);

    // Only register Service Worker in production builds (never on localhost / dev mode)
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local')
    );

    if (!isLocalhost && import.meta.env.PROD && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.debug('SW registration skipped:', err?.message));
    } else if (isLocalhost && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister());
      }).catch(() => {});
    }

    return () => window.clearTimeout(timer);
  }, []);

  return showSplash ? <SplashScreen /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
