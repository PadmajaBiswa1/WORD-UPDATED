/**
 * Collaboration & Permission Service
 * Manages document permissions, block authors, and editing restrictions
 */

export class CollaborationService {
  /**
   * Create a permission rule for a specific author
   */
  static createBlockAuthorRule(userId, userName, restrictions = {}) {
    return {
      id: `rule-${userId}-${Date.now()}`,
      userId,
      userName,
      createdAt: new Date().toISOString(),
      restrictions: {
        canEdit: restrictions.canEdit !== false,
        canComment: restrictions.canComment !== false,
        canTrackChanges: restrictions.canTrackChanges !== false,
        restrictToBlocks: restrictions.restrictToBlocks || [], // Block IDs only this author can edit
        ...restrictions,
      },
    };
  }

  /**
   * Mark content block for specific author(s)
   */
  static markBlockAuthor(editor, blockId, authorId, authorName) {
    if (!editor) return false;

    try {
      const dom = editor.view.dom;
      const blocks = dom.querySelectorAll(`[id="${blockId}"]`);
      
      blocks.forEach((block) => {
        block.setAttribute('data-block-author', authorId);
        block.setAttribute('data-block-author-name', authorName);
        block.setAttribute('data-block-locked', 'true');
        block.classList.add('etherx-block-author');
      });

      return true;
    } catch (err) {
      console.error('Mark block author failed:', err);
      return false;
    }
  }

  /**
   * Check if user can edit a specific block
   */
  static canEditBlock(editor, blockId, userId) {
    if (!editor) return false;

    try {
      const dom = editor.view.dom;
      const block = dom.querySelector(`[id="${blockId}"]`);
      
      if (!block || !block.hasAttribute('data-block-author')) {
        // No restriction = everyone can edit
        return true;
      }

      const blockAuthorId = block.getAttribute('data-block-author');
      // Only the assigned author (or admins) can edit
      return blockAuthorId === userId;
    } catch (err) {
      console.error('Check edit permission failed:', err);
      return true; // Default to allowing
    }
  }

  /**
   * Set document editing restrictions
   */
  static setEditingRestrictions(document, restrictions = {}) {
    return {
      id: `restrict-${Date.now()}`,
      createdAt: new Date().toISOString(),
      restrictions: {
        allowComments: restrictions.allowComments !== false,
        allowTracking: restrictions.allowTracking !== false,
        allowEditing: restrictions.allowEditing !== false,
        allowFormatting: restrictions.allowFormatting !== false,
        protectedSections: restrictions.protectedSections || [],
        password: restrictions.password || null,
        ...restrictions,
      },
    };
  }

  /**
   * Protect a section of the document
   */
  static protectSection(editor, sectionId, password = null) {
    if (!editor) return false;

    try {
      const dom = editor.view.dom;
      const sections = dom.querySelectorAll(`[id="${sectionId}"]`);
      
      sections.forEach((section) => {
        section.setAttribute('data-protected', 'true');
        section.setAttribute('data-protected-password', password ? '••••••' : 'false');
        section.classList.add('etherx-protected-section');
      });

      return true;
    } catch (err) {
      console.error('Protect section failed:', err);
      return false;
    }
  }

  /**
   * Unlock protected section with password
   */
  static unlockSection(sectionElement, password, correctPassword) {
    if (!sectionElement) return false;

    try {
      if (password === correctPassword) {
        sectionElement.setAttribute('data-protected', 'false');
        sectionElement.classList.remove('etherx-protected-section');
        sectionElement.classList.add('etherx-unlocked-temporarily');
        
        // Re-lock after session or on save
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Unlock section failed:', err);
      return false;
    }
  }

  /**
   * Get list of contributors to document
   */
  static getContributors(editor) {
    if (!editor) return [];

    try {
      const dom = editor.view.dom;
      const contributors = new Map();
      
      // Scan for tracked changes
      const changes = dom.querySelectorAll('[data-tracked-change]');
      changes.forEach((change) => {
        const author = change.getAttribute('data-change-author') || 'Unknown';
        const type = change.getAttribute('data-change-type') || 'modification';
        
        if (!contributors.has(author)) {
          contributors.set(author, {
            name: author,
            changes: 0,
            lastEdit: null,
          });
        }
        
        const entry = contributors.get(author);
        entry.changes++;
        entry.lastEdit = new Date().toISOString();
      });

      // Scan for comment authors
      const comments = dom.querySelectorAll('[data-comment-id]');
      comments.forEach((comment) => {
        const author = comment.getAttribute('data-comment-author') || 'Unknown';
        
        if (!contributors.has(author)) {
          contributors.set(author, {
            name: author,
            changes: 0,
            lastEdit: null,
          });
        }
      });

      return Array.from(contributors.values());
    } catch (err) {
      console.error('Get contributors failed:', err);
      return [];
    }
  }

  /**
   * Get conflict in concurrent edits
   */
  static detectConflict(localChange, remoteChange) {
    if (!localChange || !remoteChange) return null;

    // Overlapping ranges indicate conflict
    if (
      (localChange.from < remoteChange.to && localChange.to > remoteChange.from) ||
      (remoteChange.from < localChange.to && remoteChange.to > localChange.from)
    ) {
      return {
        type: 'edit-conflict',
        local: localChange,
        remote: remoteChange,
        resolveStrategy: 'remote-wins', // or 'local-wins', 'merge', 'manual'
      };
    }

    return null;
  }

  /**
   * Resolve conflict (choose which version to keep)
   */
  static resolveConflict(conflict, strategy = 'manual') {
    if (!conflict) return null;

    switch (strategy) {
      case 'local-wins':
        return conflict.local;
      case 'remote-wins':
        return conflict.remote;
      case 'merge':
        // Combine both changes intelligently
        return {
          ...conflict.local,
          to: Math.max(conflict.local.to, conflict.remote.to),
        };
      default:
        return null;
    }
  }
}

export default CollaborationService;
