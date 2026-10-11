import React from 'react';
import ReactDOM from 'react-dom/client';
import { useCallback, useEffect, useState } from 'react';
import App from './App';
import { applyTheme } from './theme/tokens';
import { SplashScreen } from './components/ui/SplashScreen';
import './theme/global.css';

// Apply the fixed dark appearance before first render to avoid a flash.
applyTheme();

// The intro plays once per browser session; the app mounts underneath it.
const SPLASH_KEY = 'etherxword_seen_splash';
function shouldShowSplash() {
  try { return !sessionStorage.getItem(SPLASH_KEY); } catch { return true; }
}

function Root() {
  const [showSplash, setShowSplash] = useState(shouldShowSplash);
  const finishSplash = useCallback(() => {
    try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* storage blocked: show again next load */ }
    setShowSplash(false);
  }, []);

  useEffect(() => {

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
  }, []);

  return (
    <>
      <App />
      {showSplash && <SplashScreen onDone={finishSplash} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
