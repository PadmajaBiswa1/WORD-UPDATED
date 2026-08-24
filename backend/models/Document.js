const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, default: 'Untitled Document' },
  content: { type: String, default: '<p></p>' },
  owner: {
    id: { type: String },
    name: { type: String },
    email: { type: String }
  },
  sharedWith: [
    {
      id: { type: String },
      email: { type: String },
      role: { type: String, default: 'viewer' },
      sharedAt: { type: String }
    }
  ],
  shareLinkEnabled: { type: Boolean, default: false },
  versions: [
    {
      id: { type: String },
      snapshot: { type: String },
      savedAt: { type: String },
      label: { type: String }
    }
  ],
  comments: [
    {
      id: { type: Number },
      text: { type: String },
      author: { type: String },
      resolved: { type: Boolean, default: false },
      createdAt: { type: String }
    }
  ],
  trackChanges: { type: Boolean, default: false },
  design: {
    pageColor: { type: String, default: '#fdfbf7' },
    pageColorMode: { type: String, default: 'theme' },
    pageFillImage: { type: String, default: '' },
    borderSetting: { type: String, default: 'box' },
    borderStyle: { type: String, default: 'solid' },
    borderColor: { type: String, default: '#6f5320' },
    borderWidth: { type: Number, default: 1 },
    pageShadow: { type: String, default: 'var(--shadow-page)' },
    accent: { type: String, default: '#c9a84c' },
    heading: { type: String, default: '#c9a84c' },
    subtle: { type: String, default: '#444444' },
    font: { type: String, default: 'Crimson Pro' },
    spacing: { type: String, default: '1.7' },
    effect: { type: String, default: 'none' }
  },
  headerFooter: {
    headerText: { type: String, default: '' },
    headerAlign: { type: String, default: 'Center' },
    footerText: { type: String, default: '' },
    footerAlign: { type: String, default: 'Center' },
    pageNumberEnabled: { type: Boolean, default: false },
    pageNumberStyle: { type: String, default: 'bottom-center' },
    pageNumberStart: { type: Number, default: 1 }
  },
  revision: { type: Number, default: 0 },
  ipfsHash: { type: String, default: null },
  ipfsGatewayUrl: { type: String, default: null },
  ipfsPinnedAt: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
