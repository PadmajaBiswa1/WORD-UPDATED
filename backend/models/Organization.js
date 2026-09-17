const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, default: 'EtherX Global Technologies' },
  domain: { type: String, default: 'etherx.com' },
  tier: { type: String, enum: ['pro', 'enterprise'], default: 'pro' },
  seatsTotal: { type: Number, default: 25 },
  seatsUsed: { type: Number, default: 7 },
  settings: {
    allowExternalSharing: { type: Boolean, default: true },
    enforce2FA: { type: Boolean, default: false },
    enforceSSO: { type: Boolean, default: false },
    ipAllowlist: [{ type: String }],
  },
  subscription: {
    plan: { type: String, default: 'pro' },
    billingCycle: { type: String, enum: ['monthly', 'annual', 'yearly'], default: 'annual' },
    status: { type: String, enum: ['active', 'past_due', 'grace_period'], default: 'active' },
    price: { type: Number, default: 3999 },
    currency: { type: String, default: 'INR' },
    renewalDate: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    gracePeriodEnd: { type: Date, default: null },
  },
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);
