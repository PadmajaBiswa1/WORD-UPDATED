import { useState, useEffect } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { Modal, Button, Input, Label, Stack } from '@/components/ui';
import { useDocumentSearch } from '@/hooks/useDocumentSearch';

export function FindReplaceDialog() {
  const { closeDialog, toast, findQuery, setFindQuery } = useUIStore();
  const { editor } = useEditorStore();

  const [findText, setFindText] = useState(findQuery || '');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);

  const {
    count,
    currentIndex,
    search,
    next,
    prev,
    replaceCurrent,
    replaceAll,
    clear,
  } = useDocumentSearch(editor);

  // Trigger search on query or case sensitivity change
  useEffect(() => {
    if (findText) {
      search(findText, caseSensitive);
    } else {
      clear();
    }
  }, [findText, caseSensitive, search, clear]);

  // Initial search if prefilled
  useEffect(() => {
    if (findQuery) {
      setFindText(findQuery);
    }
  }, [findQuery]);

  const handleClose = () => {
    clear();
    setFindQuery('');
    closeDialog('findReplace');
  };

  const handleReplaceOne = () => {
    const success = replaceCurrent(replaceText);
    if (success) {
      toast('Replaced match', 'success');
    } else {
      toast('No match to replace', 'info');
    }
  };

  const handleReplaceAll = () => {
    const replacedCount = replaceAll(replaceText);
    if (replacedCount > 0) {
      toast(`Replaced ${replacedCount} occurrence${replacedCount !== 1 ? 's' : ''}`, 'success');
    } else {
      toast('No matches found to replace', 'info');
    }
  };

  const hasMatches = count > 0;

  return (
    <Modal title="Find & Replace" onClose={handleClose} width={450}>
      <Stack gap={14}>
        <div>
          <Label>Find</Label>
          <Input
            value={findText}
            onChange={(v) => setFindText(v)}
            placeholder="Search text in document…"
            autoFocus
          />
          {findText && (
            <div
              style={{
                fontSize: 11,
                color: hasMatches ? 'var(--gold)' : 'var(--text-muted)',
                marginTop: 5,
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
              }}
            >
              {hasMatches
                ? `${currentIndex + 1} of ${count} match${count !== 1 ? 'es' : ''}`
                : 'No matches found.'}
            </div>
          )}
        </div>

        <div>
          <Label>Replace With</Label>
          <Input
            value={replaceText}
            onChange={(v) => setReplaceText(v)}
            placeholder="Replacement text…"
          />
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            color: 'var(--text-primary)',
          }}
        >
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
          />
          <span>Match case</span>
        </label>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="subtle" onClick={handleClose}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={prev}
            disabled={!hasMatches}
            title="Previous match"
          >
            ◀ Prev
          </Button>
          <Button
            variant="outline"
            onClick={next}
            disabled={!hasMatches}
            title="Next match"
          >
            ▶ Next
          </Button>
          <Button
            variant="outline"
            onClick={handleReplaceOne}
            disabled={!hasMatches}
          >
            Replace
          </Button>
          <Button
            variant="primary"
            onClick={handleReplaceAll}
            disabled={!hasMatches}
          >
            Replace All
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
