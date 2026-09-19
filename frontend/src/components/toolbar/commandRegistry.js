import { DEFAULT_COMMANDS } from './defaultCommands.js';

let COMMANDS = [...DEFAULT_COMMANDS];
let REGISTERED = true;

export function resetCommandRegistry() {
  COMMANDS = [...DEFAULT_COMMANDS];
  REGISTERED = true;
}

export function registerCommand(def) {
  if (!def) return;
  if (!def.id) throw new Error('Command must have an id');

  // Prevent duplicates (same id).
  if (COMMANDS.some((c) => c.id === def.id)) return;

  COMMANDS.push({
    keywords: [],
    type: 'action',
    tab: undefined,
    group: undefined,
    ...def,
  });
}

function normalize(s = '') {
  return String(s).toLowerCase().trim();
}

function tokenize(q) {
  return normalize(q)
    .split(/\s+/)
    .filter(Boolean);
}

export function ensureRegistered(registerFns = []) {
  if (REGISTERED) return;
  REGISTERED = true;

  // Optional: caller can pass explicit register functions.
  registerFns.forEach((fn) => {
    if (typeof fn === 'function') fn(registerCommand);
  });
}

// Allow the search component to detect whether any commands exist yet.
export function isRegistryEmpty() {
  return COMMANDS.length === 0;
}


export function getRegistryStatus() {
  return { registered: REGISTERED, count: COMMANDS.length };
}

export function getAllCommands() {
  return COMMANDS.slice();
}

export function searchCommands(query, { limit = 12 } = {}) {
  const q = normalize(query);
  const tokens = tokenize(q);
  if (!q) return getAllCommands().slice(0, limit);

  const scored = COMMANDS.map((cmd) => {
    const hay = normalize([
      cmd.title,
      cmd.tab,
      cmd.group,
      ...(cmd.keywords || []),
    ].filter(Boolean).join(' '));

    let score = 0;

    const normTitle = normalize(cmd.title);
    if (normTitle === q) score += 150;
    else if (normTitle.startsWith(q)) score += 80;
    else if (normTitle.includes(q)) score += 60;

    if (hay.includes(q)) score += 40;
    if (normalize(cmd.tab).includes(q)) score += 20;
    if (normalize(cmd.group).includes(q)) score += 15;

    // keyword exact match
    if (cmd.keywords && cmd.keywords.some((kw) => normalize(kw) === q)) {
      score += 100;
    }

    // token matching
    tokens.forEach((t) => {
      if (!t) return;
      if (normTitle.startsWith(t)) score += 15;
      if (hay.includes(t)) score += 10;
    });

    return { cmd, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ cmd }) => cmd);

  return scored;
}

