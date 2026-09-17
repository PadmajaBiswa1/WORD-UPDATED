const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  orgId: { type: String, required: true, default: 'org_etherx_pro', index: true },
  actor: {
    id: { type: String, required: true },
    name: { type: String, default: 'System' },
    email: { type: String, default: '' },
    role: { type: String, default: 'Owner' },
  },
  action: { type: String, required: true },
  target: {
    id: { type: String, default: null },
    name: { type: String, default: null },
    type: { type: String, default: 'user' },
  },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, default: '127.0.0.1' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
