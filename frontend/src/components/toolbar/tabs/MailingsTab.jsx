import { useUIStore, useEditorStore } from '@/store';
import {
  Mail, Tag, MailCheck, Users, UserCheck, Highlighter, MapPin,
  MessageSquare, Braces, Settings, ArrowLeftRight, RefreshCw, Eye,
  Search, CheckCircle, CheckCheck, Send, Printer,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight
} from 'lucide-react';
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

function HeroBtn({ icon, label, onClick, title }) {
  return (
    <Tooltip text={title || label}>
      <button
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

function MiniAction({ icon, text, onClick, title }) {
  return (
    <Tooltip text={title || text}>
      <button
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

  return (
    <>
      <RibbonGroup label="Create">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<Mail size={20} strokeWidth={1.75} />} label="Envelopes" title="Create Envelopes" onClick={() => openDialog('envelopes')} />
          <HeroBtn icon={<Tag size={20} strokeWidth={1.75} />} label="Labels" title="Create Mailing Labels" onClick={() => openDialog('labels')} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Start Mail Merge">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<MailCheck size={20} strokeWidth={1.75} />} label="Start Merge" title="Start Mail Merge" onClick={startMailMerge} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<Users size={13} strokeWidth={1.75} />} text="Select Recipients" title="Select or Import Recipients" onClick={() => openDialog('selectRecipients')} />
            <MiniAction icon={<UserCheck size={13} strokeWidth={1.75} />} text="Edit Recipient List" title="Edit Recipient List" onClick={() => openDialog('editRecipients')} />
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Write & Insert Fields">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<Highlighter size={20} strokeWidth={1.75} />} label="Highlight" title="Highlight Merge Fields" onClick={highlightFields} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<MapPin size={13} strokeWidth={1.75} />} text="Address Block" title="Insert Address Block" onClick={() => insertHtml('<div style="border:1px solid #cfcfcf;padding:10px 12px;">{{FirstName}} {{LastName}}<br />{{Address}}<br />{{City}}, {{State}} {{Zip}}</div>')} />
            <MiniAction icon={<MessageSquare size={13} strokeWidth={1.75} />} text="Greeting Line" title="Insert Greeting Line" onClick={() => openDialog('greetingLine')} />
            <MiniAction icon={<Braces size={13} strokeWidth={1.75} />} text="Insert Field ▾" title="Insert Merge Field" onClick={() => openDialog('insertMergeField')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<Settings size={13} strokeWidth={1.75} />} text="Rules ▾" title="Insert Word Fields / Rules" onClick={insertRule} />
            <MiniAction icon={<ArrowLeftRight size={13} strokeWidth={1.75} />} text="Match Fields" title="Match Database Fields" onClick={insertMatchTemplate} />
            <MiniAction icon={<RefreshCw size={13} strokeWidth={1.75} />} text="Update Labels" title="Update All Labels" onClick={() => openDialog('labels')} />
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Preview Results">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<Eye size={20} strokeWidth={1.75} />} label="Preview" title="Preview Results" onClick={() => openDialog('finishMerge')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button style={{ height: 22, padding: '0 4px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => navigateRecipient('first')} title="First Recipient"><ChevronsLeft size={12} strokeWidth={1.75} /></Button>
              <Button style={{ height: 22, padding: '0 4px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => navigateRecipient('prev')} title="Previous Recipient"><ChevronLeft size={12} strokeWidth={1.75} /></Button>
              <Button style={{ height: 22, padding: '0 4px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => navigateRecipient('next')} title="Next Recipient"><ChevronRight size={12} strokeWidth={1.75} /></Button>
              <Button style={{ height: 22, padding: '0 4px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => navigateRecipient('last')} title="Last Recipient"><ChevronsRight size={12} strokeWidth={1.75} /></Button>
            </div>
            <MiniAction icon={<Search size={13} strokeWidth={1.75} />} text="Find Recipient" title="Find Recipient in List" onClick={findRecipient} />
            <MiniAction icon={<CheckCircle size={13} strokeWidth={1.75} />} text="Auto Check" title="Auto Check for Merge Errors" onClick={checkMergeErrors} />
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Finish">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 74 }}>
          <HeroBtn icon={<CheckCheck size={20} strokeWidth={1.75} />} label="Finish & Merge" title="Finish & Merge Documents" onClick={() => openDialog('finishMerge')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: 74, justifyContent: 'center' }}>
            <MiniAction icon={<Send size={13} strokeWidth={1.75} />} text="Merge to Email" title="Send Email Messages" onClick={mergeToEmail} />
            <MiniAction icon={<Printer size={13} strokeWidth={1.75} />} text="Merge to Print" title="Print Documents" onClick={mergeToPrint} />
          </div>
        </div>
      </RibbonGroup>
    </>
  );
}

