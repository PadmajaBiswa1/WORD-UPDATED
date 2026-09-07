import { useState, useCallback, useEffect, useRef } from 'react';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const SEARCH_HIGHLIGHT_KEY = new PluginKey('documentSearchHighlight');

export function useDocumentSearch(editor) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const matchesRef = useRef([]);
  const currentIndexRef = useRef(-1);

  matchesRef.current = matches;
  currentIndexRef.current = currentIndex;

  // Find all matches in ProseMirror doc
  const findMatches = useCallback((q, cs) => {
    if (!editor || !q) return [];
    const results = [];
    const needle = cs ? q : q.toLowerCase();
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText) return;
      const text = cs ? node.text : node.text.toLowerCase();
      let start = 0;
      while (true) {
        const idx = text.indexOf(needle, start);
        if (idx === -1) break;
        results.push({ from: pos + idx, to: pos + idx + needle.length });
        start = idx + 1;
      }
    });
    return results;
  }, [editor]);

  // Apply highlight decorations to editor view
  const applyDecorations = useCallback((matchList, activeIdx) => {
    if (!editor || !editor.view) return;

    if (!matchList || matchList.length === 0) {
      const nextPlugins = editor.state.plugins.filter((p) => p.spec.key !== SEARCH_HIGHLIGHT_KEY);
      editor.view.updateState(editor.state.reconfigure({ plugins: nextPlugins }));
      return;
    }

    const decorations = matchList.map((m, i) =>
      Decoration.inline(m.from, m.to, {
        class: i === activeIdx ? 'pm-search-current' : 'pm-search-match',
        style: i === activeIdx
          ? 'background: #d4af37; color: #000; font-weight: 700; border-radius: 2px; box-shadow: 0 0 0 2px rgba(212,175,55,0.7);'
          : 'background: rgba(255, 235, 59, 0.45); color: inherit; border-radius: 2px;',
      })
    );

    const plugin = new Plugin({
      key: SEARCH_HIGHLIGHT_KEY,
      state: {
        init: () => DecorationSet.create(editor.state.doc, decorations),
        apply: (tr, old) => {
          if (tr.docChanged) return old.map(tr.mapping, tr.doc);
          return old;
        },
      },
      props: {
        decorations(state) {
          return this.getState(state);
        },
      },
    });

    const nextPlugins = editor.state.plugins
      .filter((p) => p.spec.key !== SEARCH_HIGHLIGHT_KEY)
      .concat(plugin);

    editor.view.updateState(editor.state.reconfigure({ plugins: nextPlugins }));
  }, [editor]);

  // Scroll active match into view
  const scrollToMatch = useCallback((idx, matchList) => {
    if (!editor || !matchList || !matchList[idx]) return;
    const target = matchList[idx];
    try {
      editor.chain().focus().setTextSelection(target).scrollIntoView().run();

      const scrollArea = document.getElementById('editor-scroll-area');
      if (scrollArea && editor.view) {
        const coords = editor.view.coordsAtPos(target.from);
        if (coords) {
          const scrollRect = scrollArea.getBoundingClientRect();
          if (coords.top < scrollRect.top + 60 || coords.bottom > scrollRect.bottom - 60) {
            scrollArea.scrollTo({
              top: scrollArea.scrollTop + (coords.top - scrollRect.top) - (scrollRect.height / 2),
              behavior: 'smooth',
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }, [editor]);

  // Execute search
  const search = useCallback((searchQuery, isCaseSensitive = caseSensitive) => {
    setQuery(searchQuery);
    setCaseSensitive(isCaseSensitive);

    if (!searchQuery) {
      setMatches([]);
      setCurrentIndex(-1);
      applyDecorations([], -1);
      return [];
    }

    const found = findMatches(searchQuery, isCaseSensitive);
    setMatches(found);
    const newIdx = found.length > 0 ? 0 : -1;
    setCurrentIndex(newIdx);
    applyDecorations(found, newIdx);
    if (newIdx >= 0) {
      scrollToMatch(newIdx, found);
    }
    return found;
  }, [caseSensitive, findMatches, applyDecorations, scrollToMatch]);

  // Navigate to next match
  const next = useCallback(() => {
    const list = matchesRef.current;
    if (!list.length) return -1;
    const nextIdx = (currentIndexRef.current + 1) % list.length;
    setCurrentIndex(nextIdx);
    applyDecorations(list, nextIdx);
    scrollToMatch(nextIdx, list);
    return nextIdx;
  }, [applyDecorations, scrollToMatch]);

  // Navigate to previous match
  const prev = useCallback(() => {
    const list = matchesRef.current;
    if (!list.length) return -1;
    const prevIdx = (currentIndexRef.current - 1 + list.length) % list.length;
    setCurrentIndex(prevIdx);
    applyDecorations(list, prevIdx);
    scrollToMatch(prevIdx, list);
    return prevIdx;
  }, [applyDecorations, scrollToMatch]);

  // Replace current match
  const replaceCurrent = useCallback((replacementText = '') => {
    if (!editor || !query) return false;
    const list = findMatches(query, caseSensitive);
    if (!list.length) return false;

    const idx = Math.max(0, Math.min(currentIndexRef.current, list.length - 1));
    const target = list[idx];
    if (!target) return false;

    const tr = editor.state.tr.insertText(replacementText, target.from, target.to);
    editor.view.dispatch(tr);

    // Re-scan after replacement
    const updated = findMatches(query, caseSensitive);
    setMatches(updated);
    const nextIdx = updated.length > 0 ? Math.min(idx, updated.length - 1) : -1;
    setCurrentIndex(nextIdx);
    applyDecorations(updated, nextIdx);
    if (nextIdx >= 0) {
      scrollToMatch(nextIdx, updated);
    }
    return true;
  }, [editor, query, caseSensitive, findMatches, applyDecorations, scrollToMatch]);

  // Replace all matches in a single transaction
  const replaceAll = useCallback((replacementText = '') => {
    if (!editor || !query) return 0;
    const list = findMatches(query, caseSensitive);
    if (!list.length) return 0;

    let tr = editor.state.tr;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      tr = tr.insertText(replacementText, m.from, m.to);
    }
    editor.view.dispatch(tr);

    const updated = findMatches(query, caseSensitive);
    setMatches(updated);
    setCurrentIndex(updated.length > 0 ? 0 : -1);
    applyDecorations(updated, updated.length > 0 ? 0 : -1);
    return list.length;
  }, [editor, query, caseSensitive, findMatches, applyDecorations]);

  // Clear decorations
  const clear = useCallback(() => {
    setQuery('');
    setMatches([]);
    setCurrentIndex(-1);
    applyDecorations([], -1);
  }, [applyDecorations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editor && editor.view) {
        const nextPlugins = editor.state.plugins.filter((p) => p.spec.key !== SEARCH_HIGHLIGHT_KEY);
        editor.view.updateState(editor.state.reconfigure({ plugins: nextPlugins }));
      }
    };
  }, [editor]);

  return {
    query,
    caseSensitive,
    matches,
    currentIndex,
    count: matches.length,
    search,
    next,
    prev,
    replaceCurrent,
    replaceAll,
    clear,
  };
}
