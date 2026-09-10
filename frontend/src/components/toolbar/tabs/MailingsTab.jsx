import { useUIStore, useEditorStore } from '@/store';
import { Button, Tooltip } from '@/components/ui';
import { RibbonGroup } from '../RibbonGroup';

const STORAGE_KEY = 'etherx-mailing-recipients';
const mergeTokenRegex = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

function loadRecipients() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractFields(recipients) {
  const fields = new Set();
  recipients.forEach((recipient) => Object.keys(recipient || {}).forEach((key) => fields.add(key)));
  return [...fields];
}

function mergeDocumentHtml(html, recipient) {
  return String(html || '').replace(mergeTokenRegex, (_, key) => String(recipient?.[key] ?? `{{${key}}}`));
}

export function MailingsTab() {
  const { toast, openDialog } = useUIStore();
  const { editor } = useEditorStore();

  const run = (fn) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    fn?.();
    editor.view?.focus();
  };

  const insertHtml = (html) => run(() => editor.chain().focus().insertContent(html).run());

  const startMailMerge = () => {
    const recipients = loadRecipients();
    if (!recipients.length) {
      toast('Add recipients first', 'info');
      openDialog('selectRecipients');
      return;
    }
    openDialog('mailMerge');
  };

  const withRecipients = (handler) => {
    const recipients = loadRecipients();
    if (!recipients.length) {
      toast('Add recipients first', 'info');
      openDialog('selectRecipients');
      return;
    }
    handler(recipients);
  };

  const setPreviewIndex = (nextIndex) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('etherx-preview-index', String(nextIndex));
  };

  const getPreviewIndex = () => {
    if (typeof window === 'undefined') return 0;
    const raw = window.localStorage.getItem('etherx-preview-index');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const navigateRecipient = (target) => withRecipients((recipients) => {
    const length = recipients.length;
    const current = getPreviewIndex();
    let next = current;
    if (target === 'first') next = 0;
    if (target === 'last') next = length - 1;
    if (target === 'next') next = (current + 1) % length;
    if (target === 'prev') next = (current - 1 + length) % length;
    setPreviewIndex(next);
    const r = recipients[next] || {};
    toast(`Recipient ${next + 1}/${length}: ${r.FirstName || ''} ${r.LastName || ''}`.trim(), 'info');
  });

  const findRecipient = () => withRecipients((recipients) => {
    const term = (window.prompt('Find recipient by name or email') || '').trim().toLowerCase();
    if (!term) return;
    const index = recipients.findIndex((r) => Object.values(r || {}).some((v) => String(v).toLowerCase().includes(term)));
    if (index === -1) {
      toast('No matching recipient found', 'info');
      return;
    }
    setPreviewIndex(index);
    const r = recipients[index] || {};
    toast(`Found: ${r.FirstName || ''} ${r.LastName || ''}`.trim(), 'success');
  });

  const highlightFields = () => {
    if (!editor) return toast('Editor is not ready yet', 'info');
    const html = editor.getHTML();
    const next = html.replace(mergeTokenRegex, (full) => `<mark data-etherx-merge-field="true" style="background:rgba(212,175,55,0.24);padding:1px 2px;border-radius:2px;">${full}</mark>`);
    if (next === html) {
      toast('No merge fields found in this document', 'info');
      return;
    }
    editor.commands.setContent(next, false);
    toast('Merge fields highlighted', 'success');
  };

  const insertRule = () => withRecipients((recipients) => {
    const fields = extractFields(recipients);
    const field = fields[0] || 'FirstName';
    insertHtml(`<p>{{#if ${field}}}Hello {{${field}}}{{else}}Hello there{{/if}}</p>`);
    toast(`Conditional rule inserted using ${field}`, 'success');
  });

  const insertMatchTemplate = () => withRecipients((recipients) => {
    const fields = extractFields(recipients);
    if (!fields.length) {
      toast('No fields available to match', 'info');
      return;
    }
    const rows = fields.map((field) => `<tr><td style="padding:4px 8px;border:1px solid #d8d8d8;">${field}</td><td style="padding:4px 8px;border:1px solid #d8d8d8;">{{${field}}}</td></tr>`).join('');
    insertHtml(`<table data-etherx-match-fields="true" style="border-collapse:collapse;margin:8px 0;"><thead><tr><th style="padding:4px 8px;border:1px solid #d8d8d8;">Source Field</th><th style="padding:4px 8px;border:1px solid #d8d8d8;">Merge Token</th></tr></thead><tbody>${rows}</tbody></table>`);
    toast('Match fields table inserted', 'success');
  });

  const checkMergeErrors = () => withRecipients((recipients) => {
    if (!editor) return;
    const html = editor.getHTML();
    const tokens = [...html.matchAll(mergeTokenRegex)].map((m) => m[1]);
    if (!tokens.length) {
      toast('No merge fields found', 'info');
      return;
    }
    const sample = recipients[0] || {};
    const missing = [...new Set(tokens)].filter((field) => !(field in sample));
    if (!missing.length) {
      toast('No merge errors found', 'success');
      return;
    }
    toast(`Missing fields: ${missing.join(', ')}`, 'warning');
  });

  const mergeToEmail = () => withRecipients((recipients) => {
    if (!editor) return;
    const index = Math.max(0, Math.min(recipients.length - 1, getPreviewIndex()));
    const recipient = recipients[index] || {};
    const merged = mergeDocumentHtml(editor.getHTML(), recipient)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const email = recipient.Email || '';
    if (!email) {
      toast('Selected recipient has no email address', 'warning');
      return;
    }
    window.open(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Mail merge document')}&body=${encodeURIComponent(merged.slice(0, 1800))}`, '_blank');
    toast(`Prepared email for ${email}`, 'success');
  });

  const mergeToPrint = () => withRecipients((recipients) => {
    if (!editor) return;
    const index = Math.max(0, Math.min(recipients.length - 1, getPreviewIndex()));
    const recipient = recipients[index] || {};
    const merged = mergeDocumentHtml(editor.getHTML(), recipient);
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!popup) {
      toast('Popup blocked. Please allow popups to print.', 'warning');
      return;
    }
    popup.document.write(`<html><head><title>Print Merge</title></head><body>${merged}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
    toast('Print preview opened for current recipient', 'success');
  });

  const col = { display: 'flex', flexDirection: 'column', flexWrap: 'wrap', maxHeight: 82, height: 82, gap: 2, alignContent: 'flex-start' };
  const mbtn = { height: 25, display: 'inline-flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap', fontSize: 11, padding: '0 6px' };

  return (
    <>
      <RibbonGroup label="Create">
        <div style={col}>
          <Tooltip text="Envelopes"><Button style={mbtn} onClick={() => openDialog('envelopes')}>✉ Envelopes</Button></Tooltip>
          <Tooltip text="Labels"><Button style={mbtn} onClick={() => openDialog('labels')}>🏷 Labels</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Start Mail Merge">
        <div style={col}>
          <Tooltip text="Start Mail Merge"><Button style={mbtn} onClick={startMailMerge}>⊞ Start Merge</Button></Tooltip>
          <Tooltip text="Select Recipients"><Button style={mbtn} onClick={() => openDialog('selectRecipients')}>👥 Recipients</Button></Tooltip>
          <Tooltip text="Edit Recipient List"><Button style={mbtn} onClick={() => openDialog('editRecipients')}>✎ Edit List</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Write & Insert Fields">
        <div style={col}>
          <Tooltip text="Highlight Merge Fields"><Button style={mbtn} onClick={highlightFields}>🖍 Highlight</Button></Tooltip>
          <Tooltip text="Address Block"><Button style={mbtn} onClick={() => insertHtml('<div style="border:1px solid #cfcfcf;padding:10px 12px;">{{FirstName}} {{LastName}}<br />{{Address}}<br />{{City}}, {{State}} {{Zip}}</div>')}>📮 Address</Button></Tooltip>
          <Tooltip text="Greeting Line"><Button style={mbtn} onClick={() => openDialog('greetingLine')}>👋 Greeting</Button></Tooltip>
          <Tooltip text="Insert Merge Field"><Button style={mbtn} onClick={() => openDialog('insertMergeField')}>⊞ Field</Button></Tooltip>
          <Tooltip text="Rules"><Button style={mbtn} onClick={insertRule}>⚙ Rules</Button></Tooltip>
          <Tooltip text="Match Fields"><Button style={mbtn} onClick={insertMatchTemplate}>⇔ Match</Button></Tooltip>
          <Tooltip text="Update Labels"><Button style={mbtn} onClick={() => openDialog('labels')}>↻ Update</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Preview Results">
        <div style={col}>
          <Tooltip text="Preview Results"><Button style={mbtn} onClick={() => openDialog('finishMerge')}>👁 Preview</Button></Tooltip>
          <Tooltip text="First Record"><Button style={mbtn} onClick={() => navigateRecipient('first')}>|◀</Button></Tooltip>
          <Tooltip text="Previous Record"><Button style={mbtn} onClick={() => navigateRecipient('prev')}>◀</Button></Tooltip>
          <Tooltip text="Next Record"><Button style={mbtn} onClick={() => navigateRecipient('next')}>▶</Button></Tooltip>
          <Tooltip text="Last Record"><Button style={mbtn} onClick={() => navigateRecipient('last')}>▶|</Button></Tooltip>
          <Tooltip text="Find Recipient"><Button style={mbtn} onClick={findRecipient}>🔍 Find</Button></Tooltip>
          <Tooltip text="Auto Check for Errors"><Button style={mbtn} onClick={checkMergeErrors}>✓ Check</Button></Tooltip>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Finish">
        <div style={col}>
          <Tooltip text="Finish & Merge"><Button style={mbtn} onClick={() => openDialog('finishMerge')}>✓ Finish</Button></Tooltip>
          <Tooltip text="Merge to Email"><Button style={mbtn} onClick={mergeToEmail}>📧 Email</Button></Tooltip>
          <Tooltip text="Merge to Printer"><Button style={mbtn} onClick={mergeToPrint}>🖨 Print</Button></Tooltip>
        </div>
      </RibbonGroup>
    </>
  );
}

