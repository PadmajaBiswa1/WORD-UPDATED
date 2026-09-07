const axios = require('axios');
const ollamaService = require('./ollamaService');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 EtherXWord/1.0';

class WebToolsService {
  /**
   * Search Wikipedia for factual & encyclopedic context
   */
  async searchWikipedia(query, limit = 5) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'EtherXWordApp/1.0 (contact@etherx.internal)' },
        timeout: 8000,
      });

      const searchList = res.data?.query?.search || [];
      return searchList.slice(0, limit).map((item) => ({
        title: item.title,
        snippet: (item.snippet || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim(),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`,
        source: 'Wikipedia',
        category: 'encyclopedia',
      }));
    } catch (err) {
      console.warn('⚠️ Wikipedia search failed:', err.message);
      return [];
    }
  }

  /**
   * Search Google News RSS for live news & current events
   */
  async searchNews(query, limit = 6) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 8000,
      });

      const xml = String(res.data || '');
      const results = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xml)) !== null && results.length < limit) {
        const itemXml = match[1];
        const rawTitle = (itemXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
        const link = (itemXml.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
        const pubDate = (itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
        const desc = (itemXml.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';

        // Google News titles are usually "Headline - Source Name"
        let title = rawTitle.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        let source = 'News';
        if (title.includes(' - ')) {
          const parts = title.split(' - ');
          source = parts.pop().trim();
          title = parts.join(' - ').trim();
        }

        const cleanSnippet = desc
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/\s+/g, ' ')
          .trim();

        results.push({
          title,
          url: link,
          snippet: cleanSnippet || title,
          source,
          date: pubDate ? new Date(pubDate).toLocaleDateString() : '',
          category: 'news',
        });
      }

      return results;
    } catch (err) {
      console.warn('⚠️ News search failed:', err.message);
      return [];
    }
  }

  /**
   * Search ArXiv for academic research papers & publications
   */
  async searchArxiv(query, limit = 5) {
    try {
      const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000,
      });

      const xml = String(res.data || '');
      const results = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;

      while ((match = entryRegex.exec(xml)) !== null && results.length < limit) {
        const entryXml = match[1];
        const title = (entryXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
        const summary = (entryXml.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || '';
        const id = (entryXml.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || '';
        const published = (entryXml.match(/<published>([\s\S]*?)<\/published>/) || [])[1] || '';

        // Extract author names
        const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g;
        const authors = [];
        let aMatch;
        while ((aMatch = authorRegex.exec(entryXml)) !== null) {
          authors.push(aMatch[1].trim());
        }

        results.push({
          title: title.replace(/\s+/g, ' ').trim(),
          url: id.trim(),
          snippet: summary.replace(/\s+/g, ' ').trim(),
          source: authors.length ? `ArXiv (${authors.slice(0, 2).join(', ')}${authors.length > 2 ? ' et al.' : ''})` : 'ArXiv',
          date: published ? published.slice(0, 10) : '',
          category: 'academic',
        });
      }

      return results;
    } catch (err) {
      console.warn('⚠️ ArXiv search failed:', err.message);
      return [];
    }
  }

  /**
   * Search DuckDuckGo Instant Answers & Topics
   */
  async searchDuckDuckGo(query) {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 6000,
      });

      const data = res.data || {};
      const results = [];

      if (data.AbstractText && data.AbstractURL) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText,
          source: data.AbstractSource || 'DuckDuckGo',
          category: 'direct-answer',
        });
      }

      if (Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 3).forEach((t) => {
          if (t.Text && t.FirstURL) {
            results.push({
              title: t.Text.split(' - ')[0] || query,
              url: t.FirstURL,
              snippet: t.Text,
              source: 'DuckDuckGo',
              category: 'related',
            });
          }
        });
      }

      return results;
    } catch (err) {
      console.warn('⚠️ DuckDuckGo search failed:', err.message);
      return [];
    }
  }

  /**
   * Unified search across selected sources
   */
  async searchWeb({ query, category = 'all', limit = 8 }) {
    const q = String(query || '').trim();
    if (!q) return [];

    let results = [];

    if (category === 'academic') {
      results = await this.searchArxiv(q, limit);
    } else if (category === 'facts' || category === 'wiki') {
      results = await this.searchWikipedia(q, limit);
    } else if (category === 'news') {
      results = await this.searchNews(q, limit);
    } else {
      // 'all': Combine News, Wikipedia, DDG, and ArXiv concurrently
      const [news, wiki, ddg, arxiv] = await Promise.all([
        this.searchNews(q, 4),
        this.searchWikipedia(q, 3),
        this.searchDuckDuckGo(q),
        this.searchArxiv(q, 2),
      ]);

      results = [...ddg, ...news, ...wiki, ...arxiv];
    }

    // Deduplicate by URL or title
    const seen = new Set();
    const unique = [];
    for (const r of results) {
      const key = (r.url || r.title).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
      if (unique.length >= limit) break;
    }

    return unique;
  }

  /**
   * Fetch and extract text and metadata from any public URL
   */
  async fetchUrlContent(targetUrl) {
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      throw new Error('Valid http or https URL is required');
    }

    const res = await axios.get(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 12000,
      maxContentLength: 10 * 1024 * 1024, // 10MB limit
    });

    const html = String(res.data || '');

    // Extract Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : targetUrl;

    // Clean HTML: Remove scripts, styles, navigations, footers, headers
    let clean = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');

    // Extract paragraphs and headings
    const contentBlocks = [];
    const blockRegex = /<(p|h[1-6]|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
    let bMatch;

    while ((bMatch = blockRegex.exec(clean)) !== null) {
      const tag = bMatch[1].toLowerCase();
      const rawText = bMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (rawText.length > 25) {
        contentBlocks.push({ tag, text: rawText });
      }
    }

    // Fallback: If no blocks extracted, strip all tags
    let fullText = contentBlocks.map((b) => b.text).join('\n\n');
    if (!fullText || fullText.length < 100) {
      fullText = clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const words = fullText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const excerpt = fullText.slice(0, 1500) + (fullText.length > 1500 ? '...' : '');

    return {
      url: targetUrl,
      title,
      text: fullText,
      excerpt,
      wordCount,
      host: new URL(targetUrl).hostname,
    };
  }

  /**
   * Conduct research with Pragna AI using live web search results as context
   */
  async researchWithPragna({ query, category = 'all', mode = 'synthesize', documentContext = '' }) {
    const searchResults = await this.searchWeb({ query, category, limit: 6 });

    if (!searchResults.length) {
      throw new Error(`No web search results found for: "${query}".`);
    }

    const searchContext = searchResults
      .map((r, i) => `[Source ${i + 1}]: "${r.title}" (${r.source || 'Web'})\nURL: ${r.url}\nSummary: ${r.snippet}`)
      .join('\n\n');

    let prompt = '';
    if (mode === 'draft-section') {
      prompt = `Write a comprehensive, professional document section on the topic: "${query}".
Incorporate the factual findings, data points, and current events from the web sources provided below.
Cite your claims naturally using the sources (e.g. "[Source 1]" or mention the publication name).
Provide clear subheadings (### Subheading) and bullet points.

Live Web Research Sources:
${searchContext}

${documentContext ? `Existing document context for alignment:\n"""\n${documentContext.slice(0, 1500)}\n"""` : ''}`;
    } else if (mode === 'citations') {
      prompt = `Generate a formatted Bibliography / References list in APA 7th edition style for the following web sources:

${searchContext}

Output each reference cleanly with author/source, date, title, and link.`;
    } else {
      // Default: synthesize research findings
      prompt = `Synthesize the following live web search findings regarding: "${query}".
Provide:
1. Executive Research Summary (2-3 sentences synthesizing the current state)
2. Key Insights & Developments (bulleted list with specific data/facts)
3. Cited Sources (list of the sources used with their URLs)

Live Web Research Sources:
${searchContext}`;
    }

    const messages = [
      {
        role: 'system',
        content: `You are Pragna, the advanced AI document assistant embedded in EtherX Word equipped with real-time web browsing and research capabilities.
Deliver sharp, authoritative, well-cited document intelligence. Use clean headings, paragraphs, and bullet points.`,
      },
      { role: 'user', content: prompt },
    ];

    const aiRes = await ollamaService.chatCompletion({ messages, temperature: 0.4 });
    const html = ollamaService.markdownToHtml(aiRes.content);

    return {
      query,
      results: searchResults,
      analysis: aiRes.content,
      html,
      model: aiRes.model,
    };
  }

  /**
   * Summarize a URL's content with Pragna AI
   */
  async summarizeUrlWithPragna({ url, action = 'summary' }) {
    const pageData = await this.fetchUrlContent(url);
    const contentToAnalyze = pageData.text.slice(0, 6000);

    let prompt = '';
    if (action === 'key-takeaways') {
      prompt = `Extract the top 5 key takeaways, statistics, and actionable data points from the webpage article titled "${pageData.title}".
Article content:
"""
${contentToAnalyze}
"""`;
    } else if (action === 'citation') {
      prompt = `Generate a bibliographic citation in APA 7th edition format for this web resource:
Title: ${pageData.title}
URL: ${pageData.url}
Website: ${pageData.host}
Current date: ${new Date().toLocaleDateString()}`;
    } else {
      prompt = `Provide an executive summary and core analysis of the following webpage article:
Title: "${pageData.title}"
URL: ${pageData.url}

Article content:
"""
${contentToAnalyze}
"""

Format with an Overview, Core Analysis, and Significance.`;
    }

    const messages = [
      {
        role: 'system',
        content: `You are Pragna, the AI document assistant in EtherX Word. You summarize web pages and articles with pristine accuracy and clarity.`,
      },
      { role: 'user', content: prompt },
    ];

    const aiRes = await ollamaService.chatCompletion({ messages, temperature: 0.3 });
    const html = ollamaService.markdownToHtml(aiRes.content);

    return {
      url: pageData.url,
      title: pageData.title,
      wordCount: pageData.wordCount,
      analysis: aiRes.content,
      html,
      model: aiRes.model,
    };
  }
}

const webToolsService = new WebToolsService();
module.exports = webToolsService;
