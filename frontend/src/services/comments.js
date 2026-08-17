/**
 * Comments Service
 * Manages document comments with anchoring to specific positions
 */

import { v4 as uuidv4 } from 'uuid';

export class CommentsService {
  /**
   * Create a new comment
   */
  static createComment(editor, text, author = 'Unknown') {
    if (!editor || editor.state.selection.empty) {
      return null;
    }

    try {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to);

      const comment = {
        id: uuidv4(),
        author,
        text,
        selectedText,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolved: false,
        replies: [],
        position: { from, to },
      };

      // Add comment marker to document
      editor
        .chain()
        .focus()
        .setMeta('addedToHistory', false)
        .updateAttributes('text', {
          'data-comment-id': comment.id,
        })
        .run();

      return comment;
    } catch (err) {
      console.error('Create comment failed:', err);
      return null;
    }
  }

  /**
   * Delete a comment and its anchor
   */
  static deleteComment(editor, commentId) {
    if (!editor) return false;

    try {
      // Remove comment markers from document
      const dom = editor.view.dom;
      const markers = dom.querySelectorAll(`[data-comment-id="${commentId}"]`);
      markers.forEach((marker) => {
        // Remove the marker class/attribute
        marker.removeAttribute('data-comment-id');
      });

      return true;
    } catch (err) {
      console.error('Delete comment failed:', err);
      return false;
    }
  }

  /**
   * Reply to a comment
   */
  static addReply(comment, text, author = 'Unknown') {
    if (!comment) return null;

    const reply = {
      id: uuidv4(),
      author,
      text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    comment.replies.push(reply);
    comment.updatedAt = new Date().toISOString();

    return reply;
  }

  /**
   * Mark comment as resolved
   */
  static resolveComment(comment) {
    if (!comment) return false;
    comment.resolved = true;
    comment.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Navigate to a comment's anchor in the document
   */
  static navigateToComment(editor, comment) {
    if (!editor || !comment) return false;

    try {
      const { from, to } = comment.position;
      
      // Scroll into view
      const dom = editor.view.dom;
      const marker = dom.querySelector(`[data-comment-id="${comment.id}"]`);
      
      if (marker) {
        marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
        marker.classList.add('etherx-comment-highlight');
        
        // Remove highlight after 2 seconds
        setTimeout(() => {
          marker.classList.remove('etherx-comment-highlight');
        }, 2000);
      }

      // Set selection to comment position
      editor.chain().focus().setSelection(from).run();
      
      return true;
    } catch (err) {
      console.error('Navigate to comment failed:', err);
      return false;
    }
  }

  /**
   * Get all comments in document
   */
  static getComments(editor) {
    if (!editor) return [];

    try {
      const dom = editor.view.dom;
      const commentIds = new Set();
      const markers = dom.querySelectorAll('[data-comment-id]');
      
      markers.forEach((marker) => {
        const id = marker.getAttribute('data-comment-id');
        if (id) commentIds.add(id);
      });

      return Array.from(commentIds);
    } catch (err) {
      console.error('Get comments failed:', err);
      return [];
    }
  }

  /**
   * Get comment by ID from DOM
   */
  static getCommentById(editor, commentId) {
    if (!editor) return null;

    try {
      const dom = editor.view.dom;
      const marker = dom.querySelector(`[data-comment-id="${commentId}"]`);
      
      if (!marker) return null;

      return {
        id: commentId,
        text: marker.getAttribute('data-comment-text') || '',
        author: marker.getAttribute('data-comment-author') || 'Unknown',
        selectedText: marker.textContent,
        resolved: marker.hasAttribute('data-comment-resolved'),
      };
    } catch (err) {
      console.error('Get comment by ID failed:', err);
      return null;
    }
  }

  /**
   * Update comment text
   */
  static updateComment(editor, commentId, text) {
    if (!editor) return false;

    try {
      const dom = editor.view.dom;
      const markers = dom.querySelectorAll(`[data-comment-id="${commentId}"]`);
      
      markers.forEach((marker) => {
        marker.setAttribute('data-comment-text', text);
      });

      return true;
    } catch (err) {
      console.error('Update comment failed:', err);
      return false;
    }
  }
}

export default CommentsService;
