import { runDictation, runImageTextCapture, runReadAloud, runSmartSuggestions } from '@/utils/smartFeatures';
import { useUIStore } from '@/store';

export const DEFAULT_COMMANDS = [
  // ── HOME TAB: Clipboard ──
  {
    id: 'home-paste',
    title: 'Paste',
    tab: 'home',
    group: 'Clipboard',
    keywords: ['paste', 'clipboard', 'ctrl+v', 'insert text'],
    run: ({ editor, toast }) => {
      if (navigator.clipboard?.readText) {
        navigator.clipboard.readText().then((text) => {
          if (text && editor) editor.chain().focus().insertContent(text).run();
        }).catch(() => toast?.('Paste blocked by browser permissions. Press Ctrl+V.', 'warning'));
      } else {
        toast?.('Use Ctrl+V to paste', 'info');
      }
    },
  },
  {
    id: 'home-cut',
    title: 'Cut',
    tab: 'home',
    group: 'Clipboard',
    keywords: ['cut', 'clipboard', 'ctrl+x', 'remove selection'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ');
        navigator.clipboard?.writeText(text);
        editor.chain().focus().deleteSelection().run();
        toast?.('Text cut to clipboard', 'success');
      } else {
        toast?.('Select text first to cut', 'info');
      }
    },
  },
  {
    id: 'home-copy',
    title: 'Copy',
    tab: 'home',
    group: 'Clipboard',
    keywords: ['copy', 'clipboard', 'ctrl+c', 'duplicate text'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ');
        navigator.clipboard?.writeText(text);
        toast?.('Text copied to clipboard', 'success');
      } else {
        toast?.('Select text first to copy', 'info');
      }
    },
  },
  {
    id: 'home-fpaint',
    title: 'Format Painter',
    tab: 'home',
    group: 'Clipboard',
    keywords: ['format painter', 'formatting', 'paint format', 'copy style', 'brush'],
    run: ({ setActiveTab, toast }) => {
      setActiveTab?.('home');
      toast?.('Format Painter: Select text in document to copy format, or use brush in Home tab', 'info');
    },
  },
  {
    id: 'home-clipboard-history',
    title: 'Clipboard History',
    tab: 'home',
    group: 'Clipboard',
    keywords: ['clipboard history', 'clipboard', 'paste history', 'pastes', 'history drawer'],
    run: ({ openDialog }) => openDialog?.('clipboardHistory'),
  },

  // ── HOME TAB: Font & Formatting ──
  {
    id: 'home-bold',
    title: 'Bold',
    tab: 'home',
    group: 'Font',
    keywords: ['bold', 'strong', 'weight', 'ctrl+b', 'text style'],
    run: ({ editor }) => editor?.chain().focus().toggleBold().run(),
  },
  {
    id: 'home-italic',
    title: 'Italic',
    tab: 'home',
    group: 'Font',
    keywords: ['italic', 'slant', 'oblique', 'ctrl+i', 'text style'],
    run: ({ editor }) => editor?.chain().focus().toggleItalic().run(),
  },
  {
    id: 'home-underline',
    title: 'Underline',
    tab: 'home',
    group: 'Font',
    keywords: ['underline', 'underline text', 'ctrl+u', 'text style'],
    run: ({ editor }) => editor?.chain().focus().toggleUnderline().run(),
  },
  {
    id: 'home-strike',
    title: 'Strikethrough',
    tab: 'home',
    group: 'Font',
    keywords: ['strikethrough', 'strike', 'cross out', 'line through'],
    run: ({ editor }) => editor?.chain().focus().toggleStrike().run(),
  },
  {
    id: 'home-subscript',
    title: 'Subscript',
    tab: 'home',
    group: 'Font',
    keywords: ['subscript', 'sub', 'lower', 'baseline', 'h2o'],
    run: ({ editor }) => editor?.chain().focus().toggleSubscript().run(),
  },
  {
    id: 'home-superscript',
    title: 'Superscript',
    tab: 'home',
    group: 'Font',
    keywords: ['superscript', 'super', 'exponent', 'power', 'above'],
    run: ({ editor }) => editor?.chain().focus().toggleSuperscript().run(),
  },
  {
    id: 'home-clearfmt',
    title: 'Clear Formatting',
    tab: 'home',
    group: 'Font',
    keywords: ['clear formatting', 'remove formatting', 'reset format', 'plain text', 'clean formatting'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      editor.chain().focus().clearNodes().unsetAllMarks().run();
      editor.commands.unsetFontSize?.();
      editor.commands.unsetColor?.();
      toast?.('Formatting cleared', 'info');
    },
  },
  {
    id: 'home-growfont',
    title: 'Grow Font',
    tab: 'home',
    group: 'Font',
    keywords: ['grow font', 'increase font', 'bigger text', 'larger font', 'ctrl+shift+>'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const cur = parseInt(editor.getAttributes('textStyle')?.fontSize || '12', 10);
      const next = cur < 12 ? cur + 1 : cur < 28 ? cur + 2 : cur + 4;
      editor.chain().focus().setFontSize(`${next}pt`).run();
      toast?.(`Font size: ${next}pt`, 'info');
    },
  },
  {
    id: 'home-shrinkfont',
    title: 'Shrink Font',
    tab: 'home',
    group: 'Font',
    keywords: ['shrink font', 'decrease font', 'smaller text', 'reduce font', 'ctrl+shift+<'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const cur = parseInt(editor.getAttributes('textStyle')?.fontSize || '12', 10);
      const next = Math.max(8, cur <= 12 ? cur - 1 : cur <= 28 ? cur - 2 : cur - 4);
      editor.chain().focus().setFontSize(`${next}pt`).run();
      toast?.(`Font size: ${next}pt`, 'info');
    },
  },
  {
    id: 'home-fontsize',
    title: 'Font Size',
    tab: 'home',
    group: 'Font',
    keywords: ['font size', 'size', 'point size', 'pt', 'text size', 'change font size'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const cur = editor.getAttributes('textStyle')?.fontSize || '12';
      const val = window.prompt('Enter font size in points (e.g. 10, 11, 12, 14, 16, 18, 24, 32):', parseInt(cur, 10) || 12);
      if (val && !isNaN(val)) {
        editor.chain().focus().setFontSize(`${parseInt(val, 10)}pt`).run();
        toast?.(`Font size: ${parseInt(val, 10)}pt`, 'success');
      }
    },
  },
  {
    id: 'home-fontfamily',
    title: 'Font Family',
    tab: 'home',
    group: 'Font',
    keywords: ['font family', 'font', 'typeface', 'change font', 'fonts'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const val = window.prompt('Enter font family (Calibri, Arial, Times New Roman, Georgia, Garamond, Crimson Pro, Inter):', 'Calibri');
      if (val) {
        editor.chain().focus().setFontFamily(val).run();
        toast?.(`Font family: ${val}`, 'success');
      }
    },
  },
  {
    id: 'home-case',
    title: 'Change Case',
    tab: 'home',
    group: 'Font',
    keywords: ['change case', 'uppercase', 'lowercase', 'capitalize', 'title case', 'shift+f3'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      if (from === to) {
        toast?.('Select text to change case', 'info');
      } else {
        const text = editor.state.doc.textBetween(from, to);
        const next = text === text.toUpperCase()
          ? text.toLowerCase()
          : text === text.toLowerCase()
            ? text.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
            : text.toUpperCase();
        editor.chain().focus().insertContentAt({ from, to }, next).run();
        toast?.('Case changed', 'success');
      }
    },
  },
  {
    id: 'home-textcolor',
    title: 'Text Color',
    tab: 'home',
    group: 'Font',
    keywords: ['text color', 'font color', 'colour', 'font colour', 'color text'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const val = window.prompt('Enter text color (e.g. #d4af37, #ff4d4f, #1677ff, #52c41a, gold, red, blue):', '#c9a84c');
      if (val) {
        editor.chain().focus().setColor(val).run();
        toast?.(`Text color: ${val}`, 'success');
      }
    },
  },
  {
    id: 'home-highlight',
    title: 'Highlight Color',
    tab: 'home',
    group: 'Font',
    keywords: ['highlight', 'highlight color', 'marker', 'shading', 'text highlight', 'yellow highlight'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      if (editor.isActive('highlight')) {
        editor.chain().focus().unsetHighlight().run();
        toast?.('Highlight removed', 'info');
      } else {
        editor.chain().focus().toggleHighlight({ color: '#fff200' }).run();
        toast?.('Highlight applied', 'success');
      }
    },
  },

  // ── HOME TAB: Paragraph & Alignment ──
  {
    id: 'home-alignleft',
    title: 'Align Left',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['align left', 'left align', 'flush left', 'ctrl+l'],
    run: ({ editor }) => editor?.chain().focus().setTextAlign('left').run(),
  },
  {
    id: 'home-aligncenter',
    title: 'Align Center',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['align center', 'center', 'centered text', 'middle', 'ctrl+e'],
    run: ({ editor }) => editor?.chain().focus().setTextAlign('center').run(),
  },
  {
    id: 'home-alignright',
    title: 'Align Right',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['align right', 'right align', 'flush right', 'ctrl+r'],
    run: ({ editor }) => editor?.chain().focus().setTextAlign('right').run(),
  },
  {
    id: 'home-justify',
    title: 'Justify',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['justify', 'full justify', 'align justify', 'text justify', 'ctrl+j'],
    run: ({ editor }) => editor?.chain().focus().setTextAlign('justify').run(),
  },
  {
    id: 'home-bullets',
    title: 'Bullet List',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['bullet list', 'bullets', 'unordered list', 'bulleted list', 'points'],
    run: ({ editor }) => editor?.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'home-ordered',
    title: 'Numbered List',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['numbered list', 'ordered list', 'numbers', 'sequential list', 'ol'],
    run: ({ editor }) => editor?.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'home-tasklist',
    title: 'Task List',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['task list', 'checklist', 'todo', 'check box', 'interactive list'],
    run: ({ editor }) => editor?.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'home-blockquote',
    title: 'Blockquote',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['blockquote', 'quote', 'citation', 'pull quote'],
    run: ({ editor }) => editor?.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'home-indent',
    title: 'Increase Indent',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['increase indent', 'indent', 'indent right', 'tab'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      if (editor.isActive('listItem')) {
        editor.chain().focus().sinkListItem('listItem').run();
      } else {
        const paraAttrs = editor.getAttributes('paragraph') || {};
        const cur = parseInt((paraAttrs.style || '').match(/margin-left:\s*(\d+)px/)?.[1] || '0', 10);
        editor.chain().focus().updateAttributes('paragraph', { style: `margin-left:${cur + 40}px;` }).run();
        toast?.('Indent increased', 'info');
      }
    },
  },
  {
    id: 'home-outdent',
    title: 'Decrease Indent',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['decrease indent', 'outdent', 'indent left', 'shift+tab'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      if (editor.isActive('listItem')) {
        editor.chain().focus().liftListItem('listItem').run();
      } else {
        const paraAttrs = editor.getAttributes('paragraph') || {};
        const cur = parseInt((paraAttrs.style || '').match(/margin-left:\s*(\d+)px/)?.[1] || '0', 10);
        const next = Math.max(0, cur - 40);
        editor.chain().focus().updateAttributes('paragraph', { style: next > 0 ? `margin-left:${next}px;` : null }).run();
        toast?.('Indent decreased', 'info');
      }
    },
  },
  {
    id: 'home-linespace',
    title: 'Line Spacing',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['line spacing', 'spacing', 'line height', 'lead', 'double spacing'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const spacings = ['1', '1.15', '1.5', '2'];
      const current = editor.getAttributes('paragraph')?.style || '';
      const m = current.match(/line-height:\s*([0-9.]+)/i);
      const cur = m ? m[1] : '1';
      const idx = spacings.indexOf(cur);
      const next = spacings[(idx + 1) % spacings.length];
      editor.chain().focus().updateAttributes('paragraph', { style: `line-height:${next};` }).run();
      toast?.(`Line spacing: ${next}`, 'success');
    },
  },
  {
    id: 'home-formatmarks',
    title: 'Show Formatting Marks',
    tab: 'home',
    group: 'Paragraph',
    keywords: ['formatting marks', 'pilcrow', 'show hidden characters', 'paragraph symbol', '¶'],
    run: ({ toggleFormattingMarks, toast }) => {
      toggleFormattingMarks?.();
      toast?.('Formatting marks toggled', 'info');
    },
  },

  // ── HOME TAB: Styles ──
  {
    id: 'home-style-normal',
    title: 'Normal Style',
    tab: 'home',
    group: 'Styles',
    keywords: ['normal style', 'paragraph style', 'body text', 'reset style'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      editor.chain().focus().setParagraph().unsetAllMarks().run();
      editor.commands.unsetFontSize?.();
      editor.commands.unsetColor?.();
      toast?.('Applied Normal style', 'info');
    },
  },
  {
    id: 'home-style-h1',
    title: 'Heading 1',
    tab: 'home',
    group: 'Styles',
    keywords: ['heading 1', 'h1', 'title', 'section header', 'main heading'],
    run: ({ editor, toast }) => {
      editor?.chain().focus().setHeading({ level: 1 }).run();
      toast?.('Applied Heading 1', 'info');
    },
  },
  {
    id: 'home-style-h2',
    title: 'Heading 2',
    tab: 'home',
    group: 'Styles',
    keywords: ['heading 2', 'h2', 'subtitle', 'sub section heading'],
    run: ({ editor, toast }) => {
      editor?.chain().focus().setHeading({ level: 2 }).run();
      toast?.('Applied Heading 2', 'info');
    },
  },
  {
    id: 'home-style-title',
    title: 'Title Style',
    tab: 'home',
    group: 'Styles',
    keywords: ['title style', 'document title', 'big heading', 'headline'],
    run: ({ editor, toast }) => {
      editor?.chain().focus().setHeading({ level: 1 }).setFontSize('24pt').run();
      toast?.('Applied Title style', 'info');
    },
  },
  {
    id: 'home-styleinspector',
    title: 'Style Inspector & Formatting',
    tab: 'home',
    group: 'Styles',
    keywords: ['style inspector', 'styles', 'clear formatting', 'inspect styles'],
    run: ({ openDialog }) => openDialog?.('styleInspector'),
  },

  // ── HOME TAB: Editing & Tools ──
  {
    id: 'home-undo',
    title: 'Undo',
    tab: 'home',
    group: 'Editing',
    keywords: ['undo', 'reverse', 'ctrl+z', 'step back'],
    run: ({ editor }) => editor?.chain().focus().undo().run(),
  },
  {
    id: 'home-redo',
    title: 'Redo',
    tab: 'home',
    group: 'Editing',
    keywords: ['redo', 'reapply', 'ctrl+y', 'step forward'],
    run: ({ editor }) => editor?.chain().focus().redo().run(),
  },
  {
    id: 'home-find',
    title: 'Find & Replace',
    tab: 'home',
    group: 'Editing',
    keywords: ['find', 'replace', 'search text', 'find and replace', 'ctrl+f', 'ctrl+h'],
    run: ({ openDialog }) => openDialog?.('findReplace'),
  },
  {
    id: 'home-selectall',
    title: 'Select All',
    tab: 'home',
    group: 'Editing',
    keywords: ['select all', 'select everything', 'ctrl+a'],
    run: ({ editor }) => editor?.chain().focus().selectAll().run(),
  },

  // ── PRAGNA AI COPILOT ──
  {
    id: 'home-ai-pragna',
    title: 'Pragna AI (Copilot)',
    tab: 'ai',
    group: 'Pragna AI',
    keywords: ['pragna', 'copilot', 'ai', 'assistant', 'chat', 'ask pragna', 'alt+i', 'gemini', 'ollama'],
    run: ({ openPragna }) => openPragna?.('ask'),
  },
  {
    id: 'home-ai-edit',
    title: 'Pragna Edit as Instructed',
    tab: 'ai',
    group: 'Pragna AI',
    keywords: ['pragna edit', 'edit selection', 'instruction', 'custom edit', 'rewrite as instructed'],
    run: ({ openPragna }) => openPragna?.('edit'),
  },
  {
    id: 'home-ai-generate',
    title: 'Pragna Draft Generator',
    tab: 'ai',
    group: 'Pragna AI',
    keywords: ['pragna draft', 'generate draft', 'ai write', 'generate content', 'draft generator'],
    run: ({ openPragna }) => openPragna?.('generate'),
  },
  {
    id: 'home-ai-summarize',
    title: 'Pragna Summarizer',
    tab: 'ai',
    group: 'Pragna AI',
    keywords: ['pragna summarize', 'summarizer', 'summary', 'shorten', 'digest'],
    run: ({ openPragna }) => openPragna?.('summarize'),
  },
  {
    id: 'home-ai-grammar',
    title: 'Pragna Grammar & Polish',
    tab: 'ai',
    group: 'Pragna AI',
    keywords: ['pragna grammar', 'grammar check', 'correct grammar', 'proofread', 'polish'],
    run: ({ openPragna }) => openPragna?.('grammar'),
  },
  {
    id: 'home-ai-rewrite',
    title: 'Pragna Rewrite Assistant',
    tab: 'ai',
    group: 'Pragna AI',
    keywords: ['pragna rewrite', 'rewrite assistant', 'rephrase', 'formal tone', 'persuasive'],
    run: ({ openPragna }) => openPragna?.('rewrite'),
  },
  {
    id: 'home-ai-title',
    title: 'Pragna Title Generator',
    tab: 'ai',
    group: 'Pragna AI',
    keywords: ['pragna title', 'title generator', 'headline', 'rename document'],
    run: ({ openPragna }) => openPragna?.('title'),
  },
  {
    id: 'home-ai-translate',
    title: 'Pragna Translation',
    tab: 'ai',
    group: 'Pragna AI',
    keywords: ['pragna translate', 'translation', 'translate language', 'ai translate'],
    run: ({ openPragna }) => openPragna?.('translate'),
  },
  {
    id: 'home-ai-web-research',
    title: 'Pragna Web Research',
    tab: 'ai',
    group: 'Pragna AI',
    keywords: ['pragna web research', 'web research', 'live search', 'google news', 'arxiv', 'wikipedia'],
    run: ({ openPragna }) => openPragna?.('research'),
  },
  {
    id: 'home-ai-url-reader',
    title: 'Pragna URL Reader',
    tab: 'ai',
    group: 'Pragna AI',
    keywords: ['pragna url reader', 'url reader', 'summarize url', 'fetch link', 'article summarizer'],
    run: ({ openPragna }) => openPragna?.('urlReader'),
  },

  // ── INSERT TAB ──
  {
    id: 'ins-table',
    title: 'Insert Table',
    tab: 'insert',
    group: 'Tables',
    keywords: ['table', 'insert table', 'grid', 'rows and columns', 'tabular'],
    run: ({ openDialog }) => openDialog?.('insertTable'),
  },
  {
    id: 'ins-pictures',
    title: 'Insert Picture',
    tab: 'insert',
    group: 'Illustrations',
    keywords: ['picture', 'image', 'photo', 'insert image', 'upload photo', 'insert pictures'],
    run: ({ openDialog }) => openDialog?.('insertImage'),
  },
  {
    id: 'ins-shapes',
    title: 'Insert Shapes',
    tab: 'insert',
    group: 'Illustrations',
    keywords: ['shape', 'insert shape', 'vector', 'drawing', 'rectangle', 'circle', 'arrow'],
    run: ({ openDialog }) => openDialog?.('insertShape'),
  },
  {
    id: 'ins-icons',
    title: 'Insert Icons',
    tab: 'insert',
    group: 'Illustrations',
    keywords: ['icon', 'insert icon', 'vector icon', 'symbols icon'],
    run: ({ openDialog }) => openDialog?.('insertSymbol'),
  },
  {
    id: 'ins-3d',
    title: 'Insert 3D Models',
    tab: 'insert',
    group: 'Illustrations',
    keywords: ['3d model', '3d', 'model', 'mesh'],
    run: ({ openDialog }) => openDialog?.('insertImage'),
  },
  {
    id: 'ins-smartart',
    title: 'Insert SmartArt',
    tab: 'insert',
    group: 'Illustrations',
    keywords: ['smartart', 'diagram', 'flowchart', 'smart art'],
    run: ({ openDialog }) => openDialog?.('insertShape'),
  },
  {
    id: 'ins-chart',
    title: 'Insert Chart',
    tab: 'insert',
    group: 'Illustrations',
    keywords: ['chart', 'graph', 'insert chart', 'bar chart', 'pie chart', 'visualization'],
    run: ({ openDialog }) => openDialog?.('insertChart'),
  },
  {
    id: 'ins-screenshot',
    title: 'Insert Screenshot',
    tab: 'insert',
    group: 'Illustrations',
    keywords: ['screenshot', 'screen capture', 'snip', 'capture window'],
    run: ({ openDialog }) => openDialog?.('screenshot'),
  },
  {
    id: 'ins-link',
    title: 'Insert Link',
    tab: 'insert',
    group: 'Links & Comments',
    keywords: ['link', 'hyperlink', 'url', 'insert link', 'web link', 'ctrl+k'],
    run: ({ openDialog }) => openDialog?.('insertLink'),
  },
  {
    id: 'ins-onlinevideo',
    title: 'Insert Online Video',
    tab: 'insert',
    group: 'Media',
    keywords: ['video', 'online video', 'embed video', 'youtube'],
    run: ({ openDialog }) => openDialog?.('insertLink'),
  },
  {
    id: 'ins-bookmark',
    title: 'Insert Bookmark',
    tab: 'insert',
    group: 'Links & Comments',
    keywords: ['bookmark', 'mark position', 'anchor', 'page bookmark'],
    run: ({ openDialog }) => openDialog?.('bookmark'),
  },
  {
    id: 'ins-crossref',
    title: 'Insert Cross-Reference',
    tab: 'insert',
    group: 'Links & Comments',
    keywords: ['cross reference', 'crossref', 'reference item', 'linked heading'],
    run: ({ openDialog }) => openDialog?.('crossReference'),
  },
  {
    id: 'ins-comment',
    title: 'Insert Comment',
    tab: 'insert',
    group: 'Links & Comments',
    keywords: ['comment', 'new comment', 'note', 'margin comment', 'ctrl+alt+m'],
    run: ({ openDialog }) => openDialog?.('comments'),
  },
  {
    id: 'ins-header',
    title: 'Insert Header',
    tab: 'insert',
    group: 'Header & Footer',
    keywords: ['header', 'page header', 'top margin', 'edit header'],
    run: ({ setHeaderFooterTab, openDialog }) => {
      setHeaderFooterTab?.('header');
      openDialog?.('headerFooter');
    },
  },
  {
    id: 'ins-footer',
    title: 'Insert Footer',
    tab: 'insert',
    group: 'Header & Footer',
    keywords: ['footer', 'page footer', 'bottom margin', 'edit footer'],
    run: ({ setHeaderFooterTab, openDialog }) => {
      setHeaderFooterTab?.('footer');
      openDialog?.('headerFooter');
    },
  },
  {
    id: 'ins-pagenum',
    title: 'Insert Page Number',
    tab: 'insert',
    group: 'Header & Footer',
    keywords: ['page number', 'page numbers', 'pagination', 'page #'],
    run: ({ setHeaderFooterTab, openDialog }) => {
      setHeaderFooterTab?.('pagenum');
      openDialog?.('headerFooter');
    },
  },
  {
    id: 'ins-coverpage',
    title: 'Cover Page',
    tab: 'insert',
    group: 'Pages',
    keywords: ['cover page', 'title page', 'cover template', 'front page'],
    run: ({ openDialog }) => openDialog?.('templates'),
  },
  {
    id: 'ins-blankpage',
    title: 'Blank Page',
    tab: 'insert',
    group: 'Pages',
    keywords: ['blank page', 'new page', 'insert page'],
    run: ({ editor, toast }) => {
      editor?.chain().focus().insertContent('<p></p>').run();
      toast?.('Blank page inserted', 'success');
    },
  },
  {
    id: 'ins-pagebreak',
    title: 'Page Break',
    tab: 'insert',
    group: 'Pages',
    keywords: ['page break', 'break page', 'ctrl+enter', 'split page'],
    run: ({ editor, toast }) => {
      editor?.chain().focus().insertPageBreak().run();
      toast?.('Page break inserted', 'success');
    },
  },
  {
    id: 'ins-textbox',
    title: 'Insert Text Box',
    tab: 'insert',
    group: 'Text',
    keywords: ['text box', 'textbox', 'callout', 'box text'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const boxId = `textbox-${Date.now()}`;
      editor.chain().focus().insertContent(`<div id="${boxId}" style="border:2px solid #4472c4;border-radius:4px;padding:12px;margin:8px 0;background:#f0f7ff;cursor:text;min-width:200px;min-height:60px;" contenteditable="true" data-textbox="true"><span style="color:#999;font-style:italic;">Click to type</span></div>`).run();
      toast?.('Text box inserted', 'success');
    },
  },
  {
    id: 'ins-wordart',
    title: 'WordArt',
    tab: 'insert',
    group: 'Text',
    keywords: ['wordart', 'word art', 'text art', 'stylized text', 'gradient text'],
    run: ({ openDialog }) => openDialog?.('wordArt'),
  },
  {
    id: 'ins-dropcap',
    title: 'Drop Cap',
    tab: 'insert',
    group: 'Text',
    keywords: ['drop cap', 'large letter', 'initial cap', 'decorative letter'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      const { $from } = editor.state.selection;
      const start = $from.start($from.depth);
      const paragraphText = $from.parent.textContent || '';
      const first = paragraphText[0];
      if (first) {
        editor.chain().focus().insertContentAt({ from: start, to: start + 1 }, `<span style="float:left;font-size:2.4em;line-height:0.9;padding-right:4px;font-family:serif;">${first}</span>`).run();
        toast?.('Drop cap applied', 'success');
      } else {
        toast?.('Place cursor inside a paragraph with text', 'info');
      }
    },
  },
  {
    id: 'ins-datetime',
    title: 'Date & Time',
    tab: 'insert',
    group: 'Text',
    keywords: ['date', 'time', 'datetime', 'timestamp', 'insert date'],
    run: ({ editor, toast }) => {
      const d = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      editor?.chain().focus().insertContent(d).run();
      toast?.(`Inserted date: ${d}`, 'success');
    },
  },
  {
    id: 'ins-quickparts',
    title: 'Quick Parts',
    tab: 'insert',
    group: 'Text',
    keywords: ['quick parts', 'autotext', 'snippets', 'building blocks'],
    run: ({ openDialog }) => openDialog?.('buildingBlocks'),
  },
  {
    id: 'ins-buildingblocks',
    title: 'Building Blocks & AutoText',
    tab: 'insert',
    group: 'Text',
    keywords: ['building blocks', 'autotext', 'snippets', 'quick parts', 'reusable content'],
    run: ({ openDialog }) => openDialog?.('buildingBlocks'),
  },
  {
    id: 'ins-signature',
    title: 'Signature Line',
    tab: 'insert',
    group: 'Text',
    keywords: ['signature', 'esig', 'signature line', 'sign', 'digital signature'],
    run: ({ openDialog }) => openDialog?.('digitalSignature'),
  },
  {
    id: 'ins-equation',
    title: 'Insert Equation',
    tab: 'insert',
    group: 'Symbols',
    keywords: ['equation', 'math', 'formula', 'latex', 'math symbols', 'sigma'],
    run: ({ openDialog }) => openDialog?.('equation'),
  },
  {
    id: 'ins-symbol',
    title: 'Insert Symbol',
    tab: 'insert',
    group: 'Symbols',
    keywords: ['symbol', 'special character', 'unicode', 'omega', 'greek letters', 'insert symbol'],
    run: ({ openDialog }) => openDialog?.('insertSymbol'),
  },
  {
    id: 'ins-digital-sign',
    title: 'Digital Sign',
    tab: 'insert',
    group: 'Digital Signatures',
    keywords: ['digital sign', 'digital signature', 'sign document', 'crypto sign', 'sign'],
    run: ({ openDialog }) => openDialog?.('digitalSignature'),
  },
  {
    id: 'ins-sig-field',
    title: 'Signature Field',
    tab: 'insert',
    group: 'Digital Signatures',
    keywords: ['signature field', 'sig field', 'insert signature', 'sign line', 'signature line'],
    run: ({ editor, toast }) => {
      editor?.chain().focus().insertContent('<div style="display:inline-block;border-bottom:2px solid #666;width:220px;padding:4px 8px;margin:8px 0;font-size:12px;color:#888;">Sign here: _____________________</div>').run();
      toast?.('Signature field inserted', 'success');
    },
  },
  {
    id: 'ins-esign',
    title: 'eSignature Fields',
    tab: 'insert',
    group: 'Digital Signatures',
    keywords: ['esign', 'e-signature', 'esignature', 'signature table', 'multi party signature', 'esign table'],
    run: ({ editor, toast }) => {
      editor?.chain().focus().insertContent(`
        <table style="border-collapse:collapse;width:100%;margin:8px 0;">
          <tr>
            <td style="border:1px solid #d4d4d4;padding:8px;">Signer Name</td>
            <td style="border:1px solid #d4d4d4;padding:8px;">Signature</td>
            <td style="border:1px solid #d4d4d4;padding:8px;">Date</td>
          </tr>
        </table>
      `).run();
      toast?.('eSignature fields inserted', 'success');
    },
  },

  // ── DRAW TAB ──
  {
    id: 'draw-draw',
    title: 'Draw',
    tab: 'draw',
    group: 'Drawing Tools',
    keywords: ['draw', 'drawing', 'canvas', 'freehand', 'sketch', 'inking'],
    run: ({ setDrawTool, openDialog, toast }) => {
      setDrawTool?.('pen');
      openDialog?.('drawing');
      toast?.('Drawing canvas opened', 'info');
    },
  },
  {
    id: 'draw-pen',
    title: 'Pen',
    tab: 'draw',
    group: 'Drawing Tools',
    keywords: ['pen', 'pen tool', 'ballpoint', 'inking', 'drawing pen'],
    run: ({ setDrawTool, openDialog, toast }) => {
      setDrawTool?.('pen');
      openDialog?.('drawing');
      toast?.('Pen tool activated', 'info');
    },
  },
  {
    id: 'draw-highlight',
    title: 'Highlighter',
    tab: 'draw',
    group: 'Drawing Tools',
    keywords: ['highlighter', 'highlight ink', 'felt pen', 'marker draw'],
    run: ({ setDrawTool, openDialog, toast }) => {
      setDrawTool?.('highlighter');
      openDialog?.('drawing');
      toast?.('Highlighter tool activated', 'info');
    },
  },
  {
    id: 'draw-eraser',
    title: 'Eraser',
    tab: 'draw',
    group: 'Drawing Tools',
    keywords: ['eraser', 'eraser tool', 'clear ink', 'remove drawing', 'erase'],
    run: ({ setDrawTool, openDialog, toast }) => {
      setDrawTool?.('eraser');
      openDialog?.('drawing');
      toast?.('Eraser tool activated', 'info');
    },
  },

  // ── LAYOUT TAB ──
  {
    id: 'layout-margins',
    title: 'Set Margins',
    tab: 'layout',
    group: 'Page Setup',
    keywords: ['margins', 'page margin', 'margin setup', 'narrow margins', 'wide margins', 'page setup'],
    run: ({ openDialog }) => openDialog?.('pageSetup'),
  },
  {
    id: 'layout-orientation',
    title: 'Orientation',
    tab: 'layout',
    group: 'Page Setup',
    keywords: ['orientation', 'portrait', 'landscape', 'rotate page', 'page orientation'],
    run: ({ setPageOrientation, pageOrientation, toast }) => {
      const next = pageOrientation === 'portrait' ? 'landscape' : 'portrait';
      setPageOrientation?.(next);
      toast?.(`Orientation set to ${next}`, 'success');
    },
  },
  {
    id: 'layout-pagesize',
    title: 'Page Size',
    tab: 'layout',
    group: 'Page Setup',
    keywords: ['page size', 'paper size', 'a4', 'letter', 'legal', 'a3'],
    run: ({ openDialog }) => openDialog?.('pageSetup'),
  },
  {
    id: 'layout-columns',
    title: 'Set Columns',
    tab: 'layout',
    group: 'Page Setup',
    keywords: ['columns', 'column layout', 'multi column', 'two columns', 'three columns'],
    run: ({ openDialog }) => openDialog?.('pageSetup'),
  },
  {
    id: 'layout-breaks',
    title: 'Page Breaks',
    tab: 'layout',
    group: 'Page Setup',
    keywords: ['page break', 'section break', 'breaks', 'break page'],
    run: ({ editor, toast }) => {
      editor?.chain().focus().insertPageBreak().run();
      toast?.('Page break inserted', 'success');
    },
  },
  {
    id: 'layout-linenum',
    title: 'Line Numbers',
    tab: 'layout',
    group: 'Page Setup',
    keywords: ['line numbers', 'lines', 'numbered lines', 'show line numbers'],
    run: ({ toast }) => {
      const pm = document.querySelector('.ProseMirror');
      if (pm) {
        const next = !pm.classList.contains('etherx-line-numbers');
        pm.classList.toggle('etherx-line-numbers', next);
        toast?.(next ? 'Line numbers turned on' : 'Line numbers turned off', 'info');
      }
    },
  },
  {
    id: 'layout-hyphen',
    title: 'Hyphenation',
    tab: 'layout',
    group: 'Page Setup',
    keywords: ['hyphenation', 'hyphenate', 'auto hyphenate', 'hyphen'],
    run: ({ toast }) => {
      const pm = document.querySelector('.ProseMirror');
      if (pm) {
        const next = pm.style.hyphens !== 'auto';
        pm.style.hyphens = next ? 'auto' : 'manual';
        pm.lang = next ? 'en' : '';
        toast?.(next ? 'Hyphenation turned on' : 'Hyphenation turned off', 'info');
      }
    },
  },
  {
    id: 'layout-alignimg',
    title: 'Align Image',
    tab: 'layout',
    group: 'Arrange',
    keywords: ['align image', 'image alignment', 'center picture', 'align picture'],
    run: ({ editor, toast }) => {
      if (editor?.isActive('image')) {
        editor.chain().focus().updateAttributes('image', { style: 'display:block;margin:12px auto;' }).run();
        toast?.('Image centered', 'success');
      } else {
        toast?.('Select an image to align', 'info');
      }
    },
  },
  {
    id: 'layout-wrap',
    title: 'Wrap Text',
    tab: 'layout',
    group: 'Arrange',
    keywords: ['wrap text', 'text wrap', 'float image', 'inline image'],
    run: ({ editor, toast }) => {
      if (editor?.isActive('image')) {
        editor.chain().focus().updateAttributes('image', { style: 'float:left;margin:8px 16px 8px 0;' }).run();
        toast?.('Text wrap: left', 'success');
      } else {
        toast?.('Select an image first', 'info');
      }
    },
  },
  {
    id: 'layout-size',
    title: 'Resize Image',
    tab: 'layout',
    group: 'Arrange',
    keywords: ['resize image', 'image size', 'scale picture', 'larger picture'],
    run: ({ editor, toast }) => {
      if (editor?.isActive('image')) {
        const w = parseInt(String(editor.getAttributes('image')?.width || '280'), 10);
        editor.chain().focus().updateAttributes('image', { width: String(w + 40) }).run();
        toast?.(`Image resized to ${w + 40}px`, 'success');
      } else {
        toast?.('Select an image first', 'info');
      }
    },
  },
  {
    id: 'layout-removeimg',
    title: 'Remove Image',
    tab: 'layout',
    group: 'Arrange',
    keywords: ['remove image', 'delete image', 'remove picture', 'delete picture'],
    run: ({ editor, toast }) => {
      if (editor?.isActive('image')) {
        editor.chain().focus().deleteSelection().run();
        toast?.('Image removed', 'success');
      } else {
        toast?.('Select an image first', 'info');
      }
    },
  },
  {
    id: 'layout-rotate',
    title: 'Rotate Object',
    tab: 'layout',
    group: 'Arrange',
    keywords: ['rotate', 'rotate image', 'rotation', 'turn picture'],
    run: ({ editor, toast }) => {
      if (editor?.isActive('image')) {
        const cur = parseInt(String(editor.getAttributes('image')?.rotate || '0'), 10);
        const next = (cur + 15) % 360;
        editor.chain().focus().updateAttributes('image', { rotate: String(next), style: `transform:rotate(${next}deg);` }).run();
        toast?.(`Rotated 15° (now ${next}°)`, 'success');
      } else {
        toast?.('Select an image first', 'info');
      }
    },
  },
  {
    id: 'layout-selectionpane',
    title: 'Selection Pane',
    tab: 'layout',
    group: 'Arrange',
    keywords: ['selection pane', 'sidebar', 'navigate objects', 'navigation pane'],
    run: ({ toggleSidebar, toast }) => {
      toggleSidebar?.();
      toast?.('Selection Pane / Sidebar toggled', 'info');
    },
  },
  {
    id: 'layout-masterdoc',
    title: 'Master Document & Subdocuments',
    tab: 'layout',
    group: 'Structure',
    keywords: ['master document', 'subdocuments', 'chapters', 'compose', 'book layout'],
    run: ({ openDialog }) => openDialog?.('masterDoc'),
  },

  // ── REFERENCE TAB ──
  {
    id: 'ref-toc',
    title: 'Table of Contents',
    tab: 'reference',
    group: 'Table of Contents',
    keywords: ['toc', 'table of contents', 'contents', 'outline', 'document index'],
    run: ({ openDialog }) => openDialog?.('tableOfContents'),
  },
  {
    id: 'ref-footnotes',
    title: 'Footnotes',
    tab: 'reference',
    group: 'Footnotes',
    keywords: ['footnotes', 'footnote', 'bottom note', 'insert footnote', 'alt+ctrl+f'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      editor.chain().focus().insertContent('<sup data-etherx-footnote="true">[1]</sup><div data-etherx-footnote-text="true" style="margin-top:8px;font-size:12px;color:var(--text-muted);">1. Footnote: Enter note here</div>').run();
      toast?.('Footnote inserted', 'success');
    },
  },
  {
    id: 'ref-endnotes',
    title: 'Endnotes',
    tab: 'reference',
    group: 'Footnotes',
    keywords: ['endnotes', 'endnote', 'end note', 'insert endnote', 'alt+ctrl+d'],
    run: ({ editor, toast }) => {
      if (!editor) return;
      editor.chain().focus().insertContent('<sup data-etherx-endnote="true">[a]</sup><div data-etherx-endnote-text="true" style="margin-top:8px;font-size:12px;color:var(--text-muted);">[a] Endnote: Enter endnote here</div>').run();
      toast?.('Endnote inserted', 'success');
    },
  },
  {
    id: 'ref-citation',
    title: 'Insert Citation',
    tab: 'reference',
    group: 'Citations & Bibliography',
    keywords: ['citation', 'cite', 'bibliography', 'insert citation', 'apa', 'mla'],
    run: ({ openDialog }) => openDialog?.('insertCitation'),
  },
  {
    id: 'ref-manage-sources',
    title: 'Manage Sources',
    tab: 'reference',
    group: 'Citations & Bibliography',
    keywords: ['manage sources', 'sources', 'citation manager', 'references list', 'sources manager'],
    run: ({ openDialog }) => openDialog?.('manageSources'),
  },
  {
    id: 'ref-bibliography',
    title: 'Bibliography',
    tab: 'reference',
    group: 'Citations & Bibliography',
    keywords: ['bibliography', 'works cited', 'references', 'insert bibliography', 'citations list'],
    run: ({ openDialog }) => openDialog?.('bibliography'),
  },
  {
    id: 'ref-citation-fact-check',
    title: 'Citation Fact Check',
    tab: 'reference',
    group: 'Citations & Bibliography',
    keywords: ['citation fact check', 'fact check', 'verify citation', 'check citations', 'source verification'],
    run: ({ openDialog }) => openDialog?.('citationFactCheck'),
  },
  {
    id: 'ref-captions',
    title: 'Insert Captions',
    tab: 'reference',
    group: 'Captions',
    keywords: ['caption', 'figure caption', 'table caption', 'insert caption'],
    run: ({ editor, toast }) => {
      const text = window.prompt('Enter figure/table caption text:', 'Figure 1: Description');
      if (text && editor) {
        editor.chain().focus().insertContent(`<p data-caption="true" style="font-size:12px;font-weight:600;color:var(--gold);text-align:center;margin:6px 0;"><em>${text}</em></p>`).run();
        toast?.('Caption inserted', 'success');
      }
    },
  },
  {
    id: 'ref-index',
    title: 'Mark Entry / Index',
    tab: 'reference',
    group: 'Index',
    keywords: ['index', 'mark entry', 'insert index', 'index entries', 'keywords index'],
    run: ({ openDialog }) => openDialog?.('insertIndex'),
  },
  {
    id: 'ref-tbloffigs',
    title: 'Table of Figures',
    tab: 'reference',
    group: 'Table of Figures',
    keywords: ['table of figures', 'figures list', 'tof', 'illustrations list'],
    run: ({ openDialog }) => openDialog?.('tableOfFigures'),
  },
  {
    id: 'ref-table-of-tables',
    title: 'Table of Tables',
    tab: 'reference',
    group: 'Table of Figures',
    keywords: ['table of tables', 'tables index', 'list of tables', 'tot'],
    run: ({ openDialog }) => openDialog?.('tableOfTables'),
  },

  // ── MAILINGS TAB ──
  {
    id: 'mail-envelopes',
    title: 'Envelopes',
    tab: 'mailings',
    group: 'Create',
    keywords: ['envelope', 'envelopes', 'mail envelope', 'addressee', 'postage'],
    run: ({ openDialog }) => openDialog?.('envelopes'),
  },
  {
    id: 'mail-labels',
    title: 'Labels',
    tab: 'mailings',
    group: 'Create',
    keywords: ['labels', 'mailing labels', 'address label', 'shipping label'],
    run: ({ openDialog }) => openDialog?.('labels'),
  },
  {
    id: 'mail-start_mailmerge',
    title: 'Start Mail Merge',
    tab: 'mailings',
    group: 'Start Mail Merge',
    keywords: ['mail merge', 'merge', 'merge mail', 'start mail merge'],
    run: ({ openDialog }) => openDialog?.('mailMerge'),
  },
  {
    id: 'mail-select-recipients',
    title: 'Select Recipients',
    tab: 'mailings',
    group: 'Start Mail Merge',
    keywords: ['select recipients', 'recipients', 'import recipients', 'contacts', 'csv recipients'],
    run: ({ openDialog }) => openDialog?.('selectRecipients'),
  },
  {
    id: 'mail-edit-recipients',
    title: 'Edit Recipient List',
    tab: 'mailings',
    group: 'Start Mail Merge',
    keywords: ['edit recipients', 'edit recipient list', 'manage recipients', 'recipient list'],
    run: ({ openDialog }) => openDialog?.('editRecipients'),
  },
  {
    id: 'mail-insert-merge-field',
    title: 'Insert Merge Field',
    tab: 'mailings',
    group: 'Write & Insert Fields',
    keywords: ['insert merge field', 'merge field', 'field', 'mail field', 'recipient field'],
    run: ({ openDialog }) => openDialog?.('insertMergeField'),
  },
  {
    id: 'mail-greeting-line',
    title: 'Greeting Line',
    tab: 'mailings',
    group: 'Write & Insert Fields',
    keywords: ['greeting line', 'greeting', 'dear sir', 'insert greeting', 'salutation'],
    run: ({ openDialog }) => openDialog?.('greetingLine'),
  },
  {
    id: 'mail-preview_results',
    title: 'Preview Results',
    tab: 'mailings',
    group: 'Preview Results',
    keywords: ['preview mail merge', 'preview results', 'check merge'],
    run: ({ openDialog }) => openDialog?.('finishMerge'),
  },
  {
    id: 'mail-finish',
    title: 'Finish & Merge',
    tab: 'mailings',
    group: 'Finish',
    keywords: ['finish merge', 'complete mail merge', 'finish and merge', 'send merge'],
    run: ({ openDialog }) => openDialog?.('finishMerge'),
  },
  {
    id: 'mail-wizard',
    title: 'Mail Merge Wizard',
    tab: 'mailings',
    group: 'Start Mail Merge',
    keywords: ['mail merge wizard', 'wizard', 'step by step mail merge'],
    run: ({ openDialog }) => openDialog?.('mailMerge'),
  },

  // ── REVIEW TAB ──
  {
    id: 'rev-spell',
    title: 'Spelling & Grammar',
    tab: 'review',
    group: 'Proofing',
    keywords: ['spelling', 'grammar', 'spell check', 'abc', 'f7', 'proofreading'],
    run: ({ toggleSpellCheck, spellCheck, toast }) => {
      toggleSpellCheck?.();
      toast?.(spellCheck ? 'Spell check disabled' : 'Spell check enabled', 'info');
    },
  },
  {
    id: 'rev-thesaurus',
    title: 'Thesaurus',
    tab: 'review',
    group: 'Proofing',
    keywords: ['thesaurus', 'synonym', 'word book', 'antonyms', 'vocabulary'],
    run: ({ editor, toast }) => {
      const text = editor ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ').trim() : '';
      const term = text || 'writing';
      window.open(`https://www.thesaurus.com/browse/${encodeURIComponent(term)}`, '_blank', 'noopener,noreferrer');
      toast?.(`Opened thesaurus for "${term}"`, 'success');
    },
  },
  {
    id: 'rev-wordcount',
    title: 'Word Count',
    tab: 'review',
    group: 'Proofing',
    keywords: ['word count', 'count words', 'characters', 'statistics', 'reading time'],
    run: ({ openDialog }) => openDialog?.('wordCount'),
  },
  {
    id: 'rev-readaloud',
    title: 'Text-to-Speech (Read Aloud)',
    tab: 'review',
    group: 'Speech',
    keywords: ['read aloud', 'tts', 'text to speech', 'listen', 'speak text', 'voice'],
    run: ({ editor, toast }) => runReadAloud({ editor, toast }),
  },
  {
    id: 'rev-accessibility',
    title: 'Check Accessibility',
    tab: 'review',
    group: 'Accessibility',
    keywords: ['accessibility', 'a11y', 'check accessible', 'screen reader'],
    run: ({ openDialog }) => openDialog?.('accessibility'),
  },
  {
    id: 'rev-translate',
    title: 'Translate',
    tab: 'review',
    group: 'Language',
    keywords: ['translate', 'language', 'google translate', 'translation'],
    run: ({ editor, openPragna, toast }) => {
      const text = editor ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ').trim() : '';
      if (text) {
        window.open(`https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(text)}&op=translate`, '_blank', 'noopener,noreferrer');
        toast?.('Opened translation in browser', 'success');
      } else {
        openPragna?.('translate');
      }
    },
  },
  {
    id: 'rev-lang',
    title: 'Set Language',
    tab: 'review',
    group: 'Language',
    keywords: ['language', 'proofing language', 'dictionary', 'set language'],
    run: ({ openDialog }) => openDialog?.('language'),
  },
  {
    id: 'rev-newcomment',
    title: 'New Comment',
    tab: 'review',
    group: 'Comments',
    keywords: ['new comment', 'add comment', 'comment', 'ctrl+alt+m'],
    run: ({ editor, addComment, openDialog, toast }) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      if (from === to) {
        addComment?.({ text: 'General comment' });
      } else {
        const text = editor.state.doc.textBetween(from, to, ' ');
        addComment?.({ text: `Comment on: ${text.slice(0, 80)}` });
        editor.chain().focus().setTextSelection({ from, to }).toggleHighlight({ color: '#fff59d' }).run();
      }
      openDialog?.('comments');
      toast?.('Comment added', 'success');
    },
  },
  {
    id: 'rev-showcomments',
    title: 'Show All Comments',
    tab: 'review',
    group: 'Comments',
    keywords: ['show comments', 'view comments', 'all comments', 'comment panel'],
    run: ({ openDialog }) => openDialog?.('comments'),
  },
  {
    id: 'rev-trackchanges',
    title: 'Track Changes',
    tab: 'review',
    group: 'Tracking',
    keywords: ['track changes', 'change tracking', 'revisions', 'markup'],
    run: ({ toggleTrackChanges, trackChanges, toast }) => {
      toggleTrackChanges?.();
      toast?.(trackChanges ? 'Track Changes turned off' : 'Track Changes turned on', 'info');
    },
  },
  {
    id: 'rev-pane',
    title: 'Reviewing Pane',
    tab: 'review',
    group: 'Tracking',
    keywords: ['reviewing pane', 'review pane', 'changes pane'],
    run: ({ openDialog }) => openDialog?.('reviewingPane'),
  },
  {
    id: 'rev-history',
    title: 'Version History',
    tab: 'review',
    group: 'Compare',
    keywords: ['version history', 'history', 'changes history', 'restore version', 'revisions'],
    run: ({ openDialog }) => openDialog?.('versionHistory'),
  },
  {
    id: 'rev-compare',
    title: 'Compare Documents',
    tab: 'review',
    group: 'Compare',
    keywords: ['compare', 'diff', 'compare documents', 'document comparison'],
    run: ({ openDialog }) => openDialog?.('compareDocuments'),
  },
  {
    id: 'rev-restrict',
    title: 'Restrict Editing',
    tab: 'review',
    group: 'Protect',
    keywords: ['restrict editing', 'protect', 'lock document', 'permissions'],
    run: ({ openDialog }) => openDialog?.('restrictEditing'),
  },
  {
    id: 'rev-dictate',
    title: 'Voice Typing',
    tab: 'review',
    group: 'Speech',
    keywords: ['dictate', 'speech', 'voice to text', 'speech recognition', 'voice typing'],
    run: ({ editor, toast }) => runDictation({ editor, toast }),
  },
  {
    id: 'rev-ocr',
    title: 'OCR (Image to Text)',
    tab: 'review',
    group: 'Smart Capture',
    keywords: ['ocr', 'image to text', 'scan text', 'extract text', 'document scanner'],
    run: ({ editor, toast }) => runImageTextCapture({ editor, toast, mode: 'ocr' }),
  },
  {
    id: 'rev-handwriting',
    title: 'Handwriting Recognition',
    tab: 'review',
    group: 'Smart Capture',
    keywords: ['handwriting', 'recognition', 'notes', 'image text', 'handwritten notes'],
    run: ({ editor, toast }) => runImageTextCapture({ editor, toast, mode: 'handwriting' }),
  },
  {
    id: 'rev-smart-suggestions',
    title: 'Smart Suggestions',
    tab: 'review',
    group: 'Proofing',
    keywords: ['suggestions', 'smart', 'ai help', 'rewrite', 'summarize', 'smart suggestions'],
    run: ({ editor, toast }) => runSmartSuggestions({ editor, toast }),
  },
  {
    id: 'rev-readability',
    title: 'Readability Dashboard',
    tab: 'review',
    group: 'Proofing',
    keywords: ['readability', 'flesch', 'grade level', 'clarity', 'stats', 'reading score'],
    run: ({ openDialog }) => openDialog?.('readability'),
  },
  {
    id: 'sec-security',
    title: 'Document Security & Encryption',
    tab: 'design',
    group: 'Security',
    keywords: ['security', 'encrypt', 'password', 'lock', 'protect document', 'encryption'],
    run: ({ openDialog }) => openDialog?.('security'),
  },
  {
    id: 'rev-mergeconflict',
    title: 'Three-Way Merge Conflict Resolution',
    tab: 'review',
    group: 'Compare',
    keywords: ['merge', 'conflict', 'diff', 'three-way merge', 'resolve conflicts'],
    run: ({ openDialog }) => openDialog?.('mergeConflict'),
  },

  // ── VIEW TAB ──
  {
    id: 'view-print',
    title: 'Print Layout',
    tab: 'view',
    group: 'Views',
    keywords: ['print layout', 'reading view', 'print view', 'normal view'],
    run: ({ toast }) => {
      const scroll = document.getElementById('editor-scroll-area');
      if (scroll) {
        scroll.classList.remove('etherx-view-web', 'etherx-view-outline', 'etherx-view-draft', 'etherx-view-read');
        scroll.classList.add('etherx-view-print');
        toast?.('Print Layout view enabled', 'info');
      }
    },
  },
  {
    id: 'view-web',
    title: 'Web Layout',
    tab: 'view',
    group: 'Views',
    keywords: ['web layout', 'web view', 'full width view'],
    run: ({ toast }) => {
      const scroll = document.getElementById('editor-scroll-area');
      if (scroll) {
        scroll.classList.remove('etherx-view-print', 'etherx-view-outline', 'etherx-view-draft', 'etherx-view-read');
        scroll.classList.add('etherx-view-web');
        toast?.('Web Layout view enabled', 'info');
      }
    },
  },
  {
    id: 'view-outline',
    title: 'Outline View',
    tab: 'view',
    group: 'Views',
    keywords: ['outline', 'outline view', 'headings outline'],
    run: ({ toast }) => {
      const scroll = document.getElementById('editor-scroll-area');
      if (scroll) {
        scroll.classList.remove('etherx-view-print', 'etherx-view-web', 'etherx-view-draft', 'etherx-view-read');
        scroll.classList.add('etherx-view-outline');
        toast?.('Outline view enabled', 'info');
      }
    },
  },
  {
    id: 'view-draft',
    title: 'Draft View',
    tab: 'view',
    group: 'Views',
    keywords: ['draft view', 'draft', 'edit view', 'simple view'],
    run: ({ toast }) => {
      const scroll = document.getElementById('editor-scroll-area');
      if (scroll) {
        scroll.classList.remove('etherx-view-print', 'etherx-view-web', 'etherx-view-outline', 'etherx-view-read');
        scroll.classList.add('etherx-view-draft');
        toast?.('Draft view enabled', 'info');
      }
    },
  },
  {
    id: 'view-read',
    title: 'Read Mode',
    tab: 'view',
    group: 'Views',
    keywords: ['read mode', 'read only', 'view reading', 'book mode'],
    run: ({ toast }) => {
      const scroll = document.getElementById('editor-scroll-area');
      if (scroll) {
        scroll.classList.remove('etherx-view-print', 'etherx-view-web', 'etherx-view-outline', 'etherx-view-draft');
        scroll.classList.add('etherx-view-read');
        toast?.('Read Mode enabled', 'info');
      }
    },
  },
  {
    id: 'view-focus',
    title: 'Focus Mode',
    tab: 'view',
    group: 'Views',
    keywords: ['focus mode', 'distraction free', 'focus', 'zen mode'],
    run: ({ toast }) => {
      const scroll = document.getElementById('editor-scroll-area');
      if (scroll) {
        scroll.classList.toggle('etherx-focus-mode');
        toast?.('Focus mode toggled', 'info');
      }
    },
  },
  {
    id: 'view-sidebar',
    title: 'Toggle Sidebar',
    tab: 'view',
    group: 'Show',
    keywords: ['sidebar', 'toggle sidebar', 'side panel', 'thumbnails'],
    run: ({ toggleSidebar }) => toggleSidebar?.(),
  },
  {
    id: 'view-ruler',
    title: 'Toggle Ruler',
    tab: 'view',
    group: 'Show',
    keywords: ['ruler', 'show ruler', 'ruler toggle', 'margins ruler'],
    run: ({ toggleRuler }) => {
      toggleRuler?.();
      const ruler = document.getElementById('etherx-ruler');
      if (ruler) ruler.style.display = ruler.style.display === 'none' ? 'flex' : 'none';
    },
  },
  {
    id: 'view-grid',
    title: 'Toggle Gridlines',
    tab: 'view',
    group: 'Show',
    keywords: ['gridlines', 'grid', 'show grid', 'toggle gridlines'],
    run: ({ toggleGridlines }) => {
      toggleGridlines?.();
      const el = document.getElementById('document-page-0');
      if (el) {
        const cur = el.style.backgroundImage;
        el.style.backgroundImage = cur ? '' : 'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(212,175,55,0.08) 27px,rgba(212,175,55,0.08) 28px), repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(212,175,55,0.08) 27px,rgba(212,175,55,0.08) 28px)';
      }
    },
  },
  {
    id: 'view-navpane',
    title: 'Navigation Pane',
    tab: 'view',
    group: 'Show',
    keywords: ['navigation pane', 'nav pane', 'headings', 'document structure'],
    run: ({ toggleSidebar }) => toggleSidebar?.(),
  },
  {
    id: 'view-zoomout',
    title: 'Zoom Out',
    tab: 'view',
    group: 'Zoom',
    keywords: ['zoom out', 'shrink', 'smaller zoom', 'ctrl+-'],
    run: ({ setZoom, zoom }) => setZoom?.(Math.max(25, (zoom || 100) - 10)),
  },
  {
    id: 'view-zoomin',
    title: 'Zoom In',
    tab: 'view',
    group: 'Zoom',
    keywords: ['zoom in', 'larger', 'increase zoom', 'ctrl+='],
    run: ({ setZoom, zoom }) => setZoom?.(Math.min(300, (zoom || 100) + 10)),
  },
  {
    id: 'view-zoom100',
    title: 'Zoom 100%',
    tab: 'view',
    group: 'Zoom',
    keywords: ['100 percent', 'zoom 100', 'actual size', 'reset zoom'],
    run: ({ setZoom }) => setZoom?.(100),
  },
  {
    id: 'view-fitpage',
    title: 'Fit Page',
    tab: 'view',
    group: 'Zoom',
    keywords: ['fit page', 'fit to page', 'full page zoom', 'whole page'],
    run: ({ toggleFitPage, setZoom }) => (toggleFitPage ? toggleFitPage() : setZoom?.(85)),
  },
  {
    id: 'view-pagewidth',
    title: 'Page Width',
    tab: 'view',
    group: 'Zoom',
    keywords: ['page width', 'fit width', 'zoom to width'],
    run: ({ togglePageWidth, setZoom }) => (togglePageWidth ? togglePageWidth() : (useUIStore?.getState?.()?.togglePageWidth?.() || setZoom?.(110))),
  },
  {
    id: 'view-zoom75',
    title: 'Zoom 75%',
    tab: 'view',
    group: 'Zoom',
    keywords: ['75 percent', 'zoom 75'],
    run: ({ setZoom }) => setZoom?.(75),
  },
  {
    id: 'view-newwin',
    title: 'New Window',
    tab: 'view',
    group: 'Window',
    keywords: ['new window', 'open new', 'duplicate tab'],
    run: () => window.open(window.location.href, '_blank'),
  },
  {
    id: 'view-fullscreen',
    title: 'Toggle Fullscreen',
    tab: 'view',
    group: 'Window',
    keywords: ['fullscreen', 'full screen', 'maximize', 'f11'],
    run: ({ toggleFullscreen }) => toggleFullscreen?.(),
  },
  {
    id: 'view-split',
    title: 'Split View',
    tab: 'view',
    group: 'Window',
    keywords: ['split view', 'side by side', 'split document', 'dual view'],
    run: ({ editor, toast }) => {
      const left = document.getElementById('editor-scroll-area');
      const existing = document.getElementById('etherx-split-preview');
      if (existing) {
        existing.remove();
        toast?.('Split view closed', 'info');
      } else if (left) {
        const container = document.createElement('div');
        container.id = 'etherx-split-preview';
        container.style.cssText = 'flex:1;border-left:1px solid var(--border);overflow:auto;background:var(--bg-primary);position:relative;padding:20px;white-space:pre-wrap;';
        container.innerText = editor ? editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n') : '';
        left.parentElement?.appendChild(container);
        toast?.('Split view opened', 'success');
      }
    },
  },
  {
    id: 'view-macros',
    title: 'Macros',
    tab: 'view',
    group: 'Macros',
    keywords: ['macro', 'macros', 'automate', 'script', 'macro runner'],
    run: ({ editor, toast }) => {
      const script = window.prompt('Macro command (upper|lower|title):', 'upper');
      if (script && editor) {
        const { from, to } = editor.state.selection;
        if (from !== to) {
          const selected = editor.state.doc.textBetween(from, to, ' ');
          let transformed = selected;
          if (script === 'upper') transformed = selected.toUpperCase();
          if (script === 'lower') transformed = selected.toLowerCase();
          if (script === 'title') transformed = selected.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
          editor.chain().focus().insertContentAt({ from, to }, transformed).run();
          toast?.(`Macro applied: ${script}`, 'success');
        } else {
          toast?.('Select text to run macro', 'info');
        }
      }
    },
  },

  // ── HELP TAB ──
  {
    id: 'help-help',
    title: 'Help & Tutorials',
    tab: 'help',
    group: 'Help',
    keywords: ['help', 'tutorial', 'guide', 'help tutorial', 'f1'],
    run: ({ openDialog }) => openDialog?.('help'),
  },
  {
    id: 'help-shortcuts',
    title: 'Keyboard Shortcuts',
    tab: 'help',
    group: 'Keyboard',
    keywords: ['shortcuts', 'keyboard', 'keyboard shortcuts', 'command map', 'hotkeys', 'ctrl+/'],
    run: ({ openDialog }) => openDialog?.('commandMap'),
  },
  {
    id: 'help-remapshortcuts',
    title: 'Remap Keyboard Shortcuts',
    tab: 'help',
    group: 'Keyboard',
    keywords: ['remap', 'keyboard shortcuts', 'custom shortcuts', 'hotkeys', 'remap keys'],
    run: ({ openDialog }) => openDialog?.('shortcuts'),
  },
  {
    id: 'help-support',
    title: 'Contact Support',
    tab: 'help',
    group: 'Help',
    keywords: ['support', 'contact support', 'helpdesk', 'email support'],
    run: () => window.open('mailto:support@etherx.app?subject=EtherX%20Word%20Support', '_blank'),
  },
  {
    id: 'help-feedback',
    title: 'Send Feedback',
    tab: 'help',
    group: 'Help',
    keywords: ['feedback', 'suggest', 'send feedback', 'report issue'],
    run: () => window.open('mailto:feedback@etherx.app?subject=EtherX%20Word%20Feedback', '_blank'),
  },
  {
    id: 'help-training',
    title: 'Show Training',
    tab: 'help',
    group: 'Training',
    keywords: ['training', 'learn', 'tutorials', 'quick start'],
    run: ({ openDialog }) => openDialog?.('whatsNew'),
  },
  {
    id: 'help-whatsnew',
    title: "What's New",
    tab: 'help',
    group: "What's New",
    keywords: ['whats new', 'new features', 'changelog', 'release notes'],
    run: ({ openDialog }) => openDialog?.('whatsNew'),
  },
  {
    id: 'help-community',
    title: 'Community',
    tab: 'help',
    group: 'Community',
    keywords: ['community', 'github', 'source code', 'repo'],
    run: () => window.open('https://github.com/search?q=EtherXW&type=repositories', '_blank'),
  },
  {
    id: 'help-suggest',
    title: 'Suggest a Feature',
    tab: 'help',
    group: 'Help',
    keywords: ['suggest', 'feature request', 'idea', 'feedback'],
    run: () => window.open('mailto:feedback@etherx.app?subject=Feature%20Suggestion', '_blank'),
  },
  {
    id: 'help-about',
    title: 'About EtherX Word',
    tab: 'help',
    group: 'About',
    keywords: ['about', 'version', 'info', 'credits'],
    run: ({ openDialog }) => openDialog?.('about'),
  },

  // ── DESIGN TAB ──
  {
    id: 'design-themes',
    title: 'Document Themes',
    tab: 'design',
    group: 'Document Formatting',
    keywords: ['theme', 'document theme', 'apply theme', 'theme styling', 'themes', 'style sets'],
    run: ({ getDesign, setDesign, toast, setActiveTab }) => {
      setActiveTab?.('design');
      const themes = [
        { name: 'Modern Blue', font: 'Inter', accent: '#2563eb', heading: '#1d4ed8' },
        { name: 'Editorial Crimson', font: 'Merriweather', accent: '#be123c', heading: '#9f1239' },
        { name: 'Royal Gold', font: 'Crimson Pro', accent: '#d4af37', heading: '#c9a84c' },
        { name: 'Emerald Forest', font: 'Roboto', accent: '#059669', heading: '#047857' },
        { name: 'Executive Slate', font: 'Arial', accent: '#475569', heading: '#1e293b' },
      ];
      const design = getDesign?.() || {};
      const curIdx = themes.findIndex((t) => t.accent === design.accent);
      const next = themes[(curIdx + 1) % themes.length];
      setDesign?.({ ...design, ...next, font: next.font, accent: next.accent });
      toast?.(`Applied Theme: ${next.name}`, 'success');
    },
  },
  {
    id: 'design-stylesets',
    title: 'Style Sets',
    tab: 'design',
    group: 'Document Formatting',
    keywords: ['style sets', 'style set', 'formatting styles', 'document formatting'],
    run: ({ setActiveTab, toast }) => {
      setActiveTab?.('design');
      toast?.('Style Sets available on Design ribbon tab', 'info');
    },
  },
  {
    id: 'design-colors',
    title: 'Theme Colors',
    tab: 'design',
    group: 'Document Formatting',
    keywords: ['theme colors', 'colors', 'color set', 'palette', 'accent color', 'color palettes'],
    run: ({ setActiveTab, setDesignPopover }) => {
      setActiveTab?.('design');
      setDesignPopover?.('colors');
      window.dispatchEvent(new CustomEvent('etherx:open-design-feature', { detail: { feature: 'colors' } }));
    },
  },
  {
    id: 'design-fonts',
    title: 'Theme Fonts',
    tab: 'design',
    group: 'Document Formatting',
    keywords: ['theme fonts', 'font set', 'design fonts', 'font pairing'],
    run: ({ setActiveTab, setDesignPopover }) => {
      setActiveTab?.('design');
      setDesignPopover?.('fonts');
      window.dispatchEvent(new CustomEvent('etherx:open-design-feature', { detail: { feature: 'fonts' } }));
    },
  },
  {
    id: 'design-spacing',
    title: 'Paragraph Spacing',
    tab: 'design',
    group: 'Document Formatting',
    keywords: ['paragraph spacing', 'line spacing', 'spacing', 'theme spacing'],
    run: ({ setActiveTab, setDesignPopover }) => {
      setActiveTab?.('design');
      setDesignPopover?.('spacing');
      window.dispatchEvent(new CustomEvent('etherx:open-design-feature', { detail: { feature: 'spacing' } }));
    },
  },
  {
    id: 'design-effects',
    title: 'Document Effects',
    tab: 'design',
    group: 'Document Formatting',
    keywords: ['effects', 'document effects', 'visual effects', 'shadows and depth'],
    run: ({ setActiveTab, setDesignPopover }) => {
      setActiveTab?.('design');
      setDesignPopover?.('effects');
      window.dispatchEvent(new CustomEvent('etherx:open-design-feature', { detail: { feature: 'effects' } }));
    },
  },
  {
    id: 'design-default',
    title: 'Set as Default',
    tab: 'design',
    group: 'Document Formatting',
    keywords: ['set as default', 'default formatting', 'save as default design'],
    run: ({ getDesign, toast, setActiveTab }) => {
      setActiveTab?.('design');
      try {
        const design = getDesign?.() || {};
        localStorage.setItem('etherx-design-default', JSON.stringify(design));
        toast?.('Current design saved as default', 'success');
      } catch {
        toast?.('Could not save default design', 'warning');
      }
    },
  },
  {
    id: 'design-table-styles',
    title: 'Table Styles',
    tab: 'design',
    group: 'Table Styles',
    keywords: ['table styles', 'grid table', 'table theme', 'table formatting', 'striped table', 'accent table', 'table design'],
    run: ({ editor, toast, setActiveTab }) => {
      setActiveTab?.('design');
      if (editor?.isActive('table')) {
        toast?.('Table Styles available on Design ribbon tab', 'info');
      } else {
        toast?.('Place cursor inside a table to choose Table Styles', 'info');
      }
    },
  },
  {
    id: 'design-watermark',
    title: 'Watermark',
    tab: 'design',
    group: 'Page Background',
    keywords: ['watermark', 'insert watermark', 'draft', 'confidential', 'ghosted text', 'page watermark', 'background watermark', 'remove watermark'],
    run: ({ setActiveTab, setDesignPopover }) => {
      setActiveTab?.('design');
      setDesignPopover?.('watermark');
      window.dispatchEvent(new CustomEvent('etherx:open-design-feature', { detail: { feature: 'watermark' } }));
    },
  },
  {
    id: 'design-pagecolor',
    title: 'Page Color',
    tab: 'design',
    group: 'Page Background',
    keywords: ['page color', 'color page', 'background color', 'sheet color', 'paper color', 'theme colors', 'page background', 'canvas color', 'page fill'],
    run: ({ setActiveTab, setDesignPopover }) => {
      setActiveTab?.('design');
      setDesignPopover?.('pageColor');
      window.dispatchEvent(new CustomEvent('etherx:open-design-feature', { detail: { feature: 'pageColor' } }));
    },
  },
  {
    id: 'design-pageborder',
    title: 'Page Border',
    tab: 'design',
    group: 'Page Background',
    keywords: ['page border', 'page borders', 'borders', 'borders and shading', 'frame page', 'box border', 'border settings', 'shading', 'decorative border', 'page outline'],
    run: ({ setActiveTab, setPageBordersModalOpen }) => {
      setActiveTab?.('design');
      setPageBordersModalOpen?.(true);
      window.dispatchEvent(new CustomEvent('etherx:open-design-feature', { detail: { feature: 'pageBorder' } }));
    },
  },
  {
    id: 'design-pageborders',
    title: 'Page Borders',
    tab: 'design',
    group: 'Page Background',
    keywords: ['page borders', 'page border', 'borders', 'borders and shading', 'frame page', 'box border', 'shading'],
    run: ({ setActiveTab, setPageBordersModalOpen }) => {
      setActiveTab?.('design');
      setPageBordersModalOpen?.(true);
      window.dispatchEvent(new CustomEvent('etherx:open-design-feature', { detail: { feature: 'pageBorder' } }));
    },
  },
  {
    id: 'design-voice-typing',
    title: 'Voice Typing',
    tab: 'design',
    group: 'Smart Tools',
    keywords: ['voice typing', 'voice', 'dictate', 'dictation', 'speech to text', 'speech recognition', 'mic', 'microphone', 'transcribe', 'smart tools'],
    run: ({ editor, toast, setActiveTab }) => {
      setActiveTab?.('design');
      window.dispatchEvent(new CustomEvent('etherx:toggle-voice-typing'));
      runDictation({ editor, toast });
    },
  },
  {
    id: 'design-read-aloud',
    title: 'Read Aloud',
    tab: 'design',
    group: 'Smart Tools',
    keywords: ['read aloud', 'read', 'speak', 'speech', 'text to speech', 'tts', 'listen', 'audio narration'],
    run: ({ editor, toast, setActiveTab }) => {
      setActiveTab?.('design');
      runReadAloud({ editor, toast });
    },
  },
  {
    id: 'design-handwriting',
    title: 'Handwriting',
    tab: 'design',
    group: 'Smart Tools',
    keywords: ['handwriting', 'handwritten', 'handwriting recognition', 'ocr handwriting', 'scan notes', 'notes to text', 'pen notes', 'ink to text'],
    run: ({ openDialog, setActiveTab }) => {
      setActiveTab?.('design');
      openDialog?.('handwriting');
    },
  },
  {
    id: 'design-suggestions',
    title: 'Suggestions',
    tab: 'design',
    group: 'Smart Tools',
    keywords: ['suggestions', 'smart suggestions', 'ai suggestions', 'content suggestions', 'ideas', 'smart content', 'recommendations', 'writing assistance'],
    run: ({ editor, toast, setActiveTab }) => {
      setActiveTab?.('design');
      runSmartSuggestions({ editor, toast });
    },
  },
  {
    id: 'design-masterdoc',
    title: 'Master Doc',
    tab: 'design',
    group: 'Protection',
    keywords: ['master doc', 'master document', 'subdocuments', 'chapters', 'book master', 'combine documents', 'multi-part document'],
    run: ({ openDialog, setActiveTab }) => {
      setActiveTab?.('design');
      openDialog?.('masterDoc');
    },
  },
  {
    id: 'design-security',
    title: 'Security',
    tab: 'design',
    group: 'Protection',
    keywords: ['security', 'document security', 'password', 'encryption', 'protect document', 'lock document', 'permissions', 'encrypt file', 'protection'],
    run: ({ openDialog, setActiveTab }) => {
      setActiveTab?.('design');
      openDialog?.('security');
    },
  },

  // ── FILE TAB ──
  {
    id: 'file-new',
    title: 'New Document',
    tab: 'file',
    group: 'Document',
    keywords: ['new', 'new document', 'create new', 'blank document', 'ctrl+n'],
    run: ({ navigate, toast }) => {
      navigate?.('/home');
      toast?.('Opening document gallery', 'info');
    },
  },
  {
    id: 'file-open',
    title: 'Open Document',
    tab: 'file',
    group: 'Document',
    keywords: ['open', 'open file', 'open document', 'import docx', 'ctrl+o'],
    run: ({ openDialog }) => openDialog?.('importDocx'),
  },
  {
    id: 'file-save',
    title: 'Save Document',
    tab: 'file',
    group: 'Document',
    keywords: ['save', 'save file', 'save document', 'ctrl+s'],
    run: ({ toast }) => {
      window.dispatchEvent(new CustomEvent('etherx-save-document'));
      toast?.('Document saved', 'success');
    },
  },
  {
    id: 'file-export',
    title: 'Export / Print',
    tab: 'file',
    group: 'Document',
    keywords: ['export', 'print', 'pdf', 'docx', 'save as', 'download', 'ctrl+p'],
    run: ({ openDialog }) => openDialog?.('exportDoc'),
  },
  {
    id: 'file-settings',
    title: 'Settings',
    tab: 'file',
    group: 'Application',
    keywords: ['settings', 'preferences', 'options', 'config', 'shortcuts'],
    run: ({ openDialog }) => openDialog?.('shortcuts'),
  },
];
