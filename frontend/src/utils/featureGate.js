// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Client Feature Gating Engine
// ═══════════════════════════════════════════════════════════════
import { SUBSCRIPTION_TIERS, getTier, TIER_ORDER } from '@/config/subscriptionTiers';

export function resolveTierId(userOrTier) {
  if (!userOrTier) return 'free';
  if (typeof userOrTier === 'string') return userOrTier.toLowerCase().trim();
  if (typeof userOrTier === 'object') {
    const plan = userOrTier.plan || userOrTier.tier || userOrTier.subscriptionPlan || 'free';
    return String(plan).toLowerCase().trim();
  }
  return 'free';
}

export function getUserTierConfig(userOrTier) {
  const tierId = resolveTierId(userOrTier);
  return getTier(tierId);
}

/**
 * Checks if a specific export format is permitted on the user's tier.
 */
export function canExportFormat(userOrTier, format = '') {
  const tier = getUserTierConfig(userOrTier);
  const normalized = String(format || '').toLowerCase().replace(/^\./, '').trim();
  // Map common synonyms
  const map = { md: 'markdown', doc: 'docx', word: 'docx' };
  const target = map[normalized] || normalized;
  return Boolean(tier.features?.exportFormats?.includes(target));
}

/**
 * Checks if adding another collaborator is permitted on the user's tier.
 */
export function canAddCollaborator(userOrTier, currentCollaboratorsCount = 0) {
  const tier = getUserTierConfig(userOrTier);
  if (!tier.features.realTimeCollaboration) return false;
  const limit = tier.limits.collaboratorsPerDoc;
  if (!Number.isFinite(limit)) return true;
  return currentCollaboratorsCount < limit;
}

/**
 * Checks if AI writing tools (Pragna Copilot) are accessible.
 */
export function canAccessAi(userOrTier) {
  const tier = getUserTierConfig(userOrTier);
  return Boolean(tier.features.aiWritingTools);
}

/**
 * Checks if creating a new document is permitted.
 */
export function canCreateDocument(userOrTier, currentDocCount = 0, currentStorageBytes = 0) {
  const tier = getUserTierConfig(userOrTier);
  const maxDocs = tier.limits.maxDocuments;
  const maxStorage = tier.limits.storageBytes;

  if (Number.isFinite(maxDocs) && currentDocCount >= maxDocs) {
    return {
      allowed: false,
      reason: `You have reached the ${maxDocs}-document limit on the ${tier.name} plan. Upgrade to create unlimited documents.`,
      requiredTier: 'basic',
    };
  }

  if (Number.isFinite(maxStorage) && currentStorageBytes >= maxStorage) {
    return {
      allowed: false,
      reason: `Storage cap of ${tier.limits.storageDisplay} reached. Upgrade for more storage.`,
      requiredTier: 'basic',
    };
  }

  return { allowed: true };
}

/**
 * Checks template accessibility.
 * Basic templates: blank, business, letter, resume.
 * Premium templates: proposal, invoice, pitch, research, etc.
 */
export function canAccessTemplate(userOrTier, templateId = '') {
  const tier = getUserTierConfig(userOrTier);
  const basicTemplateIds = ['blank', 'business', 'letter', 'resume'];
  const isBasicTemplate = basicTemplateIds.includes(String(templateId).toLowerCase());

  if (isBasicTemplate) return { allowed: true };
  if (tier.id === 'free') {
    return {
      allowed: false,
      reason: 'Expanded templates library requires a Basic or Pro plan.',
      requiredTier: 'basic',
    };
  }
  return { allowed: true };
}

/**
 * Comprehensive feature check with human-friendly reason and required tier.
 */
export function checkFeatureAccess(userOrTier, featureKey, context = {}) {
  const tier = getUserTierConfig(userOrTier);

  switch (featureKey) {
    case 'aiWritingTools':
    case 'pragnaAi':
    case 'grammar':
    case 'rewrite':
    case 'summarize': {
      if (tier.features.aiWritingTools) return { allowed: true, currentTier: tier.id };
      return {
        allowed: false,
        feature: 'AI Writing Assistant',
        reason: 'Pragna AI writing tools (grammar check, rewriting, summarization) are exclusively available on EtherX Pro.',
        requiredTier: 'pro',
        currentTier: tier.id,
      };
    }

    case 'realTimeCollaboration':
    case 'shareDoc':
    case 'inviteCollaborator': {
      if (!tier.features.realTimeCollaboration) {
        return {
          allowed: false,
          feature: 'Real-Time Collaboration',
          reason: 'Single-user editing on the Free plan. Upgrade to Basic for up to 3 collaborators or Pro for unlimited.',
          requiredTier: 'basic',
          currentTier: tier.id,
        };
      }
      const count = context.currentCollaboratorsCount || 0;
      if (Number.isFinite(tier.limits.collaboratorsPerDoc) && count >= tier.limits.collaboratorsPerDoc) {
        return {
          allowed: false,
          feature: 'Collaborator Limit Reached',
          reason: `Basic plan allows up to 3 collaborators per document. Upgrade to Pro for unlimited collaboration.`,
          requiredTier: 'pro',
          currentTier: tier.id,
        };
      }
      return { allowed: true, currentTier: tier.id };
    }

    case 'export': {
      const format = context.format || '';
      if (canExportFormat(tier.id, format)) return { allowed: true, currentTier: tier.id };
      const requiresPro = ['html', 'epub'].includes(format.toLowerCase());
      return {
        allowed: false,
        feature: `Export to ${format.toUpperCase()}`,
        reason: `Exporting to ${format.toUpperCase()} is not included in your ${tier.name} plan.`,
        requiredTier: requiresPro ? 'pro' : 'basic',
        currentTier: tier.id,
      };
    }

    case 'createDocument': {
      const result = canCreateDocument(tier.id, context.docCount || 0, context.storageBytes || 0);
      return {
        ...result,
        feature: 'Create Document',
        currentTier: tier.id,
      };
    }

    case 'trackChanges': {
      if (tier.features.trackChanges) return { allowed: true, currentTier: tier.id };
      return {
        allowed: false,
        feature: 'Track Changes & Audit Trail',
        reason: 'Track Changes and audit trails are exclusively available on EtherX Pro.',
        requiredTier: 'pro',
        currentTier: tier.id,
      };
    }

    case 'customTemplates': {
      if (tier.features.customTemplates) return { allowed: true, currentTier: tier.id };
      return {
        allowed: false,
        feature: 'Custom Templates & Brand Kits',
        reason: 'Custom templates and brand kits are available on EtherX Pro.',
        requiredTier: 'pro',
        currentTier: tier.id,
      };
    }

    case 'offlineAutoSync': {
      if (tier.features.offlineAutoSync) return { allowed: true, currentTier: tier.id };
      return {
        allowed: false,
        feature: 'Offline Mode with Autosync',
        reason: 'Offline mode with autosync is available on Basic and Pro plans.',
        requiredTier: 'basic',
        currentTier: tier.id,
      };
    }

    default: {
      const isFeatureUnlocked = Boolean(tier.features[featureKey]);
      return {
        allowed: isFeatureUnlocked,
        feature: featureKey,
        reason: isFeatureUnlocked ? '' : `This feature requires a plan upgrade.`,
        requiredTier: 'pro',
        currentTier: tier.id,
      };
    }
  }
}
