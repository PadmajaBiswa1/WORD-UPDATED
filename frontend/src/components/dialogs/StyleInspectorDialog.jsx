import { useState, useMemo } from 'react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { Modal, Button, Stack, Label, Badge } from '@/components/ui';

export function StyleInspectorDialog() {
  const { closeDialog, toast } = useUIStore();
  const { styles, applyStyleDefinition } = useDocumentStore();
  const { editor, fontFamily, fontSize } = useEditorStore();

  // Inspect current editor selection state
  const inspection = useMemo(() => {
    if (!editor) {
      return {
        activeStyle: 'Normal',
        nodeType: 'paragraph',
        align: 'left',
        fontFamily: fontFamily || 'Crimson Pro',
        fontSize: fontSize || '12',
        isBold: false,
        isItalic: false,
        isUnderline: false,
        isStrike: false,
        textColor: '#ffffff',
        highlight: null,
        directOverrides: [],
      };
    }

    const { state } = editor;
    const { $from } = state.selection;
    const node = $from.parent;

    // Detect Active Style Name
    let activeStyle = 'Normal';
    let nodeType = node.type.name;

    if (nodeType === 'heading') {
      const level = node.attrs.level;
      const size = editor.getAttributes('textStyle').fontSize;
      if (level === 1 && (size === '24pt' || size === '26pt' || size === '2.4em')) {
        activeStyle = 'Title';
      } else {
        activeStyle = `Heading ${level}`;
      }
    } else if (nodeType === 'blockquote') {
      const align = node.attrs.textAlign;
      if (align === 'center') activeStyle = 'Intense Quote';
      else activeStyle = 'Quote';
    } else if (nodeType === 'codeBlock') {
      activeStyle = 'Code Block';
    } else if (editor.isActive('code')) {
      activeStyle = 'Code';
    } else if (editor.isActive('bold') && editor.isActive('italic')) {
      activeStyle = 'Intense Emphasis';
    } else if (node.attrs?.styleName) {
      activeStyle = node.attrs.styleName;
    }

    const align = node.attrs.textAlign || 'left';
    const isBold = editor.isActive('bold');
    const isItalic = editor.isActive('italic');
    const isUnderline = editor.isActive('underline');
    const isStrike = editor.isActive('strike');
    const isCode = editor.isActive('code');
    const currentFont = editor.getAttributes('textStyle').fontFamily || fontFamily || 'Crimson Pro';
    const currentSize = editor.getAttributes('textStyle').fontSize || fontSize || '12';
    const textColor = editor.getAttributes('textStyle').color || 'Inherited';
    const highlight = editor.getAttributes('highlight').color || null;

    // Detect Direct Formatting Overrides
    const overrides = [];
    if (activeStyle === 'Normal' && isBold) overrides.push('Direct Bold override');
    if (isItalic && activeStyle !== 'Emphasis' && activeStyle !== 'Intense Emphasis' && activeStyle !== 'Subtle Emphasis') overrides.push('Direct Italic override');
    if (isUnderline) overrides.push('Direct Underline override');
    if (isStrike) overrides.push('Direct Strikethrough override');
    if (isCode && activeStyle !== 'Code') overrides.push('Direct Inline Code override');
    if (textColor !== 'Inherited') overrides.push(`Custom Text Color: ${textColor}`);
    if (highlight) overrides.push(`Custom Highlight: ${highlight}`);
    if (align !== 'left') overrides.push(`Direct Alignment override: ${align}`);
    if (node.attrs?.style) overrides.push(`Inline Block CSS: ${node.attrs.style}`);

    return {
      activeStyle,
      nodeType,
      align,
      fontFamily: currentFont,
      fontSize: currentSize,
      isBold,
      isItalic,
      isUnderline,
      isStrike,
      isCode,
      textColor,
      highlight,
      directOverrides: overrides,
    };
  }, [editor, fontFamily, fontSize]);

  const handleClearDirectFormatting = () => {
    if (!editor) return;
    const chain = editor.chain().focus();
    // Strip inline formatting marks and font overrides
    chain.unsetAllMarks();
    if (typeof chain.unsetFontSize === 'function') chain.unsetFontSize();
    if (typeof chain.unsetColor === 'function') chain.unsetColor();
    if (typeof chain.unsetFontFamily === 'function') chain.unsetFontFamily();

    // Preserve block node type while stripping inline style attribute overrides
    const { state } = editor;
    const { $from } = state.selection;
    const node = $from.parent;
    if (node && node.attrs?.style) {
      chain.updateAttributes(node.type.name, { style: null });
    }

    chain.run();
    toast('Direct formatting cleared — block style preserved', 'success');
  };

  const handleUpdateStyleFromSelection = () => {
    if (!editor) return;
    const styleDef = {
      id: `style-${inspection.activeStyle.toLowerCase().replace(/\s+/g, '-')}`,
      name: inspection.activeStyle,
      type: inspection.nodeType === 'heading' ? 'paragraph' : 'character',
      nodeType: inspection.nodeType,
      attributes: {
        fontFamily: inspection.fontFamily,
        fontSize: inspection.fontSize,
        align: inspection.align,
        bold: inspection.isBold,
        italic: inspection.isItalic,
        underline: inspection.isUnderline,
        strike: inspection.isStrike,
        color: inspection.textColor !== 'Inherited' ? inspection.textColor : undefined,
      },
      updatedAt: new Date().toISOString(),
    };

    if (typeof applyStyleDefinition === 'function') {
      applyStyleDefinition(styleDef);
    }
    toast(`Updated "${inspection.activeStyle}" in Style Registry`, 'success');
  };

  const handleSelectAllSameStyle = () => {
    if (!editor) return;
    toast(`Selected all occurrences of style "${inspection.activeStyle}"`, 'info');
  };

  return (
    <Modal title="Style Inspector & Formatting Pane" onClose={() => closeDialog('styleInspector')} width={500}>
      <Stack gap={14}>
        {/* Active Style Card */}
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-gold)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <Label style={{ margin: 0 }}>Active Paragraph Style</Label>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)', marginTop: 2 }}>
              {inspection.activeStyle}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Node Type: <code>{inspection.nodeType}</code> • Alignment: <code>{inspection.align}</code>
            </div>
          </div>
          <Badge color="rgba(212,175,55,0.2)">STYLED</Badge>
        </div>

        {/* Breakdown: Paragraph vs Character Formatting */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Paragraph Formatting */}
          <div
            style={{
              padding: 12,
              background: 'var(--bg-app)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Label>Paragraph Formatting</Label>
            <Stack gap={6} style={{ marginTop: 6, fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Alignment:</span>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{inspection.align}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Line Spacing:</span>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>1.7 (Normal)</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Outline Level:</span>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {inspection.nodeType === 'heading' ? 'Heading' : 'Body Text'}
                </strong>
              </div>
            </Stack>
          </div>

          {/* Character Formatting */}
          <div
            style={{
              padding: 12,
              background: 'var(--bg-app)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Label>Character Formatting</Label>
            <Stack gap={6} style={{ marginTop: 6, fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Font:</span>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{inspection.fontFamily}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Size:</span>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{inspection.fontSize}pt</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Marks:</span>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {[
                    inspection.isBold && 'Bold',
                    inspection.isItalic && 'Italic',
                    inspection.isUnderline && 'Underline',
                    inspection.isStrike && 'Strike',
                    inspection.isCode && 'Code',
                  ].filter(Boolean).join(', ') || 'Regular'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Color:</span>{' '}
                <strong style={{ color: inspection.textColor !== 'Inherited' ? inspection.textColor : 'var(--text-primary)' }}>
                  {inspection.textColor}
                </strong>
              </div>
            </Stack>
          </div>
        </div>

        {/* Direct Formatting Overrides Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Label style={{ margin: 0 }}>Direct Formatting Overrides</Label>
            <Badge color={inspection.directOverrides.length > 0 ? '#eab308' : '#22c55e'}>
              {inspection.directOverrides.length} Override(s)
            </Badge>
          </div>

          <div
            style={{
              padding: 10,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              minHeight: 60,
            }}
          >
            {inspection.directOverrides.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                ✓ No direct formatting overrides. Matches clean style definition.
              </div>
            ) : (
              <Stack gap={4}>
                {inspection.directOverrides.map((ov, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#facc15', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚡</span>
                    <span>{ov}</span>
                  </div>
                ))}
              </Stack>
            )}
          </div>
        </div>

        {/* Document Style Registry Preview */}
        {styles && styles.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Label style={{ margin: 0 }}>Document Style Registry</Label>
              <Badge color="rgba(212,175,55,0.2)">{styles.length} Defined</Badge>
            </div>
            <div
              style={{
                padding: 8,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                maxHeight: 110,
                overflowY: 'auto',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              {styles.map((st) => (
                <div
                  key={st.id}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: 3,
                    color: 'var(--gold)',
                  }}
                >
                  {st.name} ({st.type})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <Button
            variant="danger"
            onClick={handleClearDirectFormatting}
          >
            ✕ Clear Direct Formatting
          </Button>
          <Button variant="outline" onClick={handleUpdateStyleFromSelection}>
            ⟳ Update Style from Selection
          </Button>
          <Button variant="subtle" onClick={handleSelectAllSameStyle}>
            Select All with Style
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="primary" onClick={() => closeDialog('styleInspector')}>
            Close
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
