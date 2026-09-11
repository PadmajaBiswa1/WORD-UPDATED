import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Sliders, Globe, Trash2, X, FileText, Settings,
  AlertTriangle, Paperclip, Image as ImageIcon, Link as LinkIcon, ArrowUp
} from 'lucide-react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { markdownToHtml } from '@/services/ai';
import { aiApi, uploadApi } from '@/services/api';

const QUICK_PROMPTS = [
  { label: 'Executive Summary', prompt: 'Provide a concise, punchy executive summary of the attached text with key takeaways.' },
  { label: 'Professional Tone', prompt: 'Rewrite the attached text in an authoritative, executive, and highly polished corporate tone.' },
  { label: 'Fix Grammar & Flow', prompt: 'Proofread and correct all grammar, punctuation, and phrasing issues while improving sentence flow.' },
  { label: 'Convert to Table', prompt: 'Structure the key points and data from the attached text into a clean markdown data table.' },
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

export function PragnaChatSidebar() {
  const { copilotOpen, toggleCopilot, pragnaInitialTab, pragnaInitialPrompt, toast } = useUIStore();
  const { editor } = useEditorStore();
  const { title: docTitle, aiProfile, setAiProfile } = useDocumentStore();

  const [activeSidebarTab, setActiveSidebarTab] = useState('chat'); // 'chat' | 'persona'
  const [personaTone, setPersonaTone] = useState(aiProfile?.tone || 'professional');
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
      if (aiProfile.tone) setPersonaTone(aiProfile.tone);
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
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [hasSelection, setHasSelection] = useState(false);
  const [scope, setScope] = useState('document');

  // File and Image attachments state
  const [attachments, setAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrlValue, setImageUrlValue] = useState('');
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
          rewrite: 'Rewrite the attached text in a polished, professional tone.',
          title: 'Generate 5 compelling titles for this document.',
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
  }, [copilotOpen, pragnaInitialTab, pragnaInitialPrompt]);

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

  const handleSendMessage = async (customText) => {
    const rawPrompt = customText || inputPrompt || textareaRef.current?.value || '';
    const currentAttachments = [...attachments];
    const promptToSend = rawPrompt.trim();

    if ((!promptToSend && currentAttachments.length === 0) || loading) return;

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
        width: 380,
        minWidth: 340,
        maxWidth: 440,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
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

      {/* Modern Compact Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          height: 44,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        {/* Brand & Tab Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: 'linear-gradient(135deg, rgba(212,175,55,0.25) 0%, rgba(212,175,55,0.06) 100%)',
                border: '1px solid rgba(212,175,55,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold)',
                fontSize: 12,
                fontWeight: 700,
                boxShadow: '0 1px 4px rgba(212,175,55,0.12)',
              }}
            >
              <Sparkles size={12} strokeWidth={2} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em', lineHeight: 1.1 }}>
                Pragna
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1 }}>
                AI Copilot
              </span>
            </div>
          </div>

          {/* Segmented Control: Chat vs Directives */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-elevated)',
              borderRadius: 5,
              padding: 2,
              border: '1px solid var(--border)',
            }}
          >
            <button
              onClick={() => setActiveSidebarTab('chat')}
              style={{
                background: activeSidebarTab === 'chat' ? 'var(--gold)' : 'transparent',
                color: activeSidebarTab === 'chat' ? 'var(--text-on-gold)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 3,
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveSidebarTab('persona')}
              style={{
                background: activeSidebarTab === 'persona' ? 'var(--gold)' : 'transparent',
                color: activeSidebarTab === 'persona' ? 'var(--text-on-gold)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 3,
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                transition: 'all 0.12s ease',
              }}
            >
              <Sliders size={11} strokeWidth={1.75} /> Directives
            </button>
          </div>
        </div>

        {/* Header Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Web Search Toggle */}
          <button
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            title={`Web Grounding: ${webSearchEnabled ? 'Enabled (searches web)' : 'Disabled'}`}
            style={{
              background: webSearchEnabled ? 'rgba(212, 175, 55, 0.15)' : 'var(--bg-elevated)',
              color: webSearchEnabled ? 'var(--gold)' : 'var(--text-secondary)',
              border: `1px solid ${webSearchEnabled ? 'rgba(212, 175, 55, 0.45)' : 'var(--border)'}`,
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.12s ease',
            }}
          >
            <Globe size={11} strokeWidth={1.75} />
            <span>Web</span>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: webSearchEnabled ? 'var(--gold)' : 'var(--text-muted)',
                display: 'inline-block',
              }}
            />
          </button>

          {/* Clear History */}
          <button
            onClick={handleClearChat}
            title="Clear Chat Conversation"
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>

          {/* Close Panel */}
          <button
            onClick={toggleCopilot}
            title="Close Pragna Copilot"
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              width: 26,
              height: 26,
              fontSize: 13,
              cursor: 'pointer',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Slim Context & Directives Status Strip (Single 27px row) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3px 12px',
          background: 'var(--bg-app)',
          borderBottom: '1px solid var(--border)',
          fontSize: 10,
          minHeight: 27,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: hasSelection ? 'rgba(212, 175, 55, 0.12)' : 'var(--bg-elevated)',
              border: `1px solid ${hasSelection ? 'rgba(212, 175, 55, 0.35)' : 'var(--border)'}`,
              color: hasSelection ? 'var(--gold)' : 'var(--text-secondary)',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 9.5,
              fontWeight: 500,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              {hasSelection ? <Sparkles size={9} /> : <FileText size={9} />}
            </span>
            <span>{hasSelection ? `Selection (${wordCount}w)` : `Document (${wordCount}w)`}</span>
          </span>
        </div>

        <button
          onClick={() => setActiveSidebarTab(activeSidebarTab === 'persona' ? 'chat' : 'persona')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            padding: '2px 4px',
            borderRadius: 3,
            transition: 'color 0.12s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          title="Configure Persona Directives"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Sliders size={10} /> {personaTone}
          </span>
          <Settings size={10} style={{ opacity: 0.7 }} />
        </button>
      </div>

      {activeSidebarTab === 'persona' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={14} /> Document AI Persona & Directives
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Configure persistent tone, audience, instructions, and vocabulary enforced by Pragna for this document.
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Tone of Voice
            </label>
            <select
              value={personaTone}
              onChange={(e) => setPersonaTone(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
              }}
            >
              <option value="professional">Professional & Authoritative</option>
              <option value="academic">Academic & Scholarly</option>
              <option value="executive">Executive & C-Suite</option>
              <option value="conversational">Conversational & Friendly</option>
              <option value="technical">Technical & Precise</option>
              <option value="persuasive">Persuasive & Compelling</option>
              <option value="creative">Creative & Expressive</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Target Audience
            </label>
            <select
              value={personaAudience}
              onChange={(e) => setPersonaAudience(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
              }}
            >
              <option value="general">General Audience</option>
              <option value="executive">Executive Leadership / Board</option>
              <option value="technical">Technical Specialists & Engineers</option>
              <option value="legal">Legal & Compliance Officers</option>
              <option value="academic">Academic Peer Reviewers</option>
              <option value="students">Students & General Learners</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Response Style
            </label>
            <select
              value={personaResponseStyle}
              onChange={(e) => setPersonaResponseStyle(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
              }}
            >
              <option value="concise">Concise & Direct</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">In-depth & Comprehensive</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Custom Instructions & Directives
            </label>
            <textarea
              value={personaInstructions}
              onChange={(e) => setPersonaInstructions(e.target.value)}
              placeholder="e.g. Always structure findings with clear metrics. Adopt the perspective of a seasoned management consultant."
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '8px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                resize: 'vertical',
                lineHeight: 1.4,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Preferred Terminology (comma-separated)
            </label>
            <input
              type="text"
              value={preferredTermsInput}
              onChange={(e) => setPreferredTermsInput(e.target.value)}
              placeholder="e.g. EtherX, cloud infrastructure, stakeholders"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Preferred terms Pragna must use.</span>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Forbidden Terminology (comma-separated)
            </label>
            <input
              type="text"
              value={forbiddenTermsInput}
              onChange={(e) => setForbiddenTermsInput(e.target.value)}
              placeholder="e.g. synergy, paradigm shift, utilizes"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Forbidden terms Pragna must never use.</span>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <button
              onClick={() => setActiveSidebarTab('chat')}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePersona}
              style={{
                background: 'var(--gold)',
                border: '1px solid var(--gold-border)',
                color: 'var(--text-on-gold)',
                padding: '6px 14px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Save Persona
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Messages Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
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
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  marginBottom: 3,
                  padding: '0 2px',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                {isUser ? 'You' : 'Pragna'}
              </div>

              {/* Message Bubble */}
              <div
                style={{
                  maxWidth: '92%',
                  padding: '9px 12px',
                  borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: isUser ? 'rgba(212, 175, 55, 0.12)' : 'var(--bg-elevated)',
                  border: `1px solid ${isUser ? 'rgba(212, 175, 55, 0.35)' : 'var(--border)'}`,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                  boxShadow: isUser ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                {/* Text Content */}
                {isUser ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
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
              {!isUser && msg.id !== 'welcome' && !msg.isError && (
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
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', color: 'var(--gold)', fontSize: 11 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}><Sparkles size={12} strokeWidth={2} /></span>
            <span>Pragna is generating...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips (Clean Pill Scroll) */}
      <div
        style={{
          display: 'flex',
          gap: 5,
          overflowX: 'auto',
          padding: '6px 12px',
          background: 'transparent',
          borderTop: '1px solid var(--border)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
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
              borderRadius: 12,
              padding: '3px 9px',
              fontSize: 10.5,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.12s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = 'rgba(212,175,55,0.45)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {qp.label}
          </button>
        ))}
      </div>

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
          padding: '6px 12px 12px',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 10px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'border-color 0.15s ease',
          }}
          onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
          onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
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
            placeholder={!aiConfigured ? "AI assistant not configured. Please check backend .env..." : "Ask Pragna to draft, edit, summarize, or attach files..."}
            rows={2}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 11.5,
              fontFamily: 'var(--font-ui)',
              lineHeight: 1.45,
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
              paddingTop: 3,
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

              {/* Attach File Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach document or data file (.docx, .pdf, .txt, .csv...)"
                style={{
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 6px',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Paperclip size={13} strokeWidth={1.75} />
                <span style={{ fontSize: 10 }}>File</span>
              </button>

              {/* Add Image Button */}
              <button
                onClick={() => imageInputRef.current?.click()}
                title="Upload and insert image"
                style={{
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 6px',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <ImageIcon size={13} strokeWidth={1.75} />
                <span style={{ fontSize: 10 }}>Image</span>
              </button>

              {/* Image by URL */}
              <button
                onClick={() => setShowUrlInput(!showUrlInput)}
                title="Insert image from web URL"
                style={{
                  background: showUrlInput ? 'rgba(212,175,55,0.15)' : 'transparent',
                  color: showUrlInput ? 'var(--gold)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 6px',
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  transition: 'all 0.12s ease',
                }}
              >
                <LinkIcon size={13} strokeWidth={1.75} />
              </button>
            </div>

            {/* Right Send Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {uploadingFiles && (
                <span style={{ fontSize: 9.5, color: 'var(--gold)' }}>Uploading...</span>
              )}
              <button
                onClick={() => handleSendMessage()}
                disabled={loading || !aiConfigured || (!inputPrompt.trim() && attachments.length === 0)}
                title={!aiConfigured ? "AI assistant not configured" : "Send message (Enter)"}
                style={{
                  width: 26,
                  height: 26,
                  background: (!loading && aiConfigured && (inputPrompt.trim() || attachments.length > 0)) ? 'var(--gold)' : 'var(--bg-surface)',
                  color: (!loading && aiConfigured && (inputPrompt.trim() || attachments.length > 0)) ? 'var(--text-on-gold)' : 'var(--text-muted)',
                  border: `1px solid ${(!loading && aiConfigured && (inputPrompt.trim() || attachments.length > 0)) ? 'var(--gold-border)' : 'var(--border)'}`,
                  borderRadius: 5,
                  cursor: (!loading && aiConfigured && (inputPrompt.trim() || attachments.length > 0)) ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: (!loading && aiConfigured && (inputPrompt.trim() || attachments.length > 0)) ? '0 1px 4px rgba(212,175,55,0.3)' : 'none',
                }}
              >
                <ArrowUp size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
