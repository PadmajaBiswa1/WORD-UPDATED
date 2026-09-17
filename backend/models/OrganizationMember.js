const mongoose = require('mongoose');

const organizationMemberSchema = new mongoose.Schema({
  orgId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  role: {
    type: String,
    enum: ['Owner', 'Admin', 'Editor', 'Viewer'],
    default: 'Viewer',
  },
  department: { type: String, default: 'General' },
  status: {
    type: String,
    enum: ['active', 'deactivated'],
    default: 'active',
  },
  storageBytes: { type: Number, default: 0 },
  aiCreditsUsed: { type: Number, default: 0 },
  lastActiveAt: { type: Date, default: Date.now },
  invitedBy: { type: String, default: null },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

organizationMemberSchema.index({ orgId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('OrganizationMember', organizationMemberSchema);
