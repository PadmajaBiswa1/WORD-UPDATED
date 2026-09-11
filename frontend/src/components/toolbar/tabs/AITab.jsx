import { useMemo } from 'react';
import {
  Sparkles, FilePenLine, FileText, AlignLeft, CheckCheck, RefreshCw,
  Tag, Languages, Globe, Link2
} from 'lucide-react';
import { Button, Tooltip, Divider } from '@/components/ui';
import { RibbonGroup } from '../RibbonGroup';
import { useDocumentStore, useEditorStore, useUIStore } from '@/store';
import { executePragnaAi, openTranslationUrl } from '@/services/ai';

function getSelectedText(editor) {
  if (!editor) return '';
  const { from, to } = editor.state.selection;
  if (from !== to) return editor.state.doc.textBetween(from, to, ' ').trim();
  return editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ').trim();
}

function replaceSelectionOrInsert(editor, html) {
  if (!editor) return;
  const { from, to } = editor.state.selection;
  if (from !== to) {
    editor.chain().focus().insertContentAt({ from, to }, html).run();
    return;
  }
  editor.chain().focus().insertContent(html).run();
}

export function AITab() {
  const { editor } = useEditorStore();
  const { toast, openPragna } = useUIStore();
  const setTitle = useDocumentStore((s) => s.setTitle);

  const hasEditor = !!editor;
  const buttonStyle = useMemo(() => ({
    width: 124,
    height: 56,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
    padding: '8px 10px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: 11,
  }), []);

  const heroButtonStyle = useMemo(() => ({
    width: 140,
    height: 56,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
    padding: '8px 12px',
    background: 'linear-gradient(135deg, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.06) 100%)',
    border: '1px solid var(--gold-border)',
    color: 'var(--gold)',
    fontSize: 11,
    fontWeight: 600,
    boxShadow: '0 0 10px rgba(212,175,55,0.12)',
  }), []);

  const openPragnaTab = (tabId) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    openPragna(tabId);
  };

  const quickGrammar = async () => {
    if (!editor) return;
    const source = getSelectedText(editor);
    if (!source) {
      openPragna('grammar');
      return;
    }
    toast('Pragna is proofreading with Ollama...', 'info');
    try {
      const res = await executePragnaAi('grammar', source);
      if (res && res.html) {
        replaceSelectionOrInsert(editor, res.html);
        toast('Pragna: Grammar and spelling perfected', 'success');
      }
    } catch (err) {
      toast('Proofreading failed: ' + err.message, 'error');
    }
  };

  const quickSummarize = async () => {
    if (!editor) return;
    const source = getSelectedText(editor);
    if (!source) {
      openPragna('summarize');
      return;
    }
    toast('Pragna is summarizing with Ollama...', 'info');
    try {
      const res = await executePragnaAi('summarize', source);
      if (res && res.html) {
        replaceSelectionOrInsert(editor, res.html);
        toast('Pragna: Summary inserted', 'success');
      }
    } catch (err) {
      toast('Summarizing failed: ' + err.message, 'error');
    }
  };

  return (
    <>
      <RibbonGroup label="Pragna AI">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, maxWidth: 940 }}>
          {/* Flagship Assistant Button */}
          <Tooltip text="Open Pragna AI Assistant Modal">
            <Button disabled={!hasEditor} style={heroButtonStyle} onClick={() => openPragnaTab('ask')}>
              <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}><Sparkles size={18} strokeWidth={1.75} /></span>
              <span style={{ fontSize: 12 }}>Ask Pragna</span>
            </Button>
          </Tooltip>

          {/* Edit as Instructed Button */}
          <Tooltip text="Edit selected text according to custom instructions using Gemma 31B">
            <Button disabled={!hasEditor} style={heroButtonStyle} onClick={() => openPragnaTab('edit')}>
              <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}><FilePenLine size={18} strokeWidth={1.75} /></span>
              <span style={{ fontSize: 12 }}>Edit as Instructed</span>
            </Button>
          </Tooltip>

          <Divider vertical />

          <Tooltip text="Generate full draft from topic prompt">
            <Button disabled={!hasEditor} style={buttonStyle} onClick={() => openPragnaTab('generate')}>
              <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}><FileText size={18} strokeWidth={1.75} /></span>
              <span>Draft Generator</span>
            </Button>
          </Tooltip>

          <Tooltip text="Summarize selected text or document">
            <Button disabled={!hasEditor} style={buttonStyle} onClick={() => openPragnaTab('summarize')}>
              <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}><AlignLeft size={18} strokeWidth={1.75} /></span>
              <span>Summarize</span>
            </Button>
          </Tooltip>

          <Tooltip text="Fix grammar, spelling, and polish style">
            <Button disabled={!hasEditor} style={buttonStyle} onClick={() => openPragnaTab('grammar')}>
              <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}><CheckCheck size={18} strokeWidth={1.75} /></span>
              <span>Grammar & Polish</span>
            </Button>
          </Tooltip>

          <Tooltip text="Rewrite text in different tones">
            <Button disabled={!hasEditor} style={buttonStyle} onClick={() => openPragnaTab('rewrite')}>
              <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}><RefreshCw size={18} strokeWidth={1.75} /></span>
              <span>Rewrite Assistant</span>
            </Button>
          </Tooltip>

          <Tooltip text="Generate compelling document title">
            <Button disabled={!hasEditor} style={buttonStyle} onClick={() => openPragnaTab('title')}>
              <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}><Tag size={18} strokeWidth={1.75} /></span>
              <span>Title Generator</span>
            </Button>
          </Tooltip>

          <Tooltip text="Translate text with Pragna AI">
            <Button disabled={!hasEditor} style={buttonStyle} onClick={() => openPragnaTab('translate')}>
              <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}><Languages size={18} strokeWidth={1.75} /></span>
              <span>Translation</span>
            </Button>
          </Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Web & Research Tools">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tooltip text="Live Web Research across Google News, ArXiv, and Wikipedia">
            <Button disabled={!hasEditor} style={heroButtonStyle} onClick={() => openPragnaTab('research')}>
              <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}><Globe size={18} strokeWidth={1.75} /></span>
              <span style={{ fontSize: 12 }}>Web Research</span>
            </Button>
          </Tooltip>

          <Tooltip text="Fetch and analyze any web page or article URL">
            <Button disabled={!hasEditor} style={buttonStyle} onClick={() => openPragnaTab('urlReader')}>
              <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}><Link2 size={18} strokeWidth={1.75} /></span>
              <span>URL Reader</span>
            </Button>
          </Tooltip>
        </div>
      </RibbonGroup>
    </>
  );
}

