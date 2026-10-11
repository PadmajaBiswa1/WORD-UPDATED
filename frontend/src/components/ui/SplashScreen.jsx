import { useEffect, useState } from 'react';
import { LOGO_LETTERS, LOGO_VIEWBOX, LogoDefs, SHIELD_PATHS, letterFill } from '@/components/brand/EtherxWordLogo';
import './splash-screen.css';

// EtherxWord intro (same motion as EtherX Meet), built from the vector logo so it stays sharp:
// the shield's outline traces itself, the gold shield fills in under it, the shield shrinks left,
// then each letter of the wordmark pops in. The last frame is exactly the logo.
const HOLD_MS = 900; // logo stays this long after the last letter lands
const FALLBACK_MS = 7000; // leave even if animations never report (hidden tab, throttled CPU)
const FADE_MS = 500;

export function SplashScreen({ onDone }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [landed, setLanded] = useState(reduced);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), landed ? HOLD_MS : FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [landed]);

  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(onDone, FADE_MS);
    return () => clearTimeout(timer);
  }, [leaving, onDone]);

  useEffect(() => {
    const skip = (event) => { if (['Escape', ' ', 'Enter'].includes(event.key)) setLeaving(true); };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, []);

  return (
    <div className="exw-splash" data-leaving={leaving} data-reduced={reduced} onClick={() => setLeaving(true)} role="presentation">
      <div className="exw-splash-art">
        <svg viewBox={LOGO_VIEWBOX} role="img" aria-label="EtherxWord">
          <LogoDefs />
          <path className="exw-splash-shield-art" d={SHIELD_PATHS.join(' ')} fill="url(#exw-logo-shield)" />
          {SHIELD_PATHS.map((d, i) => <path key={i} className="exw-splash-line" d={d} pathLength="1" style={{ animationDelay: `${i * 90}ms, 1200ms` }} />)}
          {LOGO_LETTERS.map((letter, i) => {
            const [x0, x1, , y1] = letter.box;
            return (
              <path
                key={i} className="exw-splash-letter" d={letter.face} fill={letterFill(letter)}
                style={{ transformOrigin: `${(x0 + x1) / 2}px ${y1}px`, animationDelay: `${1950 + i * 50}ms` }}
                onAnimationEnd={i === LOGO_LETTERS.length - 1 ? () => setLanded(true) : undefined}
              />
            );
          })}
        </svg>
      </div>
      <span className="exw-splash-skip">Click or press Esc to skip</span>
    </div>
  );
}
