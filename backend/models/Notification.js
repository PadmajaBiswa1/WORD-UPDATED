const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  recipientId: { type: String, required: true, index: true },
  recipientEmail: { type: String, index: true },
  sender: {
    id: { type: String },
    name: { type: String },
    email: { type: String },
  },
  documentId: { type: String, required: true, index: true },
  documentTitle: { type: String, default: 'Untitled Document' },
  threadId: { type: String, default: null },
  commentId: { type: mongoose.Schema.Types.Mixed, default: null },
  type: {
    type: String,
    enum: ['mention', 'comment', 'share', 'signature', 'system'],
    default: 'mention',
  },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  readAt: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
