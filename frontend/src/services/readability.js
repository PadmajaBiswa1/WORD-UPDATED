// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Readability & Text Statistics Service
// ═══════════════════════════════════════════════════════════════

/**
 * Strips HTML tags and normalizes whitespace for text analysis.
 * @param {string} htmlOrText
 * @returns {string}
 */
export function extractPlainText(htmlOrText) {
  if (!htmlOrText || typeof htmlOrText !== 'string') return '';
  return htmlOrText
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/p>|<\/div>|<br\s*\/?>|<\/h[1-6]>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Counts syllables in a single English word using standard linguistic heuristics.
 * @param {string} rawWord
 * @returns {number}
 */
export function countSyllables(rawWord) {
  if (!rawWord || typeof rawWord !== 'string') return 0;
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;

  // Handle special suffixes
  let processed = word;
  // silent e at end (e.g., 'make', 'game'), but preserve 'le' after consonant (e.g., 'table')
  if (processed.endsWith('e') && !processed.endsWith('le') && processed.length > 3) {
    processed = processed.slice(0, -1);
  } else if (processed.endsWith('ed') && !processed.endsWith('ted') && !processed.endsWith('ded')) {
    processed = processed.slice(0, -2);
  } else if (processed.endsWith('es') && !processed.endsWith('ses') && !processed.endsWith('zes') && !processed.endsWith('ches') && !processed.endsWith('shes')) {
    processed = processed.slice(0, -2);
  }

  // Count vowel groups
  const matches = processed.match(/[aeiouy]{1,2}/g);
  let count = matches ? matches.length : 1;

  // Special adjustments
  if (word.endsWith('ia') || word.endsWith('io') || word.endsWith('ium')) {
    count += 1;
  }

  return Math.max(1, count);
}

/**
 * Calculates comprehensive readability metrics including Flesch Reading Ease
 * and Flesch-Kincaid Grade Level.
 *
 * @param {string} text - Raw text or HTML content
 * @returns {{
 *   fleschReadingEase: number,
 *   fleschKincaidGrade: number,
 *   wordCount: number,
 *   sentenceCount: number,
 *   syllableCount: number,
 *   readingTimeMinutes: number,
 *   suggestions: string[]
 * }}
 */
export function calculateReadability(text) {
  const plainText = extractPlainText(text);

  if (!plainText) {
    return {
      fleschReadingEase: 100,
      fleschKincaidGrade: 0,
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      readingTimeMinutes: 0,
      suggestions: ['Add content to see readability statistics and suggestions.'],
    };
  }

  // Extract sentences by punctuation
  const rawSentences = plainText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /[a-zA-Z0-9]/.test(s));

  // Extract words
  const words = plainText
    .match(/[a-zA-Z0-9]+(?:['’\-][a-zA-Z0-9]+)*/g) || [];

  const wordCount = words.length;

  if (wordCount === 0) {
    return {
      fleschReadingEase: 100,
      fleschKincaidGrade: 0,
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      readingTimeMinutes: 0,
      suggestions: ['Add content to see readability statistics and suggestions.'],
    };
  }

  const sentenceCount = Math.max(1, rawSentences.length);

  let totalSyllables = 0;
  let complexWordCount = 0; // 3 or more syllables

  for (let i = 0; i < words.length; i++) {
    const syl = countSyllables(words[i]);
    totalSyllables += syl;
    if (syl >= 3) {
      complexWordCount++;
    }
  }

  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = totalSyllables / wordCount;

  // Flesch Reading Ease formula:
  // 206.835 - (1.015 * (total words / total sentences)) - (84.6 * (total syllables / total words))
  const rawEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const fleschReadingEase = Math.round(Math.min(100, Math.max(0, rawEase)) * 10) / 10;

  // Flesch-Kincaid Grade Level formula:
  // (0.39 * (total words / total sentences)) + (11.8 * (total syllables / total words)) - 15.59
  const rawGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const fleschKincaidGrade = Math.round(Math.max(0, rawGrade) * 10) / 10;

  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  // Build actionable suggestions
  const suggestions = [];

  if (wordCount < 30) {
    suggestions.push('Add more text (at least 30 words) for a more accurate readability evaluation.');
  }

  if (wordsPerSentence > 22) {
    suggestions.push(`Average sentence length is high (${Math.round(wordsPerSentence)} words/sentence). Consider breaking long sentences into shorter thoughts.`);
  } else if (wordsPerSentence < 10 && wordCount >= 50) {
    suggestions.push('Sentences are quite short and choppy. Consider combining related ideas to improve flow.');
  }

  const complexWordPct = Math.round((complexWordCount / wordCount) * 100);
  if (complexWordPct > 18) {
    suggestions.push(`${complexWordPct}% of words are complex (3+ syllables). Replace technical or verbose phrasing with simpler terms where possible.`);
  }

  if (fleschReadingEase < 40) {
    suggestions.push('Readability score indicates university/academic level text. Simplify syntax for wider general audience accessibility.');
  } else if (fleschReadingEase >= 60 && fleschReadingEase <= 80) {
    suggestions.push('Good readability! The text is clear, engaging, and accessible to a broad audience.');
  } else if (fleschReadingEase > 80) {
    suggestions.push('Excellent clarity! The text is very easy to read and digest.');
  }

  return {
    fleschReadingEase,
    fleschKincaidGrade,
    wordCount,
    sentenceCount,
    syllableCount: totalSyllables,
    readingTimeMinutes,
    suggestions,
  };
}
