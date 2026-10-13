import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Sparkles, FilePlus, FolderOpen, Save, SaveAll,
  Printer, Download, Share2, Info, BarChart2, Settings,
  X, FileText, CheckCheck, RotateCcw, Tag, Globe, Zap, Lock, ShieldCheck,
  Copy, Check, ArrowLeft, Search, Plus, Upload, Menu
} from 'lucide-react';
import { docxToHtml } from '@/services/docxImport';
import { documentApi } from '@/services/api';
import {
  buildDocxBlob,
  buildHtmlBlob,
  buildHtmlDocument,
  buildPdfBlob,
  exportToDocx,
  exportToHtml,
  exportToPdf,
  downloadMarkdown,
  buildMarkdownBlob,
  exportToEpub,
  buildEpubBlob,
  sanitizeFilename,
} from '@/services/export';
import { buildAiResult, executePragnaAi, getPlainTextFromHtml, openTranslationUrl } from '@/services/ai';
import { useUIStore, useDocumentStore, useSubscriptionStore, getDefaultLayout } from '@/store';
import { canAccessAi, canAccessTemplate, canCreateDocument, canExportFormat } from '@/utils/featureGate';
import { getStoredUser } from '@/services/api';
import { FileWorkspace } from '@/components/design/FileWorkspace';
import { DialogManager } from '@/components/dialogs/DialogManager';
import { Modal, Button } from '@/components/ui';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { applyDesignTheme, getUiTheme } from '@/theme/tokens';
import { ShareDialog } from '@/components/dialogs/ShareDialog';
import EtherxWordLogo from '@/components/brand/EtherxWordLogo';
import { clearLocalDraft, readLocalDraft } from '@/utils/draftStorage';
import { printHtml } from '@/utils/printUtils';
import { buildOdtBlob, buildTextBlob } from '@/services/odtExport';
import { useAutoSave } from '@/hooks/useAutoSave';
import {
  readCachedRecentDocs,
  writeCachedRecentDocs,
  updateCachedRecentDoc,
  removeCachedRecentDoc,
} from '@/utils/recentDocsCache';

const LOCAL_FILE_DOCS_KEY = 'etherx_file_docs';

function getLocalDocsStorageKey() {
  const user = getStoredUser();
  const scope = user?.id || user?.email || 'guest';
  return `${LOCAL_FILE_DOCS_KEY}:${String(scope).toLowerCase()}`;
}

function getInitialRecentDocs() {
  const cached = readCachedRecentDocs();
  if (cached && cached.length > 0) return cached;
  const locals = readLocalDocs();
  return locals;
}

// SVG Icon Components
function getSaveAsIcon(location) {
  const iconStyle = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  
  const icons = {
    recent: <svg {...iconStyle}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    cloud: <svg {...iconStyle}><path d="M3 11a4 4 0 0 1 4-4h1a4 4 0 0 1 7.753-1.1A4.5 4.5 0 1 1 21 11H3z" /></svg>,
    share: <svg {...iconStyle}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
    thisPc: <svg {...iconStyle}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  };
  
  return icons[location] || icons.thisPc;
}

function getSaveAsLargeIcon(location) {
  const iconStyle = { width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.8 };
  
  const icons = {
    recent: <svg {...iconStyle}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    share: <svg {...iconStyle}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
    thisPc: <svg {...iconStyle}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  };
  
  return icons[location] || icons.thisPc;
}

const SaveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, display: 'inline' }}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const LoadingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, display: 'inline', animation: 'spin 1s linear infinite' }}>
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 2.2" />
  </svg>
);

const MENU_ITEMS = [
  { key: 'home', label: 'Home', icon: Home, group: 1 },
  { key: 'new', label: 'New', icon: FilePlus, group: 1 },
  { key: 'open', label: 'Open', icon: FolderOpen, group: 1 },
  { key: 'save', label: 'Save', icon: Save, group: 2 },
  { key: 'saveAs', label: 'Save As', icon: SaveAll, group: 2 },
  { key: 'print', label: 'Print', icon: Printer, group: 2 },
  { key: 'export', label: 'Export', icon: Download, group: 2 },
  { key: 'share', label: 'Share', icon: Share2, group: 2 },
  { key: 'info', label: 'Info', icon: Info, group: 3 },
  { key: 'statistics', label: 'Statistics', icon: BarChart2, group: 3 },
  { key: 'ai', label: 'Pragna AI', icon: Sparkles, group: 3 },
  { key: 'pricing', label: 'Plans & Pricing', icon: Zap, group: 3 },
  { key: 'settings', label: 'Settings', icon: Settings, group: 3 },
  { key: 'close', label: 'Close', icon: X, danger: true, group: 3 },
];

const START_TEMPLATES = [
  { key: 'blank', label: 'Blank', tier: 'free' },
  { key: 'business', label: 'Business', tier: 'free' },
  { key: 'letter', label: 'Letter', tier: 'free' },
  { key: 'resume', label: 'Resume', tier: 'free' },
  { key: 'proposal', label: 'Proposal', tier: 'basic' },
  { key: 'invoice', label: 'Invoice', tier: 'pro' },
];

const SAVE_AS_FORMATS = [
  { key: 'docx', label: 'Word Document (.docx)' },
  { key: 'pdf', label: 'PDF Document (.pdf)' },
  { key: 'etherx', label: 'EtherX Document (.ethex)' },
  { key: 'html', label: 'Web Page (.html)' },
  { key: 'markdown', label: 'Markdown Document (.md)' },
  { key: 'epub', label: 'EPUB eBook (.epub)' },
];

const SAVE_AS_LOCATIONS = [
  { key: 'recent', label: 'Recent', icon: '◷', area: 'leftTop' },
  { key: 'thisPc', label: 'This PC', icon: '🖥', area: 'other' },
  { key: 'share', label: 'Share Document', icon: '⇪', area: 'share' },
];

const SAVE_AS_FAVORITES = [
  { key: 'adaptive', label: 'adaptive', path: 'OneDrive - Personal » Desktop » adaptive', updatedAt: '30-03-2026 14:15' },
  { key: 'onedriveRoot', label: 'OneDrive - Personal', path: 'OneDrive - Personal' },
];

function templateContent(key) {
  const map = {
    blank: '<p></p>',
    business: `
<h2 style="font-size: 18px; color: #d4af37; margin: 20px 0 10px 0;">Acme Corporation</h2>
<p style="color: #666; margin: 0 0 20px 0;"><strong>Strategic Business Report • Q2 2026</strong></p>

<div style="border-bottom: 2px solid #d4af37; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between;">
  <div>
    <p style="margin: 5px 0; font-size: 13px;"><strong>PREPARED BY</strong></p>
    <p style="margin: 5px 0; font-size: 13px; color: #d4af37;">Your Name • Your Title</p>
  </div>
  <div>
    <p style="margin: 5px 0; font-size: 13px;"><strong>SUBMITTED TO</strong></p>
    <p style="margin: 5px 0; font-size: 13px; color: #d4af37;">Client • Department Name</p>
  </div>
  <div>
    <p style="margin: 5px 0; font-size: 13px;"><strong>STATUS</strong></p>
    <p style="margin: 5px 0; font-size: 13px; color: #d4af37;">Draft • For Review</p>
  </div>
</div>

<h3 style="font-size: 14px; font-weight: bold; border-left: 4px solid #d4af37; padding-left: 10px; margin: 20px 0 10px 0;">EXECUTIVE SUMMARY</h3>
<p>Provide a concise overview of the report's purpose, key findings, and strategic recommendations. This section is intended for senior stakeholders who may not read the full document.</p>

<div style="display: flex; gap: 30px; margin: 20px 0;">
  <div style="flex: 1;">
    <h4 style="font-size: 13px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin: 0 0 10px 0;">BACKGROUND & CONTEXT</h4>
    <p>Describe the context and background for this report. What problem, opportunity, or question prompted it? What data sources or research methods were used?</p>
  </div>
  <div style="flex: 1;">
    <h4 style="font-size: 13px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin: 0 0 10px 0;">OBJECTIVES</h4>
    <ul style="margin: 0; padding-left: 20px;">
      <li>Primary objective: [state here]</li>
      <li>Secondary objective: [state here]</li>
      <li>Success metric: [how results will be measured]</li>
      <li>Timeline: [expected completion]</li>
    </ul>
  </div>
</div>

<h3 style="font-size: 14px; font-weight: bold; border-left: 4px solid #d4af37; padding-left: 10px; margin: 20px 0 10px 0;">KEY FINDINGS & ANALYSIS</h3>
<p>Present your core findings here. Support each finding with data, observations, or evidence. Use numbered points for clarity if needed. Address any risks or limitations discovered during analysis.</p>

<h3 style="font-size: 14px; font-weight: bold; border-left: 4px solid #d4af37; padding-left: 10px; margin: 20px 0 10px 0;">RECOMMENDATIONS</h3>
<ol style="margin: 0; padding-left: 20px;">
  <li><strong>[First recommendation]</strong> – rationale and expected impact</li>
  <li><strong>[Second recommendation]</strong> – rationale and expected impact</li>
  <li><strong>[Third recommendation]</strong> – rationale and expected impact</li>
</ol>

<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; display: flex; justify-content: space-between;">
  <p style="margin: 0; font-size: 12px;"><strong>Signature:</strong> Prepared by ___________________________</p>
  <p style="margin: 0; font-size: 12px;"><strong>Signature:</strong> Approved by ___________________________</p>
</div>
    `,
    letter: `
<p style="margin: 0 0 20px 0;"><strong>Your Full Name</strong></p>
<p style="margin: 0; color: #d4af37;">123 Your Address, City, State ZIP</p>
<p style="margin: 0; color: #d4af37;">your@email.com • (555) 000-0000</p>

<p style="margin: 30px 0 0 0; font-weight: bold;">Recipient Full Name</p>
<p style="margin: 5px 0; color: #d4af37;">Title / Position</p>
<p style="margin: 5px 0; color: #d4af37;">Organization or Company</p>
<p style="margin: 5px 0 20px 0; color: #d4af37;">123 Recipient Address, City, State ZIP</p>

<p style="margin: 20px 0 0 0;"><strong>RE: SUBJECT OF THIS LETTER</strong></p>

<p style="margin: 20px 0;">Dear [Recipient's Name],</p>

<p style="margin: 15px 0; text-align: justify;">Opening paragraph: Introduce yourself and clearly state the purpose of your letter. Be direct and professional. The reader should immediately understand why you are writing.</p>

<p style="margin: 15px 0; text-align: justify;">Body paragraph: Provide context, supporting details, or evidence for your main point. Be specific and factual. Avoid unnecessary filler. If making a request, be explicit about what you need.</p>

<p style="margin: 15px 0; text-align: justify;">Additional paragraph (if needed): Continue with supplementary information, address potential objections, or provide a timeline if applicable.</p>

<p style="margin: 15px 0; text-align: justify;">Closing paragraph: Thank the recipient for their time and consideration. Restate your call to action – what you expect them to do and by when. Provide your contact details for follow-up.</p>

<p style="margin: 25px 0 5px 0;">Sincerely,</p>

<p style="margin: 35px 0 0 0;">___________________________</p>
<p style="margin: 0;"><strong>Your Full Name</strong></p>
<p style="margin: 0; font-size: 13px;">Title / Role • Organization</p>
    `,
    resume: `
<h1 style="margin: 0 0 10px 0;">Your Full Name</h1>
<p style="margin: 0; font-size: 14px; color: #d4af37;"><strong>Senior Software Engineer • Full-Stack Developer</strong></p>
<p style="margin: 5px 0; font-size: 13px;">your@email.com • (555) 000-0000 • City, State • linkedin.com/in/yourname</p>

<h3 style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 8px; margin: 20px 0 10px 0;">PROFESSIONAL SUMMARY</h3>
<p style="margin: 0; text-align: justify;">Results-driven professional with [X] years of experience delivering [key outcomes] across [industries/domains]. Known for [core strength 1], [core strength 2], and [core strength 3]. Seeking to leverage expertise at a forward-thinking organization.</p>

<h3 style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 8px; margin: 20px 0 10px 0;">WORK EXPERIENCE</h3>

<p style="margin: 10px 0 5px 0;"><strong>Senior Job Title</strong> <span style="float: right;">Jan 2023 – Present</span></p>
<p style="margin: 0 0 10px 0; font-size: 13px; color: #666;">Company Name • City, State</p>
<ul style="margin: 0 0 10px 0; padding-left: 20px;">
  <li>Achieved [specific result] by [specific action], resulting in [measurable outcome]</li>
  <li>Led a team of [N] to deliver [project] on time and [X]% under budget</li>
  <li>Improved [metric] by [X]% through [initiative or method]</li>
</ul>

<p style="margin: 10px 0 5px 0;"><strong>Previous Job Title</strong> <span style="float: right;">Mar 2020 – Dec 2022</span></p>
<p style="margin: 0 0 10px 0; font-size: 13px; color: #666;">Previous Company • City, State</p>
<ul style="margin: 0 0 10px 0; padding-left: 20px;">
  <li>Key achievement with quantified result</li>
  <li>Key responsibility or contribution</li>
  <li>Collaboration or leadership highlight</li>
</ul>

<h3 style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 8px; margin: 20px 0 10px 0;">EDUCATION</h3>
<p style="margin: 10px 0 0 0;"><strong>Degree • Major</strong> <span style="float: right;">2016 – 2020</span></p>
<p style="margin: 0; font-size: 13px; color: #666;">University Name • GPA 3.9/4.0 • Dean's List</p>

<div style="display: flex; gap: 30px; margin: 20px 0;">
  <div style="flex: 1;">
    <h4 style="font-size: 13px; font-weight: bold; border-bottom: 2px solid #666; padding-bottom: 5px; margin: 0 0 10px 0;">SKILLS</h4>
    <p style="margin: 5px 0; font-size: 13px;"><strong>Technical:</strong> Skill 1 • Skill 2 • Skill 3</p>
    <p style="margin: 5px 0; font-size: 13px;"><strong>Tools & Platforms:</strong> Tool 1 • Tool 2 • Platform 1 • Platform 2</p>
    <p style="margin: 5px 0; font-size: 13px;"><strong>Soft Skills:</strong> Leadership • Communication • Problem-solving • Strategic thinking</p>
  </div>
  <div style="flex: 1;">
    <h4 style="font-size: 13px; font-weight: bold; border-bottom: 2px solid #666; padding-bottom: 5px; margin: 0 0 10px 0;">CERTIFICATIONS</h4>
    <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
      <li>Certification Name (2024)</li>
      <li>Certification Name (2023)</li>
      <li>Certification Name (2022)</li>
    </ul>
  </div>
</div>

<h3 style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 8px; margin: 20px 0 10px 0;">LANGUAGES</h3>
<p style="margin: 5px 0; font-size: 13px;">English – Native</p>
<p style="margin: 5px 0; font-size: 13px;">Language 2 – Fluent</p>
<p style="margin: 5px 0; font-size: 13px;">Language 3 – Basic</p>
    `,
    proposal: `
<p style="font-size: 12px; color: #666; font-weight: bold; margin: 0 0 5px 0;">PROJECT PROPOSAL</p>
<h1 style="margin: 0 0 20px 0; color: #333;">Write Your Compelling Proposal Title Here</h1>

<div style="display: flex; justify-content: space-between; border-bottom: 2px solid #d4af37; padding-bottom: 15px; margin-bottom: 20px;">
  <div>
    <p style="margin: 0; font-size: 13px; color: #666;"><strong>PREPARED BY</strong></p>
    <p style="margin: 5px 0 0 0; font-size: 13px; color: #d4af37;">Your Name • Your Company</p>
  </div>
  <div>
    <p style="margin: 0; font-size: 13px; color: #666;"><strong>SUBMITTED TO</strong></p>
    <p style="margin: 5px 0 0 0; font-size: 13px; color: #d4af37;">Client Name – Organization</p>
  </div>
  <div>
    <p style="margin: 0; font-size: 13px; color: #666;"><strong>DATE</strong></p>
    <p style="margin: 5px 0 0 0; font-size: 13px; color: #d4af37;">April 22, 2026</p>
  </div>
</div>

<h3 style="font-size: 13px; font-weight: bold; border-left: 4px solid #d4af37; padding-left: 10px; margin: 20px 0 10px 0;">OVERVIEW</h3>
<p>Summarize the entire proposal in 3–5 sentences. What are you proposing, why does it matter, who benefits, and what's the expected outcome? Write this last but place it first.</p>

<div style="display: flex; gap: 30px; margin: 20px 0;">
  <div style="flex: 1;">
    <h4 style="font-size: 13px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin: 0 0 10px 0;">PROBLEM STATEMENT</h4>
    <p>Clearly define the problem or gap this proposal addresses. Use data or evidence to establish urgency and relevance. The more specific, the stronger your proposal.</p>
  </div>
  <div style="flex: 1;">
    <h4 style="font-size: 13px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin: 0 0 10px 0;">PROPOSED SOLUTION</h4>
    <p>Describe your solution in plain terms. How does it directly address the problem? What makes this approach effective, unique, or better than alternatives?</p>
  </div>
</div>

<h3 style="font-size: 13px; font-weight: bold; border-left: 4px solid #d4af37; padding-left: 10px; margin: 20px 0 10px 0;">SCOPE OF WORK</h3>
<ul style="margin: 0 0 10px 0; padding-left: 20px;">
  <li>Deliverable 1: [Description] – due [date]</li>
  <li>Deliverable 2: [Description] – due [date]</li>
  <li>Deliverable 3: [Description] – due [date]</li>
  <li>Out of scope: [explicitly list exclusions]</li>
</ul>

<div style="display: flex; gap: 30px; margin: 20px 0;">
  <div style="flex: 1;">
    <h4 style="font-size: 13px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin: 0 0 10px 0;">TIMELINE</h4>
    <p style="margin: 5px 0;"><strong>Phase 1 – Discovery</strong> [Dates]</p>
    <p style="margin: 5px 0;"><strong>Phase 2 – Execution</strong> [Dates]</p>
    <p style="margin: 5px 0;"><strong>Phase 3 – Delivery</strong> [Dates]</p>
    <p style="margin: 5px 0;"><strong>Final Review:</strong> [Date]</p>
  </div>
  <div style="flex: 1;">
    <h4 style="font-size: 13px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin: 0 0 10px 0;">BUDGET</h4>
    <p style="margin: 5px 0;"><strong>Estimated total:</strong> $[amount]</p>
    <p style="margin: 5px 0;"><strong>Labor:</strong> $[amount]</p>
    <p style="margin: 5px 0;"><strong>Materials/Tools:</strong> $[amount]</p>
    <p style="margin: 5px 0;"><strong>Payment:</strong> 50% upfront - 50% on delivery</p>
  </div>
</div>

<h3 style="font-size: 13px; font-weight: bold; border-left: 4px solid #d4af37; padding-left: 10px; margin: 20px 0 10px 0;">WHY US</h3>
<p>Highlight your team's relevant experience, past successes, and unique qualifications. Include 1–2 specific examples of similar work delivered successfully.</p>
    `,
    invoice: `
<table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
  <tbody>
    <tr>
      <td style="border: none; padding: 0; vertical-align: top;">
        <h1 style="margin: 0; font-size: 32px; font-weight: bold;">INVOICE</h1>
        <p style="margin: 5px 0; font-size: 14px; color: #d4af37;"><strong>#INV-2026-001</strong></p>
      </td>
      <td style="border: none; padding: 0; text-align: right; vertical-align: top;">
        <h2 style="margin: 0; font-size: 16px; font-weight: bold; text-align: right;">Your Business Name</h2>
        <p style="margin: 5px 0; font-size: 13px; text-align: right;">123 Your Street, City, State ZIP</p>
        <p style="margin: 5px 0; font-size: 13px; text-align: right;">billing@business.com • (555) 000-0000</p>
      </td>
    </tr>
  </tbody>
</table>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
  <tbody>
    <tr>
      <td style="border: none; padding: 0; vertical-align: top; width: 60%;">
        <p style="margin: 0; font-size: 12px; font-weight: bold; color: #666;">BILL TO</p>
        <p style="margin: 5px 0 0 0; font-size: 13px;"><strong>Client Full Name</strong></p>
        <p style="margin: 5px 0; font-size: 13px;">Client Company Inc.</p>
        <p style="margin: 5px 0; font-size: 13px;">456 Client Street, City, State ZIP</p>
        <p style="margin: 5px 0; font-size: 13px;">client@company.com</p>
      </td>
      <td style="border: none; padding: 0; vertical-align: top; width: 40%; text-align: right;">
        <p style="margin: 5px 0; font-size: 13px; text-align: right;"><strong>Invoice No.:</strong> <span style="color: #d4af37;">INV-2026-001</span></p>
        <p style="margin: 5px 0; font-size: 13px; text-align: right;"><strong>Invoice Date:</strong> <span style="color: #d4af37;">April 22, 2026</span></p>
        <p style="margin: 5px 0; font-size: 13px; text-align: right;"><strong>Due Date:</strong> <span style="color: #d4af37;">May 22, 2026</span></p>
        <p style="margin: 5px 0; font-size: 13px; text-align: right;"><strong>Status:</strong> <span style="color: #d4af37; font-weight: bold;">UNPAID</span></p>
      </td>
    </tr>
  </tbody>
</table>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="border-bottom: 2px solid #333;">
      <th style="text-align: left; padding: 8px; font-size: 12px; color: #666; font-weight: bold;">DESCRIPTION</th>
      <th style="text-align: center; padding: 8px; font-size: 12px; color: #666; font-weight: bold;">QTY</th>
      <th style="text-align: right; padding: 8px; font-size: 12px; color: #666; font-weight: bold;">UNIT PRICE</th>
      <th style="text-align: right; padding: 8px; font-size: 12px; color: #666; font-weight: bold;">AMOUNT</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px; font-size: 13px; text-align: left;">Service or Product Name</td>
      <td style="text-align: center; padding: 10px; font-size: 13px;">1</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$1,200.00</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$1,200.00</td>
    </tr>
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px; font-size: 13px; text-align: left;">Consulting Hours (Design)</td>
      <td style="text-align: center; padding: 10px; font-size: 13px;">4</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$150.00</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$600.00</td>
    </tr>
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px; font-size: 13px; text-align: left;">Additional Service Item</td>
      <td style="text-align: center; padding: 10px; font-size: 13px;">1</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$350.00</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$350.00</td>
    </tr>
  </tbody>
</table>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0 30px 0;">
  <tbody>
    <tr>
      <td style="border: none; width: 60%;"></td>
      <td style="border: none; width: 40%; text-align: right;">
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 8px 0; font-size: 13px; text-align: left;"><strong>Subtotal</strong></td>
              <td style="padding: 8px 0; font-size: 13px; text-align: right;">$2,150.00</td>
            </tr>
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 8px 0; font-size: 13px; text-align: left;"><strong>Tax (GST 18%)</strong></td>
              <td style="padding: 8px 0; font-size: 13px; text-align: right;">$387.00</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; text-align: left; color: #d4af37;"><strong>Total Due</strong></td>
              <td style="padding: 8px 0; font-size: 14px; text-align: right; font-weight: bold; color: #d4af37;">$2,537.00</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>

<table style="width: 100%; border-collapse: collapse; margin-top: 30px; border-top: 1px solid #ccc;">
  <tbody>
    <tr>
      <td style="border: none; padding: 20px 20px 0 0; vertical-align: top; width: 50%;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #666; text-align: left;">PAYMENT INSTRUCTIONS</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left;">Bank Transfer: Your Bank Name</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left;">Account Name: Your Business Name</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left;">Account No.: XXXX-XXXX-XXXX</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left;">IFSC / Routing: XXXXXXXX</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left;">Or pay via: razorpay.com/your-link</p>
      </td>
      <td style="border: none; padding: 20px 0 0 20px; vertical-align: top; width: 50%;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #666; text-align: left;">TERMS & NOTES</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left; line-height: 1.5;">Payment due within 30 days of invoice date. Late payments are subject to a 1.5% monthly interest charge. Thank you for your business — we appreciate the partnership!</p>
      </td>
    </tr>
  </tbody>
</table>
    `,
  };
  return map[key] || '<p></p>';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function relativeTimeLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const diffMs = Date.now() - date.getTime();
  const hour = 3600000;
  const day = 86400000;
  const minute = 60000;
  
  if (diffMs < minute) {
    return 'Just now';
  }
  if (diffMs < hour) {
    const m = Math.max(1, Math.floor(diffMs / minute));
    return `${m} minute${m > 1 ? 's' : ''} ago`;
  }
  if (diffMs < day) {
    const h = Math.max(1, Math.floor(diffMs / hour));
    return `${h} hour${h > 1 ? 's' : ''} ago`;
  }
  const d = Math.max(1, Math.floor(diffMs / day));
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

function formatActualTime(iso) {
  return relativeTimeLabel(iso);
}

function estimatePagesFromHtml(html) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').length : 0;
  return Math.max(1, Math.ceil(words / 420));
}

function cleanBaseName(title = 'Untitled Document') {
  const base = String(title || 'Untitled Document').replace(/\.[^/.]+$/, '').trim();
  return base || 'Untitled Document';
}

function buildSharedUrl(docId) {
  return `${window.location.origin}/shared/${docId}`;
}

function nextCopyName(title = 'Untitled Document') {
  const base = cleanBaseName(title);
  if (/^copy of\s+/i.test(base)) return base;
  return `Copy of ${base}`;
}

const LANG_CODES = {
  afrikaans: 'af', albanian: 'sq', arabic: 'ar', armenian: 'hy',
  azerbaijani: 'az', basque: 'eu', belarusian: 'be', bengali: 'bn',
  bosnian: 'bs', bulgarian: 'bg', catalan: 'ca', chinese: 'zh',
  'chinese simplified': 'zh-CN', 'chinese traditional': 'zh-TW',
  croatian: 'hr', czech: 'cs', danish: 'da', dutch: 'nl',
  english: 'en', esperanto: 'eo', estonian: 'et', filipino: 'tl',
  finnish: 'fi', french: 'fr', galician: 'gl', georgian: 'ka',
  german: 'de', greek: 'el', gujarati: 'gu', hebrew: 'he',
  hindi: 'hi', hungarian: 'hu', icelandic: 'is', indonesian: 'id',
  irish: 'ga', italian: 'it', japanese: 'ja', javanese: 'jv',
  kannada: 'kn', kazakh: 'kk', korean: 'ko', latin: 'la',
  latvian: 'lv', lithuanian: 'lt', macedonian: 'mk', malay: 'ms',
  maltese: 'mt', maori: 'mi', marathi: 'mr', mongolian: 'mn',
  nepali: 'ne', norwegian: 'no', persian: 'fa', polish: 'pl',
  portuguese: 'pt', punjabi: 'pa', romanian: 'ro', russian: 'ru',
  serbian: 'sr', slovak: 'sk', slovenian: 'sl', somali: 'so',
  spanish: 'es', swahili: 'sw', swedish: 'sv', tamil: 'ta',
  telugu: 'te', thai: 'th', turkish: 'tr', ukrainian: 'uk',
  urdu: 'ur', uzbek: 'uz', vietnamese: 'vi', welsh: 'cy',
  xhosa: 'xh', yiddish: 'yi', yoruba: 'yo', zulu: 'zu',
};

function getLanguageCode(name = '') {
  const key = name.toLowerCase().trim();
  return LANG_CODES[key] || key;
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 45000);
}

function downloadEtherxFile(title, content) {
  const payload = {
    title: cleanBaseName(title),
    content: content || '<p></p>',
    exportedAt: new Date().toISOString(),
    format: 'ethex-document',
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const safe = cleanBaseName(title).replace(/[^a-z0-9_\-\s]/gi, '_');
  downloadBlob(blob, `${safe || 'document'}.ethex`);
}

async function copyTextToClipboard(value) {
  const text = String(value || '');
  if (!text) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Continue with the legacy clipboard fallback.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    textarea.remove();
  }
  return true;
}

function filePickerSupported() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

function pickerOptions(name, format) {
  const clean = cleanBaseName(name) || 'document';
  const byFormat = {
    docx: {
      suggestedName: `${clean}.docx`,
      types: [{ description: 'Word Document (.docx)', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }],
    },
    pdf: {
      suggestedName: `${clean}.pdf`,
      types: [{ description: 'PDF Document (.pdf)', accept: { 'application/pdf': ['.pdf'] } }],
    },
    etherx: {
      suggestedName: `${clean}.ethex`,
      types: [{ description: 'EtherX Document (.ethex)', accept: { 'application/json': ['.ethex'] } }],
    },
    html: {
      suggestedName: `${clean}.html`,
      types: [{ description: 'Web Page (.html)', accept: { 'text/html': ['.html'] } }],
    },
    markdown: {
      suggestedName: `${clean}.md`,
      types: [{ description: 'Markdown Document (.md)', accept: { 'text/markdown': ['.md'] } }],
    },
    epub: {
      suggestedName: `${clean}.epub`,
      types: [{ description: 'EPUB Publication (.epub)', accept: { 'application/epub+zip': ['.epub'] } }],
    },
  };
  return byFormat[format] || byFormat.docx;
}

async function generateFormatBlob(name, format, content, options = {}) {
  const normFormat = (format || 'docx').toLowerCase();
  const safeContent = content || '<p></p>';
  const safeName = cleanBaseName(name) || 'document';

  if (normFormat === 'docx') {
    return await buildDocxBlob(safeContent, options);
  } else if (normFormat === 'pdf') {
    const { blob } = await buildPdfBlob(safeName, safeContent, options);
    return blob;
  } else if (normFormat === 'html') {
    return buildHtmlBlob(safeName, safeContent, options);
  } else if (normFormat === 'markdown' || normFormat === 'md') {
    return buildMarkdownBlob(safeName, safeContent, options);
  } else if (normFormat === 'epub') {
    const res = await buildEpubBlob(safeName, safeContent, options);
    return res.blob;
  } else if (normFormat === 'odt') {
    return buildOdtBlob(safeName, safeContent, options);
  } else if (normFormat === 'txt') {
    return buildTextBlob(safeContent);
  } else {
    const payload = {
      title: safeName,
      content: safeContent,
      exportedAt: new Date().toISOString(),
      format: 'ethex-document',
    };
    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  }
}

async function saveWithFilePicker(name, format, blob) {
  if (!filePickerSupported()) return false;
  const { suggestedName, types } = pickerOptions(name, format);
  try {
    const handle = await window.showSaveFilePicker({ suggestedName, types });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return null;
    console.warn('showSaveFilePicker error, falling back to download:', error?.message);
    return false;
  }
}
const NARROW_QUERY = '(max-width: 760px)';

// Phone-width overrides, merged over `styles` by `sx` in HomePage.
const narrowStyles = {
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: 'min(280px, 86vw)',
    zIndex: 50,
    boxShadow: '0 0 40px rgba(0,0,0,0.5)',
    transition: 'transform 200ms ease, visibility 200ms',
  },
  hero: { padding: '20px 16px 4px', flexDirection: 'column', alignItems: 'stretch', gap: 14 },
  heroTitle: { fontSize: 26 },
  searchBox: { flex: 1, width: 'auto' },
  homeArea: { padding: '16px 16px 40px' },
  startCards: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 28 },
  startCard: { padding: 12, minWidth: 0 },
  templateGrid: { gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 12 },
  recentRow: { gridTemplateColumns: 'minmax(0, 1fr) auto 40px', padding: '6px 4px', minHeight: 52 },
  recentDeleteBtn: { width: 40, height: 40 },
  catChip: { height: 36, padding: '0 14px', flexShrink: 0 },
  panel: { margin: '8px 16px 32px', padding: 14 },
  saveAsShell: { margin: '8px 16px 32px', padding: 14 },
  saveAsMainContent: { gridTemplateColumns: '1fr', gap: 16 },
  saveAsQuickAccess: { paddingRight: 0, borderRight: 'none', borderBottom: '1px solid var(--border)', paddingBottom: 12, maxHeight: 'none' },
};

function selectedStyle(active, danger) {
  return {
    ...styles.menuBtn,
    ...(active ? styles.menuBtnActive : null),
    ...(danger ? styles.menuBtnDanger : null),
  };
}

function readLocalDocs() {
  try {
    const raw = localStorage.getItem(getLocalDocsStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((d) => ({
      id: String(d.id),
      title: d.title || 'Untitled Document',
      content: d.content || '',
      updatedAt: d.updatedAt || new Date().toISOString(),
      design: d.design || undefined,
      headerFooter: d.headerFooter || undefined,
      comments: Array.isArray(d.comments) ? d.comments : [],
      trackChanges: Boolean(d.trackChanges),
      localOnly: true,
    }));
  } catch {
    return [];
  }
}

function writeLocalDocs(list) {
  localStorage.setItem(getLocalDocsStorageKey(), JSON.stringify(list));
}

function upsertLocalDoc(doc) {
  const list = readLocalDocs();
  const next = [doc, ...list.filter((d) => d.id !== doc.id)].slice(0, 100);
  writeLocalDocs(next);
  return next;
}

function createLocalDoc({ title, content, source = {} }) {
  const doc = {
    id: `local-${Date.now()}`,
    title: title || 'Untitled Document',
    content: content || '<p></p>',
    updatedAt: new Date().toISOString(),
    design: source.design || { pageColor: '#1a1a1a', pageColorMode: 'theme' },
    headerFooter: source.headerFooter,
    comments: Array.isArray(source.comments) ? source.comments : [],
    trackChanges: Boolean(source.trackChanges),
    localOnly: true,
  };
  const next = upsertLocalDoc(doc);
  return { doc, next };
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useUIStore((s) => s.toast);
  const { save: saveActiveDocument } = useAutoSave();
  const activeDocument = useDocumentStore();
  const autoSaveEnabled = useUIStore((s) => s.autoSaveEnabled);
  const dialogs = useUIStore((s) => s.dialogs);
  const closeDialog = useUIStore((s) => s.closeDialog);
  const resetDoc = useDocumentStore((s) => s.reset);
  const setDocTitle = useDocumentStore((s) => s.setTitle);
  const setDocContent = useDocumentStore((s) => s.setContent);
  const currentEditorId = useDocumentStore((s) => s.id);
  const currentEditorTitle = useDocumentStore((s) => s.title);
  const currentEditorContent = useDocumentStore((s) => s.content);
  const currentEditorDesign = useDocumentStore((s) => s.design);
  const currentEditorLayout = useDocumentStore((s) => s.layout);
  const currentEditorHeaderFooter = useDocumentStore((s) => s.headerFooter);
  const currentEditorComments = useDocumentStore((s) => s.comments);
  const currentEditorTrackChanges = useDocumentStore((s) => s.trackChanges);

  const plan = useSubscriptionStore((s) => s.plan);
  const usage = useSubscriptionStore((s) => s.usage);
  const openUpgradeModal = useSubscriptionStore((s) => s.openUpgradeModal);
  const fetchSubscription = useSubscriptionStore((s) => s.fetchSubscription);

  const currentDocIdFromRoute = (() => {
    const p = location.state?.returnTo || '';
    const m = p.match(/^\/doc\/([^/]+)$/);
    return m?.[1] || null;
  })();

  const [activeMenu, setActiveMenu] = useState(() => location.state?.menu || 'home');
  const [docs, setDocs] = useState(() => getInitialRecentDocs());
  const [loading, setLoading] = useState(() => getInitialRecentDocs().length === 0);
  const [selectedDocId, setSelectedDocId] = useState(() => {
    const initial = getInitialRecentDocs();
    if (currentDocIdFromRoute && initial.some((d) => d.id === currentDocIdFromRoute)) {
      return currentDocIdFromRoute;
    }
    return initial[0]?.id || null;
  });
  const [search, setSearch] = useState('');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [recentTab, setRecentTab] = useState('recent');
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  useEffect(() => {
    if (!confirmDelete) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setConfirmDelete(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDelete]);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = (e) => setIsNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);
  // Base style, plus its narrow-screen override when the viewport is phone sized.
  const sx = (key) => (isNarrow && narrowStyles[key] ? { ...styles[key], ...narrowStyles[key] } : styles[key]);
  const [saveAsName, setSaveAsName] = useState('');
  const [saveAsFormat, setSaveAsFormat] = useState('docx');
  const [saveAsLocation, setSaveAsLocation] = useState('thisPc');
  const [saveAsBusy, setSaveAsBusy] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [exportBusy, setExportBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareWorking, setShareWorking] = useState(false);
  const [shareDialogDoc, setShareDialogDoc] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0); // Force re-render for time updates

  // AI panel state
  const [aiAction, setAiAction] = useState(null);
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [aiRewriteMode, setAiRewriteMode] = useState('clear');
  const [aiFallbackTitle, setAiFallbackTitle] = useState('');
  const [aiLanguage, setAiLanguage] = useState('Spanish');
  const [aiPageCount, setAiPageCount] = useState(1);
  const [aiRunning, setAiRunning] = useState(false);

  const currentUser = getStoredUser();
  const isAdminUser = currentUser?.role === 'Owner' || currentUser?.role === 'Admin';
  const visibleMenuItems = useMemo(() => {
    if (!isAdminUser) return MENU_ITEMS;
    const items = [...MENU_ITEMS];
    const settingsIdx = items.findIndex((i) => i.key === 'settings');
    const adminEntry = { key: 'admin', label: 'Admin Console', icon: ShieldCheck, group: 3 };
    if (settingsIdx >= 0) {
      items.splice(settingsIdx, 0, adminEntry);
    } else {
      items.push(adminEntry);
    }
    return items;
  }, [isAdminUser]);

  const returnTo = location.state?.returnTo || '/doc/new';
  const fileInputRef = useRef(null);

  const handleBackToEditor = () => {
    if (location.state?.returnTo) {
      navigate(location.state.returnTo);
    } else if (selectedDoc?.id && !selectedDoc.localOnly) {
      navigate(`/doc/${selectedDoc.id}`);
    } else if (docs[0]?.id && !docs[0].localOnly) {
      navigate(`/doc/${docs[0].id}`);
    } else {
      navigate(returnTo);
    }
  };

  // Refresh time display every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, 60000); // Update every 60 seconds
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadDocs() {
      try {
        const data = await documentApi.list();
        const list = Array.isArray(data) ? data : data.documents || data.items || [];
        const locals = readLocalDocs();
        if (!alive) return;
        const normalized = [...locals, ...list.map((d, i) => ({
          id: String(d.id || d._id || i + 1),
          title: d.title || 'Untitled Document',
          updatedAt: d.updatedAt || d.updated || new Date().toISOString(),
          content: d.content || '',
          design: d.design,
          layout: d.layout,
          pageCount: d.pageCount,
          sharedWith: Array.isArray(d.sharedWith) ? d.sharedWith : [],
          shareLinkEnabled: d.shareLinkEnabled === true,
          shareLinkRole: d.shareLinkRole,
          headerFooter: d.headerFooter,
          comments: Array.isArray(d.comments) ? d.comments : [],
          trackChanges: Boolean(d.trackChanges),
          localOnly: Boolean(d.localOnly),
          owner: d.owner,
        }))];
        // An editor save may finish while this list request is still in flight.
        const cached = readCachedRecentDocs();
        const reconciled = normalized.map((doc) => {
          const latest = cached.find((entry) => entry.id === doc.id);
          return latest && new Date(latest.updatedAt) > new Date(doc.updatedAt) ? { ...doc, ...latest } : doc;
        }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        setDocs(reconciled);
        writeCachedRecentDocs(reconciled);
        if (currentDocIdFromRoute && normalized.some((d) => d.id === currentDocIdFromRoute)) {
          setSelectedDocId(currentDocIdFromRoute);
        } else if (!selectedDocId && normalized[0]) {
          setSelectedDocId(normalized[0].id);
        }
      } catch {
        const fallback = getInitialRecentDocs();
        if (!alive) return;
        if (fallback.length > 0) {
          setDocs(fallback);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadDocs();
    fetchSubscription();
    return () => { alive = false; };
  }, [currentDocIdFromRoute, fetchSubscription]);

  useEffect(() => {
    const syncRecentDocs = () => setDocs((previous) => {
      const cached = readCachedRecentDocs();
      const ids = new Set(cached.map((doc) => doc.id));
      return [...cached, ...previous.filter((doc) => !ids.has(doc.id))]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
    window.addEventListener('etherx:recent-docs-change', syncRecentDocs);
    return () => window.removeEventListener('etherx:recent-docs-change', syncRecentDocs);
  }, []);

  const selectedDoc = useMemo(() => docs.find((d) => d.id === selectedDocId) || null, [docs, selectedDocId]);
  const saveAsSourceDoc = useMemo(() => {
    // File commands act on the document we came from, even before the list loads.
    if (currentEditorId && (!currentDocIdFromRoute || currentDocIdFromRoute === currentEditorId)) {
      return { ...activeDocument, localOnly: false };
    }
    // If the user came from /doc/new or is editing a new/unsaved doc, prioritize in-memory editor document
    const isEditingNewDoc = returnTo === '/doc/new' || !currentEditorId || currentEditorId === 'new';
    if (isEditingNewDoc && (currentEditorContent || currentEditorTitle)) {
      return {
        id: currentEditorId || 'new',
        title: currentEditorTitle || 'Untitled Document',
        content: currentEditorContent || '<p></p>',
        design: currentEditorDesign,
        layout: currentEditorLayout,
        headerFooter: currentEditorHeaderFooter,
        comments: currentEditorComments,
        trackChanges: currentEditorTrackChanges,
        localOnly: true,
      };
    }

    // If a document is selected from the list
    if (selectedDoc) {
      let resolvedContent = selectedDoc.content;

      // If the selected document is currently open in the editor, use live editor content
      if (currentEditorId === selectedDoc.id && currentEditorContent && currentEditorContent !== '<p></p>') {
        resolvedContent = currentEditorContent;
      } else {
        // Check if there is a newer unsaved local draft for this document
        try {
          const draft = readLocalDraft(selectedDoc.id);
          if (draft?.content && draft.content !== '<p></p>') {
            resolvedContent = draft.content;
          }
        } catch {
          // ignore draft read errors
        }
      }

      return {
        ...selectedDoc,
        title: (currentEditorId === selectedDoc.id && currentEditorTitle) ? currentEditorTitle : selectedDoc.title,
        content: resolvedContent || '<p></p>',
        layout: currentEditorId === selectedDoc.id ? currentEditorLayout : selectedDoc.layout,
      };
    }

    // Fallback to active editor state if any
    if (currentEditorId || currentEditorContent) {
      return {
        id: currentEditorId,
        title: currentEditorTitle || 'Untitled Document',
        content: currentEditorContent || '<p></p>',
        design: currentEditorDesign,
        layout: currentEditorLayout,
        headerFooter: currentEditorHeaderFooter,
        comments: currentEditorComments,
        trackChanges: currentEditorTrackChanges,
        localOnly: !currentEditorId,
      };
    }

    return null;
  }, [
    returnTo,
    currentDocIdFromRoute,
    activeDocument,
    selectedDoc,
    currentEditorId,
    currentEditorTitle,
    currentEditorContent,
    currentEditorDesign,
    currentEditorLayout,
    currentEditorHeaderFooter,
    currentEditorComments,
    currentEditorTrackChanges,
  ]);

  useEffect(() => {
    const doc = saveAsSourceDoc;
    if (!doc) {
      setSaveAsName('');
      return;
    }
    setSaveAsName(nextCopyName(doc.title));
  }, [saveAsSourceDoc?.id, saveAsSourceDoc?.title]);

  const me = getStoredUser() || {};
  const isMine = (doc) => {
    const owner = doc.owner || {};
    const ownerId = String(owner.id || owner._id || owner.email || '');
    return !ownerId || ownerId === String(me.id || me._id || '') || ownerId === String(me.email || '');
  };
  const ownerLabel = (doc) => (isMine(doc) ? 'You' : (doc.owner?.name || doc.owner?.email || 'Someone'));
  const homeDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs
      .filter((d) => (recentTab === 'shared' ? !isMine(d) : true))
      .filter((d) => !q || String(d.title || '').toLowerCase().includes(q))
      .slice(0, 8);
    // isMine reads the signed-in user, which does not change while this page is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, search, recentTab]);

  const visibleDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? docs.filter((d) => d.title.toLowerCase().includes(q)) : docs;
    return filtered.slice(0, 4);
  }, [docs, search]);

  const syncDocRecord = (docId, patch) => {
    setDocs((prev) => {
      const next = prev.map((doc) => {
        if (String(doc.id) !== String(docId)) return doc;
        return {
          ...doc,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
      });
      writeCachedRecentDocs(next);
      return next;
    });
  };

  const persistSelectedDocPatch = async (patch = {}) => {
    if (!selectedDoc) {
      toast('Select a document first', 'info');
      return null;
    }

    const nextPatch = {
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    if (selectedDoc.localOnly) {
      const nextDoc = { ...selectedDoc, ...nextPatch, localOnly: true };
      const nextLocalDocs = readLocalDocs().map((doc) => (String(doc.id) === String(selectedDoc.id) ? nextDoc : doc));
      if (!nextLocalDocs.some((doc) => String(doc.id) === String(selectedDoc.id))) {
        nextLocalDocs.unshift(nextDoc);
      }
      writeLocalDocs(nextLocalDocs);
      updateCachedRecentDoc(selectedDoc.id, nextDoc);
      setDocs((prev) => prev.map((doc) => String(doc.id) === String(selectedDoc.id) ? nextDoc : doc));
      if (nextPatch.title) setDocTitle(nextPatch.title);
      if (nextPatch.content) setDocContent(nextPatch.content);
      return nextDoc;
    }

    try {
      await documentApi.save(selectedDoc.id, nextPatch);
      syncDocRecord(selectedDoc.id, nextPatch);
      updateCachedRecentDoc(selectedDoc.id, nextPatch);
      if (nextPatch.title) setDocTitle(nextPatch.title);
      if (nextPatch.content) setDocContent(nextPatch.content);
      return { ...selectedDoc, ...nextPatch };
    } catch (error) {
      toast(`Unable to save AI result: ${error?.message || 'Save failed'}`, 'error');
      return null;
    }
  };

  const createAiDocument = async (title, content) => {
    const safeTitle = title || 'AI Draft';
    try {
      const created = await documentApi.create({
        title: safeTitle,
        content,
        design: { pageColor: '#1a1a1a', pageColorMode: 'theme' },
      });
      const newId = String(created?.id || created?._id || created?.document?.id || created?.document?._id || 'new');
      const newDoc = {
        id: newId,
        title: safeTitle,
        content,
        design: { pageColor: '#1a1a1a', pageColorMode: 'theme' },
        updatedAt: new Date().toISOString(),
        comments: [],
        trackChanges: false,
        localOnly: false,
      };
      updateCachedRecentDoc(newId, newDoc);
      setDocs((prev) => [newDoc, ...prev.filter((d) => d.id !== newId)]);
      setSelectedDocId(newId);
      toast('AI draft created', 'success');
      navigate(`/doc/${newId}`);
      return true;
    } catch {
      const { doc } = createLocalDoc({ title: safeTitle, content });
      const next = upsertLocalDoc(doc);
      updateCachedRecentDoc(doc.id, doc);
      setDocs(next);
      setSelectedDocId(doc.id);
      resetDoc();
      setDocTitle(doc.title);
      setDocContent(doc.content);
      toast('AI draft created locally', 'success');
      navigate('/doc/new');
      return true;
    }
  };

  const currentDocumentText = () => getPlainTextFromHtml(selectedDoc?.content || '');

  const handleRunAiAction = async () => {
    if (!aiAction) return;

    if (!canAccessAi(plan)) {
      openUpgradeModal(
        'Pragna AI writing tools are exclusively available on EtherX Pro. Upgrade to unleash AI grammar, rewriting, and summarization.',
        'pro'
      );
      return;
    }

    if (aiAction === 'content-generator') {
      if (!aiTopic.trim()) { toast('Enter a topic for the content generator', 'info'); return; }
      setAiRunning(true);
      try {
        const result = await executePragnaAi('content-generator', '', { 
          topic: aiTopic.trim(), 
          tone: aiTone,
          pages: aiPageCount
        });
        await createAiDocument(`${aiTopic.trim()} Draft`, result.html || '<p></p>');
        setAiAction(null);
        setAiTopic('');
        setAiPageCount(1);
      } finally { setAiRunning(false); }
      return;
    }

    const source = currentDocumentText();
    if (!source) { toast('Select a document with content first', 'info'); return; }

    setAiRunning(true);
    try {
      if (aiAction === 'summarize') {
        const result = await executePragnaAi('summarize', source);
        await createAiDocument(`Summary of ${cleanBaseName(selectedDoc?.title || 'Document')}`, result.html || '<p></p>');
        setAiAction(null);
        return;
      }
      if (aiAction === 'grammar') {
        const result = await executePragnaAi('grammar', source);
        const saved = await persistSelectedDocPatch({ content: result.html || '<p></p>' });
        if (saved) {
          toast('Pragna: Grammar corrected. Opening document…', 'success');
          openDoc(selectedDoc);
          setAiAction(null);
        }
        return;
      }
      if (aiAction === 'rewrite') {
        const result = await executePragnaAi('rewrite', source, { mode: aiRewriteMode });
        const saved = await persistSelectedDocPatch({ content: result.html || '<p></p>' });
        if (saved) {
          toast(`Pragna: Rewritten in "${aiRewriteMode}" style. Opening document…`, 'success');
          openDoc(selectedDoc);
          setAiAction(null);
        }
        return;
      }
      if (aiAction === 'title') {
        const fallback = aiFallbackTitle.trim() || selectedDoc?.title || 'Untitled Document';
        const result = await executePragnaAi('title', source, { fallbackTitle: fallback });
        const saved = await persistSelectedDocPatch({ title: result.title || fallback });
        if (saved) {
          toast(`Pragna: Title updated to "${result.title || fallback}"`, 'success');
          setAiAction(null);
        }
        return;
      }
      if (aiAction === 'translate') {
        const result = await executePragnaAi('translate', selectedDoc.content, { language: aiLanguage });
        const saved = await persistSelectedDocPatch({ content: result.html || result.text });
        if (saved) {
          toast(`Pragna: Document translated to ${aiLanguage}. Opening...`, 'success');
          openDoc(selectedDoc);
          setAiAction(null);
        }
      }
    } finally { setAiRunning(false); }
  };

  async function createFromTemplate(key) {
    const templateCheck = canAccessTemplate(plan, key);
    if (!templateCheck.allowed) {
      openUpgradeModal(templateCheck.reason, templateCheck.requiredTier || 'basic');
      return;
    }

    if (key === 'blank') {
      try {
        resetDoc();
        // Create blank document on backend
        const created = await documentApi.create({
          title: 'Untitled Document',
          content: '<p></p>',
          design: { pageColor: '#1a1a1a', pageColorMode: 'theme' },
          layout: getDefaultLayout(),
        });
        const newId = String(created?.id || created?._id || 'new');
        setSelectedDocId(newId);
        toast('Blank document created (save to add to recent list)', 'success');
        navigate(`/doc/${newId}`);
      } catch {
        // Fallback to local if backend unavailable
        const { doc } = createLocalDoc({
          title: 'Untitled Document',
          content: '<p></p>',
          source: { design: { pageColor: '#1a1a1a', pageColorMode: 'theme' }, layout: getDefaultLayout() },
        });
        setSelectedDocId(doc.id);
        resetDoc();
        setDocTitle(doc.title);
        setDocContent(doc.content);
        toast('Blank document created (save to add to recent list)', 'success');
        navigate('/doc/new');
      }
      return;
    }

    const title = `${key[0].toUpperCase()}${key.slice(1)} ${new Date().toLocaleDateString()}`;
    
    try {
      resetDoc();
      // Try to use backend template API first
      const created = await documentApi.create({ 
        title, 
        content: templateContent(key),  // Use local template content as fallback data
        design: { pageColor: '#1a1a1a', pageColorMode: 'theme' },
        layout: getDefaultLayout(),
      });
      const newId = String(created?.id || created?._id || created?.document?.id || created?.document?._id || 'new');
      setSelectedDocId(newId);
      toast(`${key} template created (save to add to recent list)`, 'success');
      navigate(`/doc/${newId}`);
    } catch {
      // Fallback: create locally if backend fails
      const content = templateContent(key);
      const { doc } = createLocalDoc({ title, content, source: { layout: getDefaultLayout() } });
      setSelectedDocId(doc.id);
      resetDoc();
      setDocTitle(doc.title);
      setDocContent(doc.content);
      toast('Template created (save to add to recent list)', 'success');
      navigate('/doc/new');
    }
  }

  async function deleteDoc(doc) {
    if (!doc) return;

    try {
      if (doc.localOnly) {
        const next = readLocalDocs().filter((d) => d.id !== doc.id);
        writeLocalDocs(next);
      } else {
        await documentApi.delete(doc.id);
      }
      clearLocalDraft(doc.id);
      removeCachedRecentDoc(doc.id);

      setDocs((prev) => {
        const next = prev.filter((d) => d.id !== doc.id);
        writeCachedRecentDocs(next);
        if (selectedDocId === doc.id) {
          setSelectedDocId(next[0]?.id || null);
        }
        return next;
      });
      toast('Document deleted', 'success');
    } catch {
      toast('Unable to delete this document', 'error');
    }
  }

  function openDoc(doc) {
    if (!doc) return;
    if (doc.localOnly) {
      resetDoc();
      setDocTitle(doc.title || 'Untitled Document');
      setDocContent(doc.content || '<p></p>');
      if (doc.layout) {
        useDocumentStore.getState().setLayout(doc.layout);
      }
      navigate('/doc/new');
      return;
    }
    navigate(`/doc/${doc.id}`);
  }

  async function runMenuAction(key, options = {}) {
    if (key === 'pricing') {
      openUpgradeModal();
      return;
    }

    if (key === 'ai') {
      if (!canAccessAi(plan)) {
        openUpgradeModal(
          'Pragna AI writing tools are exclusively available on EtherX Pro. Upgrade to unleash AI grammar, rewriting, and summarization.',
          'pro'
        );
        return;
      }
      setActiveMenu('ai');
      return;
    }

    if (key === 'open') {
      setActiveMenu('open');
      fileInputRef.current?.click();
      return;
    }

    if (key === 'new') {
      await createFromTemplate('blank');
      return;
    }

    if (key === 'admin') {
      navigate('/admin');
      return;
    }

    if (key === 'home' || key === 'export' || key === 'share' || key === 'saveAs' || key === 'info' || key === 'statistics' || key === 'settings') {
      setActiveMenu(key);
      if (key !== 'ai') setAiAction(null);
      if (key === 'saveAs' && saveAsSourceDoc) {
        setSaveAsName(nextCopyName(saveAsSourceDoc.title));
        setSaveAsLocation('thisPc');
      }
      return;
    }

    if (key === 'save') {
      const source = saveAsSourceDoc || selectedDoc;
      if (!source) return toast('Select a document first', 'info');

      if (source.id && source.id === useDocumentStore.getState().id && !source.localOnly) {
        const saved = await saveActiveDocument({ manual: true });
        if (saved) {
          setSelectedDocId(String(saved.id || source.id));
          setActiveMenu('home');
        }
        return;
      }

      if (source.localOnly) {
        const localDoc = { ...source, updatedAt: new Date().toISOString(), localOnly: true };
        upsertLocalDoc(localDoc);
        updateCachedRecentDoc(localDoc.id, localDoc);
        setSelectedDocId(localDoc.id);
        toast('Document saved locally', 'success');
        setActiveMenu('home');
        return;
      }
      try {
        const saved = await documentApi.save(source.id, source);
        updateCachedRecentDoc(source.id, saved);
        toast('Document saved', 'success');
        setActiveMenu('home');
      } catch (error) {
        toast(`Save failed: ${error?.message || 'Unable to save document'}`, 'error');
      }
      return;
    }

    if (key === 'print') {
      // Print what the Print pane shows: the open document's live content when it is
      // the selected one, with the pane's page settings over the document's own.
      const doc = saveAsSourceDoc || selectedDoc;
      if (!doc) return toast('Select a document first', 'info');
      const layout = { ...(doc.layout || {}), ...(options.layout || {}) };
      if (!printHtml(doc.content || '<p>No content available.</p>', { layout })) return toast('Popup blocked for printing', 'warning');
      setActiveMenu('home');
      return;
    }

    if (key === 'close') {
      handleBackToEditor();
      return;
    }
  }

  async function exportSelectedDoc(fmtOverride) {
    // Export what the Export pane shows: the open document's live content and
    // settings when it is the selected one.
    const doc = saveAsSourceDoc || selectedDoc;
    if (!doc) return toast('Select a document first', 'info');
    if (exportBusy) return;
    const fmt = (fmtOverride || exportFormat || 'pdf').toLowerCase();

    if (!canExportFormat(plan, fmt)) {
      openUpgradeModal(
        `${fmt.toUpperCase()} export is available on ${fmt === 'markdown' || fmt === 'md' || fmt === 'odt' ? 'Basic and Pro plans' : 'the Pro plan'}. Upgrade to unlock advanced export options.`,
        fmt === 'markdown' || fmt === 'md' || fmt === 'odt' ? 'basic' : 'pro'
      );
      return;
    }

    setExportBusy(true);
    try {
      let content = doc.content || '';
      if (!content || content === '<p></p>') {
        if (doc.id === currentEditorId && currentEditorContent && currentEditorContent !== '<p></p>') {
          content = currentEditorContent;
        } else if (doc.id) {
          try {
            const draft = readLocalDraft(doc.id);
            if (draft?.content && draft.content !== '<p></p>') content = draft.content;
          } catch {}
        }
        if ((!content || content === '<p></p>') && doc.id && !doc.localOnly) {
          try {
            const fullDoc = await documentApi.get(doc.id);
            if (fullDoc?.content && fullDoc.content !== '<p></p>') content = fullDoc.content;
          } catch (err) {
            console.warn('Could not fetch full document before export:', err.message);
          }
        }
      }
      if (!content) content = '<p></p>';

      const cleanTitle = cleanBaseName(doc.title) || 'document';
      const exportOptions = {
        ...doc,
        headerFooter: doc.headerFooter,
        design: doc.design,
        pageSettings: {
          format: doc.layout?.pageSize || 'a4',
          orientation: doc.layout?.pageOrientation || 'portrait',
          margin: doc.layout?.pageMargin || 'normal',
          columns: doc.layout?.pageColumns || 1,
        },
        watermark: doc.design?.watermark || '',
      };
      const blob = await generateFormatBlob(cleanTitle, fmt, content, exportOptions);
      const ext = fmt === 'etherx' ? 'ethex' : (fmt === 'markdown' ? 'md' : fmt);
      downloadBlob(blob, `${cleanTitle}.${ext}`);
      toast(`Exported as ${fmt.toUpperCase()}`, 'success');
    } catch (err) {
      toast(`Export failed: ${err.message}`, 'error');
    } finally {
      setExportBusy(false);
    }
  }

  // role: what anyone with the link may do ('viewer' | 'commenter' | 'editor'),
  // or 'restricted' to turn the link off so only invited people can open it.
  async function shareSelectedDoc(role = 'viewer') {
    if (!selectedDoc) return toast('Select a document first', 'info');

    if (plan === 'free') {
      openUpgradeModal(
        'Single-user editing only on the Free plan. Upgrade to Basic (up to 3 collaborators) or Pro (unlimited real-time collaboration) to share documents.',
        'basic'
      );
      return;
    }

    if (shareWorking || shareCopied) return;
    setShareWorking(true);

    try {
      const targetDoc = await ensureCloudDocForShare(selectedDoc);
      let link = buildSharedUrl(targetDoc.id);
      if (role === 'restricted') {
        await documentApi.save(targetDoc.id, { shareLinkEnabled: false });
      } else {
        const response = await documentApi.share(targetDoc.id, { role });
        if (response?.shareUrl) link = response.shareUrl;
      }
      setDocs((prev) => prev.map((doc) => String(doc.id) === String(targetDoc.id)
        ? { ...doc, shareLinkEnabled: role !== 'restricted', shareLinkRole: role === 'restricted' ? doc.shareLinkRole : role }
        : doc));

      const copied = await copyTextToClipboard(link);
      if (copied) {
        setShareCopied(true);
        toast(role === 'restricted' ? 'Link copied. Only invited people can open it.' : 'Share link copied to clipboard', 'success');
        setTimeout(() => setShareCopied(false), 2000);
      } else {
        toast('Failed to copy link to clipboard', 'error');
      }
    } catch (err) {
      toast(err?.message || 'Unable to create a share link right now', 'error');
    } finally {
      setShareWorking(false);
    }
  }

  async function createCloudCopyFrom(doc, titleOverride) {
    const createCheck = canCreateDocument(plan, docs.length, usage?.storageBytes || 0);
    if (!createCheck.allowed) {
      openUpgradeModal(createCheck.reason, createCheck.requiredTier || 'basic');
      return null;
    }

    const content = doc?.content || '<p></p>';
    const title = cleanBaseName(titleOverride || doc?.title || 'Untitled Document');
    const created = await documentApi.create({
      title,
      content,
      comments: Array.isArray(doc?.comments) ? doc.comments : [],
      trackChanges: Boolean(doc?.trackChanges),
      design: doc?.design,
      headerFooter: doc?.headerFooter,
    });
    const newId = String(created?.id || created?._id || created?.document?.id || created?.document?._id || '');
    if (!newId) throw new Error('Cloud document was not created');
    const newDoc = {
      id: newId,
      title,
      content,
      updatedAt: created?.updatedAt || new Date().toISOString(),
      design: created?.design || doc?.design,
      headerFooter: created?.headerFooter || doc?.headerFooter,
      comments: Array.isArray(created?.comments) ? created.comments : (doc?.comments || []),
      trackChanges: typeof created?.trackChanges === 'boolean' ? created.trackChanges : Boolean(doc?.trackChanges),
      localOnly: false,
    };
    if (newId) {
      updateCachedRecentDoc(newId, newDoc);
      setDocs((prev) => {
        const next = [newDoc, ...prev.filter((d) => d.id !== newId)];
        writeCachedRecentDocs(next);
        return next;
      });
      setSelectedDocId(newId);
    }
    return newDoc;
  }

  async function ensureCloudDocForShare(sourceDoc) {
    if (!sourceDoc?.localOnly) return sourceDoc;
    const cloudDoc = await createCloudCopyFrom(sourceDoc, sourceDoc.title);
    toast('Created cloud copy for sharing', 'success');
    return cloudDoc;
  }

  const openShareForSaveAs = async (invite = {}) => {
    const doc = saveAsSourceDoc;
    if (!doc) {
      toast('Open or select a document first', 'info');
      return;
    }
    if (plan === 'free') {
      openUpgradeModal(
        'Single-user editing only on the Free plan. Upgrade to Basic (up to 3 collaborators) or Pro (unlimited real-time collaboration) to share documents.',
        'basic'
      );
      return;
    }
    setSaveAsBusy(true);
    try {
      const cloudDoc = await ensureCloudDocForShare(doc);
      setShareDialogDoc({ ...cloudDoc, initialEmail: invite.email || '', initialRole: invite.role || 'editor' });
    } catch (err) {
      toast(`Unable to prepare document for sharing: ${err?.message || 'Error'}`, 'error');
    } finally {
      setSaveAsBusy(false);
    }
  };

  async function performSaveAs() {
    const sourceDoc = saveAsSourceDoc;
    if (!sourceDoc) {
      toast('Open or select a document first', 'info');
      return;
    }

    if (saveAsLocation === 'share') {
      await openShareForSaveAs();
      return;
    }

    const finalName = cleanBaseName(saveAsName || nextCopyName(sourceDoc.title));
    if (!finalName) {
      toast('Enter a file name', 'warning');
      return;
    }

    if (saveAsLocation === 'recent') {
      toast('Choose This PC to save', 'info');
      return;
    }

    setSaveAsBusy(true);
    try {
      const wantsLocalFile = saveAsLocation === 'thisPc';

      if (wantsLocalFile) {
        // Ensure content is fully hydrated
        let content = sourceDoc.content || '';
        if (!content || content === '<p></p>') {
          if (sourceDoc.id) {
            try {
              const draft = readLocalDraft(sourceDoc.id);
              if (draft?.content && draft.content !== '<p></p>') content = draft.content;
            } catch {}
          }
          if ((!content || content === '<p></p>') && sourceDoc.id && !sourceDoc.localOnly) {
            try {
              const fullDoc = await documentApi.get(sourceDoc.id);
              if (fullDoc?.content && fullDoc.content !== '<p></p>') content = fullDoc.content;
            } catch (err) {
              console.warn('Could not fetch full document before saveAs:', err.message);
            }
          }
        }
        const exportOptions = {
          ...sourceDoc,
          headerFooter: sourceDoc.headerFooter,
          design: sourceDoc.design,
          pageSettings: {
            format: sourceDoc.layout?.pageSize || sourceDoc.layout?.size || 'a4',
            orientation: sourceDoc.layout?.pageOrientation || sourceDoc.layout?.orientation || 'portrait',
            margin: sourceDoc.layout?.pageMargin || sourceDoc.layout?.margin || 'normal',
            columns: sourceDoc.layout?.pageColumns || 1,
          },
          watermark: sourceDoc.design?.watermark || '',
        };
        const blob = await generateFormatBlob(finalName, saveAsFormat, content, exportOptions);
        const ext = saveAsFormat === 'etherx' ? 'ethex' : (saveAsFormat === 'markdown' ? 'md' : saveAsFormat);
        const fileNameWithExt = `${finalName}.${ext}`;

        const pickerResult = await saveWithFilePicker(finalName, saveAsFormat, blob);
        if (pickerResult === null) {
          toast('Save As cancelled', 'info');
          return;
        }

        if (pickerResult !== true) {
          downloadBlob(blob, fileNameWithExt);
        }

        toast('Saved to your computer', 'success');
        setActiveMenu('home');
        return;
      }

      const createdDoc = await createCloudCopyFrom(sourceDoc, finalName);
      toast('Saved as a new cloud document', 'success');
      navigate(`/doc/${createdDoc.id}`);
    } catch (error) {
      const message = error?.message || 'Save failed';
      if (saveAsLocation === 'share') {
        toast(`Unable to share document: ${message}`, 'error');
      } else if (saveAsLocation === 'thisPc' || saveAsFormat !== 'etherx') {
        toast(`Unable to save the file: ${message}`, 'error');
      } else {
        const { doc, next } = createLocalDoc({
          title: finalName,
          content: sourceDoc.content || '<p></p>',
          source: sourceDoc,
        });
        setDocs(next);
        setSelectedDocId(doc.id);
        toast('Cloud Save As failed, saved locally', 'warning');
        setActiveMenu('home');
      }
    } finally {
      setSaveAsBusy(false);
    }
  }

  async function handleUploadOpen(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const createCheck = canCreateDocument(plan, docs.length, usage?.storageBytes || 0);
    if (!createCheck.allowed) {
      openUpgradeModal(createCheck.reason, createCheck.requiredTier || 'basic');
      event.target.value = '';
      return;
    }

    const fileName = file.name.replace(/\.[^/.]+$/, '');
    let content = '';
    let importedDesign = {};
    let importedLayout = null;
    
    try {
      // Handle .docx files
      if (file.name.toLowerCase().endsWith('.docx')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const { html, design: docxDesign, layout: docxLayout } = await docxToHtml(arrayBuffer);
          importedDesign = docxDesign || {};
          importedLayout = docxLayout;
          
          // Ensure we have valid HTML structure
          if (!html.trim()) {
            content = '<p>Document opened but appears to be empty or in an unsupported format.</p>';
          } else {
            // Wrap in proper structure with consistent formatting
            content = `<div>${html}</div>`;
          }
        } catch (mammothErr) {
          console.warn('Mammoth parsing failed:', mammothErr);
          content = '<p>Unable to parse Word document. Please try a different file or contact support.</p>';
        }
      } else {
        // Handle text files (.txt, .md, etc.)
        const text = await file.text();
        content = `<p>${escapeHtml(text.slice(0, 50000)).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
      }
      
      try {
        const created = await documentApi.create({
          title: fileName,
          content,
          design: { pageColor: '#1a1a1a', pageColorMode: 'theme', ...importedDesign },
          ...(importedLayout ? { layout: { ...getDefaultLayout(), ...importedLayout } } : {}),
        });
        const newId = String(created?.id || created?._id || created?.document?.id || created?.document?._id || 'new');
        toast('File opened as a new document (save to add to recent list)', 'success');
        navigate(`/doc/${newId}`);
      } catch {
        const { doc } = createLocalDoc({
          title: fileName,
          content,
        });
        setSelectedDocId(doc.id);
        resetDoc();
        setDocTitle(doc.title);
        setDocContent(doc.content);
        toast('Opened file locally (save to add to recent list)', 'warning');
        navigate('/doc/new');
      }
    } catch (err) {
      toast(`Failed to open file: ${err?.message || 'Unknown error'}`, 'error');
      console.error('File open error:', err);
    } finally {
      event.target.value = '';
    }
  }

  const stats = selectedDoc
    ? (() => {
        const text = String(selectedDoc.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const words = text ? text.split(' ').length : 0;
        return {
          words,
          chars: text.length,
          pages: estimatePagesFromHtml(selectedDoc.content),
        };
      })()
    : { words: 0, chars: 0, pages: 0 };


  return <>
    <input ref={fileInputRef} type="file" hidden onChange={handleUploadOpen} />
    <FileWorkspace page={activeMenu} setPage={(key) => { setActiveMenu(key); if (key === 'saveAs') setSaveAsName(`Copy of ${saveAsSourceDoc?.title || 'Untitled Document'}`); }}
      docs={docs.map((doc) => ({ ...doc, pageCount: doc.pageCount || estimatePagesFromHtml(doc.content) }))} document={saveAsSourceDoc || selectedDoc} search={search} onSearch={setSearch}
      onSaveTitle={(title) => {
        if (saveAsSourceDoc?.id === currentEditorId) setDocTitle(title);
        else setDocs((previous) => previous.map((doc) => doc.id === selectedDocId ? { ...doc, title, isDirty: true } : doc));
      }}
      openDoc={openDoc} createTemplate={createFromTemplate} back={handleBackToEditor} browse={() => fileInputRef.current?.click()}
      saveName={saveAsName} setSaveName={setSaveAsName} saveFormat={saveAsFormat} setSaveFormat={setSaveAsFormat}
      saveLocation={saveAsLocation} setSaveLocation={setSaveAsLocation} saveAs={performSaveAs} saveBusy={saveAsBusy}
      exportFormat={exportFormat} setExportFormat={setExportFormat} exportDocument={() => exportSelectedDoc(exportFormat)} exportBusy={exportBusy}
      plan={plan} user={currentUser} stats={stats} isAdmin={isAdminUser} onMenuAction={runMenuAction}
      requestDelete={setConfirmDelete} share={openShareForSaveAs} copyShareLink={shareSelectedDoc}>
      <p style={{ padding: 48 }}>Choose a page from the File menu.</p>
    </FileWorkspace>
    <DialogManager />
    {confirmDelete && <Modal title="Delete document?" onClose={() => setConfirmDelete(null)}>
      <p>Delete “{confirmDelete.title}” permanently?</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
        <Button onClick={() => { const doc = confirmDelete; setConfirmDelete(null); deleteDoc(doc); }}>Delete</Button>
      </div>
    </Modal>}
    {shareDialogDoc && <ShareDialog documentId={shareDialogDoc.id} documentTitle={shareDialogDoc.title} documentContent={shareDialogDoc.content} initialEmail={shareDialogDoc.initialEmail} initialRole={shareDialogDoc.initialRole} onClose={() => setShareDialogDoc(null)} />}
  </>;
}

const styles = {
  page: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    overflow: 'hidden',
  },
  sidebar: {
    width: 238,
    minHeight: 0,
    borderRight: '1px solid var(--border-strong)',
    background: 'var(--bg-surface)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    overflowX: 'hidden',
    overscrollBehaviorY: 'contain',
    WebkitOverflowScrolling: 'touch',
  },
  menuList: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '10px 8px',
  },
  menuBtn: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    width: '100%',
    boxSizing: 'border-box',
    background: 'transparent',
    color: 'var(--text-secondary)',
    padding: '10px 10px',
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    textAlign: 'left',
    fontSize: 15,
    lineHeight: 1,
    fontWeight: 500,
  },
  menuBtnActive: {
    background: 'var(--bg-hover)',
    borderColor: 'var(--border-gold)',
    color: 'var(--text-gold)',
  },
  menuBtnDanger: {
    color: '#cf5d5d',
  },
  menuIcon: {
    width: 18,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    opacity: 0.92,
  },
  usageWidget: {
    margin: '10px 8px 6px',
    padding: '10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'rgba(255, 255, 255, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
  },
  usageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usagePlanBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.6px',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--bg-elevated)',
    color: 'var(--text-gold)',
    border: '1px solid var(--border-gold)',
  },
  usageLabel: {
    fontSize: 11.5,
    color: 'var(--text-secondary)',
  },
  usageBarBg: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    background: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  darkModeStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    border: '1px solid var(--border-gold)',
    borderRadius: 8,
    background: 'var(--bg-hover)',
    color: 'var(--text-gold)',
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  darkModeIndicator: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--gold)',
    boxShadow: '0 0 8px rgba(212,175,55,0.55)',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-app)',
    overflowY: 'auto',
  },
  hero: {
    padding: '40px 48px 8px',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 20,
    flexWrap: 'wrap',
  },
  heroTitle: {
    margin: 0,
    fontSize: 32,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    color: 'var(--text-heading)',
  },
  heroSub: {
    marginTop: 6,
    marginBottom: 0,
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  recentOpenBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    textAlign: 'left',
    padding: 0,
    fontFamily: 'inherit',
  },
  recentDeleteBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    borderRadius: 6,
    cursor: 'pointer',
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTitle: {
    fontSize: 13.5,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
    gap: 16,
  },
  sidebarTop: {
    padding: '20px 16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    borderBottom: '1px solid var(--border)',
  },
  fileMenuLogo: {
    width: 168,
    height: 'auto',
    display: 'block',
    alignSelf: 'flex-start',
  },
  backLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    padding: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12.5,
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },
  managePlanBtn: {
    marginTop: 4,
    border: '1px solid var(--border-gold)',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-gold)',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 34,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    width: 260,
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'inherit',
  },
  homeArea: {
    padding: '24px 48px 48px',
    boxSizing: 'border-box',
    width: '100%',
  },
  startCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
    marginBottom: 36,
  },
  startCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: 16,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'border-color 120ms ease',
  },
  startCardPrimary: {
    borderColor: 'rgba(214,178,94,0.45)',
  },
  startCardIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-hover)',
    color: 'var(--text-secondary)',
    marginBottom: 8,
  },
  startCardIconPrimary: {
    background: 'var(--gold)',
    color: '#1a1a1a',
  },
  startCardTitle: {
    fontSize: 13.5,
    fontWeight: 500,
  },
  startCardText: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-heading)',
  },
  catChip: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    background: 'transparent',
    color: 'var(--text-secondary)',
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  catChipActive: {
    borderColor: 'var(--border-gold)',
    background: 'var(--bg-hover)',
    color: 'var(--text-gold)',
  },
  templateCard: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 4,
    textAlign: 'left',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
  },
  templatePaper: {
    position: 'relative',
    aspectRatio: '8.5 / 11',
    background: '#fafaf7',
    borderRadius: 4,
    boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)',
    padding: '14% 12%',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    marginBottom: 6,
    overflow: 'hidden',
  },
  paperLine: {
    display: 'block',
    height: 3,
    borderRadius: 1,
    background: '#d9d6cf',
    flexShrink: 0,
  },
  lockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: '2px 6px',
    borderRadius: 4,
    background: '#1a1a1a',
    color: 'var(--gold)',
    fontSize: 9.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  templateName: {
    fontSize: 13,
    fontWeight: 500,
  },
  templateCat: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
  },
  recentTabBtn: {
    border: 'none',
    background: 'transparent',
    padding: '0 0 10px',
    fontSize: 13.5,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  viewAllLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-gold)',
    fontSize: 12.5,
    cursor: 'pointer',
    padding: '0 0 10px',
    fontFamily: 'inherit',
  },
  recentTable: {
    display: 'flex',
    flexDirection: 'column',
  },
  recentRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1.2fr) minmax(0, 1.4fr) 56px 32px',
    alignItems: 'center',
    gap: 12,
    padding: '9px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: 12.5,
    color: 'var(--text-secondary)',
  },
  recentHeadRow: {
    fontSize: 11,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '10px 8px 8px',
  },
  drawerBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 40,
  },
  mobileBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: 'var(--bg-app)',
  },
  mobileMenuBtn: {
    width: 36,
    height: 36,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  chipScroller: {
    display: 'flex',
    gap: 6,
    width: '100%',
    overflowX: 'auto',
    paddingBottom: 2,
    scrollbarWidth: 'none',
  },
  docIcon: {
    width: 22,
    height: 28,
    flexShrink: 0,
    borderRadius: 2,
    background: '#fafaf7',
    padding: '5px 4px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  panel: {
    margin: '10px 54px 40px',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 10,
    padding: 18,
    maxWidth: 760,
  },
  panelTitle: {
    margin: '0 0 12px',
    color: 'var(--text-heading)',
    fontSize: 26,
  },
  panelSubtitle: {
    margin: '-4px 0 16px',
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.5,
  },
  panelRow: {
    fontSize: 14,
    color: 'var(--text-primary)',
    marginBottom: 8,
  },
  aiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  aiBtn: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)',
    color: 'var(--text-primary)',
    padding: '14px 16px',
    minHeight: 84,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    textAlign: 'left',
    boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset',
  },
  aiBtnIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(212,175,55,0.12)',
    color: 'var(--gold)',
    flexShrink: 0,
    fontSize: 18,
  },
  aiBtnActive: {
    border: '1px solid var(--border-gold)',
    background: 'var(--bg-hover)',
    color: 'var(--text-gold)',
  },
  aiFormArea: {
    marginTop: 16,
    padding: 16,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  aiFormTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 2,
  },
  aiFormGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  aiFormLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  aiFormInput: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    padding: '9px 12px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
  },
  aiFormSelect: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    padding: '9px 12px',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  aiFormHint: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  aiFormActions: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },
  aiBtnRun: {
    border: '1px solid var(--border-gold)',
    borderRadius: 8,
    background: 'var(--bg-hover)',
    color: 'var(--text-gold)',
    padding: '9px 24px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  aiBtnCancel: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--text-muted)',
    padding: '9px 16px',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  panelList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
  },
  panelItem: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 10px',
  },
  panelItemMain: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flex: 1,
    minWidth: 0,
    padding: '2px 4px',
  },
  panelItemMeta: {
    fontSize: 12,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  panelDeleteBtn: {
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    padding: '5px 8px',
    cursor: 'pointer',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  panelActions: {
    marginTop: 12,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  panelActionsLeft: {
    marginTop: 12,
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-start',
  },
  primaryActionBtn: {
    border: '1px solid var(--border-gold)',
    borderRadius: 8,
    background: 'var(--bg-hover)',
    color: 'var(--text-gold)',
    padding: '9px 12px',
    cursor: 'pointer',
    fontSize: 14,
    marginBottom: 12,
  },
  secondaryActionBtn: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: 13,
  },
  search: {
    width: '100%',
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 14,
  },
  saveAsShell: {
    margin: '10px 54px 40px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    padding: 18,
    maxWidth: 980,
  },
  saveAsTitle: {
    margin: '0 0 12px',
    fontSize: 26,
    color: 'var(--text-heading)',
  },
  saveAsLayout: {
    display: 'grid',
    gridTemplateColumns: '332px 1fr',
    borderTop: '1px solid var(--border)',
    minHeight: 420,
  },
  saveAsLeft: {
    padding: '12px 14px 12px 0',
    borderRight: '1px solid var(--border)',
  },
  saveAsRight: {
    padding: '12px 0 0 22px',
    display: 'flex',
    flexDirection: 'column',
  },
  saveAsBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottom: '1px solid var(--border)',
  },
  saveAsSectionTitle: {
    color: 'var(--text-secondary)',
    fontWeight: 700,
    marginBottom: 8,
    fontSize: 18,
  },
  saveAsItem: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-primary)',
    padding: '10px 10px',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 15,
  },
  saveAsItemActive: {
    background: 'var(--bg-hover)',
    borderColor: 'var(--border-gold)',
    color: 'var(--text-gold)',
  },
  saveAsIcon: {
    width: 40,
    textAlign: 'center',
    opacity: 0.9,
  },
  saveAsRightHeading: {
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: 22,
    fontWeight: 700,
  },
  saveAsMuted: {
    marginTop: 6,
    color: 'var(--text-muted)',
    fontSize: 13,
    maxWidth: 780,
  },
  saveAsFavoritesList: {
    marginTop: 8,
    borderTop: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
  },
  saveAsFavoriteRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
    padding: '10px 10px',
    fontSize: 15,
  },
  saveAsFavoriteFolder: {
    fontSize: 24,
    color: 'var(--text-secondary)',
    width: 40,
    textAlign: 'center',
  },
  saveAsFavoriteMain: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  saveAsFavoriteTitle: {
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  saveAsFavoritePath: {
    marginTop: 2,
    color: 'var(--text-muted)',
    fontSize: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  saveAsFavoriteTime: {
    color: 'var(--text-muted)',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  saveAsFormRow: {
    marginTop: 16,
    display: 'grid',
    gridTemplateColumns: '130px 1fr',
    alignItems: 'center',
    gap: 10,
  },
  saveAsFieldLabel: {
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  saveAsInput: {
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    padding: '9px 10px',
    fontSize: 14,
  },
  saveAsSelect: {
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    padding: '9px 10px',
    fontSize: 14,
  },
  saveAsActionRow: {
    marginTop: 'auto',
    paddingTop: 16,
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },
  saveAsContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  saveAsHeader: {
    paddingBottom: 20,
    borderBottom: '1px solid var(--border)',
  },
  saveAsSubtitle: {
    margin: '8px 0 0 0',
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  saveAsMainContent: {
    display: 'grid',
    gridTemplateColumns: '200px 1fr',
    gap: 24,
    marginTop: 20,
    flex: 1,
    minHeight: 0,
  },
  saveAsQuickAccess: {
    display: 'flex',
    flexDirection: 'column',
    paddingRight: 16,
    borderRight: '1px solid var(--border)',
    overflowY: 'auto',
    maxHeight: '600px',
  },
  saveAsQuickAccessTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  saveAsQuickItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 10px',
    marginBottom: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'left',
    transition: 'all 0.2s ease',
  },
  saveAsQuickItemActive: {
    background: 'var(--bg-hover)',
    borderColor: 'var(--border-gold)',
    color: 'var(--text-gold)',
    fontWeight: 600,
  },
  saveAsQuickIcon: {
    fontSize: 16,
    width: 24,
    height: 24,
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'currentColor',
  },
  saveAsQuickLabel: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  saveAsRecentPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 14,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
  },
  saveAsRecentTitle: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  saveAsRecentItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '9px 10px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  saveAsRecentItemMain: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    gap: 2,
  },
  saveAsRecentItemTitle: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
    fontWeight: 600,
  },
  saveAsRecentItemMeta: {
    color: 'var(--text-muted)',
    fontSize: 11,
  },
  saveAsRecentItemAction: {
    color: 'var(--text-gold)',
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },
  saveAsRecentEmpty: {
    color: 'var(--text-muted)',
    fontSize: 13,
    padding: '6px 0',
  },
  saveAsFormArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  saveAsLocationCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  saveAsLocationIcon: {
    fontSize: 32,
    opacity: 0.8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  saveAsLocationName: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  saveAsLocationPath: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  saveAsInfoBanner: {
    display: 'flex',
    gap: 12,
    padding: 14,
    background: 'var(--bg-surface)',
    border: '1px solid #d4af37',
    borderRadius: 8,
    color: 'var(--text-primary)',
  },
  saveAsInfoIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    flexShrink: 0,
    color: 'var(--text-primary)',
  },
  saveAsInfoTitle: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4,
    color: 'var(--text-primary)',
  },
  saveAsInfoText: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  saveAsFormSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  saveAsFormGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  saveAsLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  saveAsInputLarge: {
    width: '100%',
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    padding: '12px 14px',
    fontSize: 15,
    boxSizing: 'border-box',
  },
  saveAsSelectLarge: {
    width: '100%',
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    padding: '12px 14px',
    fontSize: 15,
    boxSizing: 'border-box',
  },
  saveAsInputHint: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  saveAsActionBar: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    paddingTop: 16,
    borderTop: '1px solid var(--border)',
    marginTop: 'auto',
  },
  saveAsCancelBtn: {
    padding: '10px 24px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  saveAsSubmitBtn: {
    padding: '10px 32px',
    border: '1px solid var(--border-gold)',
    borderRadius: 6,
    background: 'var(--bg-hover)',
    color: 'var(--text-gold)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.2s ease',
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '36px 16px',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 10,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    padding: '0 14px',
    border: '1px solid var(--border-gold)',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--text-gold)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dialogBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
  },
  dialogTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-heading)',
    overflowWrap: 'anywhere',
  },
  dialogText: {
    margin: '8px 0 20px',
    fontSize: 13.5,
    color: 'var(--text-muted)',
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  dialogCancelBtn: {
    height: 38,
    padding: '0 16px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 13.5,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dialogDangerBtn: {
    height: 38,
    padding: '0 16px',
    borderRadius: 8,
    border: 'none',
    background: '#e5484d',
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
