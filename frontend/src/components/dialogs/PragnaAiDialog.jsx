import { useState, useEffect, useRef } from 'react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { Modal } from '@/components/ui';
import { markdownToHtml } from '@/services/ai';
import { aiApi } from '@/services/api';

const QUICK_PROMPTS = [
  { label: 'Executive Summary', prompt: 'Provide a concise, punchy executive summary of the attached document/selection with key takeaways.' },
  { label: 'Professional & Formal', prompt: 'Rewrite the attached text in an authoritative, executive, and highly polished corporate tone.' },
  { label: 'Polish Grammar & Flow', prompt: 'Proofread and correct all grammar, punctuation, and phrasing issues while improving sentence flow.' },
  { label: 'Convert to Table', prompt: 'Analyze the information in the attached text and structure it into a clean, markdown data table.' },
  { label: 'Action Items & Checklist', prompt: 'Extract all actionable tasks, obligations, and next steps into a structured checklist with owners if applicable.' },
  { label: 'Simplify & Clarify', prompt: 'Simplify the language, eliminate unnecessary jargon, and make the content effortless to read.' },
  { label: 'Elaborate with Details', prompt: 'Expand on these points with thorough rationale, concrete context, and clear explanations.' },
  { label: 'Brainstorm Ideas', prompt: 'Brainstorm creative directions, missing sections, and compelling angles to enhance this document.' },
];

const AVAILABLE_MODELS = [
  { id: 'gemma4:31b', name: 'Gemma 4 (31B Cloud)', badge: 'Default • High Precision' },
  { id: 'gpt-oss:120b', name: 'GPT-OSS (120B Cloud)', badge: 'Deep Reasoning' },
  { id: 'nemotron-3-nano:30b', name: 'Nemotron (30B Cloud)', badge: 'Fast & Structured' },
];

export function PragnaAiDialog() {
  const { dialogs, closeDialog, pragnaInitialTab, pragnaInitialPrompt, toast } = useUIStore();
  const { editor } = useEditorStore();
  const { title: docTitle, setTitle } = useDocumentStore();

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am **Pragna**, your AI writing copilot inside EtherX Word.

I can help you:
- **Draft & Generate** content, proposals, or entire articles
- **Edit & Polish** selected paragraphs with custom instructions
- **Summarize & Extract** key findings, tables, or action items
- **Research the Live Web** with verifiable citations

How can I assist with your document today?`,
      html: '',
      timestamp: new Date(),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemma4:31b');
  const [includeContext, setIncludeContext] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [hasSelection, setHasSelection] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (dialogs.pragnaAi) {
      // Inspect editor selection vs full doc
      if (editor) {
        const { from, to } = editor.state.selection;
        const sel = from !== to
          ? editor.state.doc.textBetween(from, to, ' ').trim()
          : '';
        const fullDoc = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ').trim();

        if (sel) {
          setSelectedText(sel);
          setHasSelection(true);
        } else {
          setSelectedText(fullDoc);
          setHasSelection(false);
        }
      }

      // Handle initial action shortcuts from ribbon
      if (pragnaInitialPrompt) {
        setInputPrompt(pragnaInitialPrompt);
      } else if (pragnaInitialTab && pragnaInitialTab !== 'ask') {
        const map = {
          grammar: 'Please proofread and correct the grammar, spelling, and tone of the attached text.',
          summarize: 'Please provide a clear summary with bulleted key points for the attached text.',
          generate: 'Draft a comprehensive, well-structured section for this document.',
          rewrite: 'Rewrite the attached text to make it more engaging and professional.',
          title: 'Generate 5 compelling, modern document titles for this content.',
          translate: 'Translate the attached text into fluent Spanish (or specify target language).',
          research: 'Conduct live web research on this topic and summarize the latest findings.',
          edit: 'Improve the clarity, impact, and structure of the attached text.',
        };
        if (map[pragnaInitialTab]) {
          setInputPrompt(map[pragnaInitialTab]);
        }
      }

      setTimeout(() => {
        textareaRef.current?.focus();
        scrollToBottom();
      }, 100);
    }
  }, [dialogs.pragnaAi, pragnaInitialTab, pragnaInitialPrompt, editor]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  if (!dialogs.pragnaAi) return null;

  const handleSendMessage = async (customText) => {
    const promptToSend = (customText || inputPrompt).trim();
    if (!promptToSend || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg = {
      id: userMessageId,
      role: 'user',
      content: promptToSend,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputPrompt('');
    setLoading(true);

    try {
      // Build conversation history for the API
      const apiMessages = newMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const contextPayload = includeContext && selectedText
        ? selectedText.slice(0, 4000)
        : '';

      const response = await aiApi.chat({
        messages: apiMessages,
        context: contextPayload,
        webSearch: webSearchEnabled,
        model: selectedModel,
      });

      if (response && response.success) {
        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.message,
          html: markdownToHtml(response.message),
          model: response.model || selectedModel,
          latencyMs: response.latencyMs,
          sources: response.sources || [],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(response?.message || 'Pragna did not return a valid response');
      }
    } catch (err) {
      console.error('Pragna Chat Error:', err);
      const isConfigError = String(err.message || '').includes('No Ollama API keys') || String(err.message || '').includes('not configured');
      if (isConfigError) {
        toast('AI assistant not configured. Please check backend .env', 'error');
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ **AI Assistant Not Configured**\n\nPragna AI requires Ollama API keys in the backend environment. Please check your backend \`.env\` settings.`,
            html: '',
            isError: true,
            timestamp: new Date(),
          },
        ]);
      } else {
        toast('Chat error: ' + err.message, 'error');
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ **Error:** ${err.message || 'Unable to communicate with Pragna AI. Please verify network or Ollama connection.'}`,
            html: '',
            isError: true,
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInsertAtCursor = (msg) => {
    if (!editor) return;
    const htmlToInsert = msg.html || markdownToHtml(msg.content);
    editor.chain().focus().insertContent(htmlToInsert).run();
    toast('Inserted into document at cursor', 'success');
  };

  const handleReplaceSelection = (msg) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const htmlToInsert = msg.html || markdownToHtml(msg.content);
    if (from !== to) {
      editor.chain().focus().insertContentAt({ from, to }, htmlToInsert).run();
    } else {
      editor.chain().focus().insertContent(htmlToInsert).run();
    }
    toast('Replaced selection in document', 'success');
  };

  const handleCopyText = (content) => {
    navigator.clipboard?.writeText(content);
    toast('Copied response to clipboard', 'info');
  };

  const handleApplyTitle = (content) => {
    // Extract first line or clean title text
    const clean = content.replace(/^#+\s*/, '').split('\n')[0].replace(/[*_"`]/g, '').trim();
    if (clean) {
      setTitle(clean);
      toast(`Document title updated to: "${clean}"`, 'success');
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Chat history cleared. How can I help you with **${docTitle || 'your document'}**?`,
        html: '',
        timestamp: new Date(),
      },
    ]);
    toast('Pragna conversation reset', 'info');
  };

  const wordCount = selectedText ? selectedText.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <Modal title="Pragna AI — Intelligent Writing & Research Copilot" onClose={() => closeDialog('pragnaAi')} width={880}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '76vh',
          maxHeight: 740,
          minHeight: 520,
          background: 'var(--bg-app)',
          color: 'var(--text-primary)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {/* Top Copilot Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border)',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Left: Model & Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(212,175,55,0.12)',
                border: '1px solid var(--gold-border)',
                color: 'var(--gold)',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <span>✦ Pragna Copilot</span>
            </div>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 11,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Context & Web Grounding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Live Web Toggle */}
            <button
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              title="Search the live web for up-to-date facts and citations"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: webSearchEnabled ? 'var(--gold)' : 'var(--bg-elevated)',
                color: webSearchEnabled ? 'var(--text-on-gold)' : 'var(--text-secondary)',
                border: `1px solid ${webSearchEnabled ? 'var(--gold)' : 'var(--border)'}`,
                borderRadius: 4,
                padding: '4px 9px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Web Search: {webSearchEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Clear Chat */}
            <button
              onClick={handleClearChat}
              title="Start a new conversation"
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Context Awareness Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 14px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border)',
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--gold)' }}>📎</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {hasSelection
                ? `Attached Selection: ${wordCount} words`
                : `Attached Entire Document: ${wordCount} words`}
            </span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Include document in context</span>
          </label>
        </div>

        {/* Messages Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '100%',
                }}
              >
                {/* Header info */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    marginBottom: 4,
                    padding: '0 4px',
                  }}
                >
                  <span style={{ fontWeight: 600, color: isUser ? 'var(--gold)' : 'var(--text-primary)' }}>
                    {isUser ? 'You' : 'Pragna AI'}
                  </span>
                  {msg.model && <span>• {msg.model}</span>}
                  {msg.latencyMs && <span>• {(msg.latencyMs / 1000).toFixed(1)}s</span>}
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '12px 16px',
                    borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: isUser ? 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.08) 100%)' : 'var(--bg-surface)',
                    border: `1px solid ${isUser ? 'var(--gold-border)' : 'var(--border)'}`,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    lineHeight: 1.6,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    wordBreak: 'break-word',
                  }}
                >
                  {isUser ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  ) : (
                    <div
                      className="pragna-rendered-content"
                      dangerouslySetInnerHTML={{
                        __html: msg.html || markdownToHtml(msg.content),
                      }}
                      style={{
                        '& h1': { fontSize: 16, color: 'var(--gold)', margin: '8px 0 4px' },
                        '& h2': { fontSize: 15, color: 'var(--gold)', margin: '8px 0 4px' },
                        '& h3': { fontSize: 14, color: 'var(--gold)', margin: '6px 0 3px' },
                        '& p': { margin: '0 0 8px 0' },
                        '& ul': { paddingLeft: 18, margin: '4px 0 8px 0' },
                        '& ol': { paddingLeft: 18, margin: '4px 0 8px 0' },
                        '& li': { marginBottom: 3 },
                        '& pre': { background: '#0a0a0a', padding: 10, borderRadius: 4, overflowX: 'auto', border: '1px solid var(--border)' },
                        '& code': { fontFamily: 'monospace', fontSize: 12, background: 'rgba(255,255,255,0.08)', padding: '2px 4px', borderRadius: 3 },
                      }}
                    />
                  )}

                  {/* Sources citation list if available */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: '1px solid var(--border)',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--gold)', marginBottom: 4 }}>
                        🌐 Live Web Sources ({msg.sources.length}):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {msg.sources.map((s, idx) => (
                          <a
                            key={idx}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: 'var(--gold)',
                              textDecoration: 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            [{idx + 1}] {s.title} ({s.source || 'web'})
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assistant Action Buttons */}
                {!isUser && msg.id !== 'welcome' && !msg.isError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 6,
                      paddingLeft: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      onClick={() => handleInsertAtCursor(msg)}
                      style={{
                        background: 'var(--bg-elevated)',
                        color: 'var(--gold)',
                        border: '1px solid var(--gold-border)',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>Insert into Doc</span>
                    </button>

                    <button
                      onClick={() => handleReplaceSelection(msg)}
                      style={{
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <span>Replace Selection</span>
                    </button>

                    <button
                      onClick={() => handleCopyText(msg.content)}
                      style={{
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <span>Copy</span>
                    </button>

                    <button
                      onClick={() => handleApplyTitle(msg.content)}
                      style={{
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <span>Set Title</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', color: 'var(--gold)' }}>
              <span style={{ fontSize: 16 }}>✦</span>
              <span style={{ fontSize: 12, fontStyle: 'italic' }}>
                Pragna is generating with {selectedModel}...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Prompt Chips */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            padding: '8px 14px',
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border)',
            whiteSpace: 'nowrap',
          }}
        >
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={loading}
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '4px 10px',
                fontSize: 11,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.12s ease',
              }}
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Chat Input Container */}
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
          }}
        >
          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Pragna anything, or prompt to draft, summarize, edit, translate..."
            rows={2}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
              outline: 'none',
              resize: 'none',
              lineHeight: 1.4,
            }}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={loading || !inputPrompt.trim()}
            style={{
              height: 48,
              padding: '0 18px',
              background: inputPrompt.trim() && !loading ? 'var(--gold)' : 'var(--bg-elevated)',
              color: inputPrompt.trim() && !loading ? 'var(--text-on-gold)' : 'var(--text-muted)',
              border: `1px solid ${inputPrompt.trim() && !loading ? 'var(--gold-border)' : 'var(--border)'}`,
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: inputPrompt.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>Send</span>
            <span>➔</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
