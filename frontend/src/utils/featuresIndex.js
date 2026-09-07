/**
 * Features Index - All available editor features for command search
 * Organized by category and tab
 */

import { buildAiResult, openTranslationUrl } from '@/services/ai';
import { useDocumentStore, useUIStore } from '@/store';
import { runDictation, runImageTextCapture, runReadAloud, runSmartSuggestions } from '@/utils/smartFeatures';

export const FEATURES = [
  // ═══ HOME TAB ═══
  {
    id: 'cut',
    name: 'Cut',
    category: 'Clipboard',
    tab: 'ai',
    keywords: ['cut', 'clipboard', 'remove'],
    description: 'Cut selection to clipboard',
    action: (editor) => editor?.chain().focus().cut().run(),
  },
  {
    id: 'copy',
    name: 'Copy',
    category: 'Clipboard',
    tab: 'ai',
    keywords: ['copy', 'clipboard', 'duplicate'],
    description: 'Copy selection to clipboard',
    action: (editor) => editor?.chain().focus().copy().run(),
  },
  {
    id: 'paste',
    name: 'Paste',
    category: 'Clipboard',
    tab: 'ai',
    keywords: ['paste', 'clipboard', 'insert'],
    description: 'Paste from clipboard',
    action: (editor) => editor?.chain().focus().paste().run(),
  },
  {
    id: 'format-painter',
    name: 'Format Painter',
    category: 'Clipboard',
    tab: 'ai',
    keywords: ['format', 'painter', 'style', 'brush'],
    description: 'Copy formatting to other text',
  },
  {
    id: 'bold',
    name: 'Bold',
    category: 'Text Formatting',
    tab: 'ai',
    keywords: ['bold', 'strong', 'b', 'weight'],
    description: 'Make text bold (Ctrl+B)',
    action: (editor) => editor?.chain().focus().toggleBold().run(),
  },
  {
    id: 'italic',
    name: 'Italic',
    category: 'Text Formatting',
    tab: 'ai',
    keywords: ['italic', 'slant', 'i', 'emphasis'],
    description: 'Make text italic (Ctrl+I)',
    action: (editor) => editor?.chain().focus().toggleItalic().run(),
  },
  {
    id: 'underline',
    name: 'Underline',
    category: 'Text Formatting',
    tab: 'home',
    keywords: ['underline', 'u', 'beneath'],
    description: 'Underline text (Ctrl+U)',
    action: (editor) => editor?.chain().focus().toggleUnderline().run(),
  },
  {
    id: 'strikethrough',
    name: 'Strikethrough',
    category: 'Text Formatting',
    tab: 'home',
    keywords: ['strikethrough', 'strike', 'cross', 'line'],
    description: 'Strike through text',
    action: (editor) => editor?.chain().focus().toggleStrike().run(),
  },
  {
    id: 'superscript',
    name: 'Superscript',
    category: 'Text Formatting',
    tab: 'home',
    keywords: ['superscript', 'super', 'exponent', 'x2'],
    description: 'Raise text above baseline',
    action: (editor) => editor?.chain().focus().toggleSuperscript().run(),
  },
  {
    id: 'subscript',
    name: 'Subscript',
    category: 'Text Formatting',
    tab: 'home',
    keywords: ['subscript', 'sub', 'x2', 'lower'],
    description: 'Lower text below baseline',
    action: (editor) => editor?.chain().focus().toggleSubscript().run(),
  },
  {
    id: 'text-color',
    name: 'Text Color',
    category: 'Font',
    tab: 'home',
    keywords: ['color', 'text', 'font color', 'a'],
    description: 'Change text color',
  },
  {
    id: 'highlight-color',
    name: 'Highlight Color',
    category: 'Font',
    tab: 'home',
    keywords: ['highlight', 'color', 'marker', 'background'],
    description: 'Add highlighting to text',
  },
  {
    id: 'font-family',
    name: 'Font',
    category: 'Font',
    tab: 'home',
    keywords: ['font', 'typeface', 'family', 'style'],
    description: 'Change font family',
  },
  {
    id: 'font-size',
    name: 'Font Size',
    category: 'Font',
    tab: 'home',
    keywords: ['size', 'font size', 'points', 'pt'],
    description: 'Change font size',
  },
  {
    id: 'clear-formatting',
    name: 'Clear All Formatting',
    category: 'Font',
    tab: 'home',
    keywords: ['clear', 'formatting', 'reset', 'normal'],
    description: 'Remove all text formatting',
    action: (editor) => editor?.chain().focus().clearNodes().unsetAllMarks().run(),
  },
  {
    id: 'ai-pragna',
    name: 'Pragna AI Assistant',
    category: 'Pragna AI',
    tab: 'ai',
    keywords: ['pragna', 'ai', 'assistant', 'ask pragna', 'copilot', 'ollama'],
    description: 'Open the Pragna AI writing assistant',
    action: () => {
      useUIStore.getState().openPragna('ask');
    },
  },
  {
    id: 'ai-generate',
    name: 'Pragna Draft Generator',
    category: 'Pragna AI',
    tab: 'ai',
    keywords: ['pragna', 'ai', 'generate', 'content', 'draft', 'write', 'ollama'],
    description: 'Generate a full document draft with Pragna AI',
    action: () => {
      useUIStore.getState().openPragna('generate');
    },
  },
  {
    id: 'ai-summarize',
    name: 'Pragna Summarizer',
    category: 'Pragna AI',
    tab: 'ai',
    keywords: ['pragna', 'ai', 'summarize', 'summary', 'shorten', 'digest', 'ollama'],
    description: 'Summarize the selected text or document with Pragna AI',
    action: () => {
      useUIStore.getState().openPragna('summarize');
    },
  },
  {
    id: 'ai-grammar',
    name: 'Pragna Grammar & Polish',
    category: 'Pragna AI',
    tab: 'ai',
    keywords: ['pragna', 'ai', 'grammar', 'correct', 'proofread', 'fix text', 'polish', 'ollama'],
    description: 'Correct grammar, spelling, and polish style with Pragna AI',
    action: () => {
      useUIStore.getState().openPragna('grammar');
    },
  },
  {
    id: 'ai-rewrite',
    name: 'Pragna Rewrite Assistant',
    category: 'Pragna AI',
    tab: 'ai',
    keywords: ['pragna', 'ai', 'rewrite', 'rephrase', 'formal', 'short', 'persuasive', 'ollama'],
    description: 'Rewrite text in various tones with Pragna AI',
    action: () => {
      useUIStore.getState().openPragna('rewrite');
    },
  },
  {
    id: 'ai-title',
    name: 'Pragna Title Generator',
    category: 'Pragna AI',
    tab: 'ai',
    keywords: ['pragna', 'ai', 'title', 'headline', 'rename', 'ollama'],
    description: 'Generate a compelling document title with Pragna AI',
    action: () => {
      useUIStore.getState().openPragna('title');
    },
  },
  {
    id: 'ai-translate',
    name: 'Pragna Translation',
    category: 'Pragna AI',
    tab: 'ai',
    keywords: ['pragna', 'ai', 'translate', 'language', 'translate text', 'ollama'],
    description: 'Translate text to 20+ languages with Pragna AI',
    action: () => {
      useUIStore.getState().openPragna('translate');
    },
  },
  {
    id: 'ai-web-research',
    name: 'Pragna Web Research',
    category: 'Web Tools',
    tab: 'ai',
    keywords: ['pragna', 'web', 'research', 'search', 'live search', 'google news', 'arxiv', 'wikipedia', 'facts', 'citations'],
    description: 'Search the live web and synthesize findings with Pragna AI',
    action: () => {
      useUIStore.getState().openPragna('research');
    },
  },
  {
    id: 'ai-url-reader',
    name: 'Pragna URL Reader',
    category: 'Web Tools',
    tab: 'ai',
    keywords: ['pragna', 'url', 'web', 'link', 'article', 'webpage', 'fetch', 'summarize url', 'cite link'],
    description: 'Fetch and analyze any web page or article URL with Pragna AI',
    action: () => {
      useUIStore.getState().openPragna('urlReader');
    },
  },
  {
    id: 'bullet-list',
    name: 'Bullet List',
    category: 'Paragraph',
    tab: 'home',
    keywords: ['bullet', 'list', 'unordered', 'points'],
    description: 'Create a bulleted list',
    action: (editor) => editor?.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'numbered-list',
    name: 'Numbered List',
    category: 'Paragraph',
    tab: 'home',
    keywords: ['numbered', 'list', 'ordered', 'numbers'],
    description: 'Create a numbered list',
    action: (editor) => editor?.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'align-left',
    name: 'Align Left',
    category: 'Paragraph',
    tab: 'home',
    keywords: ['align', 'left', 'flush'],
    description: 'Align text to left',
    action: (editor) => editor?.chain().focus().setTextAlign('left').run(),
  },
  {
    id: 'align-center',
    name: 'Align Center',
    category: 'Paragraph',
    tab: 'home',
    keywords: ['align', 'center', 'middle'],
    description: 'Center text',
    action: (editor) => editor?.chain().focus().setTextAlign('center').run(),
  },
  {
    id: 'align-right',
    name: 'Align Right',
    category: 'Paragraph',
    tab: 'home',
    keywords: ['align', 'right', 'flush'],
    description: 'Align text to right',
    action: (editor) => editor?.chain().focus().setTextAlign('right').run(),
  },
  {
    id: 'align-justify',
    name: 'Justify',
    category: 'Paragraph',
    tab: 'home',
    keywords: ['justify', 'align', 'fill'],
    description: 'Justify text',
    action: (editor) => editor?.chain().focus().setTextAlign('justify').run(),
  },
  {
    id: 'line-spacing',
    name: 'Line Spacing',
    category: 'Paragraph',
    tab: 'home',
    keywords: ['line spacing', 'spacing', 'distance', 'leading'],
    description: 'Adjust line spacing',
  },
  {
    id: 'indent-increase',
    name: 'Increase Indent',
    category: 'Paragraph',
    tab: 'home',
    keywords: ['indent', 'increase', 'tab', 'right'],
    description: 'Increase paragraph indentation',
    action: (editor) => editor?.chain().focus().sinkListItem('listItem').run(),
  },
  {
    id: 'indent-decrease',
    name: 'Decrease Indent',
    category: 'Paragraph',
    tab: 'home',
    keywords: ['indent', 'decrease', 'dedent', 'left'],
    description: 'Decrease paragraph indentation',
    action: (editor) => editor?.chain().focus().liftListItem('listItem').run(),
  },

  // ═══ INSERT TAB ═══
  {
    id: 'insert-table',
    name: 'Table',
    category: 'Tables',
    tab: 'insert',
    keywords: ['table', 'insert', 'grid', 'cells'],
    description: 'Insert a table',
    dialog: 'insertTable',
  },
  {
    id: 'insert-image',
    name: 'Image',
    category: 'Illustrations',
    tab: 'insert',
    keywords: ['image', 'picture', 'photo', 'insert'],
    description: 'Insert an image',
    dialog: 'insertImage',
  },
  {
    id: 'insert-shape',
    name: 'Shape',
    category: 'Illustrations',
    tab: 'insert',
    keywords: ['shape', 'insert', 'drawing', 'figure'],
    description: 'Insert a shape',
    dialog: 'insertShape',
  },
  {
    id: 'insert-chart',
    name: 'Chart',
    category: 'Illustrations',
    tab: 'insert',
    keywords: ['chart', 'graph', 'insert', 'data'],
    description: 'Insert a chart',
    dialog: 'insertChart',
  },
  {
    id: 'insert-link',
    name: 'Link',
    category: 'Links',
    tab: 'insert',
    keywords: ['link', 'hyperlink', 'url', 'web'],
    description: 'Insert a link',
    dialog: 'insertLink',
  },
  {
    id: 'insert-symbol',
    name: 'Symbol',
    category: 'Symbols',
    tab: 'insert',
    keywords: ['symbol', 'special character', 'insert'],
    description: 'Insert a symbol or special character',
    dialog: 'insertSymbol',
  },
  {
    id: 'insert-equation',
    name: 'Equation',
    category: 'Symbols',
    tab: 'insert',
    keywords: ['equation', 'math', 'formula', 'insert'],
    description: 'Insert a mathematical equation',
    dialog: 'insertEquation',
  },
  {
    id: 'word-art',
    name: 'WordArt',
    category: 'Text Effects',
    tab: 'insert',
    keywords: ['wordart', 'art', 'text effect', 'style'],
    description: 'Insert stylized text (WordArt)',
    dialog: 'wordArt',
  },
  {
    id: 'page-break',
    name: 'Page Break',
    category: 'Pages',
    tab: 'insert',
    keywords: ['page break', 'break', 'new page'],
    description: 'Insert a page break',
    action: (editor) => editor?.chain().focus().setHardBreak().run(),
  },

  // ═══ LAYOUT TAB ═══
  {
    id: 'margins',
    name: 'Margins',
    category: 'Page Setup',
    tab: 'layout',
    keywords: ['margin', 'spacing', 'edge', 'page'],
    description: 'Set page margins',
  },
  {
    id: 'orientation',
    name: 'Orientation',
    category: 'Page Setup',
    tab: 'layout',
    keywords: ['orientation', 'landscape', 'portrait', 'page'],
    description: 'Change page orientation',
  },
  {
    id: 'page-size',
    name: 'Page Size',
    category: 'Page Setup',
    tab: 'layout',
    keywords: ['page size', 'paper', 'a4', 'letter'],
    description: 'Set page size and paper type',
  },

  // ═══ REVIEW TAB ═══
  {
    id: 'spelling-check',
    name: 'Spelling Check',
    category: 'Proofing',
    tab: 'review',
    keywords: ['spelling', 'check', 'spell', 'grammar'],
    description: 'Check spelling and grammar',
  },
  {
    id: 'thesaurus',
    name: 'Thesaurus',
    category: 'Proofing',
    tab: 'review',
    keywords: ['thesaurus', 'synonym', 'word', 'alternative'],
    description: 'Find synonyms and alternatives',
  },
  {
    id: 'track-changes',
    name: 'Track Changes',
    category: 'Changes',
    tab: 'review',
    keywords: ['track', 'changes', 'edit', 'revision'],
    description: 'Track document changes',
    dialog: 'trackChanges',
  },
  {
    id: 'comments',
    name: 'Comments',
    category: 'Comments',
    tab: 'review',
    keywords: ['comment', 'note', 'annotation', 'feedback'],
    description: 'Add or manage comments',
    dialog: 'comments',
  },
  {
    id: 'voice-typing',
    name: 'Voice Typing',
    category: 'Smart Features',
    tab: 'review',
    keywords: ['voice typing', 'dictate', 'speech to text', 'speech recognition'],
    description: 'Convert speech into text',
    action: (editor) => runDictation({ editor, toast: useUIStore.getState().toast }),
  },
  {
    id: 'text-to-speech',
    name: 'Text-to-Speech',
    category: 'Smart Features',
    tab: 'review',
    keywords: ['text to speech', 'tts', 'read aloud', 'listen'],
    description: 'Read the current text aloud',
    action: (editor) => runReadAloud({ editor, toast: useUIStore.getState().toast }),
  },
  {
    id: 'ocr-image-to-text',
    name: 'OCR (Image to Text)',
    category: 'Smart Features',
    tab: 'review',
    keywords: ['ocr', 'image to text', 'scan', 'extract text'],
    description: 'Extract text from an image',
    action: (editor) => runImageTextCapture({ editor, toast: useUIStore.getState().toast, mode: 'ocr' }),
  },
  {
    id: 'handwriting-recognition',
    name: 'Handwriting Recognition',
    category: 'Smart Features',
    tab: 'review',
    keywords: ['handwriting', 'notes', 'handwritten text', 'recognition'],
    description: 'Convert handwritten text into editable text',
    action: (editor) => runImageTextCapture({ editor, toast: useUIStore.getState().toast, mode: 'handwriting' }),
  },
  {
    id: 'smart-suggestions',
    name: 'Smart Suggestions',
    category: 'Smart Features',
    tab: 'review',
    keywords: ['smart suggestions', 'suggestions', 'ai help', 'rewrite', 'summarize'],
    description: 'Suggest useful AI edits for the current text',
    action: (editor) => runSmartSuggestions({ editor, toast: useUIStore.getState().toast }),
  },

  // ═══ VIEW TAB ═══
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'Zoom',
    tab: 'view',
    keywords: ['zoom', 'magnify', 'scale', 'percentage'],
    description: 'Zoom in or out',
  },
  {
    id: 'fullscreen',
    name: 'Full Screen',
    category: 'Views',
    tab: 'view',
    keywords: ['fullscreen', 'full screen', 'maximize'],
    description: 'Toggle fullscreen mode',
  },
  {
    id: 'show-formatting-marks',
    name: 'Show Formatting Marks',
    category: 'Show',
    tab: 'view',
    keywords: ['formatting marks', 'show', 'marks', 'hidden'],
    description: 'Display hidden formatting marks',
  },

  // ═══ REFERENCES TAB ═══
  {
    id: 'table-of-contents',
    name: 'Table of Contents',
    category: 'References',
    tab: 'reference',
    keywords: ['table of contents', 'toc', 'index'],
    description: 'Insert table of contents',
    dialog: 'referenceDialogs',
  },
  {
    id: 'citations',
    name: 'Citations',
    category: 'References',
    tab: 'reference',
    keywords: ['citation', 'source', 'reference', 'cite'],
    description: 'Insert a citation',
  },

  // ═══ MAILINGS TAB ═══
  {
    id: 'mail-merge',
    name: 'Mail Merge',
    category: 'Start Mail Merge',
    tab: 'mailings',
    keywords: ['mail merge', 'merge', 'mailing'],
    description: 'Start a mail merge',
    dialog: 'mailingsDialogs',
  },

  // ═══ HELP TAB ═══
  {
    id: 'about',
    name: 'About EtherX Word',
    category: 'Help',
    tab: 'help',
    keywords: ['about', 'version', 'info', 'etherx'],
    description: 'View version and information',
  },
  {
    id: 'help-search',
    name: 'Help Search',
    category: 'Help',
    tab: 'help',
    keywords: ['help', 'search', 'documentation', 'support'],
    description: 'Search help documentation',
  },
];

/**
 * Search through features by name, keywords, category, and description
 * @param {string} query - Search query
 * @returns {Array} Matching features
 */
export function searchFeatures(query) {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  return FEATURES.filter((feature) => {
    return (
      feature.name.toLowerCase().includes(lowerQuery) ||
      feature.description.toLowerCase().includes(lowerQuery) ||
      feature.category.toLowerCase().includes(lowerQuery) ||
      feature.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))
    );
  }).sort((a, b) => {
    // Prioritize name matches
    const aNameMatch = a.name.toLowerCase().startsWith(lowerQuery);
    const bNameMatch = b.name.toLowerCase().startsWith(lowerQuery);
    if (aNameMatch !== bNameMatch) return bNameMatch ? 1 : -1;
    return 0;
  });
}

/**
 * Get features by tab
 * @param {string} tabId - Tab ID
 * @returns {Array} Features in tab
 */
export function getFeaturesByTab(tabId) {
  return FEATURES.filter((f) => f.tab === tabId);
}

/**
 * Get features by category
 * @param {string} category - Category name
 * @returns {Array} Features in category
 */
export function getFeaturesByCategory(category) {
  return FEATURES.filter((f) => f.category === category);
}
