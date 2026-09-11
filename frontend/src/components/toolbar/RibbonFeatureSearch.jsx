import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { buildAiResult, openTranslationUrl } from '@/services/ai';
import { ensureRegistered, searchCommands } from './commandRegistry';
import { runDictation, runImageTextCapture, runReadAloud, runSmartSuggestions } from '@/utils/smartFeatures';

const makeAction = (key, { title, tab, keywords = [], run }) => ({
  key,
  title,
  tab,
  keywords,
  run,
});

export function RibbonFeatureSearch({ compactWidth = 190, onActivateTab: onActivateTabProp }) {
  const { openDialog, toast, setActiveTab, watermarkText, setWatermarkText, setFindQuery, openPragna } = useUIStore();
  const onActivateTab = onActivateTabProp ?? null;
  const { editor } = useEditorStore();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    // Ensure registry is populated.
    ensureRegistered();
  }, []);

  // Registry-backed results.
  const actions = useMemo(() => {
    return searchCommands(query, { limit: 50 });
  }, [query]);

  // Back-compat: comprehensive fallback covering every feature in every ribbon tab.
  const coreFallback = useMemo(() => {
    const hasRegistry = actions && Array.isArray(actions) && actions.length > 0;
    if (hasRegistry) return null;
    return [
      // ── Home Tab ──
      { id: 'home-paste',      key: 'home-paste',      title: 'Paste',          tab: 'home',  keywords: ['paste', 'clipboard', 'ctrl+v'], run: () => { }, },
      { id: 'home-cut',        key: 'home-cut',        title: 'Cut',            tab: 'home',  keywords: ['cut', 'clipboard', 'ctrl+x'], run: () => { }, },
      { id: 'home-copy',       key: 'home-copy',       title: 'Copy',           tab: 'home',  keywords: ['copy', 'clipboard', 'ctrl+c'], run: () => { }, },
      { id: 'home-fpaint',     key: 'home-fpaint',     title: 'Format Painter', tab: 'home',  keywords: ['format painter', 'formatting', 'paint'], run: () => { }, },
      { id: 'home-fontfamily', key: 'home-fontfamily', title: 'Font Family',    tab: 'home',  keywords: ['font family', 'font', 'typeface'], run: () => { }, },
      { id: 'home-fontsize',   key: 'home-fontsize',   title: 'Font Size',      tab: 'home',  keywords: ['font size', 'size', 'point'], run: () => { }, },
      { id: 'home-growfont',   key: 'home-growfont',   title: 'Grow Font',      tab: 'home',  keywords: ['grow font', 'increase font', 'bigger'], run: () => { }, },
      { id: 'home-shrinkfont', key: 'home-shrinkfont', title: 'Shrink Font',    tab: 'home',  keywords: ['shrink font', 'decrease font', 'smaller'], run: () => { }, },
      { id: 'home-case',       key: 'home-case',       title: 'Change Case',    tab: 'home',  keywords: ['change case', 'uppercase', 'lowercase', 'capitalize'], run: () => { }, },
      { id: 'home-clearfmt',   key: 'home-clearfmt',   title: 'Clear Formatting',tab: 'home', keywords: ['clear formatting', 'remove formatting'], run: () => { }, },
      { id: 'home-bold',       key: 'home-bold',       title: 'Bold',           tab: 'home',  keywords: ['bold', 'text style', 'ctrl+b'], run: () => { }, },
      { id: 'home-italic',     key: 'home-italic',     title: 'Italic',         tab: 'home',  keywords: ['italic', 'text style', 'ctrl+i'], run: () => { }, },
      { id: 'home-underline',  key: 'home-underline',  title: 'Underline',      tab: 'home',  keywords: ['underline', 'text style', 'ctrl+u'], run: () => { }, },
      { id: 'home-strike',     key: 'home-strike',     title: 'Strikethrough',  tab: 'home',  keywords: ['strikethrough', 'strike', 'cross out'], run: () => { }, },
      { id: 'home-subscript',  key: 'home-subscript',  title: 'Subscript',      tab: 'home',  keywords: ['subscript', 'below'], run: () => { }, },
      { id: 'home-superscript',key: 'home-superscript',title: 'Superscript',    tab: 'home',  keywords: ['superscript', 'above', 'exponent'], run: () => { }, },
      { id: 'home-highlight',  key: 'home-highlight',  title: 'Highlight Color',tab: 'home',  keywords: ['highlight', 'marker', 'shading'], run: () => { }, },
      { id: 'home-textcolor',  key: 'home-textcolor',  title: 'Text Color',     tab: 'home',  keywords: ['text color', 'font color', 'colour'], run: () => { }, },
      { id: 'home-alignleft',  key: 'home-alignleft',  title: 'Align Left',     tab: 'home',  keywords: ['align left', 'left align', 'ctrl+l'], run: () => { }, },
      { id: 'home-aligncenter',key: 'home-aligncenter',title: 'Align Center',   tab: 'home',  keywords: ['center', 'align center', 'ctrl+e'], run: () => { }, },
      { id: 'home-alignright', key: 'home-alignright', title: 'Align Right',    tab: 'home',  keywords: ['align right', 'right align', 'ctrl+r'], run: () => { }, },
      { id: 'home-justify',    key: 'home-justify',    title: 'Justify',        tab: 'home',  keywords: ['justify', 'text align'], run: () => { }, },
      { id: 'home-bullets',    key: 'home-bullets',    title: 'Bullet List',    tab: 'home',  keywords: ['bullet list', 'bullets', 'unordered list'], run: () => { }, },
      { id: 'home-ordered',    key: 'home-ordered',    title: 'Ordered List',   tab: 'home',  keywords: ['numbered list', 'ordered list', 'ol'], run: () => { }, },
      { id: 'home-tasklist',   key: 'home-tasklist',   title: 'Task List',      tab: 'home',  keywords: ['task list', 'checklist', 'todo'], run: () => { }, },
      { id: 'home-blockquote', key: 'home-blockquote', title: 'Blockquote',     tab: 'home',  keywords: ['blockquote', 'quote', 'indent'], run: () => { }, },
      { id: 'home-indent',     key: 'home-indent',     title: 'Increase Indent',tab: 'home',  keywords: ['indent', 'increase indent'], run: () => { }, },
      { id: 'home-outdent',    key: 'home-outdent',    title: 'Decrease Indent',tab: 'home',  keywords: ['outdent', 'decrease indent'], run: () => { }, },
      { id: 'home-linespace',  key: 'home-linespace',  title: 'Line Spacing',   tab: 'home',  keywords: ['line spacing', 'spacing', 'lead'], run: () => { }, },
      { id: 'home-formatmarks',key: 'home-formatmarks',title: 'Show Formatting Marks',tab:'home',keywords:['formatting marks','pilcrow','¶'], run: () => { }, },
      { id: 'home-style-normal',key:'home-style-normal',title:'Normal Style',   tab:'home',  keywords:['normal style','paragraph style'], run: () => { }, },
      { id: 'home-style-h1',   key: 'home-style-h1',   title: 'Heading 1',      tab: 'home',  keywords: ['heading 1', 'h1', 'title'], run: () => { }, },
      { id: 'home-style-h2',   key: 'home-style-h2',   title: 'Heading 2',      tab: 'home',  keywords: ['heading 2', 'h2', 'subtitle'], run: () => { }, },
      { id: 'home-style-title',key: 'home-style-title', title:'Title Style',    tab: 'home',  keywords: ['title style', 'big heading'], run: () => { }, },
      { id: 'home-undo',       key: 'home-undo',       title: 'Undo',           tab: 'home',  keywords: ['undo', 'reverse', 'ctrl+z'], run: () => { }, },
      { id: 'home-redo',       key: 'home-redo',       title: 'Redo',           tab: 'home',  keywords: ['redo', 'return', 'reapply', 'ctrl+y'], run: () => { }, },
      { id: 'home-find',       key: 'home-find',       title: 'Find & Replace', tab: 'home',  keywords: ['find', 'replace', 'search text', 'find replace','ctrl+h'], run: () => openDialog('findReplace'), },
      { id: 'home-selectall',  key: 'home-selectall',  title: 'Select All',     tab: 'home',  keywords: ['select all', 'select everything', 'ctrl+a'], run: () => { }, },
      { id: 'home-help',       key: 'home-help',       title: 'Get Help',       tab: 'home',  keywords: ['help', 'support', 'assistance'], run: () => openDialog('help'), },
      { id: 'home-ai-pragna', key:'home-ai-pragna', title:'Pragna AI (Copilot)', tab:'home', keywords:['pragna','copilot','ai','assistant','chat','ask pragna','alt+i','gemma 31b'], run: () => {
        useUIStore.getState().openPragna('ask');
      } },
      { id: 'home-ai-edit', key:'home-ai-edit', title:'Pragna Edit as Instructed', tab:'home', keywords:['pragna','edit','edit selection','instruction','custom edit','copilot','rewrite as instructed','gemma'], run: () => {
        useUIStore.getState().openPragna('edit');
      } },
      { id: 'home-ai-generate', key:'home-ai-generate', title:'Pragna Draft Generator', tab:'home', keywords:['pragna','ai','generate','content','draft','write','ollama'], run: () => {
        useUIStore.getState().openPragna('generate');
      } },
      { id: 'home-ai-summarize', key:'home-ai-summarize', title:'Pragna Summarizer', tab:'ai', keywords:['pragna','ai','summarize','summary','shorten','digest','ollama'], run: () => {
        useUIStore.getState().openPragna('summarize');
      } },
      { id: 'home-ai-grammar', key:'home-ai-grammar', title:'Pragna Grammar & Polish', tab:'ai', keywords:['pragna','ai','grammar','correct','proofread','polish','ollama'], run: () => {
        useUIStore.getState().openPragna('grammar');
      } },
      { id: 'home-ai-rewrite', key:'home-ai-rewrite', title:'Pragna Rewrite Assistant', tab:'ai', keywords:['pragna','ai','rewrite','rephrase','formal','short','persuasive','ollama'], run: () => {
        useUIStore.getState().openPragna('rewrite');
      } },
      { id: 'home-ai-title', key:'home-ai-title', title:'Pragna Title Generator', tab:'ai', keywords:['pragna','ai','title','headline','rename','ollama'], run: () => {
        useUIStore.getState().openPragna('title');
      } },
      { id: 'home-ai-translate', key:'home-ai-translate', title:'Pragna Translation', tab:'ai', keywords:['pragna','ai','translate','language','ollama'], run: () => {
        useUIStore.getState().openPragna('translate');
      } },
      { id: 'home-ai-web-research', key:'home-ai-web-research', title:'Pragna Web Research', tab:'ai', keywords:['pragna','web','research','search','google news','arxiv','wikipedia'], run: () => {
        useUIStore.getState().openPragna('research');
      } },
      { id: 'home-ai-url-reader', key:'home-ai-url-reader', title:'Pragna URL Reader', tab:'ai', keywords:['pragna','url','web','link','article','summarize url'], run: () => {
        useUIStore.getState().openPragna('urlReader');
      } },

      // ── Insert Tab ──
      { id: 'ins-coverpage',   key:'ins-coverpage',    title: 'Cover Page',     tab: 'insert',keywords: ['cover page','title page','cover'], run: () => { }, },
      { id: 'ins-blankpage',   key:'ins-blankpage',    title: 'Blank Page',     tab: 'insert',keywords: ['blank page','new page'], run: () => { }, },
      { id: 'ins-pagebreak',   key:'ins-pagebreak',    title: 'Page Break',     tab: 'insert',keywords: ['page break','break'], run: () => { }, },
      { id: 'ins-table',       key: 'ins-table',       title: 'Insert Table',   tab: 'insert',keywords: ['table','insert table','grid'], run: () => openDialog('insertTable'), },
      { id: 'ins-pictures',    key: 'ins-pictures',    title: 'Insert Picture', tab: 'insert',keywords: ['picture','image','photo','insert','pictures'], run: () => openDialog('insertImage'), },
      { id: 'ins-shapes',      key: 'ins-shapes',      title: 'Insert Shapes',  tab: 'insert',keywords: ['shape','insert shape','vector','drawing'], run: () => openDialog('insertShape'), },
      { id: 'ins-icons',       key: 'ins-icons',       title: 'Insert Icons',   tab: 'insert',keywords: ['icon','insert icon','vector icon'], run: () => openDialog('insertSymbol'), },
      { id: 'ins-3d',          key: 'ins-3d',          title: 'Insert 3D Models',tab:'insert',keywords: ['3d model','3d','model'], run: () => openDialog('insertImage'), },
      { id: 'ins-smartart',    key: 'ins-smartart',    title: 'Insert SmartArt',tab: 'insert',keywords: ['smartart','diagram','smart art'], run: () => { }, },
      { id: 'ins-chart',       key: 'ins-chart',       title: 'Insert Chart',   tab: 'insert',keywords: ['chart','graph','insert chart','visualization'], run: () => openDialog('insertChart'), },
      { id: 'ins-screenshot',  key: 'ins-screenshot',  title: 'Insert Screenshot',tab:'insert',keywords: ['screenshot','screen capture','snip'], run: () => openDialog('insertImage'), },
      { id: 'ins-onlinevideo', key: 'ins-onlinevideo', title: 'Insert Online Video',tab:'insert',keywords: ['video','online video'], run: () => openDialog('insertLink'), },
      { id: 'ins-link',        key: 'ins-link',        title: 'Insert Link',    tab: 'insert',keywords: ['link','hyperlink','url','url link'], run: () => openDialog('insertLink'), },
      { id: 'ins-bookmark',    key: 'ins-bookmark',    title: 'Insert Bookmark',tab: 'insert',keywords: ['bookmark','mark','anchor'], run: () => { }, },
      { id: 'ins-crossref',    key: 'ins-crossref',    title: 'Insert Cross-Reference',tab:'insert',keywords: ['cross reference','crossref','ref'], run: () => { }, },
      { id: 'ins-comment',     key: 'ins-comment',     title: 'Insert Comment', tab: 'insert',keywords: ['comment','note','margin comment'], run: () => { }, },
      { id: 'ins-header',      key: 'ins-header',      title: 'Insert Header',  tab: 'insert',keywords: ['header','page header','top'], run: () => { }, },
      { id: 'ins-footer',      key: 'ins-footer',      title: 'Insert Footer',  tab: 'insert',keywords: ['footer','page footer'], run: () => openDialog('headerFooter'), },
      { id: 'ins-pagenum',     key: 'ins-pagenum',     title: 'Insert Page Number', tab:'insert',keywords:['page number','pagination'], run: () => openDialog('headerFooter'), },
      { id: 'ins-textbox',     key: 'ins-textbox',     title: 'Insert Text Box', tab: 'insert',keywords:['text box','textbox','draw text'], run: () => { }, },
      { id: 'ins-quickparts',  key: 'ins-quickparts',  title: 'Quick Parts',    tab: 'insert',keywords:['quick parts','template part','reusable'], run: () => { }, },
      { id: 'ins-signature',   key: 'ins-signature',   title: 'Signature Line',  tab: 'insert',keywords:['signature','esig','e-signature','sign'], run: () => { }, },
      { id: 'ins-wordart',     key: 'ins-wordart',     title: 'WordArt',         tab: 'insert',keywords:['wordart','word art','text art'], run: () => openDialog('wordArt'), },
      { id: 'ins-dropcap',     key: 'ins-dropcap',     title: 'Drop Cap',        tab: 'insert',keywords:['drop cap','large letter','initial'], run: () => { }, },
      { id: 'ins-datetime',    key: 'ins-datetime',    title: 'Date & Time',     tab: 'insert',keywords:['date','time','datetime','timestamp'], run: () => { }, },
      { id: 'ins-object',      key: 'ins-object',      title: 'Insert Object',   tab: 'insert',keywords:['object','embed','insert object'], run: () => { }, },
      { id: 'ins-equation',    key: 'ins-equation',    title: 'Insert Equation', tab: 'insert',keywords:['equation','math','formula','symbols equation'], run: () => openDialog('equation'), },
      { id: 'ins-symbol',      key: 'ins-symbol',      title: 'Insert Symbol',   tab: 'insert',keywords:['symbol','special character','insert symbol'], run: () => openDialog('insertSymbol'), },
      { id: 'ins-esign',       key: 'ins-esign',       title: 'eSignature Fields',tab:'insert',keywords:['esign','e-signature','esignature','signature fields'], run: () => { }, },
      // ── Draw Tab ──
      { id: 'draw-draw',       key: 'draw-draw',       title: 'Draw',        tab: 'draw', keywords:['draw','inking','freehand'], run: () => { }, },
      { id: 'draw-highlight',  key: 'draw-highlight',  title: 'Highlighter', tab: 'draw', keywords:['highlighter','mark','highlight ink'], run: () => { }, },
      { id: 'draw-pen',        key: 'draw-pen',        title: 'Pen',         tab: 'draw', keywords:['pen','drawing','ink'], run: () => { }, },
      { id: 'draw-eraser',     key: 'draw-eraser',     title: 'Eraser',      tab: 'draw', keywords:['eraser','erase','remove ink'], run: () => { }, },
      // ── Layout Tab ──
      { id: 'layout-margins',  key: 'layout-margins',  title: 'Set Margins',    tab: 'layout', keywords:['margins','page margin','margin setup'], run: () => { }, },
      { id: 'layout-orientation',key:'layout-orientation',title:'Orientation',tab:'layout',keywords:['orientation','portrait','landscape'], run: () => { }, },
      { id: 'layout-pagesize', key: 'layout-pagesize', title: 'Page Size',      tab: 'layout', keywords:['page size','paper size','a4','letter','legal','a3'], run: () => { }, },
      { id: 'layout-columns',  key: 'layout-columns',  title: 'Set Columns',    tab: 'layout', keywords:['columns','column layout','multi column'], run: () => { }, },
      { id: 'layout-breaks',   key: 'layout-breaks',   title: 'Page Breaks',    tab: 'layout', keywords:['page break','section break','breaks'], run: () => { }, },
      { id: 'layout-linenum',  key: 'layout-linenum',  title: 'Line Numbers',   tab: 'layout', keywords:['line numbers','lines','numbered lines'], run: () => { }, },
      { id: 'layout-hyphen',   key: 'layout-hyphen',   title: 'Hyphenation',    tab: 'layout', keywords:['hyphenation','hyphenate','auto hyphenate'], run: () => { }, },
      { id: 'layout-alignimg', key: 'layout-alignimg', title: 'Align Image',    tab: 'layout', keywords:['align image','image alignment','picture alignment'], run: () => { }, },
      { id: 'layout-wrap',     key: 'layout-wrap',     title: 'Wrap Text',      tab: 'layout', keywords:['wrap text','text wrap','float image'], run: () => { }, },
      { id: 'layout-size',     key: 'layout-size',     title: 'Resize Image',   tab: 'layout', keywords:['resize image','image size','scale'], run: () => { }, },
      { id: 'layout-removeimg',key: 'layout-removeimg',title:'Remove Image',   tab: 'layout', keywords:['remove image','delete image'], run: () => { }, },
      { id: 'layout-layerup',  key: 'layout-layerup',  title: 'Bring Forward',  tab: 'layout', keywords:['bring forward','layer up','z-index'], run: () => { }, },
      { id: 'layout-layerdown',key: 'layout-layerdown',title:'Send Backward',  tab: 'layout', keywords:['send backward','layer down'], run: () => { }, },
      { id: 'layout-selectionpane',key:'layout-selectionpane',title:'Selection Pane',tab:'layout',keywords:['selection pane','sidebar','navigate'], run: () => { }, },
      { id: 'layout-alignorg', key: 'layout-alignorg', title: 'Align Objects',  tab: 'layout', keywords:['align objects','align','left align'], run: () => { }, },
      { id: 'layout-group',    key: 'layout-group',    title: 'Group Objects',  tab: 'layout', keywords:['group','group objects'], run: () => { }, },
      { id: 'layout-rotate',   key: 'layout-rotate',   title: 'Rotate Object',  tab: 'layout', keywords:['rotate','rotate image','rotation'], run: () => { }, },
      { id: 'layout-indentleft',key:'layout-indentleft',title:'Left Indent',   tab: 'layout', keywords:['left indent','indent'], run: () => { }, },
      { id: 'layout-indentright',key:'layout-indentright',title:'Right Indent',tab:'layout',keywords:['right indent'], run: () => { }, },
      { id: 'layout-sbefore',  key: 'layout-sbefore',  title: 'Spacing Before', tab: 'layout', keywords:['spacing before','paragraph before','margin top'], run: () => { }, },
      { id: 'layout-safter',   key: 'layout-safter',   title: 'Spacing After',  tab: 'layout', keywords:['spacing after','paragraph after','margin bottom'], run: () => { }, },
      // ── Reference Tab ──
      { id: 'ref-toc',         key:'ref-toc',          title: 'Table of Contents',tab:'reference',keywords:['toc','table of contents','contents'], run: () => { }, },
      { id: 'ref-footnotes',   key:'ref-footnotes',    title: 'Footnotes',      tab: 'reference',keywords:['footnotes','footnote','bottom note'], run: () => { }, },
      { id: 'ref-endnotes',    key:'ref-endnotes',     title: 'Endnotes',       tab: 'reference',keywords:['endnotes','end note'], run: () => { }, },
      { id: 'ref-citation',    key:'ref-citation',     title: 'Insert Citation',tab: 'reference',keywords:['citation','cite','bibliography'], run: () => { }, },
      { id: 'ref-captions',    key:'ref-captions',     title: 'Insert Captions',tab: 'reference',keywords:['caption','figure caption','table caption'], run: () => { }, },
      { id: 'ref-index',       key:'ref-index',        title: 'Mark Entry / Index',tab:'reference',keywords:['index','mark entry'], run: () => { }, },
      { id: 'ref-tbloffigs',   key:'ref-tbloffigs',    title: 'Table of Figures',tab:'reference',keywords:['table of figures','figures list'], run: () => { }, },
      // ── Mailings Tab ──
      { id: 'mail-envelopes',  key:'mail-envelopes',   title: 'Envelopes',      tab: 'mailings',keywords:['envelope','mail envelope','addressee'], run: () => { }, },
      { id: 'mail-labels',     key:'mail-labels',      title: 'Labels',         tab: 'mailings',keywords:['labels','mailing labels','address label'], run: () => { }, },
      { id: 'mail-start_mailmerge',key:'mail-start_mailmerge',title:'Start Mail Merge',tab:'mailings',keywords:['mail merge','merge','merge mail'], run: () => { }, },
      { id: 'mail-preview_results',key:'mail-preview_results',title:'Preview Results',tab:'mailings',keywords:['preview mail merge','preview results'], run: () => { }, },
      { id: 'mail-finish',     key:'mail-finish',      title: 'Finish & Merge', tab: 'mailings',keywords:['finish merge','complete mail merge'], run: () => { }, },
      { id: 'mail-wizard',     key:'mail-wizard',      title: 'Mail Merge Wizard',tab:'mailings',keywords:['mail merge wizard','wizard'], run: () => { }, },
      // ── Review Tab ──
      { id: 'rev-spell',       key: 'rev-spell',       title: 'Spelling & Grammar',tab:'review',keywords:['spelling','grammar','spell check','abc','f7'], run: () => { }, },
      { id: 'rev-thesaurus',   key: 'rev-thesaurus',   title: 'Thesaurus',      tab: 'review',keywords:['thesaurus','synonym','word book'], run: () => { }, },
      { id: 'rev-wordcount',   key: 'rev-wordcount',   title: 'Word Count',     tab: 'review',keywords:['word count','count words','characters'], run: () => openDialog('wordCount'), },
      { id: 'rev-readaloud',   key: 'rev-readaloud',   title: 'Text-to-Speech', tab: 'review',keywords:['read aloud','tts','text to speech','listen'], run: () => runReadAloud({ editor, toast }) },
      { id: 'rev-accessibility',key:'rev-accessibility',title:'Check Accessibility',tab:'review',keywords:['accessibility','a11y','check accessible'], run: () => openDialog('accessibility'), },
      { id: 'rev-translate',   key: 'rev-translate',   title: 'Translate',      tab: 'review',keywords:['translate','language','google translate'], run: () => { }, },
      { id: 'rev-lang',        key: 'rev-lang',        title: 'Set Language',   tab: 'review',keywords:['language','proofing language','dictionary'], run: () => openDialog('language'), },
      { id: 'rev-newcomment',  key: 'rev-newcomment',  title: 'New Comment',    tab: 'review',keywords:['new comment','add comment','comment'], run: () => { }, },
      { id: 'rev-delcomment',  key: 'rev-delcomment',  title: 'Delete Comment', tab: 'review',keywords:['delete comment','remove comment'], run: () => { }, },
      { id: 'rev-prevcomment', key:'rev-prevcomment',   title: 'Previous Comment',tab:'review',keywords:['prev comment','last comment'], run: () => { }, },
      { id: 'rev-nextcomment', key:'rev-nextcomment',   title: 'Next Comment',   tab: 'review',keywords:['next comment','next remark'], run: () => { }, },
      { id: 'rev-showcomments',key:'rev-showcomments',  title: 'Show All Comments',tab:'review',keywords:['show comments','view comments','all comments'], run: () => openDialog('comments'), },
      { id: 'rev-trackchanges',key:'rev-trackchanges',  title: 'Track Changes',   tab: 'review',keywords:['track changes','change tracking'], run: () => { }, },
      { id: 'rev-acceptchange',key:'rev-acceptchange',  title: 'Accept Change',   tab: 'review',keywords:['accept change','approve change'], run: () => { }, },
      { id: 'rev-rejectchange',key:'rev-rejectchange',  title: 'Reject Change',   tab: 'review',keywords:['reject change','decline change'], run: () => { }, },
      { id: 'rev-prevchange',  key:'rev-prevchange',    title: 'Previous Change', tab: 'review',keywords:['prev change','last change'], run: () => { }, },
      { id: 'rev-nextchange',  key:'rev-nextchange',    title: 'Next Change',     tab: 'review',keywords:['next change'], run: () => { }, },
      { id: 'rev-markupall',   key:'rev-markupall',     title: 'All Markup View', tab: 'review',keywords:['all markup','markup view'], run: () => { }, },
      { id: 'rev-showmarkup',  key:'rev-showmarkup',    title: 'Show Markup',     tab: 'review',keywords:['show markup','view markup'], run: () => { }, },
      { id: 'rev-pane',        key:'rev-pane',          title: 'Reviewing Pane',  tab: 'review',keywords:['reviewing pane','review pane'], run: () => { }, },
      { id: 'rev-history',     key:'rev-history',       title: 'Version History', tab: 'review',keywords:['version history','history','changes history'], run: () => openDialog('versionHistory'), },
      { id: 'rev-compare',     key:'rev-compare',       title: 'Compare Documents',tab:'review',keywords:['compare','diff','compare documents'], run: () => openDialog('compareDocuments'), },
      { id: 'rev-blockauth',   key:'rev-blockauth',     title: 'Block Authors',   tab: 'review',keywords:['block authors','author protection'], run: () => { }, },
      { id: 'rev-restrict',    key:'rev-restrict',      title: 'Restrict Editing',tab:'review',keywords:['restrict editing','protect','lock document'], run: () => openDialog('restrictEditing'), },
      { id: 'rev-hideink',     key:'rev-hideink',       title: 'Hide Ink',        tab: 'review',keywords:['hide ink','ink'], run: () => { }, },
      { id: 'rev-dictate',     key:'rev-dictate',       title: 'Voice Typing',    tab: 'review',keywords:['dictate','speech','voice to text','speech recognition'], run: () => runDictation({ editor, toast }) },
      { id: 'rev-ocr',         key:'rev-ocr',           title: 'OCR (Image to Text)', tab: 'review',keywords:['ocr','image to text','scan text','extract text'], run: () => runImageTextCapture({ editor, toast, mode: 'ocr' }) },
      { id: 'rev-handwriting', key:'rev-handwriting',   title: 'Handwriting Recognition', tab: 'review',keywords:['handwriting','recognition','notes','image text'], run: () => runImageTextCapture({ editor, toast, mode: 'handwriting' }) },
      { id: 'rev-smart-suggestions', key:'rev-smart-suggestions', title: 'Smart Suggestions', tab: 'review', keywords:['suggestions','smart','ai help','rewrite','summarize'], run: () => runSmartSuggestions({ editor, toast }) },
      { id: 'rev-readability', key:'rev-readability', title: 'Readability Dashboard', tab: 'review', keywords:['readability','flesch','grade level','clarity','stats'], run: () => openDialog('readability') },
      { id: 'sec-security', key:'sec-security', title: 'Document Security & Encryption', tab: 'design', keywords:['security','encrypt','password','lock','protect'], run: () => openDialog('security') },
      { id: 'ins-buildingblocks', key:'ins-buildingblocks', title: 'Building Blocks & AutoText', tab: 'insert', keywords:['autotext','building blocks','snippets','quick parts'], run: () => openDialog('buildingBlocks') },
      { id: 'help-remapshortcuts', key:'help-remapshortcuts', title: 'Remap Keyboard Shortcuts', tab: 'help', keywords:['remap','keyboard shortcuts','custom shortcuts','hotkeys'], run: () => openDialog('shortcuts') },
      { id: 'rev-mergeconflict', key:'rev-mergeconflict', title: 'Three-Way Merge Conflict Resolution', tab: 'review', keywords:['merge','conflict','diff','three-way merge'], run: () => openDialog('mergeConflict') },
      { id: 'layout-masterdoc', key:'layout-masterdoc', title: 'Master Document & Subdocuments', tab: 'layout', keywords:['master document','subdocuments','chapters','compose'], run: () => openDialog('masterDoc') },
      { id: 'home-styleinspector', key:'home-styleinspector', title: 'Style Inspector & Formatting', tab: 'home', keywords:['style inspector','styles','clear formatting','overrides'], run: () => openDialog('styleInspector') },
      // ── View Tab ──
      { id: 'view-print',      key:'view-print',       title: 'Print Layout',    tab: 'view',keywords:['print layout','reading view','print'], run: () => { }, },
      { id: 'view-web',        key:'view-web',         title: 'Web Layout',      tab: 'view',keywords:['web layout','web view'], run: () => { }, },
      { id: 'view-outline',    key:'view-outline',     title: 'Outline View',    tab: 'view',keywords:['outline','outline view'], run: () => { }, },
      { id: 'view-draft',      key:'view-draft',       title: 'Draft View',      tab: 'view',keywords:['draft view','draft','edit view'], run: () => { }, },
      { id: 'view-read',       key:'view-read',        title: 'Read Mode',       tab: 'view',keywords:['read mode','read only','view reading'], run: () => { }, },
      { id: 'view-focus',      key:'view-focus',       title: 'Focus Mode',      tab: 'view',keywords:['focus mode','distraction free','focus'], run: () => { }, },
      { id: 'view-sidebar',    key:'view-sidebar',     title: 'Toggle Sidebar',  tab: 'view',keywords:['sidebar','toggle sidebar','side panel'], run: () => { }, },
      { id: 'view-ruler',      key:'view-ruler',       title: 'Toggle Ruler',    tab: 'view',keywords:['ruler','show ruler','ruler toggle'], run: () => { }, },
      { id: 'view-grid',       key:'view-grid',        title: 'Toggle Gridlines',tab: 'view',keywords:['gridlines','grid','show grid'], run: () => { }, },
      { id: 'view-navpane',    key:'view-navpane',     title: 'Navigation Pane', tab: 'view',keywords:['navigation pane','nav pane','headings'], run: () => { }, },
      { id: 'view-zoomout',    key:'view-zoomout',     title: 'Zoom Out',        tab: 'view',keywords:['zoom out','shrink','zoom'], run: () => { }, },
      { id: 'view-zoomin',     key:'view-zoomin',      title: 'Zoom In',         tab: 'view',keywords:['zoom in','larger','zoom'], run: () => { }, },
      { id: 'view-zoom100',    key:'view-zoom100',     title: 'Zoom 100%',       tab: 'view',keywords:['100 percent','zoom 100'], run: () => { }, },
      { id: 'view-fitpage',    key:'view-fitpage',     title: 'Fit Page',        tab: 'view',keywords:['fit page','fit to page','full page'], run: () => { }, },
      { id: 'view-pagewidth',  key:'view-pagewidth',   title: 'Page Width',      tab: 'view',keywords:['page width','fit width'], run: () => { }, },
      { id: 'view-zoom75',     key:'view-zoom75',      title: 'Zoom 75%',        tab: 'view',keywords:['75 percent','zoom 75'], run: () => { }, },
      { id: 'view-newwin',     key:'view-newwin',      title: 'New Window',      tab: 'view',keywords:['new window','open new','split window'], run: () => { }, },
      { id: 'view-fullscreen', key:'view-fullscreen',   title: 'Toggle Fullscreen',tab:'view',keywords:['fullscreen','full screen','maximize'], run: () => { }, },
      { id: 'view-split',      key:'view-split',       title: 'Split View',      tab: 'view',keywords:['split view','side by side','split document'], run: () => { }, },
      { id: 'view-macros',     key:'view-macros',      title: 'Macros',          tab: 'view',keywords:['macro','macros','automate','script'], run: () => { }, },
      // ── Help Tab ──
      { id: 'help-help',       key:'help-help',        title: 'Help & Tutorials',tab: 'help',keywords:['help','tutorial','guide','help tutorial'], run: () => openDialog('help'), },
      { id: 'help-shortcuts',  key:'help-shortcuts',   title: 'Keyboard Shortcuts',tab:'help',keywords:['shortcuts','keyboard','keyboard shortcuts','command map'], run: () => openDialog('commandMap'), },
      { id: 'help-support',    key:'help-support',     title: 'Contact Support', tab: 'help',keywords:['support','contact support','helpdesk'], run: () => { }, },
      { id: 'help-feedback',   key:'help-feedback',    title: 'Send Feedback',   tab: 'help',keywords:['feedback','suggest','send feedback'], run: () => { }, },
      { id: 'help-training',   key:'help-training',    title: 'Show Training',   tab: 'help',keywords:['training','learn','tutorials'], run: () => openDialog('whatsNew'), },
      { id: 'help-whatsnew',   key:'help-whatsnew',    title: "What's New",      tab: 'help',keywords:['whats new','new features','changelog'], run: () => openDialog('whatsNew'), },
      { id: 'help-community',  key:'help-community',   title: 'Community',        tab: 'help',keywords:['community','github','source code'], run: () => { }, },
      { id: 'help-suggest',    key:'help-suggest',     title: 'Suggest a Feature',tab: 'help',keywords:['suggest','feature request','idea'], run: () => { }, },
      { id: 'help-about',      key:'help-about',       title: 'About EtherX Word',tab: 'help',keywords:['about','version','info'], run: () => { }, },
      { id: 'help-privacy',    key:'help-privacy',     title: 'Privacy Policy',   tab: 'help',keywords:['privacy','privacy policy'], run: () => { }, },
      { id: 'help-updates',    key:'help-updates',     title: 'Check for Updates',tab: 'help',keywords:['updates','check updates','new version'], run: () => { }, },
      // ── Design Tab ──
      { id: 'design-themes',   key:'design-themes',    title: 'Apply Theme',     tab: 'design',keywords:['theme','document theme','apply theme'], run: () => { }, },
      { id: 'design-colors',   key:'design-colors',    title: 'Theme Colors',    tab: 'design',keywords:['theme colors','colors','color set'], run: () => { }, },
      { id: 'design-fonts',    key:'design-fonts',     title: 'Theme Fonts',     tab: 'design',keywords:['theme fonts','font set','design fonts'], run: () => { }, },
      { id: 'design-spacing',  key:'design-spacing',   title: 'Paragraph Spacing',tab:'design',keywords:['paragraph spacing','line spacing','spacing'], run: () => { }, },
      { id: 'design-effects',  key:'design-effects',   title: 'Document Effects',tab: 'design',keywords:['effects','document effects','visual effects'], run: () => { }, },
      { id: 'design-default',  key:'design-default',   title: 'Set as Default',  tab: 'design',keywords:['set as default','default formatting'], run: () => { }, },
      { id: 'design-watermark',key:'design-watermark', title: 'Insert Watermark',tab: 'design',keywords:['watermark','draft','background text'], run: () => { }, },
      { id: 'design-pagecolor',key:'design-pagecolor', title: 'Page Color',      tab: 'design',keywords:['page color','color page','background'], run: () => { }, },
      { id: 'design-pageborder',key:'design-pageborder',title:'Page Border',     tab: 'design',keywords:['page border','borders','page border shading'], run: () => { }, },
      { id: 'design-filleffect',key:'design-filleffect',title:'Page Border Fill Effects',tab:'design',keywords:['fill effects','page shading'], run: () => { }, },
      // ── Draw Tab ──
      { id: 'tool-draw',       key:'tool-draw',        title: 'Drawing Tool',    tab: 'draw',keywords:['draw','draw tool','ink drawing'], run: () => { }, },
      { id: 'tool-highlighter',key:'tool-highlighter', title: 'Highlighter Tool', tab: 'draw',keywords:['highlighter','mark tool'], run: () => { }, },
      { id: 'tool-pen',        key:'tool-pen',         title: 'Pen Tool',        tab: 'draw',keywords:['pen','inking','pen tool'], run: () => { }, },
      { id: 'tool-eraser',     key:'tool-eraser',      title: 'Eraser Tool',     tab: 'draw',keywords:['eraser','clear ink','erase'], run: () => { }, },
      // ── File Tab ──
      { id: 'file-new',        key:'file-new',         title: 'New',             tab: 'file', keywords:['new','new document','create new'], run: () => { }, },
      { id: 'file-open',       key:'file-open',        title: 'Open',            tab: 'file', keywords:['open','open file','open document'], run: () => { }, },
      { id: 'file-save',       key:'file-save',        title: 'Save',            tab: 'file', keywords:['save','save file','save document'], run: () => { }, },
      { id: 'file-export',     key:'file-export',      title: 'Export / Print',  tab: 'file', keywords:['export','print','pdf','docx','save as'], run: () => openDialog('exportDoc'), },
      { id: 'file-settings',   key:'file-settings',    title: 'Settings',        tab: 'file', keywords:['settings','preferences','options','config'], run: () => { }, },
    ];
  }, [actions, openDialog]);

  // Filter the fallback list by query using the same scoring logic as searchCommands.
  const filteredFallback = useMemo(() => {
    const list = coreFallback || [];
    if (!query.trim()) return list;
    const q = query.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(Boolean);
    return list
      .map((item) => {
        const hay = [item.title, item.tab, ...(item.keywords || [])].join(' ').toLowerCase();
        let score = 0;
        if (hay.includes(q)) score += 60;
        if (item.title.toLowerCase().includes(q)) score += 60;
        if (item.tab?.toLowerCase().includes(q)) score += 25;
        tokens.forEach((t) => { if (hay.includes(t)) score += 10; });
        if (tokens.some((t) => item.title.toLowerCase().startsWith(t))) score += 12;
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [coreFallback, query]);

  const filtered = (actions && actions.length) ? actions : filteredFallback;

  // Ensure core fallbacks are interactive even when the registry is not populated.
  useEffect(() => {

    if (!open) return;
    setActiveIdx(0);
  }, [query, open]);

  useEffect(() => {
    const onDown = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const runAction = (action) => {
    setOpen(false);
    setQuery('');
    setActiveIdx(0);

    const tab = action.tab;

    // Switch tab first (best-effort). Some older builds don't pass onActivateTab,
    // so we only call it if present.
    if (tab) {
      if (tab === 'file') {
        onActivateTab?.('file');
      } else {
        onActivateTab?.(tab);
        setActiveTab(tab);
      }
    }

    // Execute (must not be a no-op for available items)
    try {
      const actionId = action.id || action.key;
      if (actionId && editor) {
        switch (actionId) {
          case 'home-bold':
            editor.chain().focus().toggleBold().run();
            return;
          case 'home-italic':
            editor.chain().focus().toggleItalic().run();
            return;
          case 'home-underline':
            editor.chain().focus().toggleUnderline().run();
            return;
          case 'home-strike':
            editor.chain().focus().toggleStrike().run();
            return;
          case 'home-subscript':
            editor.chain().focus().toggleSubscript().run();
            return;
          case 'home-superscript':
            editor.chain().focus().toggleSuperscript().run();
            return;
          case 'home-alignleft':
            editor.chain().focus().setTextAlign('left').run();
            return;
          case 'home-aligncenter':
            editor.chain().focus().setTextAlign('center').run();
            return;
          case 'home-alignright':
            editor.chain().focus().setTextAlign('right').run();
            return;
          case 'home-justify':
            editor.chain().focus().setTextAlign('justify').run();
            return;
          case 'home-bullets':
            editor.chain().focus().toggleBulletList().run();
            return;
          case 'home-ordered':
            editor.chain().focus().toggleOrderedList().run();
            return;
          case 'home-tasklist':
            editor.chain().focus().toggleTaskList().run();
            return;
          case 'home-blockquote':
            editor.chain().focus().toggleBlockquote().run();
            return;
          case 'home-undo':
            editor.chain().focus().undo().run();
            return;
          case 'home-redo':
            editor.chain().focus().redo().run();
            return;
          case 'home-selectall':
            editor.chain().focus().selectAll().run();
            return;
          case 'ins-pagebreak':
          case 'ins-blankpage':
          case 'layout-breaks':
            editor.chain().focus().insertPageBreak().run();
            return;
          case 'layout-margins':
          case 'layout-orientation':
          case 'layout-pagesize':
          case 'layout-columns':
            openDialog('pageSetup');
            return;
          case 'design-watermark': {
            const input = window.prompt('Watermark text (leave blank to remove):', watermarkText || 'DRAFT');
            if (input !== null) {
              const trimmed = input.trim();
              if (trimmed === '') {
                setWatermarkText('');
                toast('Watermark removed', 'success');
              } else {
                setWatermarkText(trimmed);
                toast('Watermark added', 'success');
              }
            }
            return;
          }
          case 'design-pagecolor':
            setActiveTab('design');
            toast('Select Page Color from the Design tab', 'info');
            return;
          case 'design-pageborder':
            setActiveTab('design');
            toast('Select Page Border from the Design tab', 'info');
            return;
          case 'home-paste':
            navigator.clipboard.readText().then(text => {
              if (text) editor.chain().focus().insertContent(text).run();
            }).catch(() => toast('Paste blocked by browser permissions', 'warning'));
            return;
          case 'home-copy': {
            const { from, to } = editor.state.selection;
            if (from !== to) {
              const text = editor.state.doc.textBetween(from, to, ' ');
              navigator.clipboard.writeText(text);
              toast('Text copied to clipboard', 'success');
            } else {
              toast('Select some text first', 'info');
            }
            return;
          }
          case 'home-cut': {
            const { from, to } = editor.state.selection;
            if (from !== to) {
              const text = editor.state.doc.textBetween(from, to, ' ');
              navigator.clipboard.writeText(text);
              editor.chain().focus().deleteSelection().run();
              toast('Text cut to clipboard', 'success');
            } else {
              toast('Select some text first', 'info');
            }
            return;
          }
        }
      }

      if (typeof action.run === 'function') {
        action.run();
      } else if (tab) {
        // Fallback: if we only have tab info, at least open Help for the category.
        // This prevents “click does nothing” situations.
        openDialog('help');
      }
    } catch (e) {
      console.error(e);
      toast('Could not execute this feature', 'error');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setActiveIdx(0);
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.max(0, i - 1));
      return;
    }

    if (e.key === 'Enter') {
      if (filtered.length > 0) {
        e.preventDefault();
        runAction(filtered[activeIdx] || filtered[0]);
      } else if (query.trim()) {
        e.preventDefault();
        setOpen(false);
        setFindQuery(query.trim());
        openDialog('findReplace');
      }
      return;
    }
  };

  const showDropdown = open && filtered.length > 0;

  return (
    <div
      ref={boxRef}
      style={{
        position: 'relative',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: hasFocus ? 260 : compactWidth,
          transition: 'width 140ms ease',
        }}
        onMouseEnter={() => setHasFocus(true)}
        onMouseLeave={() => setHasFocus(false)}
      >
        <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
          <svg
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 13,
              height: 13,
              color: hasFocus ? 'var(--gold)' : 'var(--text-muted)',
              pointerEvents: 'none',
              transition: 'color 0.12s ease',
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <Input
            value={query}
            onChange={(v) => {
              setQuery(v);
              setOpen(true);
            }}
            placeholder={hasFocus ? "Type a feature, command, or action..." : "Tell me what to do..."}
            width="100%"
            type="text"
            autoFocus={false}
            onKeyDown={onKeyDown}
            style={{
              paddingLeft: 27,
              height: 25,
              fontSize: 11,
              borderRadius: 4,
              border: hasFocus ? '1px solid var(--gold)' : '1px solid var(--border)',
              background: 'var(--bg-elevated)',
            }}
          />
        </div>
      </div>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 34,
            width: hasFocus ? 400 : compactWidth,
            maxWidth: 520,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 2000,
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '6px 10px',
            fontSize: 10,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--border)',
          }}>
            Suggestions
          </div>

          {filtered.map((a, idx) => {
            const active = idx === activeIdx;
            return (
              <button
                key={a.id || a.key || a.title}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runAction(a)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 10px',
                  background: active ? 'var(--bg-hover)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.title}
                </span>
                {a.tab && (
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      border: '1px solid color-mix(in srgb, var(--border) 70%, transparent)',
                      padding: '2px 6px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.tab === 'file' ? 'File' : a.tab === 'ai' ? 'AI' : a.tab[0].toUpperCase() + a.tab.slice(1)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

