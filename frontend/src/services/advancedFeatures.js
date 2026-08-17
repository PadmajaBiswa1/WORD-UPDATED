/**
 * AI & Advanced Features Service
 * Handles zoom preferences, thesaurus lookup, and AI content generation
 */

export class AdvancedFeaturesService {
  /**
   * Set document zoom level
   */
  static setZoom(editorDom, zoomLevel = 100) {
    if (!editorDom) return false;

    try {
      // Clamp zoom between 50% and 200%
      const zoom = Math.max(50, Math.min(200, zoomLevel));

      editorDom.style.transform = `scale(${zoom / 100})`;
      editorDom.style.transformOrigin = 'top left';
      editorDom.setAttribute('data-zoom', zoom);

      // Store zoom preference
      localStorage.setItem('etherx_zoom_level', String(zoom));

      return zoom;
    } catch (err) {
      console.error('Set zoom failed:', err);
      return false;
    }
  }

  /**
   * Get stored zoom preference
   */
  static getZoomPreference() {
    try {
      const stored = localStorage.getItem('etherx_zoom_level');
      return stored ? parseInt(stored, 10) : 100;
    } catch {
      return 100;
    }
  }

  /**
   * Zoom in
   */
  static zoomIn(editorDom, step = 10) {
    const current = AdvancedFeaturesService.getZoomPreference();
    return AdvancedFeaturesService.setZoom(editorDom, current + step);
  }

  /**
   * Zoom out
   */
  static zoomOut(editorDom, step = 10) {
    const current = AdvancedFeaturesService.getZoomPreference();
    return AdvancedFeaturesService.setZoom(editorDom, current - step);
  }

  /**
   * Reset zoom to 100%
   */
  static resetZoom(editorDom) {
    return AdvancedFeaturesService.setZoom(editorDom, 100);
  }

  /**
   * Look up word in thesaurus
   */
  static async thesaurusLookup(word) {
    try {
      // Using open thesaurus API (no key required)
      const response = await fetch(`https://www.thesaurus.com/browse/${encodeURIComponent(word)}`);
      
      if (!response.ok) {
        return {
          word,
          synonyms: [],
          antonyms: [],
          error: 'Not found in thesaurus',
        };
      }

      // For a real implementation, parse the HTML or use an actual thesaurus API
      // This is a placeholder that shows the structure
      return {
        word,
        synonyms: [
          { word: 'alternative', relevance: 95 },
          { word: 'substitute', relevance: 90 },
          { word: 'replacement', relevance: 85 },
        ],
        antonyms: [
          { word: 'original', relevance: 90 },
          { word: 'unique', relevance: 85 },
        ],
      };
    } catch (err) {
      console.error('Thesaurus lookup failed:', err);
      return {
        word,
        synonyms: [],
        antonyms: [],
        error: err.message,
      };
    }
  }

  /**
   * Replace word with synonym
   */
  static replaceSynonym(editor, originalWord, synonymWord) {
    if (!editor) return false;

    try {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to);

      if (selectedText !== originalWord) {
        return false;
      }

      editor.chain().focus().insertContentAt({ from, to }, synonymWord).run();
      return true;
    } catch (err) {
      console.error('Replace synonym failed:', err);
      return false;
    }
  }

  /**
   * AI-powered content generation
   */
  static async generateAIContent(prompt, context = '') {
    try {
      // This would integrate with OpenAI, Claude, or similar
      // Placeholder implementation shows the structure
      
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          context,
          model: 'gpt-3.5-turbo',
          maxTokens: 500,
        }),
      });

      if (!response.ok) {
        return {
          error: 'AI generation failed',
          content: null,
        };
      }

      const data = await response.json();
      return {
        content: data.content,
        tokens: data.tokens,
        model: data.model,
      };
    } catch (err) {
      console.error('AI generation failed:', err);
      return {
        error: err.message,
        content: null,
      };
    }
  }

  /**
   * AI-powered text enhancement
   */
  static async enhanceText(text, enhancement = 'improve') {
    try {
      const prompts = {
        improve: `Improve this text for clarity and readability: "${text}"`,
        shorten: `Shorten this text while keeping meaning: "${text}"`,
        expand: `Expand this text with more details: "${text}"`,
        formal: `Rewrite this in formal language: "${text}"`,
        casual: `Rewrite this in casual language: "${text}"`,
        professional: `Rewrite this in professional language: "${text}"`,
      };

      return AdvancedFeaturesService.generateAIContent(
        prompts[enhancement] || prompts.improve,
        text
      );
    } catch (err) {
      console.error('Text enhancement failed:', err);
      return {
        error: err.message,
        content: null,
      };
    }
  }

  /**
   * AI-powered grammar check
   */
  static async checkGrammar(text) {
    try {
      const response = await fetch('/api/ai/grammar-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        return { errors: [], warnings: [] };
      }

      const data = await response.json();
      return {
        errors: data.errors || [],
        warnings: data.warnings || [],
        suggestions: data.suggestions || [],
      };
    } catch (err) {
      console.error('Grammar check failed:', err);
      return { errors: [], warnings: [] };
    }
  }

  /**
   * Insert AI-generated content
   */
  static insertGeneratedContent(editor, content) {
    if (!editor || !content) return false;

    try {
      editor.chain().focus().insertContent(content).run();
      return true;
    } catch (err) {
      console.error('Insert generated content failed:', err);
      return false;
    }
  }

  /**
   * Apply style to selected text using AI
   */
  static async styleTextWithAI(selectedText, targetStyle) {
    try {
      const prompt = `Rewrite this text in ${targetStyle} style: "${selectedText}"`;
      return AdvancedFeaturesService.generateAIContent(prompt);
    } catch (err) {
      console.error('AI styling failed:', err);
      return null;
    }
  }
}

export default AdvancedFeaturesService;
