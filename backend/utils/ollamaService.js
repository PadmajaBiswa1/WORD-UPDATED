const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const axios = require('axios');

const FALLBACK_KEYS = [
  '26a95f0c5431431d8338645cdde4998f.CyDoeN4fDrSTJum8dpfRglps',
  'edaff62e882644429122351eebfb886f.nWMqDHxFN_XoKqrj0OuSysKN',
  '8236b13c2ce04b7ab1e0a47db95044ca.hr_X86hvlBtvKIajcuDKMa7i',
  'e3a4223d79bb4987a04cc8c84ca13126.ZinzQDR_UwLbEOI3-d2EeT3w',
  '656c9a178c5147cfbde8bea65bd2586c.362NxF3QYCi36-V3vH10tKUY',
];

class OllamaService {
  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1').replace(/\/+$/, '');
    this.defaultModel = this.normalizeModel(process.env.OLLAMA_MODEL || 'gemma4:31b');
    this.fallbackModels = ['gemma4:31b', 'gpt-oss:20b', 'gpt-oss:120b', 'nemotron-3-nano:30b'];
    
    // Gather all configured Ollama keys
    this.keys = this._loadKeys();
    this.currentKeyIndex = 0;
    
    console.log(`✦ Pragna AI initialized with ${this.keys.length} Ollama key(s). Default model: ${this.defaultModel}`);
  }

  normalizeModel(model) {
    if (!model) return 'gemma4:31b';
    const clean = String(model).trim().toLowerCase();
    if (clean === 'gemma:31b' || clean === 'gemma:31' || clean === 'gemma-4:31b' || clean === 'gemma4:31b') {
      return 'gemma4:31b';
    }
    return model;
  }

  _loadKeys() {
    const keys = [];
    if (process.env.OLLAMA_API_KEY) keys.push(process.env.OLLAMA_API_KEY.trim());
    
    // Check numbered keys like OLLAMA_API_KEY_2 .. OLLAMA_API_KEY_20
    for (let i = 2; i <= 20; i++) {
      const k = process.env[`OLLAMA_API_KEY_${i}`];
      if (k && k.trim() && !keys.includes(k.trim())) {
        keys.push(k.trim());
      }
    }

    // Also look for any other env variables matching OLLAMA_API_KEY*
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('OLLAMA_API_KEY') && !keys.includes(process.env[key].trim())) {
        keys.push(process.env[key].trim());
      }
    });

    const activeKeys = keys.filter(Boolean);
    if (!activeKeys.length && !this.baseUrl?.includes('localhost') && !this.baseUrl?.includes('127.0.0.1')) {
      return [...FALLBACK_KEYS];
    }

    return activeKeys;
  }

  getNextKey() {
    if (!this.keys.length) return null;
    const key = this.keys[this.currentKeyIndex % this.keys.length];
    return key;
  }

  rotateKey() {
    if (this.keys.length > 1) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
      console.log(`✦ Pragna AI: Rotated to Ollama key index ${this.currentKeyIndex + 1}/${this.keys.length}`);
    }
  }

  /**
   * Convert markdown output from LLM to clean HTML tags compatible with Tiptap
   */
  markdownToHtml(markdown = '') {
    if (!markdown) return '<p></p>';

    // If it already looks like structured HTML, sanitize slightly and return
    const hasHtmlTags = /<\/?(p|h[1-6]|ul|ol|li|table|blockquote|div)\b/i.test(markdown);
    if (hasHtmlTags && !markdown.includes('```')) {
      return markdown;
    }

    let text = String(markdown).trim();

    // Strip wrapping ```html ... ``` or ```markdown ... ```
    text = text.replace(/^```(?:html|markdown)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    // Split lines
    const lines = text.split(/\r?\n/);
    const htmlLines = [];
    let inList = false;
    let listType = null; // 'ul' or 'ol'
    let inBlockquote = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Blockquotes
      if (line.startsWith('> ')) {
        if (!inBlockquote) {
          if (inList) { htmlLines.push(`</${listType}>`); inList = false; listType = null; }
          htmlLines.push('<blockquote>');
          inBlockquote = true;
        }
        line = line.replace(/^>\s?/, '');
      } else if (inBlockquote && !line.trim()) {
        htmlLines.push('</blockquote>');
        inBlockquote = false;
        continue;
      }

      // Headings
      const h4Match = line.match(/^####\s+(.*)/);
      const h3Match = line.match(/^###\s+(.*)/);
      const h2Match = line.match(/^##\s+(.*)/);
      const h1Match = line.match(/^#\s+(.*)/);

      if (h1Match || h2Match || h3Match || h4Match) {
        if (inList) { htmlLines.push(`</${listType}>`); inList = false; listType = null; }
        if (inBlockquote) { htmlLines.push('</blockquote>'); inBlockquote = false; }
        
        if (h4Match) htmlLines.push(`<h4>${this._formatInline(h4Match[1])}</h4>`);
        else if (h3Match) htmlLines.push(`<h3>${this._formatInline(h3Match[1])}</h3>`);
        else if (h2Match) htmlLines.push(`<h2>${this._formatInline(h2Match[1])}</h2>`);
        else if (h1Match) htmlLines.push(`<h1>${this._formatInline(h1Match[1])}</h1>`);
        continue;
      }

      // Unordered list
      const ulMatch = line.match(/^[-*•]\s+(.*)/);
      if (ulMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) htmlLines.push(`</${listType}>`);
          htmlLines.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        htmlLines.push(`<li>${this._formatInline(ulMatch[1])}</li>`);
        continue;
      }

      // Ordered list
      const olMatch = line.match(/^\d+\.\s+(.*)/);
      if (olMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) htmlLines.push(`</${listType}>`);
          htmlLines.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        htmlLines.push(`<li>${this._formatInline(olMatch[1])}</li>`);
        continue;
      }

      // End of list
      if (inList) {
        htmlLines.push(`</${listType}>`);
        inList = false;
        listType = null;
      }

      // Horizontal Rule
      if (/^(\*\*\*|---|___)$/.test(line.trim())) {
        htmlLines.push('<hr>');
        continue;
      }

      // Regular paragraph
      if (line.trim()) {
        htmlLines.push(`<p>${this._formatInline(line.trim())}</p>`);
      }
    }

    if (inList) htmlLines.push(`</${listType}>`);
    if (inBlockquote) htmlLines.push('</blockquote>');

    return htmlLines.join('\n') || '<p></p>';
  }

  _formatInline(text = '') {
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Code
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  /**
   * Execute chat completion with Ollama Cloud, supporting multi-key rotation and model fallbacks
   */
  async chatCompletion({ messages, temperature = 0.7, max_tokens = 4000, model }) {
    const isLocal = this.baseUrl?.includes('localhost') || this.baseUrl?.includes('127.0.0.1');
    if (!this.keys.length && !isLocal) {
      throw new Error('No Ollama API keys found in configuration. Please check backend .env.');
    }

    const candidateModels = [
      model || this.defaultModel,
      ...this.fallbackModels.filter((m) => m !== (model || this.defaultModel)),
    ];

    let lastError = null;
    const maxAttempts = Math.max(1, Math.min(Math.max(this.keys.length, 1) * 2, 8));

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const apiKey = this.getNextKey();
      const currentModel = candidateModels[Math.min(Math.floor(attempt / 2), candidateModels.length - 1)];

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: currentModel,
            messages,
            temperature,
            max_tokens,
          },
          {
            headers,
            timeout: 60000, // 60s timeout
          }
        );

        const choice = response.data?.choices?.[0];
        if (!choice?.message?.content) {
          throw new Error('Empty response from Ollama API');
        }

        return {
          content: choice.message.content.trim(),
          model: currentModel,
          role: choice.message.role || 'assistant',
        };
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        const errData = err.response?.data;
        const errMsg = errData?.error?.message || err.message;

        console.warn(`⚠️ Ollama attempt ${attempt + 1} failed with model ${currentModel} (Key index: ${this.currentKeyIndex}):`, errMsg);

        // If rate limit (429) or auth error (401/403) or quota, rotate to next key
        if (status === 429 || status === 401 || status === 403 || String(errMsg).includes('rate limit') || String(errMsg).includes('usage')) {
          this.rotateKey();
        }

        // Brief delay before retry
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    throw new Error(`Pragna AI error: All attempts to communicate with Ollama failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * High-level handler for Pragna writing actions
   */
  async executeAction({ action, text = '', topic = '', tone = 'professional', pages = 1, mode = 'clear', fallbackTitle = '', language = 'English', prompt = '', instructions = '', model = null }) {
    const systemPrompt = `You are Pragna, the advanced AI document assistant embedded in EtherX Word.
You produce top-tier, beautifully structured, insightful document content.
Return natural, ready-to-insert document content. Use clear paragraphs, headings (### Heading), bullet points (- item), or numbered lists where suitable. Do NOT surround your entire response with \`\`\` markdown codeblocks.`;

    let userPrompt = '';
    let resultType = 'html';

    switch (action) {
      case 'content-generator':
      case 'generate': {
        const targetPages = Math.max(1, Math.min(10, parseInt(pages, 10) || 1));
        const estimatedWords = targetPages * 400;
        userPrompt = `Please write a comprehensive, highly polished document draft on the following topic:
Topic: "${topic || 'Executive Project Report'}"
Desired Tone: ${tone}
Desired Length: Approximately ${targetPages} page(s) (~${estimatedWords} words).

Structure the document with:
- An engaging, executive title or header
- Clear section headings (e.g. Executive Summary, Objectives, Analysis, Recommendations, Next Steps)
- Well-developed, thorough paragraphs
- Bullet points or lists where relevant for readability

Begin drafting immediately.`;
        break;
      }

      case 'summarize': {
        userPrompt = `Summarize the following document text thoroughly yet concisely.
Provide:
1. An Executive Overview (2-3 sentences)
2. Key Findings / Core Points (bulleted list)
3. Actionable Takeaways or Conclusions

Text to summarize:
"""
${text}
"""`;
        break;
      }

      case 'grammar': {
        userPrompt = `Proofread and perfect the following text.
Fix all grammatical mistakes, spelling errors, awkward phrasing, and punctuation issues while strictly preserving the author's original meaning and voice.
Output ONLY the polished, perfected text so it can directly replace the original.

Original text:
"""
${text}
"""`;
        break;
      }

      case 'rewrite': {
        userPrompt = `Rewrite the following text with a "${mode}" style/tone.
Make it exceptionally well-written, clear, and engaging.
Output ONLY the rewritten text without conversational preamble.

Text to rewrite:
"""
${text}
"""`;
        break;
      }

      case 'title': {
        resultType = 'title';
        userPrompt = `Based on the following document excerpt, generate the single best, most compelling, and professional document title.
Output ONLY the title text (no quotes, no preamble, maximum 10 words).

Document text:
"""
${text.slice(0, 2000)}
"""`;
        break;
      }

      case 'translate': {
        userPrompt = `Translate the following text accurately and naturally into ${language}.
Preserve paragraph structure and tone.
Output ONLY the translated text.

Text to translate:
"""
${text}
"""`;
        break;
      }

      case 'edit':
      case 'custom-edit':
      case 'instruction': {
        const userInstruction = instructions || prompt || mode || 'Edit and improve this text';
        userPrompt = `You are an expert editor editing document text according to the following instructions:
User Instruction: "${userInstruction}"

Original Text to Edit:
"""
${text}
"""

Task:
Apply the user instruction directly to the text.
Output ONLY the resulting edited, perfected text ready to be inserted into the document.
Retain or refine formatting (paragraphs, bullet points, headers) appropriately. Do NOT output conversational filler or wrap in markdown code fences (\`\`\`).`;
        break;
      }

      case 'ask':
      case 'prompt':
      case 'chat': {
        userPrompt = prompt || instructions;
        if (text) {
          userPrompt += `\n\nReference text from document:\n"""\n${text}\n"""`;
        }
        break;
      }

      case 'citation-check':
      case 'fact-check': {
        userPrompt = `You are a rigorous research fact-checker and citation verifier.
Analyze the following document text, focusing on statements with citations (e.g. [1], (Author, Year), footnotes, authorities) or factual assertions.

Document text to evaluate:
"""
${text}
"""

Provide an executive fact-checking evaluation:
1. Overall Verification Score (percentage of statements verified with credible support).
2. Key Findings: breakdown of verified claims versus claims requiring caution or further evidence.
3. For each cited claim or assertion, note whether the claim is verified, supported, or needs caution, with brief reasoning.`;
        break;
      }

      default:
        userPrompt = prompt || instructions || `Process the following text:\n"""\n${text}\n"""`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.chatCompletion({ messages, model, temperature: action === 'grammar' ? 0.2 : 0.7 });
    const rawOutput = response.content;

    if (resultType === 'title') {
      const cleanTitle = rawOutput.replace(/^["']|["']$/g, '').replace(/^Title:\s*/i, '').trim();
      return {
        title: cleanTitle || fallbackTitle || 'Untitled Document',
        text: cleanTitle,
        model: response.model,
      };
    }

    const html = this.markdownToHtml(rawOutput);
    return {
      text: rawOutput,
      html,
      model: response.model,
    };
  }

  getStatus() {
    return {
      status: 'ok',
      name: 'Pragna AI',
      provider: 'Ollama Cloud',
      defaultModel: this.defaultModel,
      activeKeysCount: this.keys.length,
    };
  }
}

const ollamaService = new OllamaService();
module.exports = ollamaService;
