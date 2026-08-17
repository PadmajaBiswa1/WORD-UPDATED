import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import mammoth from 'mammoth';
import { documentApi, exportApi } from '@/services/api';
import { buildDocxBlob, buildHtmlDocument, exportToDocx, exportToHtml, exportToPdf } from '@/services/export';
import { buildAiResult, getPlainTextFromHtml, openTranslationUrl } from '@/services/ai';
import { useUIStore, useDocumentStore } from '@/store';
import { getStoredUser } from '@/services/api';

const LOCAL_FILE_DOCS_KEY = 'etherx_file_docs';

function getLocalDocsStorageKey() {
  const user = getStoredUser();
  const scope = user?.id || user?.email || 'guest';
  return `${LOCAL_FILE_DOCS_KEY}:${String(scope).toLowerCase()}`;
}

// SVG Icon Components
function getSaveAsIcon(location) {
  const iconStyle = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  
  const icons = {
    recent: <svg {...iconStyle}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    cloud: <svg {...iconStyle}><path d="M3 11a4 4 0 0 1 4-4h1a4 4 0 0 1 7.753-1.1A4.5 4.5 0 1 1 21 11H3z" /></svg>,
    share: <svg {...iconStyle}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
    copyLink: <svg {...iconStyle}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
    thisPc: <svg {...iconStyle}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
    browse: <svg {...iconStyle}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  };
  
  return icons[location] || icons.cloud;
}

function getSaveAsLargeIcon(location) {
  const iconStyle = { width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.8 };
  
  const icons = {
    recent: <svg {...iconStyle}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    cloud: <svg {...iconStyle}><path d="M3 11a4 4 0 0 1 4-4h1a4 4 0 0 1 7.753-1.1A4.5 4.5 0 1 1 21 11H3z" /></svg>,
    share: <svg {...iconStyle}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
    copyLink: <svg {...iconStyle}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
    thisPc: <svg {...iconStyle}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
    browse: <svg {...iconStyle}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  };
  
  return icons[location] || icons.cloud;
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
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'ai', label: 'AI', icon: '✦' },
  { key: 'new', label: 'New', icon: '✧' },
  { key: 'open', label: 'Open', icon: '◫' },
  { key: 'save', label: 'Save', icon: '⎙' },
  { key: 'saveAs', label: 'Save As', icon: '⇪' },
  { key: 'print', label: 'Print', icon: '⎘' },
  { key: 'export', label: 'Export', icon: '⇩' },
  { key: 'share', label: 'Share', icon: '⤴' },
  { key: 'info', label: 'Info', icon: 'ⓘ' },
  { key: 'statistics', label: 'Statistics', icon: '↕' },
  { key: 'settings', label: 'Settings', icon: '✶' },
  { key: 'close', label: 'Close', icon: '✕', danger: true },
];

const START_TEMPLATES = [
  { key: 'blank', label: 'Blank' },
  { key: 'business', label: 'Business' },
  { key: 'letter', label: 'Letter' },
  { key: 'resume', label: 'Resume' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'invoice', label: 'Invoice' },
];

const SAVE_AS_FORMATS = [
  { key: 'etherx', label: 'EtherX Document (.ethex)' },
  { key: 'docx', label: 'Word Document (.docx)' },
  { key: 'html', label: 'Web Page (.html)' },
];

const SAVE_AS_LOCATIONS = [
  { key: 'recent', label: 'Recent', icon: '◷', area: 'leftTop' },
  { key: 'cloud', label: 'EtherX Cloud', icon: '☁', area: 'personal' },
  { key: 'share', label: 'Share Document', icon: '⇪', area: 'share' },
  { key: 'copyLink', label: 'Copy Link', icon: '⎘', area: 'share' },
  { key: 'thisPc', label: 'This PC', icon: '🖥', area: 'other' },
  { key: 'browse', label: 'Browse Folder', icon: '📁', area: 'other' },
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
<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
  <div>
    <h1 style="margin: 0; font-size: 32px; font-weight: bold;">INVOICE</h1>
    <p style="margin: 5px 0; font-size: 14px; color: #d4af37;"><strong>#INV-2026-001</strong></p>
  </div>
  <div style="text-align: right;">
    <h2 style="margin: 0; font-size: 16px; font-weight: bold;">Your Business Name</h2>
    <p style="margin: 5px 0; font-size: 13px;">123 Your Street, City, State ZIP</p>
    <p style="margin: 5px 0; font-size: 13px;">billing@business.com • (555) 000-0000</p>
  </div>
</div>

<div style="display: flex; gap: 40px; margin-bottom: 30px;">
  <div style="flex: 1;">
    <p style="margin: 0; font-size: 12px; font-weight: bold; color: #666;">BILL TO</p>
    <p style="margin: 5px 0 0 0; font-size: 13px;"><strong>Client Full Name</strong></p>
    <p style="margin: 5px 0; font-size: 13px;">Client Company Inc.</p>
    <p style="margin: 5px 0; font-size: 13px;">456 Client Street, City, State ZIP</p>
    <p style="margin: 5px 0; font-size: 13px;">client@company.com</p>
  </div>
  <div>
    <p style="margin: 5px 0; font-size: 13px;"><strong>Invoice No.</strong> <span style="float: right; color: #d4af37;">INV-2026-001</span></p>
    <p style="margin: 5px 0; font-size: 13px;"><strong>Invoice Date</strong> <span style="float: right; color: #d4af37;">April 22, 2026</span></p>
    <p style="margin: 5px 0; font-size: 13px;"><strong>Due Date</strong> <span style="float: right; color: #d4af37;">May 22, 2026</span></p>
    <p style="margin: 5px 0; font-size: 13px;"><strong>Status</strong> <span style="float: right; color: #d4af37; font-weight: bold;">UNPAID</span></p>
  </div>
</div>

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
      <td style="padding: 10px; font-size: 13px;">Service or Product Name</td>
      <td style="text-align: center; padding: 10px; font-size: 13px;">1</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$1,200.00</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$1,200.00</td>
    </tr>
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px; font-size: 13px;">Consulting Hours (Design)</td>
      <td style="text-align: center; padding: 10px; font-size: 13px;">4</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$150.00</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$600.00</td>
    </tr>
    <tr>
      <td style="padding: 10px; font-size: 13px;">Additional Service Item</td>
      <td style="text-align: center; padding: 10px; font-size: 13px;">1</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$350.00</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$350.00</td>
    </tr>
  </tbody>
</table>

<div style="display: flex; justify-content: flex-end; margin: 20px 0;"></div>

<div style="display: flex; justify-content: flex-end; gap: 30px; margin: 30px 0; font-size: 13px;">
  <div style="width: 200px;">
    <div style="border-bottom: 1px solid #ddd; padding: 8px 0; text-align: right;">
      <p style="margin: 0;"><strong>Subtotal</strong> <span style="float: right;">$2,150.00</span></p>
    </div>
    <div style="border-bottom: 1px solid #ddd; padding: 8px 0; text-align: right;">
      <p style="margin: 0;"><strong>Tax (GST 18%)</strong> <span style="float: right;">$387.00</span></p>
    </div>
    <div style="padding: 8px 0; text-align: right; font-size: 14px;">
      <p style="margin: 0; font-weight: bold; color: #d4af37;"><strong>Total Due</strong> <span style="float: right;">$2,537.00</span></p>
    </div>
  </div>
</div>

<div style="display: flex; gap: 40px; margin: 40px 0; padding-top: 20px; border-top: 1px solid #ccc;">
  <div style="flex: 1;">
    <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: bold; color: #666;">PAYMENT INSTRUCTIONS</p>
    <p style="margin: 3px 0; font-size: 12px;">Bank Transfer: Your Bank Name</p>
    <p style="margin: 3px 0; font-size: 12px;">Account Name: Your Business Name</p>
    <p style="margin: 3px 0; font-size: 12px;">Account No.: XXXX-XXXX-XXXX</p>
    <p style="margin: 3px 0; font-size: 12px;">IFSC / Routing: XXXXXXXX</p>
    <p style="margin: 3px 0; font-size: 12px;">Or pay via: razorpay.com/your-link</p>
  </div>
  <div style="flex: 1;">
    <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: bold; color: #666;">TERMS & NOTES</p>
    <p style="margin: 3px 0; font-size: 12px;">Payment due within 30 days of invoice date. Late payments are subject to a 1.5% monthly interest charge. Thank you for your business — we appreciate the partnership!</p>
  </div>
</div>
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
  }, 0);
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
  return copied;
}

function filePickerSupported() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

function pickerOptions(name, format) {
  const byFormat = {
    etherx: {
      suggestedName: `${name}.ethex`,
      types: [{ description: 'EtherX Document', accept: { 'application/json': ['.ethex'] } }],
    },
    html: {
      suggestedName: `${name}.html`,
      types: [{ description: 'Web Page', accept: { 'text/html': ['.html'] } }],
    },
    docx: {
      suggestedName: `${name}.docx`,
      types: [{ description: 'Word Document', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }],
    },
  };
  return byFormat[format] || byFormat.etherx;
}

async function saveWithFilePicker(name, format, content) {
  if (!filePickerSupported()) return false;

  const { suggestedName, types } = pickerOptions(name, format);
  try {
    const handle = await window.showSaveFilePicker({ suggestedName, types });
    const writable = await handle.createWritable();

    if (format === 'docx') {
      const blob = await buildDocxBlob(content || '<p></p>');
      await writable.write(blob);
    } else if (format === 'html') {
      const html = buildHtmlDocument(name, content || '<p></p>');
      await writable.write(new Blob([html], { type: 'text/html;charset=utf-8' }));
    } else {
      const payload = {
        title: cleanBaseName(name),
        content: content || '<p></p>',
        exportedAt: new Date().toISOString(),
        format: 'ethex-document',
      };
      await writable.write(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
    }

    await writable.close();
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return null;
    throw error;
  }
}

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
    design: source.design,
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
  const resetDoc = useDocumentStore((s) => s.reset);
  const setDocTitle = useDocumentStore((s) => s.setTitle);
  const setDocContent = useDocumentStore((s) => s.setContent);
  const currentEditorId = useDocumentStore((s) => s.id);
  const currentEditorTitle = useDocumentStore((s) => s.title);
  const currentEditorContent = useDocumentStore((s) => s.content);
  const currentEditorDesign = useDocumentStore((s) => s.design);
  const currentEditorHeaderFooter = useDocumentStore((s) => s.headerFooter);
  const currentEditorComments = useDocumentStore((s) => s.comments);
  const currentEditorTrackChanges = useDocumentStore((s) => s.trackChanges);

  const [activeMenu, setActiveMenu] = useState('home');
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [search, setSearch] = useState('');
  const [saveAsName, setSaveAsName] = useState('');
  const [saveAsFormat, setSaveAsFormat] = useState('etherx');
  const [saveAsLocation, setSaveAsLocation] = useState('cloud');
  const [saveAsBusy, setSaveAsBusy] = useState(false);
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

  const returnTo = location.state?.returnTo || '/doc/new';
  const fileInputRef = useRef(null);

  // Refresh time display every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, 60000); // Update every 60 seconds
    return () => clearInterval(timer);
  }, []);

  const currentDocIdFromRoute = (() => {
    const p = location.state?.returnTo || '';
    const m = p.match(/^\/doc\/([^/]+)$/);
    return m?.[1] || null;
  })();

  useEffect(() => {
    let alive = true;
    async function loadDocs() {
      setLoading(true);
      try {
        const data = await documentApi.list();
        const list = Array.isArray(data) ? data : data.documents || data.items || [];
        const locals = readLocalDocs();
        if (!alive) return;
        // Filter out unsaved documents (Untitled Document with default empty content)
        const filtered = list.filter((d) => !(d.title === 'Untitled Document' && (d.content === '<p></p>' || d.content === '' || !d.content)));
        const normalized = [...locals, ...filtered.map((d, i) => ({
          id: String(d.id || d._id || i + 1),
          title: d.title || 'Untitled Document',
          updatedAt: d.updatedAt || d.updated || new Date().toISOString(),
          content: d.content || '',
          design: d.design,
          headerFooter: d.headerFooter,
          comments: Array.isArray(d.comments) ? d.comments : [],
          trackChanges: Boolean(d.trackChanges),
          localOnly: Boolean(d.localOnly),
        }))];
        setDocs(normalized);
        if (currentDocIdFromRoute && normalized.some((d) => d.id === currentDocIdFromRoute)) {
          setSelectedDocId(currentDocIdFromRoute);
        } else if (normalized[0]) {
          setSelectedDocId(normalized[0].id);
        }
      } catch {
        const fallback = readLocalDocs();
        if (!alive) return;
        setDocs(fallback);
        setSelectedDocId(fallback[0]?.id || null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadDocs();
    return () => { alive = false; };
  }, [currentDocIdFromRoute]);

  const selectedDoc = useMemo(() => docs.find((d) => d.id === selectedDocId) || null, [docs, selectedDocId]);
  const saveAsSourceDoc = useMemo(() => {
    if (selectedDoc) return selectedDoc;
    if (!currentEditorId && !currentEditorContent) return null;
    return {
      id: currentEditorId,
      title: currentEditorTitle || 'Untitled Document',
      content: currentEditorContent || '<p></p>',
      design: currentEditorDesign,
      headerFooter: currentEditorHeaderFooter,
      comments: currentEditorComments,
      trackChanges: currentEditorTrackChanges,
      localOnly: !currentEditorId,
    };
  }, [
    selectedDoc,
    currentEditorId,
    currentEditorTitle,
    currentEditorContent,
    currentEditorDesign,
    currentEditorHeaderFooter,
    currentEditorComments,
    currentEditorTrackChanges,
  ]);

  useEffect(() => {
    if (!selectedDoc) {
      setSaveAsName('');
      return;
    }
    setSaveAsName((current) => current || nextCopyName(selectedDoc.title));
  }, [selectedDoc]);

  const visibleDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? docs.filter((d) => d.title.toLowerCase().includes(q)) : docs;
    return filtered.slice(0, 4);
  }, [docs, search]);

  const syncDocRecord = (docId, patch) => {
    setDocs((prev) => prev.map((doc) => {
      if (String(doc.id) !== String(docId)) return doc;
      return {
        ...doc,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    }));
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
      setDocs((prev) => prev.map((doc) => String(doc.id) === String(selectedDoc.id) ? nextDoc : doc));
      if (nextPatch.title) setDocTitle(nextPatch.title);
      if (nextPatch.content) setDocContent(nextPatch.content);
      return nextDoc;
    }

    try {
      await documentApi.save(selectedDoc.id, nextPatch);
      syncDocRecord(selectedDoc.id, nextPatch);
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
      const created = await documentApi.create({ title: safeTitle, content });
      const newId = String(created?.id || created?._id || created?.document?.id || created?.document?._id || 'new');
      setSelectedDocId(newId);
      toast('AI draft created', 'success');
      navigate(`/doc/${newId}`);
      return true;
    } catch {
      const { doc } = createLocalDoc({ title: safeTitle, content });
      const next = upsertLocalDoc(doc);
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

    if (aiAction === 'content-generator') {
      if (!aiTopic.trim()) { toast('Enter a topic for the content generator', 'info'); return; }
      setAiRunning(true);
      try {
        const result = buildAiResult('content-generator', '', { 
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
        const result = buildAiResult('summarize', source);
        await createAiDocument(`Summary of ${cleanBaseName(selectedDoc?.title || 'Document')}`, result.html || '<p></p>');
        setAiAction(null);
        return;
      }
      if (aiAction === 'grammar') {
        const result = buildAiResult('grammar', source);
        const saved = await persistSelectedDocPatch({ content: result.html || '<p></p>' });
        if (saved) {
          toast('Grammar corrected. Opening document…', 'success');
          openDoc(selectedDoc);
          setAiAction(null);
        }
        return;
      }
      if (aiAction === 'rewrite') {
        const result = buildAiResult('rewrite', source, { mode: aiRewriteMode });
        const saved = await persistSelectedDocPatch({ content: result.html || '<p></p>' });
        if (saved) {
          toast(`Rewritten in "${aiRewriteMode}" style. Opening document…`, 'success');
          openDoc(selectedDoc);
          setAiAction(null);
        }
        return;
      }
      if (aiAction === 'title') {
        const fallback = aiFallbackTitle.trim() || selectedDoc?.title || 'Untitled Document';
        const result = buildAiResult('title', source, { fallbackTitle: fallback });
        const saved = await persistSelectedDocPatch({ title: result.title || fallback });
        if (saved) {
          toast(`Title updated to "${result.title || fallback}"`, 'success');
          setAiAction(null);
        }
        return;
      }
      if (aiAction === 'translate') {
        const result = buildAiResult('translate', selectedDoc.content, { language: aiLanguage });
        const saved = await persistSelectedDocPatch({ content: result.html || result.text });
        if (saved) {
          toast(`Document translated to ${aiLanguage}. Opening...`, 'success');
          openDoc(selectedDoc);
          setAiAction(null);
        }
      }
    } finally { setAiRunning(false); }
  };

  async function createFromTemplate(key) {
    if (key === 'blank') {
      try {
        // Create blank document on backend
        const created = await documentApi.create({
          title: 'Untitled Document',
          content: '<p></p>',
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
      // Try to use backend template API first
      const created = await documentApi.create({ 
        title, 
        content: templateContent(key)  // Use local template content as fallback data
      });
      const newId = String(created?.id || created?._id || created?.document?.id || created?.document?._id || 'new');
      setSelectedDocId(newId);
      toast(`${key} template created (save to add to recent list)`, 'success');
      navigate(`/doc/${newId}`);
    } catch {
      // Fallback: create locally if backend fails
      const content = templateContent(key);
      const { doc } = createLocalDoc({ title, content });
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

      setDocs((prev) => {
        const next = prev.filter((d) => d.id !== doc.id);
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
      navigate('/doc/new');
      return;
    }
    navigate(`/doc/${doc.id}`);
  }

  async function runMenuAction(key) {
    if (key === 'home' || key === 'ai' || key === 'open' || key === 'export' || key === 'share' || key === 'saveAs' || key === 'info' || key === 'statistics' || key === 'settings') {
      setActiveMenu(key);
      if (key !== 'ai') setAiAction(null);
      if (key === 'saveAs' && saveAsSourceDoc) {
        setSaveAsName(nextCopyName(saveAsSourceDoc.title));
        setSaveAsLocation('cloud');
      }
      return;
    }

    if (key === 'new') {
      await createFromTemplate('blank');
      setActiveMenu('home');
      return;
    }

    if (key === 'save') {
      if (!selectedDoc) return toast('Select a document first', 'info');
      if (selectedDoc.localOnly) {
        const localDoc = { ...selectedDoc, updatedAt: new Date().toISOString(), localOnly: true };
        const next = upsertLocalDoc(localDoc);
        setDocs(next);
        setSelectedDocId(localDoc.id);
        toast('Document saved locally', 'success');
        setActiveMenu('home');
        return;
      }
      try {
        await documentApi.save(selectedDoc.id, { title: selectedDoc.title, content: selectedDoc.content || '' });
        // Add to docs list after successful save
        setDocs((prev) => {
          const exists = prev.some((d) => d.id === selectedDoc.id);
          if (exists) {
            return prev.map((d) => d.id === selectedDoc.id ? { ...selectedDoc, updatedAt: new Date().toISOString() } : d);
          }
          return [{ ...selectedDoc, updatedAt: new Date().toISOString() }, ...prev];
        });
        toast('Document saved and added to recent list', 'success');
      } catch {
        const localDoc = { ...selectedDoc, id: `local-${Date.now()}`, updatedAt: new Date().toISOString(), localOnly: true };
        const next = upsertLocalDoc(localDoc);
        setDocs(next);
        setSelectedDocId(localDoc.id);
        toast('Cloud save failed, saved locally', 'warning');
      }
      setActiveMenu('home');
      return;
    }

    if (key === 'print') {
      if (!selectedDoc) return toast('Select a document first', 'info');
      const popup = window.open('', '_blank', 'width=980,height=760');
      if (!popup) return toast('Popup blocked for printing', 'warning');
      popup.document.write(`<html><head><title>${selectedDoc.title}</title></head><body><h1>${selectedDoc.title}</h1><div>${selectedDoc.content || '<p>No content available.</p>'}</div></body></html>`);
      popup.document.close();
      popup.focus();
      popup.print();
      setActiveMenu('home');
      return;
    }

    if (key === 'close') {
      navigate(returnTo);
    }
  }

  async function exportSelectedDoc() {
    if (!selectedDoc) return toast('Select a document first', 'info');
    const fmt = (window.prompt('Export format: html, pdf, docx', 'html') || 'html').toLowerCase();
    const exportLocally = async () => {
      if (fmt === 'docx') {
        await exportToDocx(selectedDoc.title, selectedDoc.content || '<p></p>');
        return;
      }

      if (fmt === 'pdf') {
        const frame = document.createElement('div');
        frame.style.position = 'fixed';
        frame.style.left = '-10000px';
        frame.style.top = '0';
        frame.style.width = '794px';
        frame.style.background = '#ffffff';
        frame.style.padding = '40px';
        frame.innerHTML = selectedDoc.content || '<p></p>';
        document.body.appendChild(frame);
        try {
          await exportToPdf(selectedDoc.title, frame);
        } finally {
          frame.remove();
        }
        return;
      }

      exportToHtml(selectedDoc.title, selectedDoc.content || '<p></p>');
    };

    try {
      const blob = selectedDoc.localOnly
        ? null
        : fmt === 'pdf'
          ? await exportApi.pdf(selectedDoc.id)
          : fmt === 'docx'
            ? await exportApi.docx(selectedDoc.id)
            : await exportApi.html(selectedDoc.id);

      if (!blob) {
        await exportLocally();
        toast(`Exported as ${fmt.toUpperCase()}`, 'success');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedDoc.title}.${fmt === 'pdf' || fmt === 'docx' ? fmt : 'html'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Export complete', 'success');
    } catch {
      try {
        await exportLocally();
        toast('Cloud export failed, exported locally', 'warning');
      } catch {
        const fallback = new Blob([selectedDoc.content || '<p></p>'], { type: 'text/html' });
        const url = URL.createObjectURL(fallback);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedDoc.title}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast('Cloud export failed, exported HTML locally', 'warning');
      }
    }
  }

  async function shareSelectedDoc() {
    if (!selectedDoc) return toast('Select a document first', 'info');
    try {
      const targetDoc = await ensureCloudDocForShare(selectedDoc);
      const response = await documentApi.share(targetDoc.id, { role: 'viewer' });
      const link = response?.shareUrl || buildSharedUrl(targetDoc.id);
      await navigator.clipboard.writeText(link);
      toast('Share link copied', 'success');
    } catch {
      if (selectedDoc.localOnly) {
        toast('Unable to create a cloud share link right now', 'error');
        return;
      }
      window.prompt('Copy share link', buildSharedUrl(selectedDoc.id));
    }
  }

  async function createCloudCopyFrom(doc, titleOverride) {
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
      setDocs((prev) => [newDoc, ...prev.filter((d) => d.id !== newId)]);
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

  async function performSaveAs() {
    const sourceDoc = saveAsSourceDoc;
    if (!sourceDoc) {
      toast('Open or select a document first', 'info');
      return;
    }

    const finalName = cleanBaseName(saveAsName || nextCopyName(sourceDoc.title));
    if (!finalName) {
      toast('Enter a file name', 'warning');
      return;
    }

    if (saveAsLocation === 'recent') {
      toast('Choose EtherX Cloud, This PC, or Browse Folder to save', 'info');
      return;
    }

    setSaveAsBusy(true);
    try {
      if (saveAsLocation === 'share' || saveAsLocation === 'copyLink') {
        const targetDoc = await ensureCloudDocForShare(sourceDoc);
        const response = await documentApi.share(targetDoc.id, { role: 'viewer' });
        const link = response?.shareUrl || buildSharedUrl(targetDoc.id);
        const copied = await copyTextToClipboard(link);
        if (copied) {
          toast(saveAsLocation === 'share' ? 'Share link copied' : 'Document share link copied', 'success');
        } else {
          window.prompt('Copy share link', link);
          toast('Share link ready to copy', 'info');
        }
        setActiveMenu('home');
        return;
      }

      const wantsLocalFile = saveAsLocation === 'thisPc' || saveAsLocation === 'browse';
      const content = sourceDoc.content || '<p></p>';

      if (wantsLocalFile || (saveAsLocation === 'cloud' && saveAsFormat !== 'etherx')) {
        const pickerResult = await saveWithFilePicker(finalName, saveAsFormat, content);
        if (pickerResult === null) {
          toast('Save As cancelled', 'info');
          return;
        }

        if (pickerResult !== true) {
          if (saveAsFormat === 'docx') {
            await exportToDocx(finalName, content);
          } else if (saveAsFormat === 'html') {
            exportToHtml(finalName, content);
          } else {
            downloadEtherxFile(finalName, content);
          }
        }

        const destination = wantsLocalFile
          ? (saveAsLocation === 'browse' ? 'the selected folder' : 'your computer')
          : 'your computer because Word/Web formats are file exports';
        toast(`Saved to ${destination}`, 'success');
        setActiveMenu('home');
        return;
      }

      const createdDoc = await createCloudCopyFrom(sourceDoc, finalName);
      toast('Saved as a new cloud document', 'success');
      navigate(`/doc/${createdDoc.id}`);
    } catch (error) {
      const message = error?.message || 'Save failed';
      if (saveAsLocation === 'share' || saveAsLocation === 'copyLink') {
        toast(`Unable to create a share link: ${message}`, 'error');
      } else if (saveAsLocation === 'thisPc' || saveAsLocation === 'browse' || saveAsFormat !== 'etherx') {
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
    
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    let content = '';
    
    try {
      // Handle .docx files
      if (file.name.toLowerCase().endsWith('.docx')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          let html = result.value || '';
          
          // Clean up the HTML to remove any corrupted elements
          html = html.replace(/<[^>]*>/g, (tag) => {
            // Keep only safe formatting tags
            if (/^<\/?(?:p|div|span|strong|em|u|h[1-6]|ul|ol|li|br|blockquote)(?:\s|>|$)/i.test(tag)) {
              return tag;
            }
            return '';
          });
          
          // Convert Word page breaks to visible Tiptap page break format
          // Replace double line breaks with page breaks
          html = html.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<div data-page-break="true" style="height:36px;display:block;margin:24px 0;background:linear-gradient(to bottom,rgba(100,100,100,0.15) 0%,rgba(150,150,150,0.25) 50%,rgba(100,100,100,0.15) 100%);border-top:1px solid rgba(200,200,200,0.4);border-bottom:1px solid rgba(200,200,200,0.4);box-shadow:inset 0 1px 2px rgba(0,0,0,0.1),inset 0 -1px 2px rgba(0,0,0,0.1);"></div>');
          
          // Split paragraphs and insert page breaks for long documents
          const paragraphs = html.split(/<\/p>/i);
          if (paragraphs.length > 12) {
            let newHtml = '';
            let paraCount = 0;
            
            for (let i = 0; i < paragraphs.length; i++) {
              newHtml += paragraphs[i];
              if (i < paragraphs.length - 1) newHtml += '</p>';
              paraCount++;
              
              // Insert visible page break every 12 paragraphs
              if (paraCount >= 12 && i < paragraphs.length - 1) {
                newHtml += '<div data-page-break="true" style="height:36px;display:block;margin:24px 0;background:linear-gradient(to bottom,rgba(100,100,100,0.15) 0%,rgba(150,150,150,0.25) 50%,rgba(100,100,100,0.15) 100%);border-top:1px solid rgba(200,200,200,0.4);border-bottom:1px solid rgba(200,200,200,0.4);box-shadow:inset 0 1px 2px rgba(0,0,0,0.1),inset 0 -1px 2px rgba(0,0,0,0.1);"></div>';
                paraCount = 0;
              }
            }
            html = newHtml;
          }
          
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

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={styles.page}>
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUploadOpen} />

      <aside style={styles.sidebar} aria-label="File menu" tabIndex={0}>
        <img src="/assets/etherxwordlogo.png" alt="EtherX Word Logo" style={{ ...styles.fileMenuTitle, maxHeight: '100%', objectFit: 'contain' }} />

        <div style={styles.menuList}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.key}
              style={selectedStyle(activeMenu === item.key, item.danger)}
              onClick={() => runMenuAction(item.key)}
              title={item.label}
            >
              <span style={styles.menuIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div style={styles.sidebarFooter}>
          <div style={styles.docPill}>
            <div style={styles.docPillTitle}>{selectedDoc?.title || 'Untitled Document'}</div>
            <div style={styles.docPillMeta}>{stats.words} words • {stats.pages} page</div>
          </div>
          <div style={styles.darkModeStatus} aria-label="Appearance mode">
            <span style={styles.darkModeIndicator} aria-hidden="true" />
            Dark mode
          </div>
          <button style={styles.backEditorBtn} onClick={() => navigate(returnTo)}>← Back to Editor</button>
        </div>
      </aside>

      <main style={styles.main}>
        <button style={styles.topBar} onClick={() => navigate(returnTo)}>← Editor</button>

        <section style={styles.hero}>
          <h1 style={styles.heroTitle}>Start Here</h1>
          <p style={styles.heroSub}>Create a new document or access your recent files</p>
        </section>

        {activeMenu === 'home' && (
          <section style={styles.gridArea}>
            <div>
              <div style={styles.sectionLabel}>RECENT DOCUMENTS</div>
              {loading ? (
                <div style={styles.empty}>Loading...</div>
              ) : (
                <div style={styles.recentsWrap}>
                  {visibleDocs.map((doc) => (
                    <div key={doc.id} style={styles.recentCard}>
                      <button style={styles.recentOpenBtn} onClick={() => openDoc(doc)}>
                        <span style={styles.recentIcon}>▣</span>
                        <span style={styles.recentTextWrap}>
                          <span style={styles.recentTitle}>{doc.title}</span>
                          <span style={styles.recentMeta}>{formatActualTime(doc.updatedAt)} • {estimatePagesFromHtml(doc.content)} pages</span>
                        </span>
                      </button>
                      <button
                        style={styles.recentDeleteBtn}
                        onClick={() => deleteDoc(doc)}
                        title="Delete document"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button style={styles.viewAllBtn} onClick={() => runMenuAction('open')}>View All Recent →</button>
                </div>
              )}
            </div>

            <div>
              <div style={styles.sectionLabel}>TEMPLATE CATEGORIES</div>
              <div style={styles.templateGrid}>
                {START_TEMPLATES.map((tpl) => (
                  <button key={tpl.key} style={styles.templateBtn} onClick={() => createFromTemplate(tpl.key)}>
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeMenu === 'ai' && (
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>AI Assist</h2>
            <p style={styles.panelSubtitle}>Apply AI-assisted actions to the selected document or create a new draft.</p>
            <div style={styles.aiGrid}>
              {[
                { key: 'content-generator', icon: '✦', label: 'Content Generator', desc: 'Start a new AI draft from a topic' },
                { key: 'summarize', icon: '▤', label: 'Text Summarizer', desc: 'Create a summary document' },
                { key: 'grammar', icon: '✓', label: 'Grammar Correction', desc: 'Fix grammar in the selected document' },
                { key: 'rewrite', icon: '↻', label: 'Rewrite Assistant', desc: 'Rewrite the selected document' },
                { key: 'title', icon: '🏷', label: 'Title Generator', desc: 'Generate a better document title' },
                { key: 'translate', icon: '🌐', label: 'Translation', desc: 'Open a translation view for the document' },
              ].map(({ key, icon, label, desc }) => (
                <button
                  key={key}
                  style={{ ...styles.aiBtn, ...(aiAction === key ? styles.aiBtnActive : null) }}
                  onClick={() => setAiAction(aiAction === key ? null : key)}
                  disabled={aiRunning}
                >
                  <span style={styles.aiBtnIcon}>{icon}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <strong>{label}</strong>
                    <small>{desc}</small>
                  </span>
                </button>
              ))}
            </div>

            {aiAction && (
              <div style={styles.aiFormArea}>
                <div style={styles.aiFormTitle}>
                  {aiAction === 'content-generator' && 'Generate Content'}
                  {aiAction === 'summarize' && 'Summarize Document'}
                  {aiAction === 'grammar' && 'Correct Grammar'}
                  {aiAction === 'rewrite' && 'Rewrite Document'}
                  {aiAction === 'title' && 'Generate Title'}
                  {aiAction === 'translate' && 'Translate Document'}
                </div>

                {aiAction === 'content-generator' && (
                  <>
                    <div style={styles.aiFormGroup}>
                      <label style={styles.aiFormLabel}>Topic *</label>
                      <input
                        style={styles.aiFormInput}
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        placeholder="e.g. Project Update, Market Analysis"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleRunAiAction()}
                      />
                    </div>
                    <div style={styles.aiFormGroup}>
                      <label style={styles.aiFormLabel}>Tone</label>
                      <select
                        style={styles.aiFormSelect}
                        value={aiTone}
                        onChange={(e) => setAiTone(e.target.value)}
                      >
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="formal">Formal</option>
                        <option value="friendly">Friendly</option>
                      </select>
                    </div>
                    <div style={styles.aiFormGroup}>
                      <label style={styles.aiFormLabel}>Page count (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        style={styles.aiFormInput}
                        value={aiPageCount}
                        onChange={(e) => setAiPageCount(parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                  </>
                )}

                {aiAction === 'rewrite' && (
                  <div style={styles.aiFormGroup}>
                    <label style={styles.aiFormLabel}>Rewrite style</label>
                    <select
                      style={styles.aiFormSelect}
                      value={aiRewriteMode}
                      onChange={(e) => setAiRewriteMode(e.target.value)}
                    >
                      <option value="clear">Clear</option>
                      <option value="formal">Formal</option>
                      <option value="short">Short</option>
                    </select>
                  </div>
                )}

                {aiAction === 'title' && (
                  <div style={styles.aiFormGroup}>
                    <label style={styles.aiFormLabel}>Fallback title (used if content is too short)</label>
                    <input
                      style={styles.aiFormInput}
                      value={aiFallbackTitle}
                      onChange={(e) => setAiFallbackTitle(e.target.value)}
                      placeholder={selectedDoc?.title || 'Untitled Document'}
                      onKeyDown={(e) => e.key === 'Enter' && handleRunAiAction()}
                    />
                  </div>
                )}

                {aiAction === 'translate' && (
                  <div style={styles.aiFormGroup}>
                    <label style={styles.aiFormLabel}>Target language</label>
                    <select
                      style={styles.aiFormSelect}
                      value={aiLanguage}
                      onChange={(e) => setAiLanguage(e.target.value)}
                    >
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="German">German</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Italian">Italian</option>
                      <option value="Portuguese">Portuguese</option>
                      <option value="Russian">Russian</option>
                      <option value="Arabic">Arabic</option>
                    </select>
                  </div>
                )}

                {['summarize', 'grammar', 'rewrite', 'title', 'translate'].includes(aiAction) && (
                  <p style={styles.aiFormHint}>
                    Selected document: <strong>{selectedDoc?.title || 'None — select a document first'}</strong>
                  </p>
                )}

                <div style={styles.aiFormActions}>
                  <button
                    style={{ ...styles.aiBtnRun, ...(aiRunning ? { opacity: 0.6, cursor: 'not-allowed' } : null) }}
                    onClick={handleRunAiAction}
                    disabled={aiRunning}
                  >
                    {aiRunning ? 'Running…' : 'Run'}
                  </button>
                  <button
                    style={styles.aiBtnCancel}
                    onClick={() => setAiAction(null)}
                    disabled={aiRunning}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {activeMenu === 'info' && (
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>Document Info</h2>
            <div style={styles.panelRow}>Name: {selectedDoc?.title || '-'}</div>
            <div style={styles.panelRow}>Last modified: {selectedDoc ? formatActualTime(selectedDoc.updatedAt) : '-'}</div>
            <div style={styles.panelRow}>Pages: {stats.pages}</div>
          </section>
        )}

        {activeMenu === 'statistics' && (
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>Statistics</h2>
            <div style={styles.panelRow}>Words: {stats.words}</div>
            <div style={styles.panelRow}>Characters: {stats.chars}</div>
            <div style={styles.panelRow}>Pages: {stats.pages}</div>
          </section>
        )}

        {activeMenu === 'settings' && (
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>Settings</h2>
            <div style={styles.panelRow}>Appearance mode</div>
            <div style={styles.darkModeStatus} aria-label="Appearance mode">
              <span style={styles.darkModeIndicator} aria-hidden="true" />
              Dark mode is always enabled
            </div>
          </section>
        )}

        {activeMenu === 'saveAs' && (
          <section style={styles.saveAsShell}>
            <div style={styles.saveAsContainer}>
              <div style={styles.saveAsHeader}>
                <h2 style={styles.saveAsTitle}>Save As</h2>
                <p style={styles.saveAsSubtitle}>Choose where to save your document and select the format</p>
              </div>

              <div style={styles.saveAsMainContent}>
                {/* Quick Access Sidebar */}
                <aside style={styles.saveAsQuickAccess}>
                  <div style={styles.saveAsQuickAccessTitle}>QUICK ACCESS</div>
                  {SAVE_AS_LOCATIONS.filter((item) => item.area === 'leftTop').map((item) => (
                    <button
                      key={item.key}
                      style={{
                        ...styles.saveAsQuickItem,
                        ...(saveAsLocation === item.key ? styles.saveAsQuickItemActive : null),
                      }}
                      onClick={() => setSaveAsLocation(item.key)}
                    >
                      <span style={styles.saveAsQuickIcon}>{getSaveAsIcon(item.key)}</span>
                      <span style={styles.saveAsQuickLabel}>{item.label}</span>
                    </button>
                  ))}

                  <div style={{ ...styles.saveAsQuickAccessTitle, marginTop: 16 }}>LOCATIONS</div>
                  {SAVE_AS_LOCATIONS.filter((item) => item.area === 'personal' || item.area === 'other').map((item) => (
                    <button
                      key={item.key}
                      style={{
                        ...styles.saveAsQuickItem,
                        ...(saveAsLocation === item.key ? styles.saveAsQuickItemActive : null),
                      }}
                      onClick={() => setSaveAsLocation(item.key)}
                    >
                      <span style={styles.saveAsQuickIcon}>{getSaveAsIcon(item.key)}</span>
                      <span style={styles.saveAsQuickLabel}>{item.label}</span>
                    </button>
                  ))}

                  <div style={{ ...styles.saveAsQuickAccessTitle, marginTop: 16 }}>SHARING</div>
                  {SAVE_AS_LOCATIONS.filter((item) => item.area === 'share').map((item) => (
                    <button
                      key={item.key}
                      style={{
                        ...styles.saveAsQuickItem,
                        ...(saveAsLocation === item.key ? styles.saveAsQuickItemActive : null),
                      }}
                      onClick={() => setSaveAsLocation(item.key)}
                    >
                      <span style={styles.saveAsQuickIcon}>{getSaveAsIcon(item.key)}</span>
                      <span style={styles.saveAsQuickLabel}>{item.label}</span>
                    </button>
                  ))}
                </aside>

                {/* Main Content Area */}
                <div style={styles.saveAsFormArea}>
                  {/* Current Location Card */}
                  <div style={{
                    ...styles.saveAsLocationCard,
                    ...(saveAsLocation === 'cloud' ? { border: '2px solid #d4af37', borderRadius: 10 } : null),
                  }}>
                    <div style={styles.saveAsLocationIcon}>{getSaveAsLargeIcon(saveAsLocation)}</div>
                    <div>
                      <div style={styles.saveAsLocationName}>
                        {SAVE_AS_LOCATIONS.find((l) => l.key === saveAsLocation)?.label || 'Select a location'}
                      </div>
                      <div style={styles.saveAsLocationPath}>
                        {saveAsLocation === 'thisPc' && 'Download to your computer'}
                        {saveAsLocation === 'cloud' && 'Secure cloud storage - accessible from anywhere'}
                        {saveAsLocation === 'browse' && 'Choose a specific folder on your computer'}
                        {saveAsLocation === 'share' && 'Create shareable collaboration link'}
                        {saveAsLocation === 'copyLink' && 'Generate a link to share this document'}
                        {saveAsLocation === 'recent' && 'Recently used locations'}
                      </div>
                    </div>
                  </div>

                  {saveAsLocation === 'recent' && (
                    <div style={styles.saveAsRecentPanel}>
                      <div style={styles.saveAsRecentTitle}>Recent documents</div>
                      {docs.length > 0 ? docs.slice(0, 8).map((doc) => (
                        <button
                          type="button"
                          key={doc.id}
                          style={styles.saveAsRecentItem}
                          onClick={() => {
                            setSelectedDocId(doc.id);
                            setSaveAsName(nextCopyName(doc.title));
                            setSaveAsLocation('cloud');
                          }}
                        >
                          <span style={styles.saveAsRecentItemMain}>
                            <span style={styles.saveAsRecentItemTitle}>{doc.title}</span>
                            <span style={styles.saveAsRecentItemMeta}>{formatActualTime(doc.updatedAt)}</span>
                          </span>
                          <span style={styles.saveAsRecentItemAction}>Use</span>
                        </button>
                      )) : (
                        <div style={styles.saveAsRecentEmpty}>No recent documents found.</div>
                      )}
                    </div>
                  )}

                  {/* Info Banner */}
                  {saveAsLocation === 'cloud' && (
                    <div style={styles.saveAsInfoBanner}>
                      <span style={styles.saveAsInfoIcon}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg></span>
                      <div>
                        <div style={styles.saveAsInfoTitle}>EtherX Cloud Storage</div>
                        <div style={styles.saveAsInfoText}>Your document will be saved to your EtherX cloud account and can be accessed from any device. This is separate from Microsoft OneDrive.</div>
                      </div>
                    </div>
                  )}

                  {/* Form Fields */}
                  <div style={styles.saveAsFormSection}>
                    <div style={styles.saveAsFormGroup}>
                      <label style={styles.saveAsLabel}>File name</label>
                      <input
                        value={saveAsName}
                        onChange={(e) => setSaveAsName(e.target.value)}
                        placeholder="Enter file name"
                        style={styles.saveAsInputLarge}
                        onKeyPress={(e) => e.key === 'Enter' && performSaveAs()}
                      />
                      <div style={styles.saveAsInputHint}>
                        Keep your filename descriptive and relevant
                      </div>
                    </div>

                    <div style={styles.saveAsFormGroup}>
                      <label style={styles.saveAsLabel}>Save as type</label>
                      <select
                        value={saveAsFormat}
                        onChange={(e) => setSaveAsFormat(e.target.value)}
                        style={styles.saveAsSelectLarge}
                      >
                        {SAVE_AS_FORMATS.map((fmt) => (
                          <option key={fmt.key} value={fmt.key}>{fmt.label}</option>
                        ))}
                      </select>
                      <div style={styles.saveAsInputHint}>
                        {saveAsFormat === 'etherx' && 'Native EtherX format - recommended for editing'}
                        {saveAsFormat === 'docx' && 'Microsoft Word format - compatible with Word'}
                        {saveAsFormat === 'html' && 'Web format - for viewing in browsers'}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={styles.saveAsActionBar}>
                    <button
                      style={{
                        ...styles.saveAsCancelBtn,
                        ...(saveAsBusy ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                      }}
                      onClick={() => setActiveMenu('home')}
                      disabled={saveAsBusy}
                    >
                      Cancel
                    </button>
                    <button
                      style={{
                        ...styles.saveAsSubmitBtn,
                        ...(saveAsBusy ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
                      }}
                      onClick={performSaveAs}
                      disabled={saveAsBusy}
                    >
                      {saveAsBusy ? <><LoadingIcon />Saving…</> : <><SaveIcon />Save As</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {(activeMenu === 'open' || activeMenu === 'share' || activeMenu === 'export') && (
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>{activeMenu[0].toUpperCase() + activeMenu.slice(1)}</h2>
            {activeMenu === 'open' && (
              <button style={styles.primaryActionBtn} onClick={() => fileInputRef.current?.click()}>
                Browse from device
              </button>
            )}
            {activeMenu === 'share' && (
              <button style={styles.primaryActionBtn} onClick={shareSelectedDoc}>
                Copy share link for selected document
              </button>
            )}
            {activeMenu === 'export' && (
              <button style={styles.primaryActionBtn} onClick={exportSelectedDoc}>
                Export selected document
              </button>
            )}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents"
              style={styles.search}
            />
            <div style={styles.panelList}>
              {docs.filter((d) => d.title.toLowerCase().includes(search.toLowerCase())).slice(0, 8).map((doc) => (
                <div key={doc.id} style={styles.panelItem}>
                  <button style={styles.panelItemMain} onClick={() => openDoc(doc)}>
                    <span>{doc.title}</span>
                    <span style={styles.panelItemMeta}>{formatActualTime(doc.updatedAt)}</span>
                  </button>
                  <button
                    style={styles.panelDeleteBtn}
                    onClick={() => deleteDoc(doc)}
                    title="Delete document"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <div style={styles.panelActions}>
              <button style={styles.secondaryActionBtn} onClick={() => selectedDoc && openDoc(selectedDoc)}>
                Open selected
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
    </>
  );
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
  fileMenuTitle: {
    height: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    letterSpacing: '.12em',
    fontSize: 12,
    fontWeight: 700,
  },
  menuList: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '10px 8px',
  },
  menuBtn: {
    border: '1px solid transparent',
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
    textAlign: 'center',
    fontSize: 17,
    opacity: 0.92,
  },
  sidebarFooter: {
    flexShrink: 0,
    marginTop: 'auto',
    borderTop: '1px solid var(--border)',
    padding: '10px 8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  docPill: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 10px',
    background: 'var(--bg-elevated)',
  },
  docPillTitle: {
    fontSize: 13,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  docPillMeta: {
    marginTop: 4,
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  backEditorBtn: {
    border: '1px solid var(--border-gold)',
    borderRadius: 8,
    background: 'var(--bg-elevated)',
    color: 'var(--text-gold)',
    padding: '8px 10px',
    cursor: 'pointer',
    fontSize: 16,
    textAlign: 'left',
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
  topBar: {
    height: 70,
    borderBottom: '1px solid var(--border-strong)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    color: 'var(--text-muted)',
    fontSize: 13,
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  hero: {
    padding: '46px 54px 10px',
  },
  heroTitle: {
    margin: 0,
    fontSize: 44,
    letterSpacing: '.03em',
    color: 'var(--text-heading)',
  },
  heroSub: {
    marginTop: 8,
    marginBottom: 0,
    color: 'var(--text-muted)',
    fontSize: 17,
  },
  gridArea: {
    padding: '20px 54px 40px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 44,
    minWidth: 860,
  },
  sectionLabel: {
    fontSize: 13,
    color: 'var(--text-muted)',
    letterSpacing: '.12em',
    fontWeight: 700,
    marginBottom: 14,
  },
  recentsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  recentCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 10,
    padding: '8px 10px 8px 14px',
    textAlign: 'left',
    color: 'var(--text-primary)',
  },
  recentOpenBtn: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    padding: '6px 2px',
  },
  recentDeleteBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-muted)',
    borderRadius: 6,
    cursor: 'pointer',
    width: 28,
    height: 28,
    flex: '0 0 auto',
  },
  recentIcon: {
    fontSize: 14,
    color: 'var(--text-secondary)',
  },
  recentTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  recentMeta: {
    marginTop: 4,
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  viewAllBtn: {
    border: '1px solid var(--border-gold)',
    borderRadius: 3,
    background: 'transparent',
    color: 'var(--text-gold)',
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  templateBtn: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    minHeight: 58,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
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
    border: '1px solid transparent',
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
    border: '1px solid transparent',
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
};
