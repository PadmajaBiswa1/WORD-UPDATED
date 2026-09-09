import { useState, useMemo } from 'react';
import { useUIStore, useDocumentStore, useEditorStore } from '@/store';
import { Modal, Button, Stack, Label, Badge } from '@/components/ui';

export function MergeConflictDialog() {
  const { closeDialog, toast } = useUIStore();
  const { content, setContent, revision, setRevision } = useDocumentStore();
  const { editor } = useEditorStore();

  const [activeConflictIndex, setActiveConflictIndex] = useState(0);
  const [viewMode, setViewMode] = useState('block'); // 'block' or 'side-by-side'

  // Seed sample three-way conflict blocks based on document or typical collaborative collisions
  const [conflicts, setConflicts] = useState([
    {
      id: 'conflict-1',
      title: 'Section 1: Executive Overview & Objectives',
      base: 'The EtherX platform enables decentralized document collaboration with modern typography and end-to-end security protections.',
      local: 'The EtherX platform enables real-time peer-to-peer document collaboration with rich styles, offline resiliency, and end-to-end zero-knowledge encryption.',
      remote: 'The EtherX platform powers enterprise cloud document authoring with automated citations, multi-format export, and cryptographic access verification.',
      resolution: null, // 'local', 'remote', 'combine', or 'custom'
      customText: '',
    },
    {
      id: 'conflict-2',
      title: 'Section 2: Security & Encryption Policy',
      base: 'Documents may optionally be protected with standard user credentials and encrypted storage.',
      local: 'Documents are protected with client-side AES-256-GCM authenticated encryption and argon2/pbkdf2 key derivation. Passphrases never leave the client browser.',
      remote: 'Documents employ server-side envelope encryption with managed KMS key rotation and role-based access policies (Owner, Editor, Commenter, Viewer).',
      resolution: null,
      customText: '',
    },
    {
      id: 'conflict-3',
      title: 'Section 3: Release Timeline & Rollout',
      base: 'Phases 1 through 4 will be deployed sequentially over the next quarter.',
      local: 'Phases 1 through 6 will roll out across staged feature rings with automated regression gates and telemetry validation.',
      remote: 'Phases 1 through 4 will be deployed immediately with Phases 5 and 6 scheduled for subsequent enterprise preview.',
      resolution: null,
      customText: '',
    },
  ]);

  const resolvedCount = conflicts.filter((c) => c.resolution !== null).length;
  const allResolved = resolvedCount === conflicts.length;

  const currentConflict = conflicts[activeConflictIndex] || conflicts[0];

  const handleChoose = (type) => {
    let text = '';
    if (type === 'local') text = currentConflict.local;
    else if (type === 'remote') text = currentConflict.remote;
    else if (type === 'combine') text = `${currentConflict.local}\n\n${currentConflict.remote}`;
    else if (type === 'custom') text = currentConflict.customText || currentConflict.local;

    setConflicts((prev) =>
      prev.map((c, idx) =>
        idx === activeConflictIndex ? { ...c, resolution: type, customText: text } : c
      )
    );

    // Advance to next unresolved conflict if available
    if (activeConflictIndex < conflicts.length - 1) {
      setActiveConflictIndex((curr) => curr + 1);
    }
  };

  const handleLoadRemoteFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const remoteRaw = event.target.result || '';
      const localDocText = editor?.getText() || content.replace(/<[^>]+>/g, ' ');

      const localParas = localDocText.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 15);
      const remoteParas = remoteRaw.replace(/<[^>]+>/g, ' ').split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 15);

      const computedConflicts = [];
      const count = Math.min(Math.max(localParas.length, remoteParas.length), 10);
      for (let i = 0; i < count; i++) {
        const lp = localParas[i] || '';
        const rp = remoteParas[i] || '';
        if (lp !== rp) {
          computedConflicts.push({
            id: `conflict-${i + 1}`,
            title: `Paragraph ${i + 1} Variation`,
            base: lp.slice(0, 80) + '...',
            local: lp || '(Empty locally)',
            remote: rp || '(Empty remotely)',
            resolution: null,
            customText: '',
          });
        }
      }

      if (computedConflicts.length > 0) {
        setConflicts(computedConflicts);
        setActiveConflictIndex(0);
        toast(`Loaded ${computedConflicts.length} diff conflicts from ${file.name}`, 'info');
      } else {
        toast('No content conflicts detected', 'success');
      }
    };
    reader.readAsText(file);
  };

  const handleCommitMerge = () => {
    let currentHtml = editor?.getHTML() || content || '';
    conflicts.forEach((c) => {
      const text = c.customText || (c.resolution === 'remote' ? c.remote : c.local);
      if (c.base && currentHtml.includes(c.base)) {
        currentHtml = currentHtml.replace(c.base, text);
      } else if (c.local && currentHtml.includes(c.local)) {
        currentHtml = currentHtml.replace(c.local, text);
      } else {
        currentHtml += `<div class="merged-section"><h3>${c.title}</h3><p>${text.replace(/\n\n/g, '</p><p>')}</p></div>`;
      }
    });

    if (editor) {
      editor.commands.setContent(currentHtml);
    }
    setContent(currentHtml);
    setRevision(Number(revision || 0) + 1);

    toast('Three-way merge successfully committed to document', 'success');
    closeDialog('mergeConflict');
  };

  return (
    <Modal title="Three-Way Merge Conflict Resolution" onClose={() => closeDialog('mergeConflict')} width={820}>
      <Stack gap={14}>
        {/* Header Summary & Progress */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Revision Conflict Detected (Base rev #{revision || 1} vs Remote rev #{(revision || 1) + 1})
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Resolve each conflicting block by selecting Local (your edits), Remote (server edits), or combining both.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge color={allResolved ? '#22c55e' : 'var(--gold)'}>
              {resolvedCount} of {conflicts.length} Resolved
            </Badge>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-app)', padding: 2, borderRadius: 'var(--radius-sm)' }}>
              <Button
                variant={viewMode === 'block' ? 'primary' : 'ghost'}
                size="xs"
                onClick={() => setViewMode('block')}
              >
                Focus
              </Button>
              <Button
                variant={viewMode === 'side-by-side' ? 'primary' : 'ghost'}
                size="xs"
                onClick={() => setViewMode('side-by-side')}
              >
                3-Way Pane
              </Button>
              <label style={{ display: 'inline-flex', alignItems: 'center' }}>
                <input
                  type="file"
                  accept=".txt,.html,.md,.docx"
                  style={{ display: 'none' }}
                  onChange={handleLoadRemoteFile}
                />
                <Button as="span" variant="outline" size="xs" style={{ cursor: 'pointer' }}>
                  📁 Compare File
                </Button>
              </label>
            </div>
          </div>
        </div>

        {/* Conflict Tab Navigator */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {conflicts.map((c, idx) => {
            const isCurrent = idx === activeConflictIndex;
            return (
              <button
                key={c.id}
                onClick={() => setActiveConflictIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isCurrent ? 'var(--gold)' : 'var(--border)'}`,
                  background: isCurrent ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                  color: isCurrent ? 'var(--text-gold)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontFamily: 'var(--font-ui)',
                  fontWeight: isCurrent ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{c.resolution ? '✓' : '⚠️'}</span>
                <span>{c.title}</span>
                {c.resolution && (
                  <Badge color="rgba(34, 197, 94, 0.2)">{c.resolution.toUpperCase()}</Badge>
                )}
              </button>
            );
          })}
        </div>

        {viewMode === 'block' ? (
          /* Focus Block View */
          <Stack gap={12}>
            {/* Ancestor Base */}
            <div style={paneStyle}>
              <div style={paneHeader}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>1. Base (Original Ancestor)</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Common revision</span>
              </div>
              <div style={contentBox}>{currentConflict.base}</div>
            </div>

            {/* Local vs Remote comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Local */}
              <div style={{ ...paneStyle, borderColor: 'rgba(212,175,55,0.4)' }}>
                <div style={{ ...paneHeader, background: 'rgba(212,175,55,0.1)' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>2. Local (Your Edits)</span>
                  <Button
                    variant={currentConflict.resolution === 'local' ? 'primary' : 'subtle'}
                    size="xs"
                    onClick={() => handleChoose('local')}
                  >
                    Choose Local
                  </Button>
                </div>
                <div style={contentBox}>{currentConflict.local}</div>
              </div>

              {/* Remote */}
              <div style={{ ...paneStyle, borderColor: 'rgba(59, 130, 246, 0.4)' }}>
                <div style={{ ...paneHeader, background: 'rgba(59, 130, 246, 0.1)' }}>
                  <span style={{ color: '#60a5fa', fontWeight: 700 }}>3. Remote (Server Edits)</span>
                  <Button
                    variant={currentConflict.resolution === 'remote' ? 'primary' : 'subtle'}
                    size="xs"
                    onClick={() => handleChoose('remote')}
                  >
                    Choose Remote
                  </Button>
                </div>
                <div style={contentBox}>{currentConflict.remote}</div>
              </div>
            </div>

            {/* Resolution Actions & Custom Editor */}
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Label style={{ margin: 0 }}>Resolved Result for this Block</Label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="subtle" size="xs" onClick={() => handleChoose('combine')}>
                    Combine (Local + Remote)
                  </Button>
                  <Button variant="subtle" size="xs" onClick={() => handleChoose('custom')}>
                    Reset to Local
                  </Button>
                </div>
              </div>
              <textarea
                value={currentConflict.customText || (currentConflict.resolution === 'remote' ? currentConflict.remote : currentConflict.local)}
                onChange={(e) => {
                  const val = e.target.value;
                  setConflicts((prev) =>
                    prev.map((c, idx) =>
                      idx === activeConflictIndex ? { ...c, resolution: 'custom', customText: val } : c
                    )
                  );
                }}
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  fontSize: 12,
                  fontFamily: 'var(--font-ui)',
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
          </Stack>
        ) : (
          /* Side-by-Side 3-Way Grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
            <div style={paneStyle}>
              <div style={paneHeader}><strong style={{ color: 'var(--text-muted)' }}>Base Revision</strong></div>
              <div style={contentBox}>{currentConflict.base}</div>
            </div>
            <div style={{ ...paneStyle, borderColor: 'rgba(212,175,55,0.3)' }}>
              <div style={paneHeader}>
                <strong style={{ color: 'var(--gold)' }}>Local (Mine)</strong>
                <Button size="xs" variant="subtle" onClick={() => handleChoose('local')}>Use</Button>
              </div>
              <div style={contentBox}>{currentConflict.local}</div>
            </div>
            <div style={{ ...paneStyle, borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              <div style={paneHeader}>
                <strong style={{ color: '#60a5fa' }}>Remote (Theirs)</strong>
                <Button size="xs" variant="subtle" onClick={() => handleChoose('remote')}>Use</Button>
              </div>
              <div style={contentBox}>{currentConflict.remote}</div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {allResolved ? 'All conflict blocks have been resolved.' : `${conflicts.length - resolvedCount} conflict(s) pending review.`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="subtle" onClick={() => closeDialog('mergeConflict')}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCommitMerge}>
              ✓ Commit Merge & Apply
            </Button>
          </div>
        </div>
      </Stack>
    </Modal>
  );
}

const paneStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const paneHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  background: 'var(--bg-app)',
  borderBottom: '1px solid var(--border)',
  fontSize: 11,
};

const contentBox = {
  padding: '10px 12px',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--text-primary)',
  minHeight: 60,
  maxHeight: 140,
  overflowY: 'auto',
  fontFamily: 'var(--font-ui)',
};
