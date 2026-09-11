import { useRef, useState } from 'react';
import {
  BookOpen, Plus, RefreshCw, FileText, ArrowDownToLine, ArrowRight, Eye,
  Quote, Library, Tag, Book, ShieldCheck, Captions, ListOrdered, Table,
  ExternalLink, BookmarkPlus, ListFilter, Scale, ScrollText, GraduationCap, Search
} from 'lucide-react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { Button, Tooltip } from '@/components/ui';
import { RibbonGroup } from '../RibbonGroup';
import {
  buildTocHtml,
  getHeadingOutline,
  syncHeadingIds,
  scanFigures,
  buildTofHtml,
  scanTables,
  buildTotHtml,
  buildIndexData,
  buildIndexHtml,
  upsertReferenceSection,
} from '@/components/dialogs/ReferenceDialogs';

const INDEX_STORE_KEY = 'etherx-reference-index-entries';
const AUTH_STORE_KEY = 'etherx-reference-authority-entries';

function selectedText(editor) {
  if (!editor) return '';
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, ' ').trim();
}

function readEntryStore(key) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntryStore(key, values) {
  window.localStorage.setItem(key, JSON.stringify(values));
}

function dedupeSorted(values = []) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ReferenceTab() {
  const { toast, openDialog } = useUIStore();
  const { editor } = useEditorStore();
  const nextFootnoteIndex = useRef(0);
  const [notesVisible, setNotesVisible] = useState(true);

  const keepSelectionOnMouseDown = (event) => {
    event.preventDefault();
  };

  const run = (fn) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    fn?.();
    editor.view?.focus();
  };

  const insertHtml = (html) => run(() => editor.chain().focus().insertContent(html).run());

  const upsertListSection = (heading, values = []) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return false;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = editor.getHTML();
    const safeValues = values.filter(Boolean);
    const listHtml = safeValues.length
      ? safeValues.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')
      : '<li style="color:#666;">No entries found.</li>';
    const sectionHtml = `<h2>${escapeHtml(heading)}</h2><ol>${listHtml}</ol>`;

    const headings = [...wrapper.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    const targetHeading = headings.find((node) => node.textContent?.trim().toLowerCase() === heading.toLowerCase());
    if (targetHeading) {
      const nextSibling = targetHeading.nextElementSibling;
      const box = document.createElement('div');
      box.innerHTML = sectionHtml;
      const newHeading = box.querySelector('h2');
      const newList = box.querySelector('ol');
      if (newHeading && newList) {
        targetHeading.replaceWith(newHeading);
        if (nextSibling && (nextSibling.tagName === 'OL' || nextSibling.tagName === 'UL')) nextSibling.replaceWith(newList);
        else newHeading.insertAdjacentElement('afterend', newList);
      }
    } else {
      wrapper.insertAdjacentHTML('beforeend', sectionHtml);
    }

    editor.commands.setContent(wrapper.innerHTML, false);
    editor.view?.focus();
    return true;
  };

  const insertCitation = () => openDialog('insertCitation');
  const manageSources = () => openDialog('manageSources');
  const insertBibliography = () => openDialog('bibliography');
  const insertToc = () => openDialog('tableOfContents');

  const addTextToToc = () => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }

    const { from, to } = editor.state.selection;
    if (from === to) {
      toast('Select heading text first to add it to the table of contents', 'info');
      return;
    }

    const selected = editor.state.doc.textBetween(from, to, ' ').trim();
    if (!selected) {
      toast('Select heading text first to add it to the table of contents', 'info');
      return;
    }

    run(() => editor.chain().focus().setTextSelection({ from, to }).setHeading({ level: 2 }).run());
    toast('Selected text promoted to heading for TOC', 'success');
  };

  const updateToc = () => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }

    const currentHtml = syncHeadingIds(editor.getHTML());
    const wrapper = document.createElement('div');
    wrapper.innerHTML = currentHtml;

    const tocContainer = document.createElement('div');
    tocContainer.innerHTML = buildTocHtml(getHeadingOutline(editor));
    const nextToc = tocContainer.firstElementChild;
    if (!nextToc) {
      toast('Unable to build table of contents', 'error');
      return;
    }

    const headings = [...wrapper.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    const tocHeading = headings.find((node) => node.textContent?.trim().toLowerCase() === 'table of contents');
    if (tocHeading) {
      const nextSibling = tocHeading.nextElementSibling;
      const tocWrap = document.createElement('div');
      tocWrap.innerHTML = buildTocHtml(getHeadingOutline(editor));
      const newHeading = tocWrap.querySelector('h2');
      const newList = tocWrap.querySelector('ol,ul');
      if (newHeading && newList) {
        tocHeading.replaceWith(newHeading);
        if (nextSibling && (nextSibling.tagName === 'OL' || nextSibling.tagName === 'UL')) nextSibling.replaceWith(newList);
        else newHeading.insertAdjacentElement('afterend', newList);
      }
    } else {
      wrapper.prepend(nextToc);
    }

    editor.commands.setContent(wrapper.innerHTML, false);
    editor.view?.focus();
    toast('Table of contents updated', 'success');
  };

  const jumpToNextFootnote = () => {
    if (!editor) return toast('Editor is not ready yet', 'info');
    const root = editor.view?.dom;
    if (!root) return;
    const notes = [...root.querySelectorAll('sup')].filter((node) => /\[(\d+|[a-zA-Z]+)\]/.test(node.textContent || ''));
    if (!notes.length) {
      toast('No footnotes found', 'info');
      return;
    }
    const next = notes[nextFootnoteIndex.current % notes.length];
    nextFootnoteIndex.current = (nextFootnoteIndex.current + 1) % notes.length;
    next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Moved to next footnote', 'success');
  };

  const toggleNotesVisibility = () => {
    if (!editor) return;
    const root = editor.view?.dom;
    const noteBodies = [...root.querySelectorAll('p')].filter((node) => {
      const t = node.textContent || '';
      return t.includes('Footnote:') || t.includes('Endnote:');
    });
    if (!noteBodies.length) {
      toast('No note details found', 'info');
      return;
    }
    const shouldHide = notesVisible;
    noteBodies.forEach((note) => {
      note.style.display = shouldHide ? 'none' : '';
    });
    setNotesVisible(!shouldHide);
    toast(shouldHide ? 'Notes hidden' : 'Notes shown', 'success');
  };

  const insertCaption = () => {
    if (!editor) return;
    const type = window.confirm('Click OK for Figure caption, or Cancel for Table caption') ? 'Figure' : 'Table';
    const num = (type === 'Figure' ? scanFigures(editor).length : scanTables(editor).length) + 1;
    const captionText = (window.prompt(`Enter ${type} caption`, `${type} ${num}: Description`) || '').trim();
    if (!captionText) return;
    const id = `${type.toLowerCase()}-${Date.now()}`;
    useDocumentStore.getState().addCaption?.({ id, type: type.toLowerCase(), text: captionText, label: `${type} ${num}` });
    insertHtml(`<p id="${id}" data-caption-type="${type.toLowerCase()}"><strong>${escapeHtml(captionText)}</strong></p>`);
    toast(`${type} caption inserted`, 'success');
  };

  const insertTableOfFigures = () => {
    openDialog('tableOfFigures');
  };

  const insertTableOfTables = () => {
    openDialog('tableOfTables');
  };

  const updateCaptionsTable = () => {
    if (!editor) return;
    let updatedAny = false;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = editor.getHTML();

    if (wrapper.querySelector('[data-tof="true"]')) {
      const figs = scanFigures(editor);
      upsertReferenceSection(editor, '[data-tof="true"]', buildTofHtml(figs));
      updatedAny = true;
    }
    if (wrapper.querySelector('[data-tot="true"]')) {
      const tbls = scanTables(editor);
      upsertReferenceSection(editor, '[data-tot="true"]', buildTotHtml(tbls));
      updatedAny = true;
    }

    if (updatedAny) {
      toast('Table of Figures / Tables updated in place', 'success');
    } else {
      openDialog('tableOfFigures');
    }
  };

  const markIndexEntry = () => {
    if (!editor) return;
    const text = selectedText(editor);
    if (!text) {
      toast('Select text to mark as an index entry', 'info');
      return;
    }
    useDocumentStore.getState().addIndexEntry?.({ id: `idx-${Date.now()}`, term: text, page: 1 });
    const next = dedupeSorted([...readEntryStore(INDEX_STORE_KEY), text]);
    writeEntryStore(INDEX_STORE_KEY, next);
    toast(`Index entry marked: "${text}"`, 'success');
  };

  const insertIndex = () => {
    openDialog('insertIndex');
  };

  const updateIndex = () => {
    if (!editor) return;
    const storeEntries = useDocumentStore.getState().references?.indexEntries || [];
    const localEntries = readEntryStore(INDEX_STORE_KEY);
    const combined = [...storeEntries, ...localEntries];
    const grouped = buildIndexData(combined);
    const html = buildIndexHtml(grouped);
    upsertReferenceSection(editor, '[data-index="true"]', html);
    toast('Index refreshed in place', 'success');
  };

  const markCitation = () => {
    if (!editor) return;
    const text = selectedText(editor);
    if (!text) {
      toast('Select text to mark citation', 'info');
      return;
    }
    const next = dedupeSorted([...readEntryStore(AUTH_STORE_KEY), text]);
    writeEntryStore(AUTH_STORE_KEY, next);
    toast('Citation marked', 'success');
  };

  const insertAuthorities = () => {
    if (!editor) return;
    const entries = readEntryStore(AUTH_STORE_KEY);
    if (!entries.length) {
      toast('No marked citations found', 'info');
      return;
    }
    const unique = dedupeSorted(entries);
    if (upsertListSection('Table of Authorities', unique)) {
      toast('Table of authorities updated', 'success');
    }
  };

  const updateAuthorities = () => {
    insertAuthorities();
  };

  const smartLookup = () => {
    const query = selectedText(editor);
    if (!query) {
      toast('Select text to look up', 'info');
      return;
    }
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
    toast('Lookup opened in browser', 'success');
  };

  const openResearcher = () => {
    const query = selectedText(editor) || 'academic writing';
    window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
    toast('Researcher opened', 'success');
  };

function HeroBtn({ icon, label, onClick, onMouseDown, title, shortcut }) {
  return (
    <Tooltip text={title || label} shortcut={shortcut}>
      <button
        onMouseDown={onMouseDown}
        onClick={onClick}
        style={{
          border: '1px solid transparent',
          background: 'transparent',
          borderRadius: 3,
          cursor: 'pointer',
          color: 'var(--text-primary)',
          minWidth: 64,
          height: 74,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '4px 6px',
          fontFamily: 'var(--font-ui)',
          fontSize: 11,
          transition: 'background 0.1s, border-color 0.1s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }}
      >
        <div style={{ fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: 11, lineHeight: 1.1, textAlign: 'center' }}>{label}</span>
      </button>
    </Tooltip>
  );
}

function MiniAction({ icon, text, onClick, onMouseDown, title, shortcut }) {
  return (
    <Tooltip text={title || text} shortcut={shortcut}>
      <button
        onMouseDown={onMouseDown}
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: 22,
          padding: '0 6px',
          fontSize: 11,
          fontFamily: 'var(--font-ui)',
          border: '1px solid transparent',
          borderRadius: 2,
          background: 'transparent',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'background 0.1s, border-color 0.1s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }}
      >
        {icon && <span style={{ fontSize: 13, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
        <span>{text}</span>
      </button>
    </Tooltip>
  );
}

  return (
    <>
      <RibbonGroup label="Table of Contents">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<BookOpen size={20} strokeWidth={1.75} />} label="Contents" title="Insert Table of Contents" onMouseDown={keepSelectionOnMouseDown} onClick={insertToc} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<Plus size={13} strokeWidth={1.75} />} text="Add Text ▾" title="Add Text to Outline" onMouseDown={keepSelectionOnMouseDown} onClick={addTextToToc} />
            <MiniAction icon={<RefreshCw size={13} strokeWidth={1.75} />} text="Update Table" title="Update Table of Contents" onMouseDown={keepSelectionOnMouseDown} onClick={updateToc} />
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Footnotes">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<FileText size={20} strokeWidth={1.75} />} label="Footnote" title="Insert Footnote" shortcut="Alt+Ctrl+F" onMouseDown={keepSelectionOnMouseDown} onClick={() => insertHtml('<p><sup>[1]</sup> Footnote: Footnote text</p>')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<ArrowDownToLine size={13} strokeWidth={1.75} />} text="Insert Endnote" shortcut="Alt+Ctrl+D" onMouseDown={keepSelectionOnMouseDown} onClick={() => insertHtml('<p><sup>[a]</sup> Endnote: Endnote text</p>')} />
            <MiniAction icon={<ArrowRight size={13} strokeWidth={1.75} />} text="Next Footnote ▾" onMouseDown={keepSelectionOnMouseDown} onClick={jumpToNextFootnote} />
            <MiniAction icon={<Eye size={13} strokeWidth={1.75} />} text={notesVisible ? 'Hide Notes' : 'Show Notes'} onMouseDown={keepSelectionOnMouseDown} onClick={toggleNotesVisibility} />
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Citations & Bibliography">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<Quote size={20} strokeWidth={1.75} />} label="Citation" title="Insert Citation" onMouseDown={keepSelectionOnMouseDown} onClick={insertCitation} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<Library size={13} strokeWidth={1.75} />} text="Manage Sources" onMouseDown={keepSelectionOnMouseDown} onClick={manageSources} />
            <MiniAction icon={<Tag size={13} strokeWidth={1.75} />} text="Style: APA ▾" onMouseDown={keepSelectionOnMouseDown} onClick={() => openDialog('insertCitation')} />
            <MiniAction icon={<Book size={13} strokeWidth={1.75} />} text="Bibliography ▾" onMouseDown={keepSelectionOnMouseDown} onClick={insertBibliography} />
          </div>
          <HeroBtn icon={<ShieldCheck size={20} strokeWidth={1.75} />} label="Fact-Check" title="AI Citation Fact-Checking" onMouseDown={keepSelectionOnMouseDown} onClick={() => openDialog('citationFactCheck')} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Captions">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<Captions size={20} strokeWidth={1.75} />} label="Caption" title="Insert Caption (Figure or Table)" onMouseDown={keepSelectionOnMouseDown} onClick={insertCaption} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<ListOrdered size={13} strokeWidth={1.75} />} text="Figures Table" title="Insert Table of Figures" onMouseDown={keepSelectionOnMouseDown} onClick={insertTableOfFigures} />
            <MiniAction icon={<Table size={13} strokeWidth={1.75} />} text="Tables Table" title="Insert Table of Tables" onMouseDown={keepSelectionOnMouseDown} onClick={insertTableOfTables} />
            <MiniAction icon={<ExternalLink size={13} strokeWidth={1.75} />} text="Cross-reference" onMouseDown={keepSelectionOnMouseDown} onClick={() => {
              const picked = selectedText(editor) || (window.prompt('Cross-reference label', 'Reference') || 'Reference');
              run(() => editor.chain().insertContent(`[See: ${picked}]`).run());
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<RefreshCw size={13} strokeWidth={1.75} />} text="Update Table" title="Update Tables of Figures / Tables" onMouseDown={keepSelectionOnMouseDown} onClick={updateCaptionsTable} />
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Index">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<BookmarkPlus size={20} strokeWidth={1.75} />} label="Mark Entry" title="Mark Selected Text for Index" onMouseDown={keepSelectionOnMouseDown} onClick={markIndexEntry} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<ListFilter size={13} strokeWidth={1.75} />} text="Insert Index" title="Insert Alphabetical Index (A-Z)" onMouseDown={keepSelectionOnMouseDown} onClick={insertIndex} />
            <MiniAction icon={<RefreshCw size={13} strokeWidth={1.75} />} text="Update Index" title="Update Index" onMouseDown={keepSelectionOnMouseDown} onClick={updateIndex} />
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Table of Authorities">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<Scale size={20} strokeWidth={1.75} />} label="Mark" title="Mark Citation for Authorities" onMouseDown={keepSelectionOnMouseDown} onClick={markCitation} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<ScrollText size={13} strokeWidth={1.75} />} text="Insert Authorities" onMouseDown={keepSelectionOnMouseDown} onClick={insertAuthorities} />
            <MiniAction icon={<RefreshCw size={13} strokeWidth={1.75} />} text="Update Table" onMouseDown={keepSelectionOnMouseDown} onClick={updateAuthorities} />
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Research">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<GraduationCap size={20} strokeWidth={1.75} />} label="Researcher" title="Academic Researcher" onMouseDown={keepSelectionOnMouseDown} onClick={openResearcher} />
          <HeroBtn icon={<Search size={20} strokeWidth={1.75} />} label="Lookup" title="Smart Web Lookup" onMouseDown={keepSelectionOnMouseDown} onClick={smartLookup} />
        </div>
      </RibbonGroup>
    </>
  );
}
