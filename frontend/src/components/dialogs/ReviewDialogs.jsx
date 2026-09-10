import { useEffect, useState } from 'react';
import { useDocumentStore, useEditorStore, useUIStore, useProductivityStore } from '@/store';
import { Button, Input, Label, Modal, Select, Stack } from '@/components/ui';

const LANGUAGE_KEY = 'etherx-language';

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'nl-NL', label: 'Dutch' },
  { value: 'ru-RU', label: 'Russian' },
  { value: 'tr-TR', label: 'Turkish' },
  { value: 'ar-SA', label: 'Arabic' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'bn-BD', label: 'Bengali' },
  { value: 'ta-IN', label: 'Tamil' },
  { value: 'te-IN', label: 'Telugu' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'ko-KR', label: 'Korean' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'zh-TW', label: 'Chinese (Traditional)' },
  { value: 'th-TH', label: 'Thai' },
  { value: 'vi-VN', label: 'Vietnamese' },
  { value: 'he-IL', label: 'Hebrew' },
  { value: 'ur-PK', label: 'Urdu' },
  { value: 'fa-IR', label: 'Persian' },
];

const RTL_LANGS = new Set(['ar-SA', 'he-IL', 'ur-PK', 'fa-IR']);

const FONT_BY_LANGUAGE = {
  'hi-IN': 'Nirmala UI',
  'bn-BD': 'Nirmala UI',
  'ta-IN': 'Nirmala UI',
  'te-IN': 'Nirmala UI',
  'ja-JP': 'Meiryo',
  'ko-KR': 'Malgun Gothic',
  'zh-CN': 'Microsoft YaHei',
  'zh-TW': 'Microsoft YaHei',
  'ar-SA': 'Noto Naskh Arabic',
  'ur-PK': 'Noto Naskh Arabic',
  'fa-IR': 'Noto Naskh Arabic',
};

const MARKUP_OPTIONS = [
  { value: 'all', label: 'All Markup' },
  { value: 'simple', label: 'Simple Markup' },
  { value: 'original', label: 'Original' },
  { value: 'final', label: 'Final' },
];

function getStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function loadLanguage() {
  const storage = getStorage();
  return storage?.getItem(LANGUAGE_KEY) || 'en-US';
}

function saveLanguage(language) {
  const storage = getStorage();
  storage?.setItem(LANGUAGE_KEY, language);
}

function getPlainText(editor) {
  return editor?.state?.doc?.textContent?.trim?.() || editor?.state?.doc?.textContent || '';
}

function scanAccessibility(html) {
  if (!html) {
    return ['The document is empty. Add content before running a review.'];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const issues = [];

  const images = [...doc.querySelectorAll('img')];
  images.forEach((img, index) => {
    const alt = (img.getAttribute('alt') || '').trim();
    if (!alt) issues.push(`Image ${index + 1} is missing alternative text.`);
  });

  const tables = [...doc.querySelectorAll('table')];
  tables.forEach((table, index) => {
    if (!table.querySelector('caption')) {
      issues.push(`Table ${index + 1} has no caption.`);
    }
  });

  const headings = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((heading) => Number(heading.tagName.slice(1)));
  headings.forEach((level, index) => {
    const previous = headings[index - 1];
    if (previous && level > previous + 1) {
      issues.push(`Heading level jumps from H${previous} to H${level}.`);
    }
  });

  if (!issues.length) issues.push('No obvious accessibility issues were found.');
  return issues;
}

export function WordCountDialog() {
  const { closeDialog } = useUIStore();
  const { wordCount, charCount, pageCount, readingTime } = useDocumentStore();

  return (
    <Modal title="Word Count" onClose={() => closeDialog('wordCount')} width={420}>
      <Stack gap={12}>
        <div style={metricGrid}>
          <Metric label="Words" value={wordCount} />
          <Metric label="Characters" value={charCount} />
          <Metric label="Pages" value={pageCount} />
          <Metric label="Reading Time" value={`${readingTime} min`} />
        </div>
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: 12 }}>
          These values update live as you type.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('wordCount')}>Close</Button>
        </div>
      </Stack>
    </Modal>
  );
}

export function CommentsDialog() {
  const { closeDialog, toast } = useUIStore();
  const { comments, addComment, resolveComment, deleteComment } = useDocumentStore();
  const [newComment, setNewComment] = useState('');

  const handleAddComment = () => {
    if (!newComment.trim()) {
      toast('Comment cannot be empty', 'info');
      return;
    }
    addComment({ text: newComment.trim(), author: 'You', timestamp: new Date().toISOString() });
    setNewComment('');
    toast('✓ Comment added', 'success');
  };

  const openComment = (comment) => {
    toast(comment.text || 'Comment selected', 'info');
  };

  return (
    <Modal title="Comments" onClose={() => closeDialog('comments')} width={560}>
      <Stack gap={14}>
        <div>
          <Label>Add new comment</Label>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write your comment here..."
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <Button
            variant="primary"
            onClick={handleAddComment}
            style={{ marginTop: 8 }}
          >
            Add Comment
          </Button>
        </div>

        {comments.length === 0 ? (
          <div style={emptyState}>No comments yet.</div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)' }}>
              {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </div>
            <Stack gap={10}>
              {comments.slice().reverse().map((comment) => (
                <div key={comment.id} style={commentCard}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {comment.resolved ? 'Resolved' : 'Open'} comment
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>
                      {comment.text}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Button variant="subtle" onClick={() => openComment(comment)}>Go To</Button>
                    <Button variant="outline" onClick={() => resolveComment(comment.id)} disabled={comment.resolved}>Resolve</Button>
                    <Button variant="danger" onClick={() => deleteComment(comment.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Modal>
  );
}

export function AccessibilityDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [issues, setIssues] = useState([]);

  const runScan = () => {
    const nextIssues = scanAccessibility(editor?.getHTML?.() || '');
    setIssues(nextIssues);
    toast(nextIssues[0] === 'No obvious accessibility issues were found.' ? 'Accessibility scan passed' : 'Accessibility issues found', nextIssues[0] === 'No obvious accessibility issues were found.' ? 'success' : 'info');
  };

  useEffect(() => {
    runScan();
  }, []);

  return (
    <Modal title="Check Accessibility" onClose={() => closeDialog('accessibility')} width={560}>
      <Stack gap={14}>
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: 12 }}>
          EtherX performs a lightweight scan for structure and content issues.
        </div>
        <div style={issueList}>
          {issues.map((issue) => (
            <div key={issue} style={issueRow}>{issue}</div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={runScan}>Re-scan</Button>
          <Button variant="subtle" onClick={() => closeDialog('accessibility')}>Close</Button>
        </div>
      </Stack>
    </Modal>
  );
}

export function LanguageDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor, spellCheck, toggleSpellCheck, setFontFamily } = useEditorStore();
  const { customDictionary = [], addToCustomDictionary, removeFromCustomDictionary } = useProductivityStore();
  const [language, setLanguage] = useState(loadLanguage());
  const [newWord, setNewWord] = useState('');

  const handleAddWord = () => {
    const trimmed = newWord.trim().toLowerCase();
    if (!trimmed) return;
    addToCustomDictionary(trimmed);
    setNewWord('');
    toast(`Added "${trimmed}" to custom dictionary`, 'success');
  };

  const applyLanguage = () => {
    if (editor?.view?.dom) {
      editor.view.dom.setAttribute('lang', language);
      editor.view.dom.setAttribute('dir', RTL_LANGS.has(language) ? 'rtl' : 'ltr');
      editor.view.dom.setAttribute('spellcheck', String(spellCheck));
    }
    const mappedFont = FONT_BY_LANGUAGE[language];
    if (mappedFont) {
      setFontFamily(mappedFont);
      editor?.chain().focus().setFontFamily(mappedFont).run();
    }
    saveLanguage(language);
    toast(`Language set to ${language}`, 'success');
    closeDialog('language');
  };

  return (
    <Modal title="Language & Proofing Dictionary" onClose={() => closeDialog('language')} width={460}>
      <Stack gap={14}>
        <div>
          <Label>Document Language</Label>
          <Select value={language} options={LANGUAGE_OPTIONS} onChange={setLanguage} width={220} title="Language" />
        </div>
        <label style={toggleRow}>
          <input type="checkbox" checked={spellCheck} onChange={toggleSpellCheck} style={{ accentColor: 'var(--gold)' }} />
          Enable spell check for this document
        </label>

        {/* Custom Dictionary section */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <Label>Custom Dictionary (Ignored by Spellcheck)</Label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, marginTop: 4 }}>
            <Input
              value={newWord}
              onChange={setNewWord}
              placeholder="Add word to dictionary…"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddWord(); }}
            />
            <Button size="xs" variant="primary" onClick={handleAddWord}>＋ Add</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 100, overflowY: 'auto' }}>
            {customDictionary.length === 0 ? (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No custom words added yet.</span>
            ) : (
              customDictionary.map((word) => (
                <span
                  key={word}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {word}
                  <button
                    onClick={() => { removeFromCustomDictionary(word); toast(`Removed "${word}" from dictionary`, 'info'); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 13, lineHeight: 1 }}
                    title="Remove word"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <Button variant="outline" onClick={() => { setLanguage('en-US'); toast('Language reset to English (US)', 'info'); }}>Reset</Button>
          <Button variant="primary" onClick={applyLanguage}>Apply</Button>
        </div>
      </Stack>
    </Modal>
  );
}

export function ReviewingPaneDialog() {
  const { closeDialog, openDialog } = useUIStore();
  const { comments, trackChanges } = useDocumentStore();

  return (
    <Modal title="Reviewing Pane" onClose={() => closeDialog('reviewingPane')} width={520}>
      <Stack gap={12}>
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: 12 }}>
          Track changes is {trackChanges ? 'on' : 'off'} and there {comments.length === 1 ? 'is 1 comment' : `are ${comments.length} comments`} in this document.
        </div>
        <div style={summaryGrid}>
          <PaneCard label="Comments" value={comments.length} action={() => openDialog('comments')} />
          <PaneCard label="Word Count" value="Live" action={() => openDialog('wordCount')} />
          <PaneCard label="Accessibility" value="Scan" action={() => openDialog('accessibility')} />
          <PaneCard label="Compare" value="Docs" action={() => openDialog('compareDocuments')} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('reviewingPane')}>Close</Button>
        </div>
      </Stack>
    </Modal>
  );
}

export function CompareDocumentsDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [comparisonText, setComparisonText] = useState('');
  const [result, setResult] = useState(null);

  const compare = () => {
    const source = getPlainText(editor);
    const target = comparisonText.trim();

    if (!source || !target) {
      setResult(null);
      toast('Add both documents to compare them', 'info');
      return;
    }

    const sourceLines = source.split(/\r?\n/);
    const targetLines = target.split(/\r?\n/);
    const firstDifference = sourceLines.findIndex((line, index) => line !== (targetLines[index] || ''));
    const nextResult = {
      sourceLength: source.length,
      targetLength: target.length,
      sourceWords: source.split(/\s+/).filter(Boolean).length,
      targetWords: target.split(/\s+/).filter(Boolean).length,
      firstDifference: firstDifference === -1 ? null : firstDifference + 1,
    };

    setResult(nextResult);
    toast('Comparison ready', 'success');
  };

  return (
    <Modal title="Compare Documents" onClose={() => closeDialog('compareDocuments')} width={620}>
      <Stack gap={14}>
        <div>
          <Label>Paste the other document</Label>
          <Input rows={8} value={comparisonText} onChange={setComparisonText} placeholder="Paste the second version here…" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={compare}>Compare</Button>
          <Button variant="subtle" onClick={() => closeDialog('compareDocuments')}>Close</Button>
        </div>
        {result && (
          <div style={resultCard}>
            <div style={resultRow}><span>Source words</span><strong>{result.sourceWords}</strong></div>
            <div style={resultRow}><span>Comparison words</span><strong>{result.targetWords}</strong></div>
            <div style={resultRow}><span>Source characters</span><strong>{result.sourceLength}</strong></div>
            <div style={resultRow}><span>Comparison characters</span><strong>{result.targetLength}</strong></div>
            <div style={resultRow}><span>First difference</span><strong>{result.firstDifference ? `Line ${result.firstDifference}` : 'None'}</strong></div>
          </div>
        )}
      </Stack>
    </Modal>
  );
}

export function RestrictEditingDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [locked, setLocked] = useState(editor ? !editor.isEditable : false);

  useEffect(() => {
    if (editor) setLocked(!editor.isEditable);
  }, [editor]);

  const applyRestriction = () => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    const nextLocked = !locked;
    editor.setEditable(!nextLocked);
    setLocked(nextLocked);
    toast(nextLocked ? 'Editing restricted' : 'Editing unlocked', nextLocked ? 'success' : 'info');
  };

  return (
    <Modal title="Restrict Editing" onClose={() => closeDialog('restrictEditing')} width={440}>
      <Stack gap={14}>
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: 12 }}>
          Lock the document so readers can review without changing the content.
        </div>
        <label style={toggleRow}>
          <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} style={{ accentColor: 'var(--gold)' }} />
          Restrict editing
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="subtle" onClick={() => closeDialog('restrictEditing')}>Close</Button>
          <Button variant="primary" onClick={applyRestriction}>Apply</Button>
        </div>
      </Stack>
    </Modal>
  );
}

function Metric({ label, value }) {
  return (
    <div style={metricCard}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-ui)' }}>{value}</div>
    </div>
  );
}

function PaneCard({ label, value, action }) {
  return (
    <button onClick={action} style={paneCard}>
      <span style={paneLabel}>{label}</span>
      <strong style={paneValue}>{value}</strong>
    </button>
  );
}

const metricGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const metricCard = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 14px',
};

const commentCard = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
};

const emptyState = {
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  padding: '34px 20px',
};

const issueList = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const issueRow = {
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
};

const toggleRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  color: 'var(--text-primary)',
  fontSize: 13,
};

const summaryGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const paneCard = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  padding: '12px 14px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)',
};

const paneLabel = {
  color: 'var(--text-muted)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
};

const paneValue = {
  color: 'var(--text-primary)',
  fontSize: 18,
};

const resultCard = {
  display: 'grid',
  gap: 8,
  padding: '12px 14px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-ui)',
};

const resultRow = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--text-primary)',
  fontSize: 12,
};