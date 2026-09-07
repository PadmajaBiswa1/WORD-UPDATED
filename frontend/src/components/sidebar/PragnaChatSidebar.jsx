import { useState, useEffect, useRef } from 'react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { markdownToHtml } from '@/services/ai';
import { aiApi, uploadApi } from '@/services/api';

const QUICK_PROMPTS = [
  { label: 'Executive Summary', prompt: 'Provide a concise, punchy executive summary of the attached text with key takeaways.' },
  { label: 'Professional & Formal', prompt: 'Rewrite the attached text in an authoritative, executive, and highly polished corporate tone.' },
  { label: 'Polish Grammar & Flow', prompt: 'Proofread and correct all grammar, punctuation, and phrasing issues while improving sentence flow.' },
  { label: 'Convert to Table', prompt: 'Structure the key points and data from the attached text into a clean markdown data table.' },
  { label: 'Action Items & Checklist', prompt: 'Extract all actionable tasks and next steps into a structured checklist.' },
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

function getFileIcon(name = '', type = '') {
  if (type === 'image' || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return '🖼️';
  if (/\.(csv|tsv|xlsx?|json)$/i.test(name)) return '📊';
  if (/\.(docx?|pdf|rtf)$/i.test(name)) return '📄';
  if (/\.(js|jsx|ts|tsx|py|html|css|json|xml|sh|sql|yml|yaml)$/i.test(name)) return '📝';
  return '📎';
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
  const { title: docTitle } = useDocumentStore();

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am **Pragna**, your AI writing copilot.

I can help you:
- **Add Images & Files** directly into your document or analyze them in chat
- **Draft & Generate** content, proposals, or entire articles
- **Edit & Polish** selected text with custom instructions
- **Summarize & Extract** key findings, tables, or action items
- **Research the Live Web** with verifiable citations

Attach files/images below or ask me anything!`,
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
      toast('✓ Image inserted into document', 'success');
      return true;
    } catch (err) {
      console.warn('setImage warning, trying HTML insertContent fallback:', err);
      try {
        editor.chain().focus().insertContent(`<p><img src="${src}" alt="${alt || 'Image'}" width="480" /></p>`).run();
        toast('✓ Image inserted into document', 'success');
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
      toast(`✓ Inserted content from ${att.name}`, 'success');
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

        // Attempt server upload for permanent URL
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

    // Check if the user's intent is to insert the attached images/files into the document
    const isInsertOnlyIntent =
      hasAttachments &&
      (!promptToSend ||
        /^\s*(add|insert|place|put|embed|paste|include)?\s*(this|the)?\s*(images?|pictures?|photos?|screenshots?|files?|it|everything|content)?\s*$/i.test(promptToSend) ||
        /\b(add images?|insert images?|insert in doc|add to doc|put in document|add this)\b/i.test(promptToSend));

    const userMessageId = `user-${Date.now()}`;
    const userMsg = {
      id: userMessageId,
      role: 'user',
      content: promptToSend || (hasImages ? 'Add attached image(s) to document' : `[Attached ${currentAttachments.length} file(s)]`),
      attachments: currentAttachments,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputPrompt('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.value = '';

    // If intent is purely to add/insert into the document, execute immediately with zero latency
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
          content: `✓ **Added directly to your document!**\n\n${imgItems.map((a) => `![${a.name}](${a.url})`).join('\n\n')}\n\n*Inserted at your current cursor position.*`,
          html: `<p><strong>✓ Added directly to your document!</strong></p>${imgItems.map((a) => `<p><img src="${a.url}" alt="${a.name}" style="max-width:100%; border-radius:4px; margin:4px 0;" /></p>`).join('')}<p style="font-size:11px; color:var(--text-secondary); margin-top:4px;"><em>Inserted at your current cursor position in the document.</em></p>`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLoading(false);
        return;
      }
    }

    // If user prompt mentions adding/inserting alongside other instructions, insert the images now as well
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
      toast('Chat error: ' + err.message, 'error');
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Error:** ${err.message || 'Unable to communicate with Pragna AI.'}`,
          html: '',
          isError: true,
          timestamp: new Date(),
        },
      ]);
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
        toast('✓ Replaced selection in document', 'success');
      } else if (isDocEmpty || msg.targetScope === 'document') {
        editor.chain().focus().setContent(htmlContent).run();
        toast(isDocEmpty ? '✓ Inserted into blank document' : '✓ Replaced document content', 'success');
      } else {
        editor.chain().focus().insertContent(htmlContent).run();
        toast('✓ Inserted into document', 'success');
      }
    } catch (err) {
      console.error('Edit execution error:', err);
      editor.chain().focus().setContent(htmlContent).run();
      toast('✓ Applied to document', 'success');
    }
  };

  const handleInsertAtCursor = (msg) => {
    if (!editor) return;
    const htmlContent = msg.html || markdownToHtml(msg.content);
    editor.chain().focus().insertContent(htmlContent).run();
    toast('✓ Inserted at cursor', 'success');
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
        title="Open Pragna Copilot"
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1000,
          background: 'var(--bg-surface)',
          border: '1px solid var(--gold-border)',
          borderRight: 'none',
          borderRadius: '6px 0 0 6px',
          padding: '8px 6px',
          color: 'var(--gold)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          boxShadow: '-3px 0 12px rgba(0,0,0,0.3)',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.boxShadow = '-4px 0 16px rgba(212,175,55,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-surface)';
          e.currentTarget.style.boxShadow = '-3px 0 12px rgba(0,0,0,0.3)';
        }}
      >
        <span style={{ fontSize: 14 }}>✦</span>
        <span style={{ writingMode: 'vertical-rl', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
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
      style={{
        width: 360,
        minWidth: 320,
        maxWidth: 420,
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
            background: 'rgba(20, 20, 20, 0.9)',
            border: '2px dashed var(--gold)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--gold)',
            backdropFilter: 'blur(3px)',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 32 }}>📂</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Drop Images or Files Here</span>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            Attach to chat or insert directly into document
          </span>
        </div>
      )}

      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          height: 38,
          boxSizing: 'border-box',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, color: 'var(--gold)', lineHeight: 1 }}>✦</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            Pragna Copilot
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Web Search Toggle */}
          <button
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            title={`Web Grounding: ${webSearchEnabled ? 'ON' : 'OFF'}`}
            style={{
              background: webSearchEnabled ? 'var(--gold)' : 'var(--bg-elevated)',
              color: webSearchEnabled ? 'var(--text-on-gold)' : 'var(--text-secondary)',
              border: `1px solid ${webSearchEnabled ? 'var(--gold)' : 'var(--border)'}`,
              borderRadius: 3,
              padding: '2px 6px',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              transition: 'all 0.12s ease',
            }}
          >
            <span>🌐</span>
            <span>{webSearchEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Clear */}
          <button
            onClick={handleClearChat}
            title="Clear Chat History"
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              padding: '2px 4px',
              fontSize: 11,
              cursor: 'pointer',
              borderRadius: 3,
            }}
          >
            🗑️
          </button>

          {/* Close */}
          <button
            onClick={toggleCopilot}
            title="Close Panel"
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              padding: '2px 5px',
              fontSize: 12,
              cursor: 'pointer',
              borderRadius: 3,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Context Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border)',
          fontSize: 10,
          color: 'var(--text-muted)',
          minHeight: 24,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--gold)' }}>📎</span>
          <span>
            {hasSelection ? `Selection (${wordCount} words)` : `Document (${wordCount} words)`}
          </span>
        </div>

        <span style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {scope === 'selection' ? 'Selection' : 'Document'}
        </span>
      </div>

      {/* Messages Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
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
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  marginBottom: 2,
                  padding: '0 2px',
                  fontWeight: 600,
                }}
              >
                {isUser ? 'You' : '✦ Pragna'}
              </div>

              {/* Message Bubble */}
              <div
                style={{
                  maxWidth: '92%',
                  padding: '8px 11px',
                  borderRadius: isUser ? '8px 8px 1px 8px' : '8px 8px 8px 1px',
                  background: isUser ? 'rgba(212,175,55,0.14)' : 'var(--bg-elevated)',
                  border: `1px solid ${isUser ? 'var(--gold-border)' : 'var(--border)'}`,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
                      '& p': { margin: '0 0 5px 0' },
                      '& h1, & h2, & h3': { fontSize: 12, color: 'var(--gold)', margin: '5px 0 2px' },
                      '& ul, & ol': { paddingLeft: 14, margin: '2px 0 5px 0' },
                      '& li': { marginBottom: 2 },
                      '& pre': { background: '#0a0a0a', padding: 6, borderRadius: 3, overflowX: 'auto', border: '1px solid var(--border)' },
                      '& code': { fontFamily: 'monospace', fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '1px 3px', borderRadius: 2 },
                    }}
                  />
                )}

                {/* Render Attachments in User Message */}
                {isUser && msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: msg.content ? 6 : 0 }}>
                    {msg.attachments.map((att) => {
                      const isImg = att.type === 'image';
                      return (
                        <div
                          key={att.id}
                          style={{
                            background: 'rgba(0,0,0,0.25)',
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
                                  borderRadius: 3,
                                  display: 'block',
                                  marginBottom: 4,
                                }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <span style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                  {att.name}
                                </span>
                                <button
                                  onClick={() => handleInsertImage(att.uploadedUrl || att.previewUrl, att.name)}
                                  title="Insert image into document at current cursor"
                                  style={{
                                    background: 'var(--gold)',
                                    color: 'var(--text-on-gold)',
                                    border: '1px solid var(--gold-border)',
                                    borderRadius: 3,
                                    padding: '2px 6px',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <span>Insert in Doc</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                                <span>{getFileIcon(att.name, att.type)}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                                  {att.name}
                                </span>
                              </div>
                              <button
                                onClick={() => handleInsertFile(att)}
                                title="Insert content from this file into document"
                                style={{
                                  background: 'var(--gold)',
                                  color: 'var(--text-on-gold)',
                                  border: '1px solid var(--gold-border)',
                                  borderRadius: 3,
                                  padding: '2px 6px',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span>Insert Content</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Detect Images in Assistant Message and offer Insert buttons */}
                {!isUser && (() => {
                  const detectedImgs = extractImagesFromMessage(msg.content, msg.html);
                  if (!detectedImgs.length) return null;
                  return (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--gold)', fontWeight: 600, marginBottom: 3 }}>
                        🖼️ Images in response:
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
                              borderRadius: 3,
                              padding: '2px 6px',
                              fontSize: 9,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <span>➕ Insert Image {detectedImgs.length > 1 ? `#${i + 1}` : 'in Doc'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: 6, paddingTop: 5, borderTop: '1px solid var(--border)', fontSize: 9 }}>
                    <div style={{ fontWeight: 600, color: 'var(--gold)', marginBottom: 2 }}>🌐 Sources:</div>
                    {msg.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'block', color: 'var(--gold)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        [{idx + 1}] {s.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {!isUser && msg.id !== 'welcome' && !msg.isError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, paddingLeft: 2 }}>
                  <button
                    onClick={() => handleReplaceInDoc(msg)}
                    title="Apply/Replace directly in document"
                    style={{
                      background: 'var(--gold)',
                      color: 'var(--text-on-gold)',
                      border: '1px solid var(--gold-border)',
                      borderRadius: 3,
                      padding: '2px 7px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <span>⚡ Replace</span>
                  </button>

                  <button
                    onClick={() => handleInsertAtCursor(msg)}
                    title="Insert at current cursor"
                    style={{
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      padding: '2px 6px',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <span>Insert</span>
                  </button>

                  <button
                    onClick={() => handleCopyText(msg.content)}
                    title="Copy to clipboard"
                    style={{
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      padding: '2px 5px',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    📋
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', color: 'var(--gold)', fontSize: 11, fontStyle: 'italic' }}>
            <span>✦</span>
            <span>Pragna is writing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
          padding: '5px 8px',
          background: 'var(--bg-elevated)',
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
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '2px 7px',
              fontSize: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Pending Attachments List */}
      {attachments.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            padding: '6px 8px',
            background: 'var(--bg-elevated)',
            borderTop: '1px solid var(--border)',
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
                  gap: 6,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '3px 6px',
                  fontSize: 10,
                  flexShrink: 0,
                  maxWidth: 240,
                }}
              >
                {isImg ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3, border: '1px solid var(--border)' }}
                  />
                ) : (
                  <span style={{ fontSize: 14 }}>{getFileIcon(att.name, att.type)}</span>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 95 }}>
                    {att.name}
                  </span>
                  <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>
                    {formatBytes(att.size)}
                  </span>
                </div>

                {/* Quick Insert into Document button directly on attachment chip */}
                <button
                  onClick={() => (isImg ? handleInsertImage(att.uploadedUrl || att.previewUrl, att.name) : handleInsertFile(att))}
                  title="Insert directly into document at current cursor"
                  style={{
                    background: 'var(--gold)',
                    color: 'var(--text-on-gold)',
                    border: 'none',
                    borderRadius: 3,
                    padding: '2px 5px',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isImg ? '➕ Insert' : '📥 Insert'}
                </button>

                {/* Remove attachment */}
                <button
                  onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                  title="Remove attachment"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '1px 2px',
                    fontSize: 11,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Attachment & Action Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          fontSize: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Hidden file & image inputs */}
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
            title="Attach document or data file (.docx, .pdf, .txt, .csv, .json, etc.)"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '3px 7px',
              fontSize: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span>📎</span>
            <span>Attach File</span>
          </button>

          {/* Add Image Button */}
          <button
            onClick={() => imageInputRef.current?.click()}
            title="Upload and insert image (.png, .jpg, .svg, .webp, etc.)"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '3px 7px',
              fontSize: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span>🖼️</span>
            <span>Add Image</span>
          </button>

          {/* Image by URL */}
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            title="Insert image from web URL"
            style={{
              background: showUrlInput ? 'var(--gold)' : 'var(--bg-elevated)',
              color: showUrlInput ? 'var(--text-on-gold)' : 'var(--text-secondary)',
              border: `1px solid ${showUrlInput ? 'var(--gold-border)' : 'var(--border)'}`,
              borderRadius: 3,
              padding: '3px 7px',
              fontSize: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span>🔗</span>
            <span>Image URL</span>
          </button>
        </div>

        {uploadingFiles && (
          <span style={{ fontSize: 9, color: 'var(--gold)', fontStyle: 'italic' }}>
            Uploading...
          </span>
        )}
      </div>

      {/* URL Input Bar */}
      {showUrlInput && (
        <div
          style={{
            padding: '6px 8px',
            background: 'var(--bg-elevated)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 4,
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
              padding: '4px 6px',
              fontSize: 10,
              borderRadius: 3,
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
              border: '1px solid var(--gold-border)',
              borderRadius: 3,
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: 600,
              cursor: imageUrlValue.trim() ? 'pointer' : 'not-allowed',
              opacity: imageUrlValue.trim() ? 1 : 0.6,
            }}
          >
            ➕ Insert
          </button>
          <button
            onClick={handleAttachUrlImage}
            disabled={!imageUrlValue.trim()}
            title="Attach image to chat"
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
            💬 Attach
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
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Box */}
      <div
        style={{
          padding: '6px 8px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 5,
          alignItems: 'flex-end',
        }}
      >
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
          placeholder="Ask Pragna, prompt to draft/edit, or attach files/images..."
          rows={2}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 3,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: 11,
            fontFamily: 'var(--font-ui)',
            outline: 'none',
            resize: 'none',
            lineHeight: 1.35,
          }}
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={loading}
          title="Send message"
          style={{
            height: 32,
            padding: '0 10px',
            background: !loading ? 'var(--gold)' : 'var(--bg-elevated)',
            color: !loading ? 'var(--text-on-gold)' : 'var(--text-muted)',
            border: `1px solid ${!loading ? 'var(--gold-border)' : 'var(--border)'}`,
            borderRadius: 3,
            fontSize: 11,
            fontWeight: 600,
            cursor: !loading ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ➔
        </button>
      </div>
    </div>
  );
}
