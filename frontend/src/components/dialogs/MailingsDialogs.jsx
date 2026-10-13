import { useEffect, useMemo, useState } from 'react';
import { useEditorStore, useUIStore } from '@/store';
import { Button, Input, Label, Modal, Stack } from '@/components/ui';

import { loadRecipients, saveRecipients, csvToRecipients, recipientsToCsv, mergeDocumentHtml, extractFields, escapeMailHtml, labelSheetHtml, saveMailingConfig, mailingConfig } from '@/utils/mailMerge';

const DEFAULT_RECIPIENTS = [
  { FirstName: 'Ava', LastName: 'Carter', Address: '12 River Road', City: 'Seattle', State: 'WA', Zip: '98101', Email: 'ava@example.com' },
  { FirstName: 'Noah', LastName: 'Patel', Address: '88 Market Street', City: 'Austin', State: 'TX', Zip: '78701', Email: 'noah@example.com' },
];

function insertHtml(editor, html) {
  if (!editor) return false;
  editor.chain().focus().insertContent(html).run();
  editor.view?.focus();
  return true;
}

export function MailMergeDialog() {
  const { closeDialog, openDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [recipients, setRecipients] = useState(() => loadRecipients());
  const [csv, setCsv] = useState(() => recipientsToCsv(loadRecipients()));

  const fieldCount = useMemo(() => extractFields(recipients).length, [recipients]);

  const persist = (nextRecipients) => {
    setRecipients(nextRecipients);
    saveRecipients(nextRecipients);
    setCsv(recipientsToCsv(nextRecipients));
  };

  const loadSample = () => persist(DEFAULT_RECIPIENTS);

  const saveCsv = () => {
    let parsed;
    try { parsed = csvToRecipients(csv); } catch (error) { toast(error.message, 'error'); return false; }
    if (!parsed.length) {
      toast('Add at least one recipient row', 'info');
      return false;
    }
    persist(parsed);
    toast('Recipients saved', 'success');
    return true;
  };

  const saveCsvAndOpenRecipients = () => {
    if (!saveCsv()) return;
    closeDialog('mailMerge');
    openDialog('selectRecipients');
  };

  return (
    <Modal title="Mail Merge" onClose={() => closeDialog('mailMerge')} width={720}>
      <Stack gap={14}>
        <div>
          <Label>Recipients CSV</Label>
          <textarea
            aria-label="Recipients CSV"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={11}
            placeholder="FirstName,LastName,Address,City,State,Zip,Email"
            style={{ width: '100%', resize: 'vertical', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-ui)' }}
          />
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} loaded, {fieldCount} fields detected.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Button variant="subtle" onClick={loadSample}>Load Sample</Button>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Button variant="subtle" onClick={() => closeDialog('mailMerge')}>Close</Button>
            <Button variant="outline" onClick={saveCsvAndOpenRecipients}>Select Recipients</Button>
            <Button variant="primary" onClick={saveCsv}>Save Recipients</Button>
          </div>
        </div>

        <div>
          <Label>Preview</Label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', background: 'var(--bg-elevated)', maxHeight: 180, overflow: 'auto' }}>
            {recipients.map((recipient, index) => (
              <div key={`${recipient.Email || index}`} style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
                {recipient.FirstName || recipient.firstName || 'Recipient'} {recipient.LastName || recipient.lastName || ''} • {recipient.Email || recipient.email || 'no email'}
              </div>
            ))}
          </div>
        </div>
      </Stack>
    </Modal>
  );
}

export function SelectRecipientsDialog() {
  const { closeDialog, toast } = useUIStore();
  const [recipients, setRecipients] = useState(() => loadRecipients());
  const [csv, setCsv] = useState(() => recipientsToCsv(loadRecipients()));

  const save = () => {
    let parsed;
    try { parsed = csvToRecipients(csv); } catch (error) { toast(error.message, 'error'); return false; }
    if (!parsed.length) {
      toast('Add at least one recipient row', 'info');
      return;
    }
    setRecipients(parsed);
    saveRecipients(parsed);
    toast('Recipients selected', 'success');
    closeDialog('selectRecipients');
  };

  return (
    <Modal title="Select Recipients" onClose={() => closeDialog('selectRecipients')} width={680}>
      <Stack gap={14}>
        <div>
          <Label>CSV Input</Label>
          <textarea
            aria-label="Recipients CSV"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={11}
            style={{ width: '100%', resize: 'vertical', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-ui)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Button variant="subtle" onClick={() => { setCsv(recipientsToCsv(DEFAULT_RECIPIENTS)); setRecipients(DEFAULT_RECIPIENTS); }}>Use Sample</Button>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Button variant="subtle" onClick={() => closeDialog('selectRecipients')}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save Selection</Button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} currently available.
        </div>
      </Stack>
    </Modal>
  );
}

export function EditRecipientsDialog() {
  const { closeDialog, toast } = useUIStore();
  const [recipients, setRecipients] = useState(() => loadRecipients());

  const updateField = (rowIndex, field, value) => {
    setRecipients((current) => current.map((recipient, index) => (index === rowIndex ? { ...recipient, [field]: value } : recipient)));
  };

  const addRecipient = () => setRecipients((current) => [...current, { FirstName: '', LastName: '', Address: '', City: '', State: '', Zip: '', Email: '' }]);

  const save = () => {
    const cleaned = recipients.filter((recipient) => Object.values(recipient).some((value) => String(value || '').trim()));
    saveRecipients(cleaned);
    toast('Recipient list updated', 'success');
    closeDialog('editRecipients');
  };

  return (
    <Modal title="Edit Recipient List" onClose={() => closeDialog('editRecipients')} width={760}>
      <Stack gap={14}>
        <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)' }}>
          {recipients.map((recipient, index) => (
            <div key={index} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[...new Set(['FirstName', 'LastName', 'Address', 'City', 'State', 'Zip', 'Email', ...extractFields(recipients)])].map((field) => (
                  <Input
                    key={field}
                    value={recipient[field] || ''}
                    onChange={(value) => updateField(index, field, value)}
                    placeholder={field}
                  />
                ))}
              </div>
              <Button variant="subtle" onClick={() => setRecipients((current) => current.filter((_, row) => row !== index))}>Remove Recipient {index + 1}</Button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Button variant="subtle" onClick={addRecipient}>Add Recipient</Button>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Button variant="subtle" onClick={() => closeDialog('editRecipients')}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save Changes</Button>
          </div>
        </div>
      </Stack>
    </Modal>
  );
}

export function InsertMergeFieldDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [field, setField] = useState('FirstName');
  const [customField, setCustomField] = useState('');

  const insertField = () => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }

    const name = (customField.trim() || field.trim()).replace(/[^A-Za-z0-9_]/g, '');
    if (!name) {
      toast('Choose or enter a merge field name', 'info');
      return;
    }

    insertHtml(editor, `{{${name}}}`);
    toast(`Merge field inserted: ${name}`, 'success');
    closeDialog('insertMergeField');
  };

  return (
    <Modal title="Insert Merge Field" onClose={() => closeDialog('insertMergeField')} width={460}>
      <Stack gap={14}>
        <div>
          <Label>Common Fields</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[...new Set([...extractFields(loadRecipients()), 'FirstName', 'LastName', 'Address', 'City', 'State', 'Zip', 'Email'])].map((item) => (
              <Button key={item} variant={field === item ? 'primary' : 'subtle'} onClick={() => { setField(item); setCustomField(''); }}>{item}</Button>
            ))}
          </div>
        </div>
        <div>
          <Label>Custom Field</Label>
          <Input value={customField} onChange={setCustomField} placeholder="Optional custom field" />
        </div>
        <div>
          <Label>Preview</Label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', background: 'var(--bg-elevated)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
            {`{{${(customField.trim() || field).replace(/[^A-Za-z0-9_]/g, '') || 'Field'}}}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('insertMergeField')}>Cancel</Button>
          <Button variant="primary" onClick={insertField}>Insert Field</Button>
        </div>
      </Stack>
    </Modal>
  );
}

export function GreetingLineDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [recipients] = useState(() => loadRecipients());
  const availableFields = useMemo(() => extractFields(recipients), [recipients]);
  const [mode, setMode] = useState('firstName');
  const [customGreeting, setCustomGreeting] = useState('Dear {{FirstName}},');

  useEffect(() => {
    if (!availableFields.length) return;
    if (!availableFields.includes('FirstName')) {
      setMode('custom');
      setCustomGreeting(`Dear {{${availableFields[0]}}},`);
    }
  }, [availableFields]);

  const buildGreeting = () => {
    if (mode === 'custom') {
      return customGreeting.trim() || 'Dear {{FirstName}},';
    }

    if (mode === 'lastName') {
      return 'Dear {{LastName}},';
    }

    if (mode === 'firstLast') {
      return 'Dear {{FirstName}} {{LastName}},';
    }

    return 'Dear {{FirstName}},';
  };

  const insertGreeting = () => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }

    const greeting = buildGreeting();
    insertHtml(editor, `<p>${escapeMailHtml(greeting)}</p>`);
    toast('Greeting line inserted', 'success');
    closeDialog('greetingLine');
  };

  return (
    <Modal title="Greeting Line" onClose={() => closeDialog('greetingLine')} width={520}>
      <Stack gap={14}>
        <div>
          <Label>Greeting Style</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant={mode === 'firstName' ? 'primary' : 'subtle'} onClick={() => setMode('firstName')}>Dear First Name</Button>
            <Button variant={mode === 'firstLast' ? 'primary' : 'subtle'} onClick={() => setMode('firstLast')}>Dear First and Last Name</Button>
            <Button variant={mode === 'lastName' ? 'primary' : 'subtle'} onClick={() => setMode('lastName')}>Dear Last Name</Button>
            <Button variant={mode === 'custom' ? 'primary' : 'subtle'} onClick={() => setMode('custom')}>Custom</Button>
          </div>
        </div>

        {mode === 'custom' && (
          <div>
            <Label>Custom Greeting</Label>
            <Input value={customGreeting} onChange={setCustomGreeting} placeholder="Dear {{FirstName}}," />
          </div>
        )}

        <div>
          <Label>Preview</Label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', background: 'var(--bg-elevated)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
            {buildGreeting()}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          Uses your mail-merge recipient fields when available, like Microsoft Word’s greeting line.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('greetingLine')}>Cancel</Button>
          <Button variant="primary" onClick={insertGreeting}>Insert Greeting</Button>
        </div>
      </Stack>
    </Modal>
  );
}

export function EnvelopesDialog() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [recipient, setRecipient] = useState('Recipient Name\nRecipient Street\nCity, State ZIP');
  const [sender, setSender] = useState('Sender Name\nSender Street\nCity, State ZIP');

  const insertEnvelope = () => {
    if (!editor) {
      toast('Editor is not ready yet', 'error');
      return;
    }

    if (!recipient.trim() || !sender.trim()) {
      toast('Recipient and sender addresses are required', 'error');
      return;
    }

    const recipientEscaped = String(recipient).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const senderEscaped = String(sender).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const html = `<p style="font-size:12px;">From: ${senderEscaped.replace(/\n/g, '<br>')}</p><p style="font-size:18px;text-align:center;padding:32px;border:1px solid #ccc;">${recipientEscaped.replace(/\n/g, '<br>')}</p>`;

    try {
      insertHtml(editor, html);
      toast('✓ Envelope inserted', 'success');
      closeDialog('envelopes');
    } catch (error) {
      toast('Failed to insert envelope: ' + error?.message, 'error');
    }
  };

  return (
    <Modal title="Envelopes" onClose={() => closeDialog('envelopes')} width={560}>
      <Stack gap={14}>
        <div>
          <Label>Recipient Address</Label>
          <Input value={recipient} onChange={setRecipient} placeholder="Recipient address" rows={4} />
        </div>
        <div>
          <Label>Return Address</Label>
          <Input value={sender} onChange={setSender} placeholder="Sender address" rows={3} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('envelopes')}>Cancel</Button>
          <Button variant="primary" onClick={insertEnvelope}>Insert Envelope</Button>
        </div>
      </Stack>
    </Modal>
  );
}

export function LabelsDialog({ updateExisting = false } = {}) {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [recipients] = useState(() => loadRecipients());
  const [columns, setColumns] = useState(mailingConfig().labels?.columns || 2);
  const [rows, setRows] = useState(mailingConfig().labels?.rows || 5);

  const insertLabels = () => {
    if (!editor) {
      toast('Editor is not ready yet', 'error');
      return;
    }

    if (!recipients.length) {
      toast('No recipients available. Add recipients first', 'error');
      return;
    }

    if (columns < 1 || rows < 1) {
      toast('Columns and rows must be at least 1', 'error');
      return;
    }

    try {
      const html = labelSheetHtml(recipients, rows, columns);
      let existing = null;
      if (updateExisting) editor.state.doc.descendants((node, pos) => { if (node.type.name === 'table' && node.attrs.id === 'etherx-mailing-labels') existing = { node, pos }; });
      if (existing) editor.chain().focus().insertContentAt({ from: existing.pos, to: existing.pos + existing.node.nodeSize }, html).run();
      else insertHtml(editor, html);
      saveMailingConfig({ labels: { rows, columns } });
      toast(`✓ Label sheet inserted (${rows}x${columns})`, 'success');
      closeDialog(updateExisting ? 'updateLabels' : 'labels');
    } catch (error) {
      toast('Failed to insert labels: ' + error?.message, 'error');
    }
  };

  return (
    <Modal title={updateExisting ? "Update Labels" : "Labels"} onClose={() => closeDialog(updateExisting ? 'updateLabels' : 'labels')} width={560}>
      <Stack gap={14}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label>Columns</Label>
            <Input aria-label="Label columns" value={String(columns)} onChange={(v) => setColumns(Math.max(1, Math.min(4, Number(v) || 1)))} />
          </div>
          <div>
            <Label>Rows</Label>
            <Input aria-label="Label rows" value={String(rows)} onChange={(v) => setRows(Math.max(1, Math.min(10, Number(v) || 1)))} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          Inserts a label grid using your selected recipients.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="subtle" onClick={() => closeDialog('labels')}>Cancel</Button>
          <Button variant="primary" onClick={insertLabels}>{updateExisting ? 'Update Labels' : 'Insert Labels'}</Button>
        </div>
      </Stack>
    </Modal>
  );
}

export function PreviewMergeDialog({ previewOnly = false } = {}) {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const [recipients] = useState(() => loadRecipients());
  const [index, setIndex] = useState(() => Math.max(0, Math.min(recipients.length - 1, Number(localStorage.getItem('etherx-preview-index')) || 0)));
  useEffect(() => { localStorage.setItem('etherx-preview-index', String(index)); window.dispatchEvent(new Event('etherx:recipients-change')); }, [index]);

  const current = recipients[index] || null;
  const previewHtml = current ? mergeDocumentHtml(editor?.getHTML() || '', current) : '';

  const insertPreview = () => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }

    if (!current) {
      toast('No recipients available', 'info');
      return;
    }

    editor.commands.setContent(previewHtml, true);
    toast(`Preview generated for ${current.FirstName || 'recipient'}`, 'success');
    closeDialog('finishMerge');
  };

  const insertAllMerged = () => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }

    if (!recipients.length) {
      toast('No recipients available', 'info');
      return;
    }

    const template = editor.getHTML();
    const merged = recipients.map((recipient) => mergeDocumentHtml(template, recipient)).join('<div data-page-break="true" data-manual="true"></div>');
    editor.commands.setContent(merged, true);
    toast('Merged copies generated', 'success');
    closeDialog('finishMerge');
  };

  return (
    <Modal title={previewOnly ? 'Preview Results' : 'Finish & Merge'} onClose={() => closeDialog(previewOnly ? 'previewMerge' : 'finishMerge')} width={760}>
      <Stack gap={14}>
        <div>
          <Label>Preview Recipient</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="subtle" disabled={index <= 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>Previous</Button>
            <Button variant="subtle" disabled={index >= recipients.length - 1} onClick={() => setIndex((value) => Math.min(recipients.length - 1, value + 1))}>Next</Button>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', alignSelf: 'center' }}>
              {current ? `${current.FirstName || ''} ${current.LastName || ''}`.trim() || 'Recipient' : 'No recipients'}
            </div>
          </div>
        </div>

        <div>
          <Label>Preview Output</Label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px', background: 'var(--bg-elevated)', minHeight: 160, maxHeight: 260, overflow: 'auto', fontSize: 13, fontFamily: 'var(--font-ui)' }}>
            {previewHtml ? <div dangerouslySetInnerHTML={{ __html: previewHtml }} /> : 'No preview available.'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Button variant="subtle" onClick={() => closeDialog(previewOnly ? 'previewMerge' : 'finishMerge')}>Close</Button>
          {!previewOnly && <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <Button variant="outline" disabled={!current} onClick={insertPreview}>Insert Current Preview</Button>
            <Button variant="primary" disabled={!recipients.length} onClick={insertAllMerged}>Merge All</Button>
          </div>}
        </div>
      </Stack>
    </Modal>
  );
}

export function MatchFieldsDialog() {
  const { closeDialog, toast } = useUIStore();
  const fields = extractFields(loadRecipients());
  const [mapping, setMapping] = useState(mailingConfig().mapping || {});
  const common = ['FirstName', 'LastName', 'Address', 'City', 'State', 'Zip', 'Email'];
  return <Modal title="Match Fields" onClose={() => closeDialog('matchFields')} width={520}><Stack gap={12}>
    {common.map((field) => <Label key={field}>{field}<select aria-label={`Map ${field}`} value={mapping[field] || (fields.includes(field) ? field : '')} onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}><option value="">Not matched</option>{fields.map((source) => <option key={source}>{source}</option>)}</select></Label>)}
    <Button variant="primary" onClick={() => { saveMailingConfig({ mapping }); closeDialog('matchFields'); toast('Field matching saved', 'success'); }}>Save Matching</Button>
  </Stack></Modal>;
}

export function MergeRulesDialog() {
  const { editor } = useEditorStore();
  const { closeDialog, toast } = useUIStore();
  const fields = extractFields(loadRecipients());
  const [field, setField] = useState(fields[0] || 'FirstName');
  const [yes, setYes] = useState('Hello {{FirstName}}');
  const [no, setNo] = useState('Hello there');
  return <Modal title="Merge Rules" onClose={() => closeDialog('mergeRules')} width={520}><Stack gap={12}>
    <Label>When this field has a value<select aria-label="Rule field" value={field} onChange={(event) => setField(event.target.value)}>{fields.map((name) => <option key={name}>{name}</option>)}</select></Label>
    <Input aria-label="Rule when present" value={yes} onChange={setYes} />
    <Input aria-label="Rule when empty" value={no} onChange={setNo} />
    <Button variant="primary" onClick={() => { if (!editor?.isEditable) return; insertHtml(editor, `<p>{{#if ${field}}}${escapeMailHtml(yes)}{{else}}${escapeMailHtml(no)}{{/if}}</p>`); closeDialog('mergeRules'); toast('Conditional rule inserted', 'success'); }}>Insert Rule</Button>
  </Stack></Modal>;
}

export function FindRecipientDialog() {
  const { closeDialog, toast } = useUIStore();
  const recipients = loadRecipients();
  const [query, setQuery] = useState('');
  return <Modal title="Find Recipient" onClose={() => closeDialog('findRecipient')} width={520}><Stack gap={12}>
    <Input aria-label="Find recipient" value={query} onChange={setQuery} placeholder="Name, email, or address" autoFocus />
    {recipients.map((recipient, index) => ({ recipient, index })).filter(({ recipient }) => Object.values(recipient).some((value) => String(value).toLowerCase().includes(query.toLowerCase()))).map(({ recipient, index }) => <Button key={index} onClick={() => { localStorage.setItem('etherx-preview-index', String(index)); window.dispatchEvent(new Event('etherx:recipients-change')); closeDialog('findRecipient'); toast(`Selected recipient ${index + 1}`, 'success'); }}>{index + 1}. {recipient.FirstName || recipient.Name || recipient.Email || Object.values(recipient)[0]} {recipient.LastName || ''}</Button>)}
  </Stack></Modal>;
}
