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
 * Determines whether a document is private (has an owner).
 */
function isPrivateDocument(document) {
  if (!document) return false;
  const ownerId = normalizeIdentifier(document.owner?.id);
  const ownerEmail = normalizeIdentifier(document.owner?.email);
  return Boolean(ownerId || ownerEmail);
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
  const ownerId = normalizeIdentifier(document.owner?.id);
  const ownerEmail = normalizeIdentifier(document.owner?.email);

  // 1. Guest / Unauthenticated user handling
  if (isGuest) {
    // If document is private (has an owner):
    // Only grant access if shared with link (shareLinkEnabled) or explicitly shared with this guest
    if (isPrivateDocument(document)) {
      // If the guest is the original creator with matching session id or email (not generic 'guest-user')
      if (
        (userId && ownerId && userId === ownerId && !['guest-user', 'guest'].includes(userId)) ||
        (userEmail && ownerEmail && userEmail === ownerEmail)
      ) {
        return 'owner';
      }

      if (document.shareLinkEnabled === true) {
        const linkEntry = Array.isArray(document.sharedWith)
          ? document.sharedWith.find((entry) => !entry?.email && !entry?.id)
          : null;
        const candidateRole = String(linkEntry?.role || document.shareLinkRole || 'editor').toLowerCase();
        if (['owner', 'editor', 'commenter', 'viewer'].includes(candidateRole)) {
          return candidateRole;
        }
        return 'editor';
      }

      if (Array.isArray(document.sharedWith)) {
        const match = document.sharedWith.find((entry) => {
          const shareId = normalizeIdentifier(entry?.id);
          const shareEmail = normalizeIdentifier(entry?.email);
          return (userId && shareId === userId && !['guest-user', 'guest'].includes(userId)) ||
                 (userEmail && shareEmail === userEmail);
        });

        if (match) {
          const candidateRole = String(match.role || 'editor').toLowerCase();
          return ['owner', 'editor', 'commenter', 'viewer'].includes(candidateRole) ? candidateRole : 'editor';
        }
      }

      // Private document not shared -> strictly no access
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
    if (document.shareLinkRole) {
      const roleStr = String(document.shareLinkRole).toLowerCase();
      if (['editor', 'commenter', 'viewer'].includes(roleStr)) {
        return roleStr;
      }
    }
    return 'editor';
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

  // For administrative actions on private documents, require owner authentication
  if (isGuest && isPrivateDocument(document) && ['share', 'security', 'delete'].includes(act)) {
    return {
      allowed: false,
      role,
      reason: 'Administrative actions require document owner authentication',
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
