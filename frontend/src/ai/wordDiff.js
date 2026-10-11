// Word-level diff used to turn Pragna's rewrites into reviewable suggestions.

// Words include combining marks (Indic vowel signs, viramas) and ZWNJ/ZWJ so they never split.
const TOKEN = /\s+|[\p{L}\p{M}\p{N}_\u200C\u200D]+|[^\s\p{L}\p{M}\p{N}_\u200C\u200D]/gu;
const MAX_CELLS = 250000; // LCS table size guard (~500 x 500 tokens)

export function tokenize(text = '') {
  return text.match(TOKEN) || [];
}

function push(ops, type, text) {
  if (!text) return;
  const last = ops[ops.length - 1];
  if (last && last.type === type) last.text += text;
  else ops.push({ type, text });
}

export function diffWords(oldText = '', newText = '') {
  const a = tokenize(oldText);
  const b = tokenize(newText);
  if (a.length * b.length > MAX_CELLS) {
    const ops = [];
    push(ops, 'delete', oldText);
    push(ops, 'insert', newText);
    return ops;
  }

  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  let pendingDelete = '';
  let pendingInsert = '';
  const flush = () => {
    push(ops, 'delete', pendingDelete);
    push(ops, 'insert', pendingInsert);
    pendingDelete = '';
    pendingInsert = '';
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      push(ops, 'equal', a[i]);
      i += 1;
      j += 1;
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      pendingInsert += b[j];
      j += 1;
    } else {
      pendingDelete += a[i];
      i += 1;
    }
  }
  flush();
  return ops;
}
