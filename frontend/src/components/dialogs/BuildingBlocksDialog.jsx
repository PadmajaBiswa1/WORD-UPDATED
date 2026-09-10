import { useState, useEffect } from 'react';
import { useUIStore, useEditorStore, useProductivityStore } from '@/store';
import { Modal, Button, Stack, Input, Label, Badge } from '@/components/ui';

const STORAGE_KEY = 'etherx_building_blocks';

const DEFAULT_BLOCKS = [
  {
    id: 'bb-signoff-formal',
    title: 'Formal Sign-off',
    name: 'Formal Sign-off',
    category: 'Sign-off',
    description: 'Professional closing block with signature space and title',
    content: '<p>Sincerely,</p><p><br></p><p><strong>[Signer Name]</strong><br><span style="color:#777;">[Title / Organization]</span></p>',
  },
  {
    id: 'bb-confidential-notice',
    title: 'Confidentiality Notice',
    name: 'Confidentiality Notice',
    category: 'Legal',
    description: 'Legal confidentiality disclaimer banner',
    content: '<div style="border-left:3px solid #c9a84c;padding:8px 12px;margin:12px 0;background:rgba(212,175,55,0.08);"><p><strong>CONFIDENTIALITY NOTICE:</strong> The contents of this document are strictly private and legally protected. Any unauthorized distribution, reproduction, or disclosure is strictly prohibited.</p></div>',
  },
  {
    id: 'bb-meeting-header',
    title: 'Executive Meeting Header',
    name: 'Executive Meeting Header',
    category: 'Headers',
    description: 'Structured header for agendas, memos, and executive summaries',
    content: '<div style="border-bottom:2px solid #d4af37;padding-bottom:8px;margin-bottom:16px;"><h2>EXECUTIVE MEMORANDUM</h2><table style="width:100%;border:none;margin-top:8px;"><tr><td style="width:15%;border:none;color:#888;">TO:</td><td style="border:none;">[Recipients]</td></tr><tr><td style="border:none;color:#888;">FROM:</td><td style="border:none;">[Author / Team]</td></tr><tr><td style="border:none;color:#888;">DATE:</td><td style="border:none;">[Current Date]</td></tr><tr><td style="border:none;color:#888;">SUBJECT:</td><td style="border:none;"><strong>[Subject]</strong></td></tr></table></div>',
  },
  {
    id: 'bb-acceptance-block',
    title: 'Acceptance Signature Block',
    name: 'Acceptance Signature Block',
    category: 'Legal',
    description: 'Dual-party signature acknowledgement table',
    content: '<table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr><th style="border:1px solid #444;padding:8px;text-align:left;">Party A Approval</th><th style="border:1px solid #444;padding:8px;text-align:left;">Party B Approval</th></tr></thead><tbody><tr><td style="border:1px solid #444;padding:12px;"><p>Name: ______________________</p><p>Title: _______________________</p><p>Date: _______________________</p></td><td style="border:1px solid #444;padding:12px;"><p>Name: ______________________</p><p>Title: _______________________</p><p>Date: _______________________</p></td></tr></tbody></table>',
  },
];

export function BuildingBlocksDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const { buildingBlocks = [], addBuildingBlock, deleteBuildingBlock } = useProductivityStore();

  const [blocks, setBlocks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isCreating, setIsCreating] = useState(false);

  // New snippet state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newDesc, setNewDesc] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newJson, setNewJson] = useState(null);

  // Load blocks on mount (merging defaults with store & localStorage)
  useEffect(() => {
    let savedList = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          savedList = parsed;
        }
      }
    } catch {}

    const storeList = Array.isArray(buildingBlocks) ? buildingBlocks : [];
    const combined = [...storeList, ...savedList];
    const uniqueMap = new Map();

    DEFAULT_BLOCKS.forEach((b) => uniqueMap.set(b.id, b));
    combined.forEach((b) => {
      if (b && b.id) {
        uniqueMap.set(b.id, {
          ...b,
          title: b.title || b.name || 'Untitled Block',
          name: b.name || b.title || 'Untitled Block',
          content: b.content || b.previewText || '',
        });
      }
    });

    const list = Array.from(uniqueMap.values());
    setBlocks(list);
    setSelectedId(list[0]?.id || null);
  }, [buildingBlocks]);

  const saveBlocks = (next) => {
    setBlocks(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const categories = ['All', ...new Set(blocks.map((b) => b.category || 'General'))];

  const filteredBlocks = blocks.filter((b) => {
    const title = b.title || b.name || '';
    const desc = b.description || '';
    const matchesSearch =
      title.toLowerCase().includes(search.toLowerCase()) ||
      desc.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const selectedBlock = blocks.find((b) => b.id === selectedId) || filteredBlocks[0] || null;

  const handleInsert = (blockToInsert) => {
    const target = blockToInsert || selectedBlock;
    if (!target) return;
    if (!editor) {
      toast('Editor is not ready', 'error');
      return;
    }

    try {
      // Wire "Insert" button to insert the building block JSON/HTML directly into the editor at current selection
      if (target.contentJson) {
        editor.chain().focus().insertContent(target.contentJson).run();
      } else if (target.content) {
        editor.chain().focus().insertContent(target.content).run();
      } else {
        editor.chain().focus().insertContent(`<p>${target.title || target.name}</p>`).run();
      }
      toast(`Inserted "${target.title || target.name}" at current selection`, 'success');
      closeDialog('buildingBlocks');
    } catch (err) {
      console.error(err);
      toast('Failed to insert building block: ' + err.message, 'error');
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this building block?')) {
      const next = blocks.filter((b) => b.id !== id);
      saveBlocks(next);
      deleteBuildingBlock?.(id);
      if (selectedId === id) {
        setSelectedId(next[0]?.id || null);
      }
      toast('Building block deleted', 'info');
    }
  };

  // Add "Save Current Selection as Building Block" button with category and title
  const handleSaveSelectionAsBuildingBlock = () => {
    let selectionHtml = '';
    let selectionJson = null;
    let snippetTitle = '';

    if (editor) {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const selText = editor.state.doc.textBetween(from, to, ' ').trim();
        snippetTitle = selText.slice(0, 40);
        const slice = editor.state.doc.slice(from, to);
        selectionJson = slice.toJSON();

        try {
          const serializer = editor.schema.cached.domSerializer || editor.view.someProp('clipboardSerializer', (s) => s);
          if (serializer) {
            const div = document.createElement('div');
            div.appendChild(serializer.serializeFragment(slice.content));
            selectionHtml = div.innerHTML;
          }
        } catch {
          selectionHtml = `<p>${selText}</p>`;
        }
      } else {
        toast('Tip: Highlight text in document to capture it, or create a block below.', 'info');
      }
    }

    setNewContent(selectionHtml || '<p>Building block content</p>');
    setNewJson(selectionJson);
    setNewTitle(snippetTitle || '');
    setNewCategory('General');
    setNewDesc(snippetTitle ? `Custom block: ${snippetTitle}` : 'Custom snippet');
    setIsCreating(true);
  };

  const handleSaveNew = () => {
    if (!newTitle.trim()) {
      toast('Please provide a title for the building block', 'error');
      return;
    }
    const blockId = `bb-${Date.now()}`;
    const newBlock = {
      id: blockId,
      title: newTitle.trim(),
      name: newTitle.trim(),
      category: newCategory.trim() || 'General',
      description: newDesc.trim() || 'Custom building block',
      content: newContent,
      contentJson: newJson,
      previewText: newContent.replace(/<[^>]+>/g, ' ').slice(0, 100),
      createdAt: new Date().toISOString(),
    };

    // Save to centralized productivity store
    addBuildingBlock?.(newBlock);

    const next = [newBlock, ...blocks];
    saveBlocks(next);
    setSelectedId(newBlock.id);
    setIsCreating(false);
    toast(`Saved "${newBlock.title}" to building blocks`, 'success');
  };

  return (
    <Modal title="Building Blocks & AutoText Gallery" onClose={() => closeDialog('buildingBlocks')} width={700}>
      <Stack gap={14}>
        {!isCreating ? (
          <>
            {/* Top Toolbar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6, flex: 1, maxWidth: 360 }}>
                <Input
                  value={search}
                  onChange={setSearch}
                  placeholder="Search building blocks…"
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="primary" size="xs" onClick={handleSaveSelectionAsBuildingBlock}>
                  ＋ Save Current Selection as Building Block
                </Button>
              </div>
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  style={{
                    background: categoryFilter === cat ? 'var(--gold)' : 'var(--bg-elevated)',
                    color: categoryFilter === cat ? 'var(--text-on-gold)' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '2px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: categoryFilter === cat ? 600 : 400,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Two Column Layout: List & Preview */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '260px 1fr',
                gap: 12,
                minHeight: 280,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              {/* Snippet List */}
              <div
                style={{
                  background: 'var(--bg-app)',
                  borderRight: '1px solid var(--border)',
                  overflowY: 'auto',
                  maxHeight: 340,
                }}
              >
                {filteredBlocks.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    No building blocks found
                  </div>
                ) : (
                  filteredBlocks.map((b) => {
                    const isSelected = b.id === (selectedBlock?.id);
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedId(b.id)}
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--border)',
                          background: isSelected ? 'var(--bg-hover)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--gold)' : '3px solid transparent',
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--text-gold)' : 'var(--text-primary)' }}>
                            {b.title}
                          </span>
                          <Badge color="rgba(212,175,55,0.2)">{b.category || 'General'}</Badge>
                        </div>
                        {b.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.description}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Preview Pane */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  maxHeight: 340,
                  overflowY: 'auto',
                }}
              >
                {selectedBlock ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {selectedBlock.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Category: <strong style={{ color: 'var(--gold)' }}>{selectedBlock.category}</strong>
                        </div>
                      </div>
                      <Button variant="danger" size="xs" onClick={() => handleDelete(selectedBlock.id)}>
                        Delete
                      </Button>
                    </div>

                    <Label>Live Content Preview</Label>
                    <div
                      style={{
                        background: '#ffffff',
                        color: '#1a1a1a',
                        padding: 12,
                        borderRadius: 'var(--radius-sm)',
                        minHeight: 120,
                        maxHeight: 180,
                        overflowY: 'auto',
                        fontSize: 12,
                        lineHeight: 1.5,
                        fontFamily: 'Crimson Pro, Georgia, serif',
                        border: '1px solid var(--border)',
                      }}
                      dangerouslySetInnerHTML={{ __html: selectedBlock.content }}
                    />
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                    Select a snippet to preview
                  </div>
                )}

                {selectedBlock && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <Button variant="primary" onClick={() => handleInsert(selectedBlock)}>
                      ↵ Insert at Cursor
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Create Snippet Form */
          <Stack gap={12}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
              Create AutoText Snippet from Editor Selection
            </div>
            <div>
              <Label>Snippet Title</Label>
              <Input
                value={newTitle}
                onChange={setNewTitle}
                placeholder="e.g., Company Standard Footer"
                autoFocus
              />
            </div>
            <div>
              <Label>Category</Label>
              <Input
                value={newCategory}
                onChange={setNewCategory}
                placeholder="General, Legal, Headers, Sign-off…"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newDesc}
                onChange={setNewDesc}
                placeholder="Optional description of when to use this snippet…"
              />
            </div>
            <div>
              <Label>Snippet HTML Content</Label>
              <Input
                rows={4}
                value={newContent}
                onChange={setNewContent}
                placeholder="HTML or rich text content…"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="subtle" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveNew}>
                Save Building Block
              </Button>
            </div>
          </Stack>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('buildingBlocks')}>
            Close
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
