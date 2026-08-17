/**
 * Save & Merge Service
 * Handles document save status, recent documents, and mail merge
 */

export class SaveMergeService {
  /**
   * Track save status
   */
  static createSaveStatus(documentId) {
    return {
      documentId,
      saved: false,
      lastSaved: null,
      lastModified: new Date().toISOString(),
      autoSaveInterval: 30000, // 30 seconds
      isDirty: false,
    };
  }

  /**
   * Mark document as saved
   */
  static markSaved(saveStatus) {
    if (!saveStatus) return null;

    return {
      ...saveStatus,
      saved: true,
      lastSaved: new Date().toISOString(),
      isDirty: false,
    };
  }

  /**
   * Mark document as modified
   */
  static markModified(saveStatus) {
    if (!saveStatus) return null;

    return {
      ...saveStatus,
      saved: false,
      lastModified: new Date().toISOString(),
      isDirty: true,
    };
  }

  /**
   * Get save status message
   */
  static getSaveStatusMessage(saveStatus) {
    if (!saveStatus) return 'Unknown';

    if (!saveStatus.saved) {
      return 'Unsaved changes';
    }

    if (!saveStatus.lastSaved) {
      return 'Not saved yet';
    }

    const now = new Date();
    const lastSaved = new Date(saveStatus.lastSaved);
    const diffMs = now - lastSaved;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  /**
   * Add document to recent list
   */
  static addToRecentDocuments(doc) {
    if (!doc) return [];

    try {
      let recent = [];
      const stored = localStorage.getItem('etherx_recent_documents');

      if (stored) {
        try {
          recent = JSON.parse(stored);
        } catch {
          recent = [];
        }
      }

      // Remove if already exists
      recent = recent.filter((d) => d.id !== doc.id);

      // Add to front
      recent.unshift({
        id: doc.id,
        title: doc.title || 'Untitled',
        lastAccessed: new Date().toISOString(),
        thumbnail: doc.thumbnail || null,
      });

      // Keep only 20 most recent
      recent = recent.slice(0, 20);

      localStorage.setItem('etherx_recent_documents', JSON.stringify(recent));
      return recent;
    } catch (err) {
      console.error('Add to recent failed:', err);
      return [];
    }
  }

  /**
   * Get recent documents
   */
  static getRecentDocuments() {
    try {
      const stored = localStorage.getItem('etherx_recent_documents');
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Get recent failed:', err);
      return [];
    }
  }

  /**
   * Clear recent documents
   */
  static clearRecentDocuments() {
    try {
      localStorage.removeItem('etherx_recent_documents');
      return true;
    } catch (err) {
      console.error('Clear recent failed:', err);
      return false;
    }
  }

  /**
   * Prepare mail merge data
   */
  static prepareMergeData(csvData) {
    try {
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) return [];

      const headers = lines[0].split(',').map((h) => h.trim());
      const records = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const record = {};
        headers.forEach((header, idx) => {
          record[header] = (values[idx] || '').trim();
        });
        records.push(record);
      }

      return records;
    } catch (err) {
      console.error('Prepare merge data failed:', err);
      return [];
    }
  }

  /**
   * Execute mail merge with template
   */
  static executeMerge(template, dataRecords, mergeFields) {
    try {
      const mergedDocuments = [];

      dataRecords.forEach((record, idx) => {
        let content = template;

        // Replace all merge fields
        mergeFields.forEach((field) => {
          const regex = new RegExp(`<<${field}>>`, 'g');
          content = content.replace(regex, record[field] || '');
        });

        mergedDocuments.push({
          index: idx + 1,
          recipient: record.recipient || `Recipient ${idx + 1}`,
          content,
        });
      });

      return mergedDocuments;
    } catch (err) {
      console.error('Execute merge failed:', err);
      return [];
    }
  }

  /**
   * Insert merge field placeholder
   */
  static insertMergeField(editor, fieldName) {
    if (!editor) return false;

    try {
      editor.chain().focus().insertContent(`<<${fieldName}>>`).run();
      return true;
    } catch (err) {
      console.error('Insert merge field failed:', err);
      return false;
    }
  }

  /**
   * Get merge fields from document
   */
  static extractMergeFields(content) {
    try {
      const regex = /<<(\w+)>>/g;
      const fields = new Set();
      let match;

      while ((match = regex.exec(content)) !== null) {
        fields.add(match[1]);
      }

      return Array.from(fields);
    } catch (err) {
      console.error('Extract merge fields failed:', err);
      return [];
    }
  }

  /**
   * Preview merge result
   */
  static previewMerge(template, dataRecord, mergeFields) {
    try {
      let preview = template;

      mergeFields.forEach((field) => {
        const regex = new RegExp(`<<${field}>>`, 'g');
        preview = preview.replace(regex, dataRecord[field] || `[${field}]`);
      });

      return preview;
    } catch (err) {
      console.error('Preview merge failed:', err);
      return template;
    }
  }
}

export default SaveMergeService;
