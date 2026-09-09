const express = require('express');
const router = express.Router();
const ollamaService = require('../utils/ollamaService');
const webToolsService = require('../utils/webToolsService');

// Execute Pragna AI action (generate, summarize, grammar, rewrite, title, translate, prompt)
router.post('/action', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      action = 'generate',
      text = '',
      topic = '',
      tone = 'professional',
      pages = 1,
      mode = 'clear',
      fallbackTitle = '',
      language = 'English',
      prompt = '',
      instructions = '',
      instruction = '',
      model = '',
      aiProfile = null,
    } = req.body;

    const effectivePrompt = prompt || instructions || instruction || '';

    const result = await ollamaService.executeAction({
      action,
      text,
      topic,
      tone: (aiProfile && aiProfile.tone) || tone,
      pages,
      mode,
      fallbackTitle,
      language,
      prompt: effectivePrompt,
      instructions: (aiProfile && aiProfile.instructions) ? `${effectivePrompt} ${aiProfile.instructions}` : effectivePrompt,
      model,
      aiProfile,
    });

    const latencyMs = Date.now() - startTime;
    return res.json({
      success: true,
      action,
      latencyMs,
      ...result,
    });
  } catch (err) {
    console.error('❌ Pragna AI Action error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Pragna AI processing failed',
      latencyMs: Date.now() - startTime,
    });
  }
});

// Interactive chat/assistant with Pragna (with optional Web Grounding)
router.post('/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      messages = [],
      selectedText = '',
      documentText = '',
      scope = 'document',
      context = '',
      webSearch = false,
      model,
      aiProfile = null,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'Messages array is required' });
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    let webContext = '';
    let webSources = [];
    if (webSearch && lastUserMessage.trim()) {
      try {
        webSources = await webToolsService.searchWeb({ query: lastUserMessage, limit: 4 });
        if (webSources.length) {
          webContext = '\n\nLive Web Findings:\n' + webSources.map((s, i) => `[Source ${i + 1}] "${s.title}": ${s.snippet} (URL: ${s.url})`).join('\n');
        }
      } catch (wErr) {
        console.warn('⚠️ Web grounding failed during chat:', wErr.message);
      }
    }

    const effectiveSelectedText = selectedText || '';
    const effectiveDocumentText = documentText || context || '';

    let personaPrompt = '';
    if (aiProfile && typeof aiProfile === 'object') {
      const pTerms = Array.isArray(aiProfile.preferredTerms) && aiProfile.preferredTerms.length
        ? `\n- **Preferred Terminology (MUST use whenever applicable):** ${aiProfile.preferredTerms.join(', ')}`
        : '';
      const fTerms = Array.isArray(aiProfile.forbiddenTerms) && aiProfile.forbiddenTerms.length
        ? `\n- **Forbidden Terminology (NEVER use these words or phrases):** ${aiProfile.forbiddenTerms.join(', ')}`
        : '';
      const instr = aiProfile.instructions ? `\n- **Document Directives / Custom Persona Instructions:** ${aiProfile.instructions}` : '';
      const targetTone = aiProfile.tone ? `\n- **Persona Tone:** ${aiProfile.tone}` : '';
      const targetAudience = aiProfile.audience ? `\n- **Target Audience:** ${aiProfile.audience}` : '';
      const respStyle = aiProfile.responseStyle ? `\n- **Response Style:** ${aiProfile.responseStyle}` : '';

      personaPrompt = `\n\n## Active Document AI Persona Guidelines\nYou must strictly adhere to the following document persona guidelines established for this document:${targetTone}${targetAudience}${respStyle}${instr}${pTerms}${fTerms}`;
    }

    const systemPrompt = `You are Pragna, an AI assistant chatting with a user inside a Word document, in a side panel.

## Context you receive each turn
- selectedText: ${effectiveSelectedText ? JSON.stringify(effectiveSelectedText) : '""'} (whatever the user has highlighted in the document)
- documentText: ${effectiveDocumentText ? JSON.stringify(effectiveDocumentText.slice(0, 5000)) : '""'} (the document body)
- scope: "${scope}" ("selection", "cursor", or "document" — tells you what the user's next action will apply to)
- webSearch: ${webSearch}

Always read this context before responding. Never ask the user to paste text you already have access to.

## How to respond
- Talk like a normal chatbot — conversational, no rigid menus.
- If the user asks you to write, rewrite, fix, shorten, expand, or restyle something, produce the finished replacement text as your reply. It will be inserted into the document as-is when they click "Insert into document", so don't wrap it in commentary, quotes, or explanations ("Here is the result:") — just the clean text meant for the page.
- If they ask a question about the document instead ("does this hold up," "what am I missing"), just answer conversationally — no need to produce insertable text.
- If scope is "selection" and selectedText is present, treat that as the exact target of any edit.
- If scope is "cursor", write new text meant to be inserted at that point — it should read naturally when it lands there.
- If scope is "document" and no selection exists, work with the full documentText.
- Stay scoped to what was asked: "fix grammar" ≠ rewrite tone; "shorten" ≠ restructure.

## Web search
${webSearch ? `Live web search is ENABLED.\nWeb findings:\n${webContext}\nCite sources briefly for any fact pulled from search. Never paste web content verbatim — paraphrase into the document's own voice.` : 'When webSearch is false, rely on what you know and flag if something needs verification instead of guessing.'}

## Images and Media
- You HAVE FULL CAPABILITY to embed and insert images into the document.
- When an attached image URL is in the prompt context (e.g. \`[URL: /uploads/...]\`), and the user asks to add, insert, place, or include the image (or write content with it), you MUST embed the image in your reply using Markdown image format: \`![Image Description](image_url)\`.
- NEVER state that you cannot insert images or tell the user to use the ribbon/Insert tab. You CAN embed images directly via Markdown \`![alt](url)\`, which our editor renders and inserts into the document canvas.

## Tone
- Match the existing voice of documentText (formal, casual, academic, marketing, etc.) unless told to change it.
- Keep chat replies focused — the deliverable is the text meant for the document, not a long explanation of your reasoning.${personaPrompt}`;

    const targetText = effectiveSelectedText || (scope === 'document' ? effectiveDocumentText : '');

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m, idx) => {
        let content = String(m.content || '');
        if (idx === messages.length - 1 && m.role === 'user' && targetText) {
          content += `\n\n[Document Context - Target ${effectiveSelectedText ? 'Selection' : 'Document'} Text]:\n"""\n${targetText.slice(0, 5000)}\n"""`;
        }
        return {
          role: m.role === 'user' ? 'user' : 'assistant',
          content,
        };
      }),
    ];

    const response = await ollamaService.chatCompletion({ messages: formattedMessages, model });
    const latencyMs = Date.now() - startTime;

    return res.json({
      success: true,
      message: response.content,
      model: response.model,
      sources: webSources,
      latencyMs,
    });
  } catch (err) {
    console.error('❌ Pragna Chat error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Pragna Chat failed',
      latencyMs: Date.now() - startTime,
    });
  }
});

// ══════════════════════════════════════════════════════════════════
// WEB TOOLS FOR PRAGNA AI
// ══════════════════════════════════════════════════════════════════

// 1. Web Search endpoint
router.post('/web/search', async (req, res) => {
  const startTime = Date.now();
  try {
    const { query = '', category = 'all', limit = 8 } = req.body;
    if (!query.trim()) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const results = await webToolsService.searchWeb({ query: query.trim(), category, limit });
    return res.json({
      success: true,
      query: query.trim(),
      category,
      results,
      count: results.length,
      latencyMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('❌ Pragna Web Search error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Fetch webpage content
router.post('/web/fetch', async (req, res) => {
  const startTime = Date.now();
  try {
    const { url = '' } = req.body;
    if (!url.trim()) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

    const pageData = await webToolsService.fetchUrlContent(url.trim());
    return res.json({
      success: true,
      ...pageData,
      latencyMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('❌ Pragna Web Fetch error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Synthesize live web research with Pragna AI
router.post('/web/research', async (req, res) => {
  const startTime = Date.now();
  try {
    const { query = '', category = 'all', mode = 'synthesize', documentContext = '' } = req.body;
    if (!query.trim()) {
      return res.status(400).json({ success: false, message: 'Research query is required' });
    }

    const result = await webToolsService.researchWithPragna({
      query: query.trim(),
      category,
      mode,
      documentContext,
    });

    return res.json({
      success: true,
      ...result,
      latencyMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('❌ Pragna Web Research error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Summarize URL with Pragna AI
router.post('/web/summarize-url', async (req, res) => {
  const startTime = Date.now();
  try {
    const { url = '', action = 'summary' } = req.body;
    if (!url.trim()) {
      return res.status(400).json({ success: false, message: 'Target URL is required' });
    }

    const result = await webToolsService.summarizeUrlWithPragna({ url: url.trim(), action });
    return res.json({
      success: true,
      ...result,
      latencyMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('❌ Pragna Summarize URL error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Status check
router.get('/status', (req, res) => {
  try {
    const status = ollamaService.getStatus();
    return res.json({
      ...status,
      webToolsEnabled: true,
      webSources: ['Google News RSS', 'Wikipedia', 'ArXiv Academic', 'DuckDuckGo'],
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
