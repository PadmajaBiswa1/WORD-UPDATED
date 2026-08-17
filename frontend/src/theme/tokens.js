// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Design Tokens
// ═══════════════════════════════════════════════════════════════

export const GOLD = '#d4af37';

// EtherX Word intentionally ships with one fixed dark appearance.
export function applyTheme() {
  const root = document.documentElement;

  const vars = {
    // ── Surfaces ────────────────────────────────────────────────
    '--bg-app':      '#0a0a0a',
    '--bg-surface':  '#0a0a0a',
    '--bg-elevated': '#111111',
    '--bg-hover':    '#1f1800',
    '--bg-active':   '#1a1a1a',
    '--bg-page':     '#1a1a1a',
    '--bg-code':     '#161616',
    '--bg-th':       '#1c1c1c',
    '--bg-sidebar':  '#0e0e0e',

    // ── Borders ──────────────────────────────────────────────────
    '--border':        '#3d3000',
    '--border-strong': '#2a2a2a',
    '--border-gold':   '#3d3000',

    // ── Text ─────────────────────────────────────────────────────
    '--text-primary':   '#f0e6c8',
    '--text-secondary': '#d4b86a',
    '--text-muted':     '#9a8a6a',
    '--text-gold':      GOLD,
    '--text-heading':   '#e8d98a',
    '--text-doc':       '#e8d98a',
    '--text-on-gold':   '#0a0800',

    // ── Gold accent ───────────────────────────────────────────────
    '--gold':        '#c9a84c',
    '--gold-hover':  '#d9bb67',
    '--gold-dim':    'rgba(212,175,55,0.12)',
    '--gold-glow':   'none',
    '--gold-border': 'rgba(212,175,55,0.35)',

    // ── Shadows ───────────────────────────────────────────────────
    '--shadow-sm':   '0 1px 3px rgba(0,0,0,0.4)',
    '--shadow-md':   '0 2px 8px rgba(0,0,0,0.5)',
    '--shadow-lg':   '0 6px 20px rgba(0,0,0,0.6)',
    '--shadow-page': '0 0 0 1px rgba(255,255,255,0.07), 0 4px 20px rgba(0,0,0,0.65)',
    '--page-border': 'rgba(255,255,255,0.07)',

    // ── Fonts ─────────────────────────────────────────────────────
    '--font-ui':      "'Segoe UI', Arial, sans-serif",
    '--font-heading': "'Spectral', 'Georgia', serif",
    '--font-body':    "'Segoe UI', Arial, sans-serif",
    '--font-mono':    "'JetBrains Mono', 'SF Mono', monospace",

    // ── Radius / transitions ──────────────────────────────────────
    '--radius-sm':     '2px',
    '--radius-md':     '6px',
    '--radius-lg':     '10px',
    '--radius-xl':     '16px',
    '--transition':    '140ms ease',
    '--transition-md': '260ms ease',
  };

  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.setAttribute('data-theme', 'dark');
}
