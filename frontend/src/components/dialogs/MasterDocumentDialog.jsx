import { useState, useEffect } from 'react';
import { useUIStore, useDocumentStore, useEditorStore } from '@/store';
import { Modal, Button, Stack, Input, Label, Badge } from '@/components/ui';
import { documentApi } from '@/services/api';

const SAMPLE_PARTS = [
  {
    partId: 'part-ch1',
    title: 'Chapter 1: System Architecture & Data Plane',
    linkedDocumentId: 'doc_arch_001',
    includeMode: 'linked',
    order: 1,
    status: 'synced',
    lastRefreshed: new Date(Date.now() - 3600000).toLocaleString(),
    preview: 'This chapter outlines the peer-to-peer data plane, local IndexedDB caching layer, and Tiptap JSON document normalization.',
  },
  {
    partId: 'part-ch2',
    title: 'Chapter 2: Cryptographic Security Model',
    linkedDocumentId: 'doc_sec_002',
    includeMode: 'linked',
    order: 2,
    status: 'synced',
    lastRefreshed: new Date(Date.now() - 7200000).toLocaleString(),
    preview: 'Covers AES-256-GCM zero-knowledge client encryption, PBKDF2 salt derivation, and digital signature envelope validation.',
  },
  {
    partId: 'part-appA',
    title: 'Appendix A: Regulatory Compliance Snapshot',
    linkedDocumentId: 'doc_snap_003',
    includeMode: 'snapshot',
    order: 3,
    status: 'snapshot',
    lastRefreshed: '2026-09-01 (Frozen)',
    preview: 'Fixed regulatory audit certification freeze for enterprise compliance verification.',
  },
];

export function MasterDocumentDialog() {
  const { closeDialog, toast } = useUIStore();
  const { id: currentDocId, documentParts, setDocumentParts } = useDocumentStore();
  const { editor } = useEditorStore();

  const [parts, setParts] = useState(
    Array.isArray(documentParts) && documentParts.length > 0 ? documentParts : []
  );
  const [selectedPartId, setSelectedPartId] = useState(parts[0]?.partId || null);
  const [isAdding, setIsAdding] = useState(false);
  const [availableDocs, setAvailableDocs] = useState([]);

  useEffect(() => {
    documentApi.list().then((res) => {
      const list = res?.documents || res?.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(list)) {
        setAvailableDocs(list.filter((d) => String(d.id || d._id) !== String(currentDocId)));
      }
    }).catch(() => {});
  }, [currentDocId]);

  // New subdocument form state
  const [newTitle, setNewTitle] = useState('');
  const [newDocId, setNewDocId] = useState('');
  const [newMode, setNewMode] = useState('linked'); // 'linked' or 'snapshot'

  const persistParts = (nextParts) => {
    setParts(nextParts);
    if (typeof setDocumentParts === 'function') {
      setDocumentParts(nextParts);
    }
  };

  const handleMove = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= parts.length) return;
    const reordered = [...parts];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const updated = reordered.map((p, idx) => ({ ...p, order: idx + 1 }));
    persistParts(updated);
  };

  const handleRefreshPart = async (partId) => {
    const part = parts.find((p) => p.partId === partId);
    if (!part?.linkedDocumentId) return;
    try {
      const doc = await documentApi.get(part.linkedDocumentId);
      const previewText = (doc?.content || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 140);
      const updated = parts.map((p) =>
        p.partId === partId
          ? {
              ...p,
              title: doc?.title || p.title,
              preview: previewText || 'Content synced from linked document.',
              status: 'synced',
              lastRefreshed: new Date().toLocaleString(),
            }
          : p
      );
      persistParts(updated);
      toast(`Subdocument "${part.title}" refreshed from source`, 'success');
    } catch (err) {
      toast(`Unable to fetch linked subdocument: ${err.message}`, 'error');
    }
  };

  const handleRefreshAll = async () => {
    let refreshed = 0;
    const nextParts = [...parts];
    for (let i = 0; i < nextParts.length; i++) {
      const p = nextParts[i];
      if (p.includeMode === 'linked' && p.linkedDocumentId) {
        try {
          const doc = await documentApi.get(p.linkedDocumentId);
          const previewText = (doc?.content || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 140);
          nextParts[i] = {
            ...p,
            title: doc?.title || p.title,
            preview: previewText || p.preview,
            status: 'synced',
            lastRefreshed: new Date().toLocaleString(),
          };
          refreshed++;
        } catch {
          // keep existing
        }
      }
    }
    persistParts(nextParts);
    toast(`${refreshed} linked subdocuments refreshed from server`, 'success');
  };

  const handleDetachPart = (partId) => {
    const updated = parts.map((p) =>
      p.partId === partId
        ? {
            ...p,
            includeMode: 'snapshot',
            status: 'detached',
            lastRefreshed: `${new Date().toLocaleDateString()} (Detached)`,
          }
        : p
    );
    persistParts(updated);
    toast('Subdocument detached: converted to static snapshot in master document', 'info');
  };

  const handleDeletePart = (partId) => {
    if (window.confirm('Remove this subdocument from the master document?')) {
      const updated = parts
        .filter((p) => p.partId !== partId)
        .map((p, idx) => ({ ...p, order: idx + 1 }));
      persistParts(updated);
      if (selectedPartId === partId) {
        setSelectedPartId(updated[0]?.partId || null);
      }
      toast('Subdocument removed', 'info');
    }
  };

  const handleAddSubdocument = () => {
    if (!newTitle.trim() || !newDocId.trim()) {
      toast('Please provide both a title and document ID', 'error');
      return;
    }

    // Cycle detection check
    if (newDocId.trim() === currentDocId) {
      toast('Cycle detected: A document cannot include itself as a subdocument', 'error');
      return;
    }

    if (parts.some((p) => p.linkedDocumentId === newDocId.trim())) {
      toast('This document is already linked as a subdocument', 'warning');
      return;
    }

    const newPart = {
      partId: `part-${Date.now()}`,
      title: newTitle.trim(),
      linkedDocumentId: newDocId.trim(),
      includeMode: newMode,
      order: parts.length + 1,
      status: newMode === 'linked' ? 'synced' : 'snapshot',
      lastRefreshed: new Date().toLocaleString(),
      preview: `Imported content from document ID ${newDocId.trim()}.`,
    };

    const updated = [...parts, newPart];
    persistParts(updated);
    setSelectedPartId(newPart.partId);
    setIsAdding(false);
    setNewTitle('');
    setNewDocId('');
    toast(`Added "${newPart.title}" to master document`, 'success');
  };

  const handleStitchIntoEditor = async () => {
    if (!editor) {
      toast('Editor is not ready', 'error');
      return;
    }

    let composedHtml = '';
    for (const p of parts) {
      let bodyHtml = `<p>${p.preview || 'Subdocument content.'}</p>`;
      if (p.includeMode === 'linked' && p.linkedDocumentId) {
        try {
          const doc = await documentApi.get(p.linkedDocumentId);
          if (doc?.content) {
            bodyHtml = doc.content;
          }
        } catch {
          // fallback to preview
        }
      }
      composedHtml += `
        <div class="master-subdocument-part" data-part-id="${p.partId}" style="margin: 28px 0; padding: 20px; border-left: 4px solid var(--gold, #c9a84c); background: rgba(212,175,55,0.03); border-radius: 4px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 8px;">
            [Subdocument ${p.order} • Mode: ${p.includeMode} • ID: ${p.linkedDocumentId || 'snapshot'}]
          </div>
          <h2 style="margin-top: 0; color: #c9a84c;">${p.title}</h2>
          <div>${bodyHtml}</div>
        </div>
      `;
    }

    editor.chain().focus().insertContent(composedHtml).run();
    toast(`Composed master document parts inserted into editor`, 'success');
    closeDialog('masterDoc');
  };

  const selectedPart = parts.find((p) => p.partId === selectedPartId) || parts[0];

  return (
    <Modal title="Master Document & Subdocuments Manager" onClose={() => closeDialog('masterDoc')} width={780}>
      <Stack gap={14}>
        {/* Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Master Document Structure
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Manage multi-part manuscripts, book chapters, and team-authored subdocuments.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="subtle" size="xs" onClick={handleRefreshAll}>
              ⟳ Refresh All Linked
            </Button>
            <Button variant="primary" size="xs" onClick={() => setIsAdding(!isAdding)}>
              {isAdding ? 'Close Form' : '+ Add Subdocument'}
            </Button>
          </div>
        </div>

        {/* Add New Part Form */}
        {isAdding && (
          <div
            style={{
              padding: 12,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-gold)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Stack gap={10}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>
                Link or Insert New Subdocument
              </div>
              {availableDocs.length > 0 && (
                <div>
                  <Label>Pick From Your Documents Library</Label>
                  <select
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                    onChange={(e) => {
                      const doc = availableDocs.find((d) => String(d.id || d._id) === e.target.value);
                      if (doc) {
                        setNewDocId(String(doc.id || doc._id));
                        setNewTitle(doc.title || 'Untitled Subdocument');
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>-- Select a document to link --</option>
                    {availableDocs.map((d) => (
                      <option key={d.id || d._id} value={String(d.id || d._id)}>
                        {d.title} (ID: {String(d.id || d._id).slice(0, 8)}...)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <Label>Section / Chapter Title</Label>
                  <Input
                    value={newTitle}
                    onChange={setNewTitle}
                    placeholder="e.g. Chapter 3: Implementation Details"
                    autoFocus
                  />
                </div>
                <div>
                  <Label>Document ID</Label>
                  <Input
                    value={newDocId}
                    onChange={setNewDocId}
                    placeholder="e.g. doc_12345"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Label style={{ margin: 0 }}>Include Mode:</Label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mode"
                    checked={newMode === 'linked'}
                    onChange={() => setNewMode('linked')}
                  />
                  Linked (Live dynamic updates)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mode"
                    checked={newMode === 'snapshot'}
                    onChange={() => setNewMode('snapshot')}
                  />
                  Snapshot (Frozen copy)
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <Button variant="subtle" size="xs" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="xs" onClick={handleAddSubdocument}>
                  Add Part
                </Button>
              </div>
            </Stack>
          </div>
        )}

        {/* Subdocuments Table and Controls */}
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 10px', width: 40 }}>#</th>
                <th style={{ padding: '8px 10px' }}>Subdocument Title</th>
                <th style={{ padding: '8px 10px' }}>Document ID</th>
                <th style={{ padding: '8px 10px' }}>Mode</th>
                <th style={{ padding: '8px 10px' }}>Last Refreshed</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p, idx) => {
                const isSelected = p.partId === selectedPartId;
                return (
                  <tr
                    key={p.partId}
                    onClick={() => setSelectedPartId(p.partId)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? 'var(--bg-hover)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{p.order}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.title}
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--gold)' }}>
                      {p.linkedDocumentId}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <Badge color={p.includeMode === 'linked' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(212, 175, 55, 0.2)'}>
                        {p.includeMode.toUpperCase()}
                      </Badge>
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
                      {p.lastRefreshed}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={idx === 0}
                          onClick={(e) => { e.stopPropagation(); handleMove(idx, -1); }}
                          title="Move Up"
                        >
                          ▲
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={idx === parts.length - 1}
                          onClick={(e) => { e.stopPropagation(); handleMove(idx, 1); }}
                          title="Move Down"
                        >
                          ▼
                        </Button>
                        {p.includeMode === 'linked' ? (
                          <>
                            <Button
                              variant="subtle"
                              size="xs"
                              onClick={(e) => { e.stopPropagation(); handleRefreshPart(p.partId); }}
                              title="Refresh content"
                            >
                              ↻
                            </Button>
                            <Button
                              variant="subtle"
                              size="xs"
                              onClick={(e) => { e.stopPropagation(); handleDetachPart(p.partId); }}
                              title="Detach subdocument"
                            >
                              Detach
                            </Button>
                          </>
                        ) : null}
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={(e) => { e.stopPropagation(); handleDeletePart(p.partId); }}
                          title="Remove part"
                        >
                          ✕
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Selected Part Preview & Metadata */}
        {selectedPart && (
          <div
            style={{
              padding: 10,
              background: 'var(--bg-app)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedPart.title}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                Permissions: <strong style={{ color: 'var(--gold)' }}>Inherited from Master</strong>
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {selectedPart.preview}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <Button variant="subtle" onClick={handleStitchIntoEditor}>
            📑 Assemble All Parts into Document
          </Button>
          <Button variant="primary" onClick={() => closeDialog('masterDoc')}>
            Done
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
