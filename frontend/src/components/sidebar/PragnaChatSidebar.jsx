import { useState, useEffect, useRef } from 'react';
import { buildHistory } from '@/ai/memory';
import { listSuggestionIds } from '@/ai/suggestions';
import { Sparkles, X, FileText, AlertTriangle, ArrowUp, PenLine, CheckCheck } from 'lucide-react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { markdownToHtml } from '@/services/ai';
import { aiApi, uploadApi } from '@/services/api';
import { useDocumentAgent } from '@/ai/useDocumentAgent';
import { SuggestionReview } from './SuggestionReview';

// Empty-state skills (design). Each runs as a normal Pragna request.
const PRAGNA_SKILLS = [
  ['/check-doc', 'Check this document for errors, inconsistencies and unclear passages, and list what to fix.'],
  ['/copy-edit', 'Copy-edit the selected text, or the whole document if nothing is selected: fix grammar, spelling, punctuation and word choice without changing the meaning.'],
  ['/summarize', 'Summarize the selected text, or the whole document if nothing is selected, as a short paragraph followed by key points.'],
  ['/flag-issues', 'Flag factual, logical and tone issues in this document as comments, without rewriting it.'],
  ['/tighten', 'Tighten the selected text, or the whole document if nothing is selected: cut filler and redundancy while keeping every point.'],
  ['/outline', 'Draft an outline for this document as headings with one-line notes under each.'],
];

const skillBtn = {
  height: 34,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid rgba(var(--ink,255,255,255),0.16)',
  background: 'transparent',
  color: 'var(--t20,#e8e6e1)',
  fontSize: 13.5,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const QUICK_PROMPTS = [
  { label: 'Summarize', icon: FileText, prompt: 'Summarize the selected text, or the whole document if nothing is selected, as a short paragraph followed by key points.' },
  { label: 'Fix grammar', icon: CheckCheck, prompt: 'Fix the grammar, spelling and punctuation in the selected text, or the whole document if nothing is selected. Do not change the meaning.' },
  { label: 'Continue', icon: PenLine, prompt: 'Continue writing from the end of the document in the same style and tone, adding one or two paragraphs.' },
  { label: 'Executive Summary', prompt: 'Provide a concise, punchy executive summary of the selected text, or the whole document if nothing is selected, with key takeaways.' },
  { label: 'Professional Tone', prompt: 'Rewrite the selected text, or the whole document if nothing is selected, in an authoritative, executive, and highly polished corporate tone.' },
  { label: 'Convert to Table', prompt: 'Structure the key points and data from the selected text, or the whole document if nothing is selected, into a clean markdown data table.' },
  { label: 'Action Items', prompt: 'Extract all actionable tasks and next steps into a structured checklist.' },
  { label: 'Simplify & Clarify', prompt: 'Simplify the language, eliminate unnecessary jargon, and make the content effortless to read.' },
  { label: 'Brainstorm Ideas', prompt: 'Brainstorm creative angles and missing sections to improve this document.' },
];

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileBadge(name = '', type = '') {
  if (type === 'image' || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return 'IMG';
  if (/\.(csv|tsv|xlsx?|json)$/i.test(name)) return 'DATA';
  if (/\.(docx?|pdf|rtf)$/i.test(name)) return 'DOC';
  if (/\.(js|jsx|ts|tsx|py|html|css|json|xml|sh|sql|yml|yaml)$/i.test(name)) return 'CODE';
  return 'FILE';
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result || '');
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function extractImagesFromMessage(content = '', html = '') {
  const images = [];
  const mdRegex = /!\[(.*?)\]\((https?:\/\/[^\s)]+|\/uploads\/[^\s)]+|data:image\/[^\s)]+)\)/g;
  let match;
  while ((match = mdRegex.exec(content)) !== null) {
    images.push({ alt: match[1] || 'Image', src: match[2] });
  }
  const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = imgTagRegex.exec(html)) !== null) {
    if (!images.some((i) => i.src === match[1])) {
      const altMatch = /alt=["']([^"']*)["']/i.exec(match[0]);
      images.push({ alt: altMatch ? altMatch[1] : 'Image', src: match[1] });
    }
  }
  const uploadRegex = /(\/uploads\/[a-zA-Z0-9_\-\.]+\.(?:png|jpe?g|gif|webp|svg))/gi;
  while ((match = uploadRegex.exec(content)) !== null) {
    if (!images.some((i) => i.src === match[1])) {
      images.push({ alt: 'Image', src: match[1] });
    }
  }
  return images;
}

function preferredTone(profile) {
  if (profile?.tone && profile.tone !== 'balanced') return profile.tone;
  try {
    const style = JSON.parse(localStorage.getItem('etherx.preferences') || '{}').responseStyle;
    return { Balanced: 'balanced', Precise: 'technical', Creative: 'creative' }[style] || 'balanced';
  } catch { return 'balanced'; }
}

export function PragnaChatSidebar() {
  const { copilotOpen, toggleCopilot, pragnaInitialTab, pragnaInitialPrompt, pragnaAutoSend, toast } = useUIStore();
  const { editor } = useEditorStore();
  const { title: docTitle, aiProfile, setAiProfile } = useDocumentStore();

  const [activeSidebarTab, setActiveSidebarTab] = useState('chat'); // 'chat' | 'persona'
  const [personaTone, setPersonaTone] = useState(() => preferredTone(aiProfile));
  const [personaAudience, setPersonaAudience] = useState(aiProfile?.audience || 'general');
  const [personaResponseStyle, setPersonaResponseStyle] = useState(aiProfile?.responseStyle || 'concise');
  const [personaInstructions, setPersonaInstructions] = useState(aiProfile?.instructions || '');
  const [preferredTermsInput, setPreferredTermsInput] = useState(
    Array.isArray(aiProfile?.preferredTerms) ? aiProfile.preferredTerms.join(', ') : ''
  );
  const [forbiddenTermsInput, setForbiddenTermsInput] = useState(
    Array.isArray(aiProfile?.forbiddenTerms) ? aiProfile.forbiddenTerms.join(', ') : ''
  );

  const [aiConfigured, setAiConfigured] = useState(true);

  useEffect(() => {
    let active = true;
    aiApi.status()
      .then((res) => {
        if (!active) return;
        if (res && res.activeKeysCount === 0) {
          setAiConfigured(false);
        } else {
          setAiConfigured(true);
        }
      })
      .catch(() => {
        // keep current state if status check fails
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (aiProfile) {
      setPersonaTone(preferredTone(aiProfile));
      if (aiProfile.audience) setPersonaAudience(aiProfile.audience);
      if (aiProfile.responseStyle) setPersonaResponseStyle(aiProfile.responseStyle);
      if (aiProfile.instructions !== undefined) setPersonaInstructions(aiProfile.instructions);
      if (Array.isArray(aiProfile.preferredTerms)) setPreferredTermsInput(aiProfile.preferredTerms.join(', '));
      if (Array.isArray(aiProfile.forbiddenTerms)) setForbiddenTermsInput(aiProfile.forbiddenTerms.join(', '));
    }
  }, [aiProfile]);

  const handleSavePersona = () => {
    const pTerms = preferredTermsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const fTerms = forbiddenTermsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const next = {
      tone: personaTone,
      audience: personaAudience,
      responseStyle: personaResponseStyle,
      instructions: personaInstructions.trim(),
      preferredTerms: pTerms,
      forbiddenTerms: fTerms,
    };
    setAiProfile(next);
    toast('Persistent AI Persona saved for this document', 'success');
    setActiveSidebarTab('chat');
  };

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am **Pragna**, your document intelligence copilot.
 
 I can help you:
- **Embed Media & Files** directly into your document or analyze them
- **Draft & Generate** sections, proposals, or full articles
- **Edit & Polish** selected text with precise instructions
- **Summarize & Extract** structured tables or action items
- **Research the Live Web** with grounded citations

Ask me anything or attach files below.`,
      html: '',
      timestamp: new Date(),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  // Web search starts off: while it is on, messages go to research chat instead of
  // the document agent. The "Web access" setting only decides whether it may be on.
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const webAccessAllowed = (() => {
    try { return JSON.parse(localStorage.getItem('etherx.preferences') || '{}').web !== false; } catch { return true; }
  })();
  const [agentMode, setAgentMode] = useState(true);
  const agent = useDocumentAgent(editor);
  const [selectedText, setSelectedText] = useState('');
  const [hasSelection, setHasSelection] = useState(false);
  const [scope, setScope] = useState('document');

  // File and Image attachments state
  const [attachments, setAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrlValue, setImageUrlValue] = useState('');
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const savedRangeRef = useRef({ from: 0, to: 0, text: '' });
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Sync editor selection & range dynamically
  useEffect(() => {
    if (!editor) return;

    const updateContext = () => {
      try {
        const { from, to } = editor.state.selection;
        const fullDoc = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ').trim();

        if (from !== to) {
          const sel = editor.state.doc.textBetween(from, to, ' ').trim();
          setSelectedText(sel);
          setHasSelection(true);
          setScope('selection');
          savedRangeRef.current = { from, to, text: sel };
        } else {
          setSelectedText(fullDoc);
          setHasSelection(false);
          setScope(fullDoc ? 'document' : 'cursor');
          savedRangeRef.current = { from, to, text: '' };
        }
      } catch {
        // ignore
      }
    };

    updateContext();
    editor.on('selectionUpdate', updateContext);
    editor.on('update', updateContext);

    return () => {
      editor.off('selectionUpdate', updateContext);
      editor.off('update', updateContext);
    };
  }, [editor]);

  // Handle opening with initial prompt
  useEffect(() => {
    if (copilotOpen) {
      if (pragnaInitialPrompt) {
        setInputPrompt(pragnaInitialPrompt);
      } else if (pragnaInitialTab && pragnaInitialTab !== 'ask') {
        const map = {
          grammar: 'Proofread and correct all grammar and style issues in the attached text.',
          summarize: 'Summarize the attached text with concise bullet points.',
          generate: 'Draft a comprehensive, well-structured section for this document.',
          rewrite: 'Rewrite the selected text, or the whole document if nothing is selected, in a polished, professional tone.',
          title: 'Generate 5 compelling titles for this document.',
          edit: 'Improve the clarity, impact, and structure of the attached text.',
        };
        if (map[pragnaInitialTab]) {
          setInputPrompt(map[pragnaInitialTab]);
        }
      }
      setTimeout(() => {
        if (pragnaInitialPrompt || pragnaInitialTab !== 'ask') textareaRef.current?.focus();
        scrollToBottom();
      }, 100);
    }
  }, [copilotOpen, pragnaInitialTab, pragnaInitialPrompt]);

  // Callers such as an @Pragna comment ask for the prompt to be sent at once.
  const autoSentRef = useRef(pragnaAutoSend);
  useEffect(() => {
    if (!copilotOpen || pragnaAutoSend === autoSentRef.current || !pragnaInitialPrompt) return;
    autoSentRef.current = pragnaAutoSend;
    setActiveSidebarTab('chat');
    handleSendMessage(pragnaInitialPrompt, { forceAgent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copilotOpen, pragnaAutoSend]);

  useEffect(() => {
    if (copilotOpen) {
      scrollToBottom();
    }
  }, [messages, loading, copilotOpen, attachments]);

  // Handle inserting images directly into editor canvas
  const handleInsertImage = (src, alt = 'Image') => {
    if (!editor) {
      toast('Editor is not ready', 'error');
      return false;
    }
    if (!src) {
      toast('No image source found', 'error');
      return false;
    }
    try {
      const isDocEmpty = !editor.state.doc.textContent.trim();
      if (isDocEmpty) {
        editor.chain().focus().setContent(`<p><img src="${src}" alt="${alt || 'Image'}" width="480" /></p>`).run();
      } else {
        const ok = editor.chain().focus().setImage({ src, alt: alt || 'Image', width: '480' }).run();
        if (!ok) {
          editor.chain().focus().insertContent(`<p><img src="${src}" alt="${alt || 'Image'}" width="480" /></p>`).run();
        }
      }
      toast('Image inserted into document', 'success');
      return true;
    } catch (err) {
      console.warn('setImage warning, trying HTML insertContent fallback:', err);
      try {
        editor.chain().focus().insertContent(`<p><img src="${src}" alt="${alt || 'Image'}" width="480" /></p>`).run();
        toast('Image inserted into document', 'success');
        return true;
      } catch (err2) {
        console.error('Error inserting image:', err2);
        toast('Failed to insert image', 'error');
        return false;
      }
    }
  };

  // Handle inserting file text or docx HTML into editor canvas
  const handleInsertFile = (att) => {
    if (!editor) {
      toast('Editor is not ready', 'error');
      return;
    }
    try {
      if (att.html) {
        editor.chain().focus().insertContent(att.html).run();
      } else if (att.text) {
        editor.chain().focus().insertContent(markdownToHtml(att.text)).run();
      } else {
        toast('No insertable content found in this file', 'info');
        return;
      }
      toast(`Inserted content from ${att.name}`, 'success');
    } catch (err) {
      console.error('Error inserting file content:', err);
      toast('Failed to insert content', 'error');
    }
  };

  // Process incoming files (from input, drop, or clipboard)
  const processFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadingFiles(true);

    for (const file of files) {
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
      const isDocx = file.name.endsWith('.docx');

      if (isImg) {
        const previewUrl = URL.createObjectURL(file);
        const attObj = {
          id,
          name: file.name,
          size: file.size,
          type: 'image',
          previewUrl,
          file,
          uploadedUrl: '',
        };
        setAttachments((prev) => [...prev, attObj]);

        try {
          const res = await uploadApi.image(file);
          if (res && res.url) {
            setAttachments((prev) =>
              prev.map((a) => (a.id === id ? { ...a, uploadedUrl: res.url } : a))
            );
          }
        } catch (e) {
          console.warn('Image upload fallback to blob:', e);
        }
      } else if (isDocx) {
        let html = '';
        let text = '';
        try {
          const mammoth = (await import('mammoth')).default;
          const arrayBuffer = await file.arrayBuffer();
          const htmlRes = await mammoth.convertToHtml({ arrayBuffer });
          const textRes = await mammoth.extractRawText({ arrayBuffer });
          html = htmlRes.value || '';
          text = textRes.value || '';
        } catch (err) {
          console.warn('DOCX parse error:', err);
        }

        const attObj = {
          id,
          name: file.name,
          size: file.size,
          type: 'docx',
          html,
          text,
          file,
        };
        setAttachments((prev) => [...prev, attObj]);
      } else {
        let text = '';
        try {
          text = await readTextFile(file);
        } catch {
          text = '';
        }

        const attObj = {
          id,
          name: file.name,
          size: file.size,
          type: 'file',
          text,
          file,
        };
        setAttachments((prev) => [...prev, attObj]);
      }
    }
    setUploadingFiles(false);
  };

  // Insert image directly from web URL
  const handleInsertUrlImage = () => {
    const url = imageUrlValue.trim();
    if (!url) return;
    handleInsertImage(url, 'Image from URL');
    setImageUrlValue('');
    setShowUrlInput(false);
  };

  // Attach image from URL to pending list
  const handleAttachUrlImage = () => {
    const url = imageUrlValue.trim();
    if (!url) return;
    const id = `att-${Date.now()}`;
    const name = url.split('/').pop()?.split('?')[0] || 'web-image.png';
    setAttachments((prev) => [
      ...prev,
      {
        id,
        name,
        size: 0,
        type: 'image',
        previewUrl: url,
        uploadedUrl: url,
      },
    ]);
    setImageUrlValue('');
    setShowUrlInput(false);
    toast('Image URL attached', 'info');
  };

  const handleUndoAgentRun = (msg) => {
    const undone = agent.undoRun();
    const skipped = agent.lastRun?.recorder?.skipped || 0;
    const note = !undone
      ? 'There was nothing left to undo for that run.'
      : skipped > 0
        ? `Undid Pragna's changes, but ${skipped} could not be undone because that text was edited since.`
        : null;
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === msg.id ? { ...m, undone: true } : m));
      return note
        ? [...next, { id: `assistant-${Date.now()}`, role: 'assistant', content: note, isError: true, timestamp: new Date() }]
        : next;
    });
  };

  // forceAgent: requests that must edit the document (e.g. an @Pragna comment)
  // take the agent path even if web search or attachments are active.
  // display: what the chat shows for the user's turn (e.g. a skill name) when it differs from the prompt.
  const handleSendMessage = async (customText, { forceAgent = false, display } = {}) => {
    const rawPrompt = customText || inputPrompt || textareaRef.current?.value || '';
    const currentAttachments = [...attachments];
    const promptToSend = rawPrompt.trim();

    if ((!promptToSend && currentAttachments.length === 0) || loading) return;

    if (editor && (forceAgent || (agentMode && !currentAttachments.length && !webSearchEnabled))) {
      const userMsg = { id: `user-${Date.now()}`, role: 'user', content: promptToSend, display, timestamp: new Date() };
      const history = buildHistory(messages, new Set(listSuggestionIds(editor.state.doc)));
      setMessages((prev) => [...prev, userMsg]);
      setInputPrompt('');
      setLoading(true);
      try {
        const result = await agent.run(promptToSend, history);
        const text = result?.error
          ? `${result.error}`
          : `${result?.summary || 'Done.'}${result?.suggestions ? `\n\n_${result.suggestions} change(s) to review._` : ''}`;
        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`, role: 'assistant', content: text, html: markdownToHtml(text),
          isAgentRun: true, runId: result?.runId, canUndo: Boolean(result?.recorder?.changed), plan: result?.plan || null, changes: result?.changes || [], timestamp: new Date(),
        }]);
      } catch (err) {
        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`, role: 'assistant', content: err?.message || 'Pragna hit an unexpected error.',
          isError: true, timestamp: new Date(),
        }]);
      } finally {
        setLoading(false);
      }
      return;
    }

    const hasAttachments = currentAttachments.length > 0;
    const hasImages = currentAttachments.some((a) => a.type === 'image');

    const isInsertOnlyIntent =
      hasAttachments &&
      (!promptToSend ||
        /^\s*(add|insert|place|put|embed|paste|include)?\s*(this|the)?\s*(images?|pictures?|photos?|screenshots?|files?|it|everything|content)?\s*$/i.test(promptToSend) ||
        /\b(add images?|insert images?|insert in doc|add to doc|put in document|add this)\b/i.test(promptToSend));

    const userMessageId = `user-${Date.now()}`;
    const userMsg = {
      id: userMessageId,
      role: 'user',
      content: promptToSend || (hasImages ? 'Add attached image(s) to document' : `Attached ${currentAttachments.length} item(s)`),
      attachments: currentAttachments,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputPrompt('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.value = '';

    if (isInsertOnlyIntent) {
      let anyInserted = false;
      const insertedSummary = [];

      for (const att of currentAttachments) {
        if (att.type === 'image') {
          const imgUrl = att.uploadedUrl || att.previewUrl;
          if (imgUrl) {
            handleInsertImage(imgUrl, att.name);
            anyInserted = true;
            insertedSummary.push({ type: 'image', name: att.name, url: imgUrl });
          }
        } else if (att.html || att.text) {
          handleInsertFile(att);
          anyInserted = true;
          insertedSummary.push({ type: 'file', name: att.name });
        }
      }

      if (anyInserted) {
        const imgItems = insertedSummary.filter((i) => i.type === 'image');
        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `**Added to document.**\n\n${imgItems.map((a) => `![${a.name}](${a.url})`).join('\n\n')}\n\n*Inserted at cursor position.*`,
          html: `<p><strong>Added to document.</strong></p>${imgItems.map((a) => `<p><img src="${a.url}" alt="${a.name}" style="max-width:100%; border-radius:4px; margin:4px 0;" /></p>`).join('')}<p style="font-size:11px; color:var(--text-secondary); margin-top:4px;"><em>Inserted at current cursor position.</em></p>`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLoading(false);
        return;
      }
    }

    if (hasImages && /\b(add|insert|put|place|embed)\b/i.test(promptToSend)) {
      for (const att of currentAttachments) {
        if (att.type === 'image') {
          const imgUrl = att.uploadedUrl || att.previewUrl;
          if (imgUrl) handleInsertImage(imgUrl, att.name);
        }
      }
    }

    setLoading(true);

    try {
      let enrichedPrompt = promptToSend || 'Please review the attached item(s):';
      if (currentAttachments.length > 0) {
        enrichedPrompt += '\n\nAttached Media & Files:';
        for (const att of currentAttachments) {
          if (att.type === 'image') {
            const imgUrl = att.uploadedUrl || att.previewUrl;
            enrichedPrompt += `\n- Image: "${att.name}" (${formatBytes(att.size)})\n  Markdown embed syntax: ![${att.name}](${imgUrl})\n  URL: ${imgUrl}`;
          } else if (att.text) {
            enrichedPrompt += `\n- File "${att.name}" (${formatBytes(att.size)}) Content:\n"""\n${att.text.slice(0, 6000)}\n"""`;
          } else {
            enrichedPrompt += `\n- File: "${att.name}" (${formatBytes(att.size)})`;
          }
        }
        enrichedPrompt += '\n\nInstruction: When generating or editing document text with this image, embed it directly using: ![Description](image_url).';
      }

      const apiMessages = newMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.id === userMessageId ? enrichedPrompt : m.content,
        }));

      const fullDoc = editor ? editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ').trim() : '';
      const currentScope = hasSelection ? 'selection' : (fullDoc ? 'document' : 'cursor');

      const response = await aiApi.chat({
        messages: apiMessages,
        selectedText: hasSelection ? selectedText : '',
        documentText: fullDoc,
        scope: currentScope,
        webSearch: webSearchEnabled,
        aiProfile,
      });

      if (response && response.success) {
        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.message,
          html: markdownToHtml(response.message),
          sources: response.sources || [],
          targetRange: { ...savedRangeRef.current },
          targetScope: currentScope,
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
        setAiConfigured(false);
        toast('AI assistant not configured. Please check backend .env', 'error');
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ **AI Assistant Not Configured**\n\nPragna AI requires Ollama API keys configured in the backend environment. Please check your backend \`.env\` settings.`,
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
            content: `**Error:** ${err.message || 'Unable to communicate with Pragna AI.'}`,
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

  // Replace the saved selection range or document
  const handleReplaceInDoc = (msg) => {
    if (!editor) {
      toast('Editor is not ready', 'info');
      return;
    }

    const htmlContent = msg.html || markdownToHtml(msg.content);
    const range = msg.targetRange || savedRangeRef.current;
    const isDocEmpty = !editor.state.doc.textContent.trim();

    try {
      if (range && range.from !== range.to) {
        editor
          .chain()
          .focus()
          .deleteRange({ from: range.from, to: range.to })
          .insertContentAt(range.from, htmlContent)
          .run();
        toast('Replaced selection in document', 'success');
      } else if (isDocEmpty || msg.targetScope === 'document') {
        editor.chain().focus().setContent(htmlContent).run();
        toast(isDocEmpty ? 'Inserted into blank document' : 'Replaced document content', 'success');
      } else {
        editor.chain().focus().insertContent(htmlContent).run();
        toast('Inserted into document', 'success');
      }
    } catch (err) {
      console.error('Edit execution error:', err);
      editor.chain().focus().setContent(htmlContent).run();
      toast('Applied to document', 'success');
    }
  };

  const handleInsertAtCursor = (msg) => {
    if (!editor) return;
    const htmlContent = msg.html || markdownToHtml(msg.content);
    editor.chain().focus().insertContent(htmlContent).run();
    toast('Inserted at cursor', 'success');
  };

  const handleCopyText = (content) => {
    navigator.clipboard?.writeText(content);
    toast('Copied to clipboard', 'info');
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Chat cleared. How can I assist with your document?`,
        html: '',
        timestamp: new Date(),
      },
    ]);
    setAttachments([]);
    toast('Pragna chat reset', 'info');
  };

  const wordCount = selectedText ? selectedText.trim().split(/\s+/).filter(Boolean).length : 0;

  if (!copilotOpen) {
    return (
      <button
        onClick={toggleCopilot}
        title="Open Pragna"
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1000,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          padding: '10px 7px',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.borderColor = 'var(--gold-border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-surface)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--gold)' }}><Sparkles size={13} strokeWidth={2} /></span>
        <span style={{ writingMode: 'vertical-rl', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
          PRAGNA
        </span>
      </button>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer?.files?.length) {
          processFiles(e.dataTransfer.files);
        }
      }}
      className="pragna-sidebar-container"
      style={{
        width: 360,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--t3,#131210)',
        borderLeft: '1px solid rgba(var(--ink,255,255,255),0.07)',
        overflow: 'hidden',
        zIndex: 100,
        flexShrink: 0,
        fontFamily: 'var(--font-ui)',
        position: 'relative',
      }}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10, 10, 10, 0.92)',
            border: '2px dashed var(--gold)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--text-primary)',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--gold)' }}><Sparkles size={20} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Drop files to attach</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Images, documents, or data sheets
          </span>
        </div>
      )}

      {/* Header (design): title, collapse, close */}
      <div style={{ height: 48, flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 0 16px' }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--t18,#f1efea)', display: 'flex', alignItems: 'center', gap: 7 }}>
          Pragna
          {!aiConfigured && <span title="Not configured" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--t28,#6f6d68)' }} />}
        </span>
        <button type="button" onClick={toggleCopilot} title="Collapse" aria-label="Collapse Pragna" className="pragna-icon-btn" style={headerIconBtn}><i className="icon-chevron-down" style={{ fontSize: 15 }} /></button>
        <button type="button" onClick={toggleCopilot} title="Close" aria-label="Close Pragna" className="pragna-icon-btn" style={headerIconBtn}><i className="icon-x" style={{ fontSize: 15 }} /></button>
      </div>

      {/* Card (design): history, new chat, directives; then chat or directives; then composer */}
      <div style={{ flex: 1, minHeight: 0, margin: '0 12px 12px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(var(--ink,255,255,255),0.1)', borderRadius: 6, background: 'var(--t4,#121214)' }}>
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '10px 12px 0' }}>
        <button type="button" disabled title="Chat history (coming soon)" aria-label="Chat history" style={{ ...headerIconBtn, opacity: 0.45, cursor: 'default' }}><i className="icon-history" style={{ fontSize: 16 }} /></button>
        <button type="button" onClick={() => { handleClearChat(); setActiveSidebarTab('chat'); }} title="New chat" aria-label="New chat" className="pragna-icon-btn" style={headerIconBtn}><i className="icon-message-circle-plus" style={{ fontSize: 16 }} /></button>
        <button type="button" onClick={() => setActiveSidebarTab(activeSidebarTab === 'persona' ? 'chat' : 'persona')} title="Directives" aria-label="Directives" aria-pressed={activeSidebarTab === 'persona'} className="pragna-icon-btn" style={headerIconBtn}><i className="icon-ellipsis-vertical" style={{ fontSize: 16 }} /></button>
      </div>

      {activeSidebarTab === 'persona' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t18,#f1efea)' }}>Directives</span>
            <button type="button" onClick={handleSavePersona} className="pragna-skill-btn" style={{ height: 28, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(var(--ink,255,255,255),0.16)', background: 'transparent', color: 'var(--t20,#e8e6e1)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>Done</button>
          </div>
          {[
            ['TONE', personaTone, setPersonaTone, PERSONA_TONES],
            ['AUDIENCE', personaAudience, setPersonaAudience, PERSONA_AUDIENCES],
            ['RESPONSE STYLE', personaResponseStyle, setPersonaResponseStyle, PERSONA_STYLES],
          ].map(([label, value, setValue, options]) => (
            <div key={label} role="radiogroup" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={directiveLabel}>{label}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {options.map(([id, name]) => {
                  const on = value === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setValue(id)}
                      style={{ height: 28, padding: '0 11px', borderRadius: 14, border: `1px solid ${on ? 'rgba(212,175,55,0.45)' : 'rgba(var(--ink,255,255,255),0.08)'}`, background: on ? 'rgba(212,175,55,0.12)' : 'transparent', color: on ? 'var(--t32,#e3c378)' : 'var(--t22,#c4c2bd)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={directiveLabel}>CUSTOM INSTRUCTIONS</span>
            <textarea value={personaInstructions} onChange={(e) => setPersonaInstructions(e.target.value)} placeholder="Anything else Pragna should follow…" style={{ ...directiveField, minHeight: 96, resize: 'vertical' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={directiveLabel}>PREFERRED TERMS</span>
            <input type="text" value={preferredTermsInput} onChange={(e) => setPreferredTermsInput(e.target.value)} placeholder="Comma-separated, e.g. EtherX, stakeholders" style={directiveField} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={directiveLabel}>FORBIDDEN TERMS</span>
            <input type="text" value={forbiddenTermsInput} onChange={(e) => setForbiddenTermsInput(e.target.value)} placeholder="Comma-separated, e.g. synergy, utilize" style={directiveField} />
          </label>
        </div>
      ) : (
        <>
          {/* Messages Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {!messages.some((m) => m.id !== 'welcome') && !loading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '24px 0', transform: 'translateY(8px)' }}>
            <div style={{ fontSize: 15, color: 'var(--t20,#e8e6e1)', marginBottom: 4 }}>Get started with these skills:</div>
            {PRAGNA_SKILLS.map(([name, prompt]) => (
              <button key={name} type="button" className="pragna-skill-btn" onClick={() => handleSendMessage(prompt, { forceAgent: true, display: name })} style={skillBtn}>{name}</button>
            ))}
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 12.5, color: 'var(--t25,#8b8984)' }}>
              <a href="#directives" onClick={(e) => { e.preventDefault(); setActiveSidebarTab('persona'); }} style={{ color: 'var(--t22,#c4c2bd)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Create and manage skills</a>
              <span>in your Pragna directives</span>
            </div>
          </div>
        )}
        {messages.filter((m) => m.id !== 'welcome').map((msg) => {
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
              {!isUser && (
                <span aria-hidden="true" style={{ ...pragnaOrb, width: 22, height: 22, marginBottom: 6 }}><Sparkles size={11} /></span>
              )}

              {/* Message Bubble */}
              <div
                style={{
                  maxWidth: isUser ? '84%' : '100%',
                  padding: isUser ? '10px 13px' : msg.isError ? '8px 11px' : 0,
                  borderRadius: isUser ? '14px 14px 4px 14px' : 10,
                  background: isUser ? '#1a1a1d' : msg.isError ? 'rgba(214,178,94,0.08)' : 'transparent',
                  border: msg.isError ? '1px solid rgba(214,178,94,0.3)' : 'none',
                  color: isUser ? 'var(--text-primary)' : '#e8e6e1',
                  fontSize: 13.5,
                  lineHeight: isUser ? 1.5 : 1.6,
                  wordBreak: 'break-word',
                }}
              >
                {/* Text Content */}
                {isUser ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.display || msg.content}</div>
                ) : (
                  <div
                    className="pragna-sidebar-rendered"
                    dangerouslySetInnerHTML={{
                      __html: msg.html || markdownToHtml(msg.content),
                    }}
                    style={{
                      '& p': { margin: '0 0 6px 0' },
                      '& h1, & h2, & h3': { fontSize: 12, color: 'var(--gold)', margin: '6px 0 3px', fontWeight: 600 },
                      '& ul, & ol': { paddingLeft: 16, margin: '4px 0 6px 0' },
                      '& li': { marginBottom: 3 },
                      '& pre': { background: '#0a0a0a', padding: 8, borderRadius: 4, overflowX: 'auto', border: '1px solid var(--border)' },
                      '& code': { fontFamily: 'var(--font-mono)', fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 3 },
                    }}
                  />
                )}

                {/* Render Attachments in User Message */}
                {isUser && msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: msg.content ? 8 : 0 }}>
                    {msg.attachments.map((att) => {
                      const isImg = att.type === 'image';
                      return (
                        <div
                          key={att.id}
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            padding: 6,
                          }}
                        >
                          {isImg ? (
                            <div>
                              <img
                                src={att.uploadedUrl || att.previewUrl}
                                alt={att.name}
                                onError={(e) => {
                                  if (att.previewUrl && e.target.src !== att.previewUrl) {
                                    e.target.src = att.previewUrl;
                                  }
                                }}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: 140,
                                  objectFit: 'contain',
                                  borderRadius: 4,
                                  display: 'block',
                                  marginBottom: 6,
                                }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                                  {att.name}
                                </span>
                                <button
                                  onClick={() => handleInsertImage(att.uploadedUrl || att.previewUrl, att.name)}
                                  title="Insert image into document"
                                  style={{
                                    background: 'var(--gold)',
                                    color: 'var(--text-on-gold)',
                                    border: 'none',
                                    borderRadius: 3,
                                    padding: '2px 7px',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Insert in Doc
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 2, background: 'var(--bg-elevated)', color: 'var(--gold)' }}>
                                  {getFileBadge(att.name, att.type)}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                  {att.name}
                                </span>
                              </div>
                              <button
                                onClick={() => handleInsertFile(att)}
                                title="Insert content from this file into document"
                                style={{
                                  background: 'var(--gold)',
                                  color: 'var(--text-on-gold)',
                                  border: 'none',
                                  borderRadius: 3,
                                  padding: '2px 7px',
                                  fontSize: 10,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Insert Content
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Detect Images in Assistant Message */}
                {!isUser && (() => {
                  const detectedImgs = extractImagesFromMessage(msg.content, msg.html);
                  if (!detectedImgs.length) return null;
                  return (
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
                        Images in response:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {detectedImgs.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => handleInsertImage(img.src, img.alt)}
                            title={`Insert "${img.alt}" directly into document`}
                            style={{
                              background: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--gold-border)',
                              borderRadius: 4,
                              padding: '3px 8px',
                              fontSize: 10,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            Insert Image {detectedImgs.length > 1 ? `#${i + 1}` : 'in Doc'}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 10 }}>
                    <div style={{ fontWeight: 600, color: 'var(--gold)', marginBottom: 3 }}>Sources:</div>
                    {msg.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'block', color: 'var(--gold)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}
                      >
                        [{idx + 1}] {s.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {!isUser && msg.id !== 'welcome' && !msg.isError && !msg.isAgentRun && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, paddingLeft: 2 }}>
                  <button
                    onClick={() => handleReplaceInDoc(msg)}
                    title="Replace in document"
                    style={{
                      background: 'rgba(212, 175, 55, 0.15)',
                      color: 'var(--gold)',
                      border: '1px solid rgba(212, 175, 55, 0.35)',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--text-on-gold)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(212, 175, 55, 0.15)'; e.currentTarget.style.color = 'var(--gold)'; }}
                  >
                    <span>⇄</span> Replace
                  </button>

                  <button
                    onClick={() => handleInsertAtCursor(msg)}
                    title="Insert at current cursor"
                    style={{
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <span>+</span> Insert
                  </button>

                  <button
                    onClick={() => handleCopyText(msg.content)}
                    title="Copy to clipboard"
                    style={{
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 10,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    Copy
                  </button>
                </div>
              )}
              {msg.plan && <PlanChecklist plan={msg.plan} />}
              {msg.isAgentRun && msg.canUndo && !msg.undone && !agent.running && msg.runId === agent.lastRunId && (
                <button type="button" onClick={() => handleUndoAgentRun(msg)} style={{ marginTop: 4, fontSize: 11, background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', padding: '2px 8px', cursor: 'pointer' }}>
                  Undo Pragna's changes
                </button>
              )}
            </div>
          );
        })}

        {agent.running && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ ...pragnaOrb, width: 22, height: 22 }}><i className="icon-sparkles" style={{ fontSize: 11 }} /></span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agent.plan && <PlanChecklist plan={agent.plan} />}
              <span role="status" style={{ fontSize: 13, color: 'var(--t25,#8b8984)', fontStyle: 'italic' }}>
                {agent.steps.at(-1)?.label || 'Pragna is writing…'}
              </span>
              <button type="button" onClick={agent.stop} style={{ alignSelf: 'flex-start', height: 26, padding: '0 10px', borderRadius: 7, border: '1px solid rgba(var(--ink,255,255,255),0.12)', background: 'transparent', color: 'var(--t22,#c4c2bd)', fontSize: 12, cursor: 'pointer' }}>Stop</button>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', color: 'var(--gold)', fontSize: 11 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}><Sparkles size={12} strokeWidth={2} /></span>
            <span>Pragna is generating...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <SuggestionReview editor={editor} />


      {/* AI Not Configured Alert */}
      {!aiConfigured && (
        <div
          style={{
            margin: '0 12px 6px',
            padding: '6px 10px',
            background: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            borderRadius: 6,
            color: 'var(--gold)',
            fontSize: 10.5,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertTriangle size={14} />
          <span><strong>AI assistant not configured.</strong> Check backend .env</span>
        </div>
      )}

      {/* Unified Modern Input Card */}
      <div
        style={{
          padding: '8px 10px 10px',
          background: 'transparent',
          flexShrink: 0,
        }}
      >
        <div
          className="reference-pragna-composer"
          style={{
            position: 'relative',
            background: 'var(--t11)',
            border: '1px solid rgba(var(--ink),0.12)',
            borderRadius: 16,
            padding: '14px 10px 8px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'border-color 0.15s ease',
          }}
          onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
          onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'rgba(var(--ink),0.12)'; }}
        >
          {hasSelection && (
            <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--gold-hover)', background: 'rgba(212,175,55,0.1)', borderRadius: 999, padding: '2px 8px' }}>
              <FileText size={11} />Selection · {wordCount} word{wordCount === 1 ? '' : 's'}
            </span>
          )}
          {/* Pending Attachments inside Input Card */}
          {attachments.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 6,
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
              }}
            >
              {attachments.map((att) => {
                const isImg = att.type === 'image';
                return (
                  <div
                    key={att.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '3px 6px',
                      fontSize: 10,
                      flexShrink: 0,
                      maxWidth: 220,
                    }}
                  >
                    {isImg ? (
                      <img
                        src={att.previewUrl}
                        alt={att.name}
                        style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 3, border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 4px', borderRadius: 2, background: 'var(--bg-elevated)', color: 'var(--gold)' }}>
                        {getFileBadge(att.name, att.type)}
                      </span>
                    )}

                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 100 }}>
                      {att.name}
                    </span>

                    <button
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      title="Remove attachment"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '1px 3px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        lineHeight: 1,
                      }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Web URL Input Bar inside Card */}
          {showUrlInput && (
            <div
              style={{
                padding: '3px 0 6px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: 5,
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                value={imageUrlValue}
                onChange={(e) => setImageUrlValue(e.target.value)}
                placeholder="https://example.com/image.png"
                autoFocus
                style={{
                  flex: 1,
                  padding: '4px 7px',
                  fontSize: 11,
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInsertUrlImage();
                  }
                }}
              />
              <button
                onClick={handleInsertUrlImage}
                disabled={!imageUrlValue.trim()}
                title="Insert image directly into document"
                style={{
                  background: 'var(--gold)',
                  color: 'var(--text-on-gold)',
                  border: 'none',
                  borderRadius: 3,
                  padding: '3px 7px',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: imageUrlValue.trim() ? 'pointer' : 'not-allowed',
                  opacity: imageUrlValue.trim() ? 1 : 0.6,
                }}
              >
                Insert
              </button>
              <button
                onClick={handleAttachUrlImage}
                disabled={!imageUrlValue.trim()}
                title="Attach image to chat prompt"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  padding: '3px 7px',
                  fontSize: 10,
                  cursor: imageUrlValue.trim() ? 'pointer' : 'not-allowed',
                  opacity: imageUrlValue.trim() ? 1 : 0.6,
                }}
              >
                Attach
              </button>
              <button
                onClick={() => {
                  setShowUrlInput(false);
                  setImageUrlValue('');
                }}
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              if (e.clipboardData?.files?.length) {
                processFiles(e.clipboardData.files);
              }
            }}
            disabled={loading || !aiConfigured}
            aria-label="Ask Pragna"
            placeholder={!aiConfigured ? 'Pragna is unavailable. Try again later.' : 'Ask Pragna for help, or / for skills'}
            rows={1}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontFamily: 'var(--font-ui)',
              lineHeight: 1.5,
              resize: 'none',
              padding: 0,
              opacity: !aiConfigured ? 0.6 : 1,
              cursor: !aiConfigured ? 'not-allowed' : 'text',
            }}
          />

          {/* Bottom Action Bar inside Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 0,
              marginLeft: -6,
            }}
          >
            {/* Left Attachment Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.markdown,.json,.csv,.docx,.pdf,.js,.jsx,.ts,.tsx,.py,.html,.css,.xml,.yml,.yaml,.rtf,.log"
                style={{ display: 'none' }}
                onChange={(e) => {
                  processFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  processFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              <button type="button" aria-label="Attach files" title="Attach files" onClick={() => setAttachmentMenu((open) => !open)} className="reference-composer-icon"><i className="icon-plus" /></button>
              <button type="button" aria-label="Toggle document editing" aria-pressed={agentMode} title={agentMode ? 'Edit document with Pragna' : 'Chat without editing'} onClick={() => setAgentMode((on) => !on)} className="reference-composer-icon"><i className="icon-hand" /></button>
              {attachmentMenu && <div className="reference-attachment-menu" role="menu">
                <button role="menuitem" onClick={() => { fileInputRef.current?.click(); setAttachmentMenu(false); }}>Attach file</button>
                <button role="menuitem" onClick={() => { imageInputRef.current?.click(); setAttachmentMenu(false); }}>Add image</button>
                <button role="menuitem" onClick={() => { setShowUrlInput(true); setAttachmentMenu(false); }}>Image from URL</button>
              </div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              {webAccessAllowed && <button type="button" aria-label="Web search" aria-pressed={webSearchEnabled} title={webSearchEnabled ? 'Web search on' : 'Web search off'} onClick={() => setWebSearchEnabled((on) => !on)} className="reference-composer-icon" style={{ color: webSearchEnabled ? 'var(--t31)' : 'var(--t25)' }}><i className="icon-globe" /></button>}
              <button type="button" onClick={() => setActiveSidebarTab('persona')} title="Tone and directives" style={{ display: 'flex', gap: 4, alignItems: 'center', border: 0, background: 'transparent', color: 'var(--t21)', cursor: 'pointer', fontSize: 12.5 }}><span style={{ textTransform: 'capitalize' }}>{personaTone}</span><i className="icon-chevron-down" style={{ fontSize: 10 }} /></button>
              {inputPrompt.trim() || attachments.length ? <button type="button" aria-label="Send message" title="Send message (Enter)" onClick={() => handleSendMessage()} disabled={loading || !aiConfigured} className="reference-composer-send"><ArrowUp size={15} /></button> : <button type="button" aria-label="Voice input" title={listening ? 'Listening…' : 'Voice input'} className="reference-composer-icon" onClick={() => {
                const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!Recognition) return toast('Voice input is unavailable in this browser', 'info');
                const recognition = new Recognition(); recognition.lang = 'en-US';
                recognition.onresult = (event) => setInputPrompt((text) => `${text}${text ? ' ' : ''}${event.results[0][0].transcript}`);
                recognition.onend = () => setListening(false);
                recognition.onerror = () => { setListening(false); toast('Voice input could not start. Check microphone permissions.', 'warning'); };
                try { recognition.start(); setListening(true); } catch { setListening(false); }
              }}><i className="icon-mic" style={{ color: listening ? 'var(--t31)' : 'inherit' }} /></button>}
            </div>
          </div>
        </div>
      </div>
      </>
      )}
      </div>
    </div>
  );
}

const GOLD_GRADIENT = 'linear-gradient(135deg,#e5c76b 0%,#d4af37 50%,#b8860b 100%)';

const PERSONA_TONES = [
  ['balanced', 'Balanced'], ['professional', 'Professional'], ['academic', 'Academic'], ['executive', 'Executive'],
  ['conversational', 'Friendly'], ['technical', 'Technical'], ['persuasive', 'Persuasive'], ['creative', 'Creative'],
];
const PERSONA_AUDIENCES = [
  ['general', 'General'], ['executive', 'Executives'], ['technical', 'Technical'], ['legal', 'Legal'], ['academic', 'Academic'], ['students', 'Students'],
];
const PERSONA_STYLES = [['concise', 'Concise'], ['balanced', 'Balanced'], ['detailed', 'Detailed']];

const directiveLabel = { fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--t27,#7d7b76)' };
const directiveField = {
  padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(var(--ink,255,255,255),0.07)', background: 'var(--t8,#17171a)',
  color: 'var(--t18,#f1efea)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, outline: 'none', boxSizing: 'border-box', width: '100%',
};

const PLAN_ICON = { done: 'circle-check', active: 'loader', pending: 'circle' };

// A run's plan as a checklist (update_plan).
function PlanChecklist({ plan }) {
  return (
    <ol aria-label="Plan" style={{ listStyle: 'none', margin: '6px 0 0', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--ink,255,255,255),0.08)', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {plan.map((step, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.4, color: step.status === 'pending' ? 'var(--t25,#8b8984)' : 'var(--t20,#e8e6e1)' }}>
          <i className={`icon-${PLAN_ICON[step.status] || 'circle'}`} aria-label={step.status} style={{ fontSize: 13, marginTop: 1, color: step.status === 'pending' ? 'var(--t28,#6f6d68)' : 'var(--t31,#d6b25e)' }} />
          <span style={{ textDecoration: step.status === 'done' ? 'line-through' : 'none', textDecorationColor: 'rgba(var(--ink,255,255,255),0.3)' }}>{step.text}</span>
        </li>
      ))}
    </ol>
  );
}

const pragnaOrb = {
  flex: 'none',
  borderRadius: '50%',
  background: GOLD_GRADIENT,
  boxShadow: '0 0 24px rgba(212,175,55,0.3)',
  display: 'grid',
  placeItems: 'center',
  color: '#1a1405',
};

const headerIconBtn = {
  width: 30,
  height: 30,
  border: 0,
  background: 'transparent',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--t23,#a19f99)',
  display: 'grid',
  placeItems: 'center',
};

const capCard = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 10,
  borderRadius: 11,
  border: '1px solid rgba(255,255,255,0.07)',
  background: 'var(--bg-elevated)',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'var(--font-ui)',
};

const chipBtn = {
  height: 28,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontFamily: 'var(--font-ui)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
};

const pillBtn = {
  height: 24,
  padding: '0 8px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: 11.5,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const pillOn = {
  borderColor: 'rgba(214,178,94,0.45)',
  background: 'rgba(212,175,55,0.12)',
  color: 'var(--gold-hover)',
};

function iconHoverOn(e) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text-primary)'; }
function iconHoverOff(e) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }
