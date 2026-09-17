// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Backend Subscription Tiers Configuration
// ═══════════════════════════════════════════════════════════════

const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Essential writing tools for personal documents',
    badge: null,
    price: {
      monthly: 0,
      yearly: 0,
      annual: 0,
      currency: 'INR',
      currencySymbol: '₹',
    },
    limits: {
      maxDocuments: 5,
      storageBytes: 500 * 1024 * 1024, // 500 MB
      storageDisplay: '500 MB',
      collaboratorsPerDoc: 0, // Single-user editing only
      versionHistoryHours: 48,
      versionHistoryDisplay: '48 hours',
      templatesCount: 4,
    },
    features: {
      exportFormats: ['pdf', 'docx'],
      realTimeCollaboration: false,
      collaboratorsCount: 0,
      comments: false,
      trackChanges: false,
      mentions: false,
      aiWritingTools: false,
      customTemplates: false,
      brandKits: false,
      autoTableOfContents: false,
      integrations: false,
      prioritySupport: false,
      offlineAutoSync: false,
    },
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    tagline: 'For individuals & small teams creating with confidence',
    badge: 'Popular',
    price: {
      monthly: 149,
      yearly: 1299,
      annual: 1299,
      currency: 'INR',
      currencySymbol: '₹',
      yearlyDiscountPercent: 27,
    },
    limits: {
      maxDocuments: Infinity,
      storageBytes: 15 * 1024 * 1024 * 1024, // 15 GB
      storageDisplay: '15 GB',
      collaboratorsPerDoc: 3,
      versionHistoryHours: 60 * 24, // 60 days
      versionHistoryDisplay: '60 days',
      templatesCount: 20,
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
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Ultimate power, unlimited collaboration & intelligent AI writing',
    badge: 'Best Value',
    price: {
      monthly: 399,
      yearly: 3999,
      annual: 3999,
      currency: 'INR',
      currencySymbol: '₹',
      yearlyDiscountPercent: 16,
    },
    limits: {
      maxDocuments: Infinity,
      storageBytes: Infinity,
      storageDisplay: 'Unlimited',
      collaboratorsPerDoc: Infinity,
      versionHistoryHours: Infinity,
      versionHistoryDisplay: 'Full history & audit trail',
      templatesCount: Infinity,
    },
    features: {
      exportFormats: ['docx', 'pdf', 'odt', 'markdown', 'html', 'epub'],
      realTimeCollaboration: true,
      collaboratorsCount: Infinity,
      comments: true,
      trackChanges: true,
      mentions: true,
      aiWritingTools: true,
      customTemplates: true,
      brandKits: true,
      autoTableOfContents: true,
      integrations: true,
      prioritySupport: true,
      offlineAutoSync: true,
    },
  },
};

const TIER_ORDER = ['free', 'basic', 'pro'];

function getTier(tierId = 'free') {
  const normalized = String(tierId || '').toLowerCase().trim();
  return SUBSCRIPTION_TIERS[normalized] || SUBSCRIPTION_TIERS.free;
}

module.exports = {
  SUBSCRIPTION_TIERS,
  TIER_ORDER,
  getTier,
};
