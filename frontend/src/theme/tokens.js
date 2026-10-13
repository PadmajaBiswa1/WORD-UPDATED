// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Design Tokens
// ═══════════════════════════════════════════════════════════════

export const GOLD = '#d6b25e';

// Initialize both the shared app tokens and the reference design palette.
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
  applyDesignTheme();
}

// Design palette (--t0 … --t33, --ink, --t0hi, --tblack) from the EtherX Word
// design. Dark is the default; the top-bar theme button switches to light.
const DESIGN_DARK = { '--t0':'#0f0e0c','--t1':'#090807','--t2':'#121110','--t3':'#131210','--t4':'#181715','--t5':'#11100e','--t6':'#1e1c19','--t7':'#1a1917','--t8':'#11100e','--t9':'#1c1b18','--t10':'#23211d','--t11':'#1e1c19','--t12':'#272520','--t13':'#2a2519','--t14':'#34302a','--t15':'#302d27','--t16':'#2e2716','--t17':'#3d3830','--t18':'#f0e6d3','--t19':'#f0e6d3','--t20':'#e8dcc4','--t21':'#d8cbb0','--t22':'#c9bda2','--t23':'#a89878','--t24':'#a89878','--t25':'#a89878','--t26':'#968766','--t27':'#8f8164','--t28':'#7a6e56','--t29':'#5a5140','--t30':'#3a3428','--t31':'#d4af37','--t32':'#e5c76b','--t33':'#eedca0', '--ink':'240,230,211', '--t0hi':'#fff', '--tblack':'#030303' };
const DESIGN_LIGHT = { '--t0':'#f7f5ef','--t1':'#ece7da','--t2':'#f0ece0','--t3':'#fbf9f4','--t4':'#ffffff','--t5':'#f0ece0','--t6':'#f7f5ef','--t7':'#f0ece0','--t8':'#f0ece0','--t9':'#ffffff','--t10':'#e8e2d4','--t11':'#f0ece0','--t12':'#e8e2d4','--t13':'#f7efd7','--t14':'#ddd4bf','--t15':'#dfd8c7','--t16':'#f7efd7','--t17':'#ddd4bf','--t18':'#2a2415','--t19':'#2a2415','--t20':'#2a2415','--t21':'#3a3220','--t22':'#4a4030','--t23':'#6a5f48','--t24':'#6a5f48','--t25':'#7a6f58','--t26':'#7a6f58','--t27':'#7a6f58','--t28':'#8f8468','--t29':'#b3a88e','--t30':'#c9bfa6','--t31':'#b8860b','--t32':'#926a0b','--t33':'#75540e', '--ink':'42,36,21', '--t0hi':'#000' , '--tblack':'#ffffff' };
const THEME_KEY = 'etherx.uiTheme';

export function getUiTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

export function applyDesignTheme(mode = getUiTheme()) {
  const dark = mode !== 'light';
  const root = document.documentElement;
  Object.entries(dark ? DESIGN_DARK : DESIGN_LIGHT).forEach(([k, x]) => root.style.setProperty(k, x));
  const shared = {
    '--bg-app': 'var(--t0)', '--bg-surface': 'var(--t3)', '--bg-elevated': 'var(--t4)',
    '--bg-hover': 'var(--t12)', '--bg-active': 'var(--t13)', '--bg-sidebar': 'var(--t2)',
    '--bg-th': 'var(--t11)', '--bg-code': dark ? '#25231e' : '#eee9df',
    '--text-code': dark ? '#a8c8ed' : '#24568a',
    '--border': 'rgba(var(--ink),0.12)', '--border-strong': 'var(--t17)',
    '--border-gold': 'rgba(184,134,11,0.4)', '--border-code': 'rgba(var(--ink),0.15)',
    '--text-primary': 'var(--t18)', '--text-secondary': 'var(--t22)', '--text-muted': 'var(--t23)',
    '--text-gold': 'var(--t31)', '--text-heading': 'var(--t32)', '--gold': 'var(--t31)',
    '--gold-hover': 'var(--t32)', '--gold-dim': 'rgba(184,134,11,0.12)',
    '--gold-border': 'rgba(184,134,11,0.4)', '--text-on-gold': '#211905',
    '--shadow-page': dark ? '0 16px 48px rgba(0,0,0,0.3)' : '0 16px 48px rgba(50,40,20,0.1)',
    '--shadow-lg': dark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(50,40,20,0.14)',
  };
  Object.entries(shared).forEach(([key, value]) => root.style.setProperty(key, value));
  // Page paper and document ink follow the design's paperDark / paperLight.
  root.style.setProperty('--bg-page', dark ? 'var(--t9)' : '#f6f4ef');
  root.style.setProperty('--text-doc', dark ? 'var(--t19)' : '#26241f');
  root.style.setProperty('--page-border', dark ? 'rgba(var(--ink),0.05)' : 'rgba(0,0,0,0.06)');
  document.body.style.background = dark ? '#0f0e0c' : '#f7f5ef';
  root.setAttribute('data-ui-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.style.colorScheme = dark ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('etherx:theme-change', { detail: dark ? 'dark' : 'light' }));
}
