import { useRef, useState } from 'react';
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

  const col = { display: 'flex', flexDirection: 'column', flexWrap: 'wrap', maxHeight: 82, height: 82, gap: 2, alignContent: 'flex-start' };
  const btn = { height: 25, display: 'inline-flex', alignItems: 'center', flexShrink: 0 };

  return (
    <>
      <RibbonGroup label="Table of Contents">
        <div style={col}>
          <Tooltip text="Table of Contents"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={insertToc}>≡ Contents</Button></Tooltip>
          <Tooltip text="Add Text"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={addTextToToc}>+ Add Text</Button></Tooltip>
          <Tooltip text="Update Table"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={updateToc}>↻ Update</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Footnotes">
        <div style={col}>
          <Tooltip text="Insert Footnote" shortcut="Alt+Ctrl+F"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={() => insertHtml('<p><sup>[1]</sup> Footnote: Footnote text</p>')}>¹ Footnote</Button></Tooltip>
          <Tooltip text="Insert Endnote" shortcut="Alt+Ctrl+D"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={() => insertHtml('<p><sup>[a]</sup> Endnote: Endnote text</p>')}>¹ Endnote</Button></Tooltip>
          <Tooltip text="Next Footnote"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={jumpToNextFootnote}>→ Next</Button></Tooltip>
          <Tooltip text="Show Notes"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={toggleNotesVisibility}>👁 Show</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Citations & Bibliography">
        <div style={col}>
          <Tooltip text="Insert Citation"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={insertCitation}>❝ Citation</Button></Tooltip>
          <Tooltip text="Manage Sources"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={manageSources}>📚 Sources</Button></Tooltip>
          <Tooltip text="Style"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={() => openDialog('insertCitation')}>APA Style</Button></Tooltip>
          <Tooltip text="Bibliography"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={insertBibliography}>📖 Biblio</Button></Tooltip>
          <Tooltip text="AI Citation Fact-Checking"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={() => openDialog('citationFactCheck')}>🛡 Fact-Check</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Captions">
        <div style={col}>
          <Tooltip text="Insert Caption (Figure or Table)"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={insertCaption}>🏷 Caption</Button></Tooltip>
          <Tooltip text="Insert Table of Figures"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={insertTableOfFigures}>≡ Figures</Button></Tooltip>
          <Tooltip text="Insert Table of Tables"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={insertTableOfTables}>≡ Tables</Button></Tooltip>
          <Tooltip text="Update Tables of Figures / Tables"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={updateCaptionsTable}>↻ Update</Button></Tooltip>
          <Tooltip text="Cross-reference"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={() => {
            const picked = selectedText(editor) || (window.prompt('Cross-reference label', 'Reference') || 'Reference');
            run(() => editor.chain().insertContent(`[See: ${picked}]`).run());
          }}>⇒ Cross-ref</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Index">
        <div style={col}>
          <Tooltip text="Mark Selected Text for Index"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={markIndexEntry}>✎ Mark Entry</Button></Tooltip>
          <Tooltip text="Insert Alphabetical Index (A-Z)"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={insertIndex}>≡ Index</Button></Tooltip>
          <Tooltip text="Update Index"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={updateIndex}>↻ Update</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Table of Authorities">
        <div style={col}>
          <Tooltip text="Mark Citation"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={markCitation}>✎ Mark</Button></Tooltip>
          <Tooltip text="Insert Table of Authorities"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={insertAuthorities}>≡ Authorities</Button></Tooltip>
          <Tooltip text="Update Table"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={updateAuthorities}>↻ Update</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Research">
        <div style={col}>
          <Tooltip text="Researcher"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={openResearcher}>🔬 Researcher</Button></Tooltip>
          <Tooltip text="Smart Lookup"><Button style={btn} onMouseDown={keepSelectionOnMouseDown} onClick={smartLookup}>🔍 Lookup</Button></Tooltip>
        </div>
      </RibbonGroup>
    </>
  );
}
