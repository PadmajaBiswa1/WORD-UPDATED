// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Subscription Tiers Single Source of Truth
// ═══════════════════════════════════════════════════════════════

export const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Essential writing tools for personal documents',
    badge: null,
    color: '#9e9e9e',
    accent: '#888888',
    price: {
      monthly: 0,
      yearly: 0,
      annual: 0,
      currency: 'INR',
      currencySymbol: '₹',
      displayMonthly: '₹0',
      displayYearly: '₹0',
      yearlyDiscountPercent: 0,
    },
    limits: {
      maxDocuments: 5,
      storageBytes: 500 * 1024 * 1024, // 500 MB
      storageDisplay: '500 MB',
      collaboratorsPerDoc: 0, // Single-user editing only
      versionHistoryHours: 48,
      versionHistoryDisplay: '48 hours',
      templatesCount: 4,
      templatesDisplay: '3–5 basic templates',
    },
    features: {
      exportFormats: ['pdf', 'docx'],
      realTimeCollaboration: false,
      collaboratorsCount: 0,
      comments: false,
      trackChanges: false,
      mentions: false,
      aiWritingTools: false, // grammar check, rewriting, summarization, etc.
      customTemplates: false,
      brandKits: false,
      autoTableOfContents: false,
      integrations: false,
      prioritySupport: false,
      offlineAutoSync: false,
    },
    featureHighlights: [
      { text: 'Up to 5 documents', included: true },
      { text: '500 MB cloud storage', included: true },
      { text: 'Export to PDF & DOCX', included: true },
      { text: 'Single-user editing', included: true },
      { text: '48-hour version history', included: true },
      { text: 'Basic templates library', included: true },
      { text: 'Real-time collaboration', included: false },
      { text: 'Markdown & ODT export', included: false },
      { text: 'Pragna AI writing assistant', included: false },
      { text: 'Unlimited documents & storage', included: false },
    ],
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    tagline: 'For individuals & small teams creating with confidence',
    badge: 'Popular',
    color: '#4fc3f7',
    accent: '#0288d1',
    price: {
      monthly: 149,
      yearly: 1299,
      annual: 1299,
      currency: 'INR',
      currencySymbol: '₹',
      displayMonthly: '₹149',
      displayYearly: '₹1,299',
      yearlyDiscountPercent: 27, // (149 * 12 - 1299) / (149 * 12) ≈ 27.4%
    },
    limits: {
      maxDocuments: Infinity,
      storageBytes: 15 * 1024 * 1024 * 1024, // 15 GB
      storageDisplay: '15 GB',
      collaboratorsPerDoc: 3, // up to 3 collaborators per doc
      versionHistoryHours: 60 * 24, // 60 days
      versionHistoryDisplay: '60 days',
      templatesCount: 20,
      templatesDisplay: 'Expanded template library',
    },
    features: {
      exportFormats: ['docx', 'pdf', 'odt', 'markdown'],
      realTimeCollaboration: true,
      collaboratorsCount: 3,
      comments: true,
      trackChanges: false,
      mentions: false,
      aiWritingTools: false,
      customTemplates: false,
      brandKits: false,
      autoTableOfContents: false,
      integrations: false,
      prioritySupport: false,
      offlineAutoSync: true,
    },
    featureHighlights: [
      { text: 'Unlimited documents', included: true },
      { text: '15 GB cloud storage', included: true },
      { text: 'Export to DOCX, PDF, ODT & Markdown', included: true },
      { text: 'Real-time collaboration (up to 3 per doc)', included: true },
      { text: '60-day version history', included: true },
      { text: 'Expanded template library', included: true },
      { text: 'Basic offline mode with autosync', included: true },
      { text: 'Document comments', included: true },
      { text: 'Pragna AI writing assistant', included: false },
      { text: 'Track changes & audit trail', included: false },
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Ultimate power, unlimited collaboration & intelligent AI writing',
    badge: 'Best Value',
    color: '#d4af37',
    accent: '#c9a84c',
    price: {
      monthly: 399,
      yearly: 3999,
      annual: 3999,
      currency: 'INR',
      currencySymbol: '₹',
      displayMonthly: '₹399',
      displayYearly: '₹3,999',
      yearlyDiscountPercent: 16, // (399 * 12 - 3999) / (399 * 12) ≈ 16.5%
    },
    limits: {
      maxDocuments: Infinity,
      storageBytes: Infinity,
      storageDisplay: 'Unlimited',
      collaboratorsPerDoc: Infinity, // Unlimited
      versionHistoryHours: Infinity,
      versionHistoryDisplay: 'Full history & audit trail',
      templatesCount: Infinity,
      templatesDisplay: 'All + Custom templates & brand kits',
    },
    features: {
      exportFormats: ['docx', 'pdf', 'odt', 'markdown', 'html', 'epub'],
      realTimeCollaboration: true,
      collaboratorsCount: Infinity,
      comments: true,
      trackChanges: true,
      mentions: true,
      aiWritingTools: true, // Grammar check, rewriting, summarization, etc.
      customTemplates: true,
      brandKits: true,
      autoTableOfContents: true,
      integrations: true, // Google Drive, Slack, API access
      prioritySupport: true,
      offlineAutoSync: true,
    },
    featureHighlights: [
      { text: 'Unlimited documents & storage', included: true },
      { text: 'All export formats (DOCX, PDF, ODT, MD, HTML, EPUB)', included: true },
      { text: 'Unlimited real-time collaboration', included: true },
      { text: 'Comments, Track changes & @mentions', included: true },
      { text: 'Full version history with restore + audit trail', included: true },
      { text: 'Pragna AI writing tools (Grammar, Rewrite, Summarize)', included: true },
      { text: 'Custom templates & brand kits', included: true },
      { text: 'Auto-generated table of contents', included: true },
      { text: 'Google Drive, Slack & API integrations', included: true },
      { text: '24/7 Priority support', included: true },
    ],
  },
};

export const TIER_ORDER = ['free', 'basic', 'pro'];

export function getTier(tierId = 'free') {
  const normalized = String(tierId || '').toLowerCase().trim();
  return SUBSCRIPTION_TIERS[normalized] || SUBSCRIPTION_TIERS.free;
}

export function isTierHigher(currentTier = 'free', targetTier = 'pro') {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  const targetIndex = TIER_ORDER.indexOf(targetTier);
  return targetIndex > currentIndex;
}
