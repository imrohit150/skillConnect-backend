const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const RefreshSession = require("../models/refresh-session.model");
const { sendEmail } = require("./email.service");

const RESET_TTL_MS = 15 * 60 * 1000;
const RESET_COOLDOWN_MS = 60 * 1000;
const RESET_FIELDS = "+passwordResetTokenHash +passwordResetExpiresAt +passwordResetLastSentAt";
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
class PasswordResetError extends Error {
  constructor() { super("This reset link is invalid or has expired. Please request a new one."); this.code = "INVALID_RESET_TOKEN"; }
}

const requestPasswordReset = async (email) => {
  const base = new URL(process.env.CLIENT_URL || "http://localhost:3000");
  if (!["http:", "https:"].includes(base.protocol) || (process.env.NODE_ENV === "production" && base.protocol !== "https:")) throw new Error("Invalid password reset client URL");
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const now = new Date(Date.now());
  const previous = await User.findOneAndUpdate({
    email, isEmailVerified: true,
    $or: [{ passwordResetLastSentAt: { $lte: new Date(now.getTime() - RESET_COOLDOWN_MS) } }, { passwordResetLastSentAt: { $exists: false } }],
  }, { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: new Date(now.getTime() + RESET_TTL_MS), passwordResetLastSentAt: now } }, { returnDocument: "before", runValidators: true }).select(RESET_FIELDS);
  // Missing accounts and cooldowns have the same public response; neither sends mail.
  if (!previous) return;
  const url = new URL("/reset-password", base);
  // Fragments are never sent in HTTP requests, access logs or Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  const resetUrl = url.toString();
  let accepted = false;
  try {
    accepted = await sendEmail({
      to: previous.email, subject: "Reset your SkillConnect password",
      text: `Reset your SkillConnect password:\n${resetUrl}\n\nThis link expires in 15 minutes and works once. If you did not request it, ignore this email. Your password has not changed.`,
      html: `<div style="font-family:Arial,sans-serif;background:#effbfc;padding:28px 16px;color:#12313c"><div style="max-width:460px;margin:auto;border:1px solid #cee9ed;border-radius:20px;background:white;padding:28px"><p style="font-size:20px;font-weight:bold;color:#0891b2">SkillConnect</p><h1 style="font-size:24px">Reset your password</h1><p style="line-height:1.6">Use the link below to choose a new password. It expires in <strong>15 minutes</strong> and works once.</p><a href="${resetUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}" style="display:inline-block;margin:16px 0;padding:14px 22px;border-radius:12px;background:#0891b2;color:white;text-decoration:none;font-weight:bold">Choose a new password</a><p style="font-size:12px;line-height:1.6;color:#607580">If you did not request this email, ignore it. Your password has not changed.</p></div></div>`,
    });
  } catch { accepted = false; }
  if (!accepted) {
    const restore = { $set: {}, $unset: {} };
    for (const key of ["passwordResetTokenHash", "passwordResetExpiresAt", "passwordResetLastSentAt"]) {
      if (previous[key] !== undefined) restore.$set[key] = previous[key]; else restore.$unset[key] = 1;
    }
    await User.updateOne({ _id: previous._id, passwordResetTokenHash: tokenHash, passwordResetLastSentAt: now }, restore);
    console.error("Password reset email could not be delivered");
  }
};

const resetPassword = async (token, newPassword) => {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new PasswordResetError();
  // Hash before the atomic update. Only one request can replace the password and consume the link.
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const now = new Date(Date.now());
  const user = await User.findOneAndUpdate({ passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: { $gt: now }, isEmailVerified: true }, {
    $set: { passwordHash }, $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 }, $inc: { sessionVersion: 1 },
  }, { returnDocument: "after", runValidators: true }).select("email +sessionVersion");
  if (!user) throw new PasswordResetError();
  // Version checks already invalidate every older access/refresh token even if cleanup fails.
  try {
    await RefreshSession.updateMany({ userId: user._id, revokedAt: null, $or: [{ sessionVersion: { $lt: user.sessionVersion } }, { sessionVersion: { $exists: false } }] }, { $set: { revokedAt: now } });
  } catch { console.error("Could not clean up older sessions after password reset"); }
  return user;
};

const notifyPasswordReset = async (email) => {
  await sendEmail({ to: email, subject: "Your SkillConnect password was changed", text: "Your SkillConnect password was reset. Previous sessions have been signed out. If you did not make this change, reset your password again and secure your email account.", html: "<div style='font-family:Arial,sans-serif;padding:24px;color:#12313c'><h2>Your password was changed</h2><p>Your SkillConnect password was reset and previous sessions have been signed out.</p><p>If you did not make this change, reset your password again and secure your email account.</p></div>" });
};

module.exports = { requestPasswordReset, resetPassword, notifyPasswordReset, PasswordResetError, RESET_TTL_MS, RESET_COOLDOWN_MS };
