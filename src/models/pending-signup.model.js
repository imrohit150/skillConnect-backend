const mongoose = require("mongoose");

// Temporary signup data only. No User or refresh session exists until the OTP succeeds.
const pendingSignupSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  name: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  dateOfBirth: { type: Date, required: true, select: false },
  tokenHash: { type: String, required: true, unique: true, select: false, match: /^[a-f0-9]{64}$/i },
  otpHash: { type: String, required: true, select: false, match: /^[a-f0-9]{64}$/i },
  otpExpiresAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  lastSentAt: { type: Date, required: true },
}, { timestamps: true });

pendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("PendingSignup", pendingSignupSchema);
