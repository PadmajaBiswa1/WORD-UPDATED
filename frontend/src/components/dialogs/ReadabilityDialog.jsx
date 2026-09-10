import { useState, useMemo } from 'react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { Modal, Button, Stack, Label, Badge } from '@/components/ui';

function countWordSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const processed = w
    .replace(/(?:[^laeiouy]|ed|es|e)$/, '')
    .replace(/^y/, '');
  const matches = processed.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

function analyzeText(rawText) {
  const text = (rawText || '').trim();
  if (!text) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      avgWordsPerSentence: 0,
      avgSyllablesPerWord: 0,
      complexWordCount: 0,
      complexWordPct: 0,
      longSentenceCount: 0,
      passiveSentenceCount: 0,
      readingEase: 0,
      readingEaseLabel: 'No text available',
      gradeLevel: 0,
      gradeLevelLabel: 'N/A',
      recommendations: ['Add document text to calculate readability metrics.'],
    };
  }

  // Extract sentences
  const sentenceRegex = /[^.!?]+[.!?]+|[^.!?]+$/g;
  const sentences = (text.match(sentenceRegex) || [text]).map((s) => s.trim()).filter(Boolean);
  const sentenceCount = Math.max(1, sentences.length);

  // Extract words
  const words = text.split(/\s+/).map((w) => w.replace(/^[^\w]+|[^\w]+$/g, '')).filter(Boolean);
  const wordCount = Math.max(1, words.length);

  // Syllables and complex words
  let syllableCount = 0;
  let complexWordCount = 0;
  words.forEach((word) => {
    const syl = countWordSyllables(word);
    syllableCount += syl;
    if (syl >= 3) complexWordCount += 1;
  });

  const avgWordsPerSentence = Number((wordCount / sentenceCount).toFixed(1));
  const avgSyllablesPerWord = Number((syllableCount / wordCount).toFixed(2));
  const complexWordPct = Math.round((complexWordCount / wordCount) * 100);

  // Passive voice check
  const passivePattern = /\b(am|is|are|was|were|be|been|being)\s+([a-z]+ed|[a-z]+en|done|seen|made|found|written|given|taken)\b/i;
  let passiveSentenceCount = 0;
  let longSentenceCount = 0;

  sentences.forEach((s) => {
    const sWords = s.split(/\s+/).filter(Boolean);
    if (sWords.length > 25) longSentenceCount += 1;
    if (passivePattern.test(s)) passiveSentenceCount += 1;
  });

  // Flesch Reading Ease
  // 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
  let ease = 206.835 - (1.015 * (wordCount / sentenceCount)) - (84.6 * (syllableCount / wordCount));
  ease = Math.max(0, Math.min(100, Math.round(ease)));

  let easeLabel = 'Standard';
  let easeColor = '#22c55e';
  if (ease >= 90) { easeLabel = 'Very Easy (5th grade level)'; easeColor = '#22c55e'; }
  else if (ease >= 80) { easeLabel = 'Easy (6th grade level)'; easeColor = '#4ade80'; }
  else if (ease >= 70) { easeLabel = 'Fairly Easy (7th grade level)'; easeColor = '#a3e635'; }
  else if (ease >= 60) { easeLabel = 'Standard (Plain English / 8th-9th grade)'; easeColor = '#facc15'; }
  else if (ease >= 50) { easeLabel = 'Fairly Difficult (High school / 10th-12th)'; easeColor = '#fb923c'; }
  else if (ease >= 30) { easeLabel = 'Difficult (College level)'; easeColor = '#f87171'; }
  else { easeLabel = 'Very Confusing (Academic / Graduate level)'; easeColor = '#ef4444'; }

  // Flesch-Kincaid Grade Level
  // 0.39 * (total words / total sentences) + 11.8 * (total syllables / total words) - 15.59
  let grade = (0.39 * (wordCount / sentenceCount)) + (11.8 * (syllableCount / wordCount)) - 15.59;
  grade = Math.max(1, Number(grade.toFixed(1)));

  let gradeLabel = `Grade ${Math.round(grade)}`;
  if (grade <= 6) gradeLabel += ' (Elementary)';
  else if (grade <= 8) gradeLabel += ' (Middle School)';
  else if (grade <= 12) gradeLabel += ' (High School)';
  else if (grade <= 16) gradeLabel += ' (College Undergraduate)';
  else gradeLabel += ' (Advanced Graduate)';

  // Recommendations
  const recommendations = [];
  if (avgWordsPerSentence > 22) {
    recommendations.push(`Sentences average ${avgWordsPerSentence} words. Aim for 14-18 words to boost clarity.`);
  }
  if (longSentenceCount > 0) {
    recommendations.push(`${longSentenceCount} sentence(s) exceed 25 words. Consider splitting them into smaller clauses.`);
  }
  if (complexWordPct > 15) {
    recommendations.push(`${complexWordPct}% of words have 3+ syllables. Replace dense vocabulary with simpler alternatives.`);
  }
  if (passiveSentenceCount > 0) {
    recommendations.push(`${passiveSentenceCount} sentence(s) use passive voice. Converting to active voice increases punchiness.`);
  }
  if (ease >= 60 && ease <= 75) {
    recommendations.push('Overall reading ease is balanced and accessible for general professional readers.');
  } else if (ease > 75) {
    recommendations.push('Text is exceptionally readable and easy to digest for broad audiences.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Text readability is well-balanced across sentence structure and vocabulary.');
  }

  return {
    wordCount,
    sentenceCount,
    syllableCount,
    avgWordsPerSentence,
    avgSyllablesPerWord,
    complexWordCount,
    complexWordPct,
    longSentenceCount,
    passiveSentenceCount,
    readingEase: ease,
    readingEaseLabel: easeLabel,
    easeColor,
    gradeLevel: grade,
    gradeLevelLabel: gradeLabel,
    recommendations,
  };
}

export function ReadabilityDialog() {
  const { closeDialog, toast } = useUIStore();
  const { content } = useDocumentStore();
  const { editor } = useEditorStore();

  const [scope, setScope] = useState('doc'); // 'doc' or 'selection'

  const textToAnalyze = useMemo(() => {
    if (scope === 'selection' && editor) {
      const { from, to } = editor.state.selection;
      const selected = editor.state.doc.textBetween(from, to, ' ');
      if (selected && selected.trim()) return selected;
    }
    if (editor) {
      return editor.getText() || '';
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = content || '';
    return tmp.textContent || '';
  }, [scope, editor, content]);

  const metrics = useMemo(() => analyzeText(textToAnalyze), [textToAnalyze]);

  const copyReport = async () => {
    const report = `EtherX Word — Readability Report
Scope: ${scope === 'selection' ? 'Current Selection' : 'Whole Document'}
Flesch Reading Ease: ${metrics.readingEase}/100 (${metrics.readingEaseLabel})
Flesch-Kincaid Grade Level: ${metrics.gradeLevel} (${metrics.gradeLevelLabel})
Words: ${metrics.wordCount} | Sentences: ${metrics.sentenceCount} | Syllables: ${metrics.syllableCount}
Average Words / Sentence: ${metrics.avgWordsPerSentence}
Average Syllables / Word: ${metrics.avgSyllablesPerWord}
Complex Words (>2 syllables): ${metrics.complexWordCount} (${metrics.complexWordPct}%)
Long Sentences (>25 words): ${metrics.longSentenceCount}
Passive Voice Sentences: ${metrics.passiveSentenceCount}

Recommendations:
${metrics.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;

    try {
      await navigator.clipboard.writeText(report);
      toast('Readability report copied to clipboard', 'success');
    } catch {
      toast('Could not copy report to clipboard', 'error');
    }
  };

  return (
    <Modal title="Readability & Clarity Dashboard" onClose={() => closeDialog('readability')} width={560}>
      <Stack gap={16}>
        {/* Scope Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-elevated)', padding: 3, borderRadius: 'var(--radius-sm)' }}>
            <Button
              variant={scope === 'doc' ? 'primary' : 'ghost'}
              size="xs"
              onClick={() => setScope('doc')}
            >
              Whole Document
            </Button>
            <Button
              variant={scope === 'selection' ? 'primary' : 'ghost'}
              size="xs"
              onClick={() => setScope('selection')}
            >
              Selection Only
            </Button>
          </div>
          <Button variant="subtle" size="xs" onClick={copyReport}>
            📋 Copy Report
          </Button>
        </div>

        {/* Primary Gauge Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Flesch Reading Ease Gauge */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              textAlign: 'center',
            }}
          >
            <Label style={{ marginBottom: 8 }}>Flesch Reading Ease</Label>
            <div style={{ fontSize: 36, fontWeight: 800, color: metrics.easeColor || 'var(--gold)', lineHeight: 1 }}>
              {metrics.readingEase}
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-muted)' }}>/100</span>
            </div>
            {/* Visual Gauge Bar */}
            <div
              style={{
                height: 6,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 3,
                margin: '10px 0 6px 0',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${metrics.readingEase}%`,
                  background: metrics.easeColor || 'var(--gold)',
                  transition: 'width 0.4s ease',
                  borderRadius: 3,
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {metrics.readingEaseLabel}
            </div>
          </div>

          {/* Flesch-Kincaid Grade Level */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              textAlign: 'center',
            }}
          >
            <Label style={{ marginBottom: 8 }}>Grade Level (Flesch-Kincaid)</Label>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>
              {metrics.gradeLevel}
            </div>
            <div style={{ height: 6, margin: '10px 0 6px 0' }} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {metrics.gradeLevelLabel}
            </div>
          </div>
        </div>

        {/* Structural Statistics Grid */}
        <div>
          <Label>Structure & Syllable Statistics</Label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              marginTop: 4,
            }}
          >
            <div style={statBox}>
              <div style={statNum}>{metrics.wordCount}</div>
              <div style={statLbl}>Words</div>
            </div>
            <div style={statBox}>
              <div style={statNum}>{metrics.sentenceCount}</div>
              <div style={statLbl}>Sentences</div>
            </div>
            <div style={statBox}>
              <div style={statNum}>{metrics.avgWordsPerSentence}</div>
              <div style={statLbl}>Words / Sent.</div>
            </div>
            <div style={statBox}>
              <div style={statNum}>{metrics.avgSyllablesPerWord}</div>
              <div style={statLbl}>Syllables / Word</div>
            </div>
            <div style={statBox}>
              <div style={statNum}>{metrics.complexWordCount}</div>
              <div style={statLbl}>Complex Words ({metrics.complexWordPct}%)</div>
            </div>
            <div style={statBox}>
              <div style={statNum}>{metrics.longSentenceCount}</div>
              <div style={statLbl}>Long Sentences (&gt;25w)</div>
            </div>
            <div style={statBox}>
              <div style={statNum}>{metrics.passiveSentenceCount}</div>
              <div style={statLbl}>Passive Voice</div>
            </div>
            <div style={statBox}>
              <div style={statNum}>{metrics.syllableCount}</div>
              <div style={statLbl}>Total Syllables</div>
            </div>
          </div>
        </div>

        {/* Actionable Clarity Recommendations */}
        <div>
          <Label>Clarity & Tone Guidance</Label>
          <div
            style={{
              background: 'var(--bg-app)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              marginTop: 4,
            }}
          >
            <Stack gap={8}>
              {metrics.recommendations.map((rec, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--gold)', fontSize: 14, lineHeight: 1.2 }}>•</span>
                  <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{rec}</span>
                </div>
              ))}
            </Stack>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="primary" onClick={() => closeDialog('readability')}>
            Close
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}

const statBox = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 10px',
  textAlign: 'center',
};

const statNum = {
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)',
};

const statLbl = {
  fontSize: 10,
  color: 'var(--text-muted)',
  marginTop: 2,
};
