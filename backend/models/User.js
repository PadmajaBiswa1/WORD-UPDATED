const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 6 },
  isVerified:{ type: Boolean, default: false },
  plan:      { type: String, enum: ['free', 'basic', 'pro'], default: 'free' },
  billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  subscriptionExpiresAt: { type: Date, default: null },
  razorpaySubscriptionId: { type: String, default: null },
  razorpayPaymentId:      { type: String, default: null },
  role:         { type: String, enum: ['Owner', 'Admin', 'Editor', 'Viewer'], default: 'Viewer' },
  status:       { type: String, enum: ['active', 'deactivated'], default: 'active' },
  department:   { type: String, default: 'General' },
  organizationId: { type: String, default: 'org_etherx_pro' },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
