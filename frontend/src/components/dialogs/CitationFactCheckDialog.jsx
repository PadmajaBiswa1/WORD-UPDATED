import { useState, useEffect, useMemo } from 'react';
import { useEditorStore, useUIStore, useDocumentStore } from '@/store';
import { Button, Modal, Stack } from '@/components/ui';
import { executePragnaAi } from '@/services/ai';
import { loadSources } from './ReferenceDialogs';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function CitationFactCheckDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const { doc } = useDocumentStore();

  const [scope, setScope] = useState('selection');
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [result, setResult] = useState(null);

  // Check if editor has selection on mount
  const hasSelection = useMemo(() => {
    if (!editor) return false;
    const { from, to } = editor.state.selection;
    return to > from;
  }, [editor]);

  useEffect(() => {
    setSources(loadSources());
    if (hasSelection) {
      setScope('selection');
    } else {
      setScope('document');
    }
  }, [hasSelection]);

  const getTargetText = () => {
    if (!editor) return '';
    if (scope === 'selection') {
      const { from, to } = editor.state.selection;
      const sel = editor.state.doc.textBetween(from, to, ' ').trim();
      if (sel) return sel;
    }
    return editor.getText().trim();
  };

  const handleRunFactCheck = async () => {
    const text = getTargetText();
    if (!text) {
      toast('No text available to fact-check', 'info');
      return;
    }

    setLoading(true);
    try {
      const aiResponse = await executePragnaAi('citation-check', text, {
        aiProfile: doc?.aiProfile || null,
        sources,
      });

      if (aiResponse?.data) {
        setResult(aiResponse.data);
      } else {
        toast('Verification finished without issues', 'success');
      }
    } catch (err) {
      toast('Fact-check analysis failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Run automatically when dialog opens if text exists
  useEffect(() => {
    handleRunFactCheck();
  }, [scope]);

  const locateInDoc = (claimText) => {
    if (!editor || !claimText) return;
    const cleanSnippet = claimText.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ').split(/\s+/).slice(0, 6).join(' ').trim();
    if (!cleanSnippet) return;

    const fullDocText = editor.getText();
    const matchIdx = fullDocText.toLowerCase().indexOf(cleanSnippet.toLowerCase());
    if (matchIdx !== -1) {
      try {
        // Search text node positions
        let foundPos = null;
        editor.state.doc.descendants((node, pos) => {
          if (node.isText && node.text.toLowerCase().includes(cleanSnippet.toLowerCase())) {
            const innerOffset = node.text.toLowerCase().indexOf(cleanSnippet.toLowerCase());
            foundPos = { from: pos + innerOffset, to: pos + innerOffset + cleanSnippet.length };
            return false;
          }
        });

        if (foundPos) {
          editor.chain().focus().setTextSelection(foundPos).scrollIntoView().run();
          toast('Highlighted claim in document', 'info');
          return;
        }
      } catch (e) {
        console.warn('Selection jump error:', e);
      }
    }
    toast(`Found snippet: "${cleanSnippet}..."`, 'info');
  };

  const insertAssessmentAppendix = () => {
    if (!editor || !result) return;
    const timestamp = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const scoreColor = result.overallScore >= 85 ? '#10b981' : result.overallScore >= 70 ? '#f59e0b' : '#ef4444';

    const claimsRows = (result.claims || [])
      .map(
        (c) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 10px; font-weight: 500; font-size: 12px; color: #111827;">${escapeHtml(c.claim)}</td>
          <td style="padding: 8px 10px; font-size: 12px; color: #374151;"><code>${escapeHtml(c.citation)}</code></td>
          <td style="padding: 8px 10px; font-size: 12px;">
            <span style="display:inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: ${
              c.status === 'Verified' ? '#ecfdf5; color: #065f46;' : c.status === 'Supported' ? '#eff6ff; color: #1e40af;' : '#fffbeb; color: #92400e;'
            }">${escapeHtml(c.status)} (${c.confidence}%)</span>
          </td>
          <td style="padding: 8px 10px; font-size: 12px; color: #4b5563;">${escapeHtml(c.assessment)}${c.recommendation ? `<br><em style="color:#b45309;">${escapeHtml(c.recommendation)}</em>` : ''}</td>
        </tr>`
      )
      .join('');

    const appendixHtml = `
      <section class="citation-factcheck-report" style="margin-top: 32px; padding: 20px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb;">
        <h3 style="margin-top: 0; color: #1f2937; display: flex; align-items: center; gap: 8px;">
          <span>🛡 Pragna AI Citation & Fact-Check Verification Report</span>
          <span style="margin-left: auto; font-size: 14px; font-weight: bold; color: ${scoreColor}; background: white; padding: 4px 10px; border-radius: 12px; border: 1px solid currentColor;">
            Trust Score: ${result.overallScore}%
          </span>
        </h3>
        <p style="font-size: 13px; color: #4b5563; margin-bottom: 14px;">
          Generated on <strong>${timestamp}</strong> • Assessed <strong>${result.totalClaims}</strong> factual claims/citations.
          <br>${escapeHtml(result.summary)}
        </p>
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background: #f3f4f6; text-align: left; font-size: 12px; color: #374151;">
              <th style="padding: 8px 10px;">Claim / Statement</th>
              <th style="padding: 8px 10px;">Citation</th>
              <th style="padding: 8px 10px;">Status</th>
              <th style="padding: 8px 10px;">Verification Assessment</th>
            </tr>
          </thead>
          <tbody>
            ${claimsRows}
          </tbody>
        </table>
      </section>
      <p><br></p>
    `;

    editor.chain().focus().insertContent(appendixHtml).run();
    toast('Verification assessment appendix inserted into document', 'success');
    closeDialog('citationFactCheck');
  };

  const copyReportText = () => {
    if (!result) return;
    const lines = [
      `=== PRAGNA AI CITATION FACT-CHECK REPORT ===`,
      `Trust Score: ${result.overallScore}%`,
      `Summary: ${result.summary}`,
      `Total Claims: ${result.totalClaims} | Verified: ${result.verifiedCount} | Caution: ${result.cautionCount}`,
      ``,
      ...result.claims.map(
        (c, i) =>
          `[Claim ${i + 1}] (${c.status} - ${c.confidence}%)\nClaim: "${c.claim}"\nCitation: ${c.citation}\nAssessment: ${c.assessment}${
            c.recommendation ? `\nRecommendation: ${c.recommendation}` : ''
          }\n`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast('Fact-check report copied to clipboard', 'success');
  };

  return (
    <Modal title="AI Citation & Fact-Checking" onClose={() => closeDialog('citationFactCheck')} width={740}>
      <Stack gap={16}>
        {/* Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Scope:</span>
            <div style={{ display: 'inline-flex', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setScope('selection')}
                disabled={!hasSelection}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  border: 'none',
                  background: scope === 'selection' ? 'var(--primary)' : 'var(--bg-elevated)',
                  color: scope === 'selection' ? '#fff' : 'var(--text-primary)',
                  cursor: hasSelection ? 'pointer' : 'not-allowed',
                  opacity: hasSelection ? 1 : 0.5,
                  fontWeight: 500,
                }}
              >
                Selection {hasSelection ? '' : '(None)'}
              </button>
              <button
                type="button"
                onClick={() => setScope('document')}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  border: 'none',
                  borderLeft: '1px solid var(--border)',
                  background: scope === 'document' ? 'var(--primary)' : 'var(--bg-elevated)',
                  color: scope === 'document' ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Full Document
              </button>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
              📚 {sources.length} Registered Source{sources.length === 1 ? '' : 's'}
            </span>
          </div>

          <Button variant="primary" size="sm" onClick={handleRunFactCheck} disabled={loading}>
            {loading ? 'Analyzing...' : '↻ Re-evaluate'}
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🛡️ ⏳</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Analyzing Claims & Validating Citations...
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Comparing document assertions against registered sources and reference citations with Pragna AI.
            </div>
          </div>
        )}

        {/* Result Card */}
        {!loading && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Top Score Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background:
                  result.overallScore >= 85
                    ? 'rgba(16, 185, 129, 0.08)'
                    : result.overallScore >= 70
                    ? 'rgba(245, 158, 11, 0.08)'
                    : 'rgba(239, 68, 68, 0.08)',
                border:
                  result.overallScore >= 85
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : result.overallScore >= 70
                    ? '1px solid rgba(245, 158, 11, 0.3)'
                    : '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🛡️</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Factual Verification Assessment
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: result.overallScore >= 85 ? '#10b981' : result.overallScore >= 70 ? '#f59e0b' : '#ef4444',
                      color: '#ffffff',
                    }}
                  >
                    {result.overallScore}% Trust Score
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {result.summary}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{result.totalClaims}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Claims</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{result.verifiedCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Verified</div>
                </div>
                {result.cautionCount > 0 && (
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{result.cautionCount}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Caution</div>
                  </div>
                )}
              </div>
            </div>

            {/* Claims Breakdown */}
            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
              {result.claims?.map((claim) => (
                <div
                  key={claim.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          background:
                            claim.status === 'Verified'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : claim.status === 'Supported'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color:
                            claim.status === 'Verified'
                              ? '#059669'
                              : claim.status === 'Supported'
                              ? '#2563eb'
                              : '#d97706',
                          border: '1px solid currentColor',
                        }}
                      >
                        {claim.status === 'Verified' ? '✓ ' : '⚠ '}
                        {claim.status} ({claim.confidence}%)
                      </span>
                      <code style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-secondary)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                        {claim.citation}
                      </code>
                    </div>

                    <Button variant="ghost" size="xs" onClick={() => locateInDoc(claim.claim)} title="Highlight and locate this claim in the editor">
                      🔍 Find in Doc
                    </Button>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                    "{claim.claim}"
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '6px 10px', borderRadius: 4 }}>
                    <strong>Assessment:</strong> {claim.assessment}
                    {claim.recommendation && (
                      <div style={{ marginTop: 4, color: '#d97706' }}>
                        💡 <strong>Recommendation:</strong> {claim.recommendation}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={copyReportText} disabled={!result}>
              📋 Copy Report
            </Button>
            <Button variant="primary" size="sm" onClick={insertAssessmentAppendix} disabled={!result}>
              ➕ Insert Assessment Appendix
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => closeDialog('citationFactCheck')}>
            Close
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
