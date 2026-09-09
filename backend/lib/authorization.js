/**
 * EtherX Word - Server-side Authorization & Role Resolution
 * Implements Section 7.1 Role-Based Permissions Matrix
 * Enforces verified identities and strict read-only access for guest/unauthenticated users.
 */

/**
 * Normalizes user identifier tokens for consistent comparison.
 */
function normalizeIdentifier(val) {
  return String(val || '').trim().toLowerCase();
}

/**
 * Checks if a user object represents an unauthenticated guest.
 */
function isGuestOrUnauthenticated(user = {}) {
  if (!user || typeof user !== 'object') return true;
  if (user.isGuest === true || user.isAuthenticated === false) return true;
  const id = normalizeIdentifier(user.id);
  const email = normalizeIdentifier(user.email);
  if (!id && !email) return true;
  if (id === 'guest-user' || id === 'guest' || id.startsWith('guest_') || id.startsWith('guest-')) {
    return true;
  }
  return false;
}

/**
 * Determines whether a document is private (has an authenticated owner).
 */
function isPrivateDocument(document) {
  if (!document) return false;
  const ownerId = normalizeIdentifier(document.owner?.id);
  const ownerEmail = normalizeIdentifier(document.owner?.email);
  return Boolean((ownerId && ownerId !== 'guest-user') || ownerEmail);
}

/**
 * Determines the user's effective role on a document:
 * 'owner' | 'editor' | 'commenter' | 'viewer' | null
 *
 * @param {Object} document - The normalized or raw document object
 * @param {Object} user - Requesting user { id, email, name, isAuthenticated, isGuest }
 * @returns {string|null} The resolved role, or null if unauthenticated / no access
 */
function getEffectiveRole(document, user = {}) {
  if (!document) return null;

  const isGuest = isGuestOrUnauthenticated(user);
  const userId = normalizeIdentifier(user?.id);
  const userEmail = normalizeIdentifier(user?.email);

  // 1. Guest / Unauthenticated user handling
  if (isGuest) {
    // If document is private (owned by an authenticated user):
    // Only grant read-only access if shared with public (shareLinkEnabled) or explicitly shared with public/guest viewer role
    if (isPrivateDocument(document)) {
      if (document.shareLinkEnabled === true) {
        return 'viewer';
      }

      if (Array.isArray(document.sharedWith)) {
        const publicMatch = document.sharedWith.find((entry) => {
          const shareId = normalizeIdentifier(entry?.id);
          const shareEmail = normalizeIdentifier(entry?.email);
          return !shareId && !shareEmail || shareId === 'guest-user' || shareId === 'public';
        });

        if (publicMatch) {
          return 'viewer';
        }
      }

      // Private document not shared with public/viewer -> strictly no access
      return null;
    }

    // Unowned document: guest can view
    return 'viewer';
  }

  // 2. Authenticated user handling

  // Check if document has no owner: claim as owner
  if (!document.owner || (!document.owner.id && !document.owner.email)) {
    return 'owner';
  }

  // Owner check
  const ownerId = normalizeIdentifier(document.owner?.id);
  const ownerEmail = normalizeIdentifier(document.owner?.email);

  if ((ownerId && userId && ownerId === userId) || (ownerEmail && userEmail && ownerEmail === userEmail)) {
    return 'owner';
  }

  // Explicit sharedWith entries
  if (Array.isArray(document.sharedWith)) {
    const match = document.sharedWith.find((entry) => {
      const shareId = normalizeIdentifier(entry?.id);
      const shareEmail = normalizeIdentifier(entry?.email);
      return (userId && shareId === userId) || (userEmail && shareEmail === userEmail);
    });

    if (match) {
      const validRoles = ['owner', 'editor', 'commenter', 'viewer'];
      const candidate = String(match.role || '').toLowerCase();
      if (validRoles.includes(candidate)) {
        return candidate;
      }
      return 'viewer';
    }
  }

  // Share link enabled fallback for authenticated users
  if (document.shareLinkEnabled === true) {
    if (Array.isArray(document.sharedWith)) {
      const linkEntry = document.sharedWith.find((entry) => !entry?.email && !entry?.id);
      if (linkEntry && linkEntry.role) {
        const roleStr = String(linkEntry.role).toLowerCase();
        if (['editor', 'commenter', 'viewer'].includes(roleStr)) {
          return roleStr;
        }
      }
    }
    return 'viewer';
  }

  return null;
}

/**
 * Checks whether a user has permission to perform an action on a document.
 * 
 * Matrix per Section 7.1:
 * - read: owner, editor, commenter, viewer
 * - edit: owner, editor
 * - comment: owner, editor, commenter (unless policy disables comments)
 * - resolve_comment: owner, editor, or commenter if resolving own comment
 * - share: owner
 * - security: owner
 * - sign: owner, editor
 * - export: policy-controlled (allowDownload !== false)
 * - manage_subdocuments: owner, editor
 * - delete: owner
 *
 * @param {Object} document - Document object
 * @param {Object} user - User object { id, email, name, isAuthenticated, isGuest }
 * @param {string} action - Action key
 * @param {Object} [context={}] - Context details (e.g. comment author for resolve_comment)
 * @returns {{ allowed: boolean, role: string, reason?: string }}
 */
function checkPermission(document, user = {}, action = 'read', context = {}) {
  if (!document) {
    return { allowed: false, role: 'none', reason: 'Document not found' };
  }

  const isGuest = isGuestOrUnauthenticated(user);
  const role = getEffectiveRole(document, user);

  if (!role) {
    return { allowed: false, role: 'none', reason: 'User does not have access to this document' };
  }

  const act = String(action || '').toLowerCase();
  const accessPolicy = document.accessPolicy || {
    allowDownload: true,
    allowComments: true,
    allowCopy: true,
  };

  // Enforce read-only restriction for guest / unauthenticated users
  if (isGuest) {
    if (act === 'read') {
      return { allowed: true, role: 'viewer' };
    }
    if (act === 'export') {
      if (accessPolicy.allowDownload === false) {
        return { allowed: false, role: 'viewer', reason: 'Export is disabled by document access policy' };
      }
      return { allowed: true, role: 'viewer' };
    }
    return {
      allowed: false,
      role: 'viewer',
      reason: 'Unauthenticated and guest users have read-only access to documents',
    };
  }

  switch (act) {
    case 'read':
      return { allowed: true, role };

    case 'edit':
      if (role === 'owner' || role === 'editor') {
        return { allowed: true, role };
      }
      return {
        allowed: false,
        role,
        reason: 'Edit permission requires Editor or Owner role',
      };

    case 'comment':
      if (accessPolicy.allowComments === false) {
        return {
          allowed: false,
          role,
          reason: 'Comments are disabled by document access policy',
        };
      }
      if (role === 'owner' || role === 'editor' || role === 'commenter') {
        return { allowed: true, role };
      }
      return {
        allowed: false,
        role,
        reason: 'Commenting requires Commenter, Editor, or Owner role',
      };

    case 'resolve_comment':
      if (role === 'owner' || role === 'editor') {
        return { allowed: true, role };
      }
      if (role === 'commenter') {
        const comment = context.comment || {};
        const author = comment.author || context.commentAuthor;
        const authorId = normalizeIdentifier(typeof author === 'object' ? (author?.id || author?.email || author?.name) : author);
        const userId = normalizeIdentifier(user?.id);
        const userEmail = normalizeIdentifier(user?.email);
        const userName = normalizeIdentifier(user?.name);

        const isOwnComment = Boolean(
          authorId && (
            (userId && authorId === userId) ||
            (userEmail && authorId === userEmail) ||
            (userName && authorId === userName)
          )
        );

        if (isOwnComment) {
          return { allowed: true, role };
        }
        return {
          allowed: false,
          role,
          reason: 'Commenters can only resolve their own comments',
        };
      }
      return {
        allowed: false,
        role,
        reason: 'Viewers cannot resolve comments',
      };

    case 'share':
      if (role === 'owner') {
        return { allowed: true, role };
      }
      return {
        allowed: false,
        role,
        reason: 'Managing document sharing requires Owner role',
      };

    case 'security':
      if (role === 'owner') {
        return { allowed: true, role };
      }
      return {
        allowed: false,
        role,
        reason: 'Changing security and encryption envelopes requires Owner role',
      };

    case 'sign':
      if (role === 'owner' || role === 'editor') {
        return { allowed: true, role };
      }
      return {
        allowed: false,
        role,
        reason: 'Signing document requires Editor or Owner role',
      };

    case 'export':
      if (accessPolicy.allowDownload === false) {
        return {
          allowed: false,
          role,
          reason: 'Export is disabled by document access policy',
        };
      }
      return { allowed: true, role };

    case 'manage_subdocuments':
      if (role === 'owner' || role === 'editor') {
        return { allowed: true, role };
      }
      return {
        allowed: false,
        role,
        reason: 'Managing subdocuments requires Editor or Owner role',
      };

    case 'delete':
      if (role === 'owner') {
        return { allowed: true, role };
      }
      return {
        allowed: false,
        role,
        reason: 'Deleting document requires Owner role',
      };

    default:
      if (role === 'owner' || role === 'editor') {
        return { allowed: true, role };
      }
      return {
        allowed: false,
        role,
        reason: `Operation '${action}' requires Editor or Owner role`,
      };
  }
}

module.exports = {
  getEffectiveRole,
  checkPermission,
  isGuestOrUnauthenticated,
  isPrivateDocument,
};
