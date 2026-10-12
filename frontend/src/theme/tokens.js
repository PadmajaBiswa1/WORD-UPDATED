// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Design Tokens
// ═══════════════════════════════════════════════════════════════

export const GOLD = '#d6b25e';

// EtherX Word intentionally ships with one fixed dark appearance.
export function applyTheme() {
  const root = document.documentElement;

  const vars = {
    // ── Surfaces ────────────────────────────────────────────────
    '--bg-app':      '#0a0a0b',
    '--bg-surface':  '#0a0a0b',
    '--bg-elevated': '#121214',
    '--bg-hover':    '#1b1b1e',
    '--bg-active':   '#17171a',
    '--bg-page':     '#18181b',
    '--bg-code':     '#282c34',
    '--border-code': 'rgba(255, 255, 255, 0.16)',
    '--text-code':   '#93c5fd',
    '--bg-th':       '#1d1d20',
    '--bg-sidebar':  '#0e0e10',

    // ── Borders ──────────────────────────────────────────────────
    '--border':        'rgba(255,255,255,0.08)',
    '--border-strong': '#2a2a2e',
    '--border-gold':   'rgba(214,178,94,0.35)',

    // ── Text ─────────────────────────────────────────────────────
    '--text-primary':   '#f1efea',
    '--text-secondary': '#c4c2bd',
    '--text-muted':     '#8b8984',
    '--text-gold':      GOLD,
    '--text-heading':   '#e3c378',
    '--text-doc':       '#F5F1E8',
    '--text-on-gold':   '#1a1405',

    // ── Gold accent ───────────────────────────────────────────────
    '--gold':        '#d6b25e',
    '--gold-hover':  '#e3c378',
    '--gold-dim':    'rgba(214,178,94,0.12)',
    '--gold-glow':   'none',
    '--gold-border': 'rgba(214,178,94,0.35)',

    // ── Shadows ───────────────────────────────────────────────────
    '--shadow-sm':   '0 1px 3px rgba(0,0,0,0.4)',
    '--shadow-md':   '0 2px 8px rgba(0,0,0,0.5)',
    '--shadow-lg':   '0 6px 20px rgba(0,0,0,0.6)',
    '--shadow-page': '0 0 0 1px rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.4), 0 24px 60px rgba(0,0,0,0.55)',
    '--page-border': 'rgba(255,255,255,0.05)',

    // ── Fonts ─────────────────────────────────────────────────────
    '--font-ui':      "Inter, system-ui, sans-serif",
    '--font-heading': "'Spectral', 'Georgia', serif",
    '--font-body':    "Inter, system-ui, sans-serif",
    '--font-mono':    "'JetBrains Mono', 'SF Mono', monospace",

    // ── Radius / transitions ──────────────────────────────────────
    '--radius-sm':     '2px',
    '--radius-md':     '8px',
    '--radius-lg':     '10px',
    '--radius-xl':     '16px',
    '--transition':    '140ms ease',
    '--transition-md': '260ms ease',
  };

  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.setAttribute('data-theme', 'dark');
}
