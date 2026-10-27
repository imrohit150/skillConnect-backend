const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const PendingSignup = require("../models/pending-signup.model");
const { sendEmail } = require("./email.service");

const OTP_TTL_MS = 10 * 60 * 1000;
const SIGNUP_TTL_MS = 30 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const PRIVATE_FIELDS = "+passwordHash +dateOfBirth +tokenHash +otpHash";

class EmailVerificationError extends Error {
  constructor(message, status, code) { super(message); this.name = "EmailVerificationError"; this.status = status; this.code = code; }
}

const expiredSignup = () => new EmailVerificationError("This signup expired or was already completed. Please sign up again or log in.", 410, "SIGNUP_EXPIRED");
const hashSignupToken = (token) => {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw expiredSignup();
  return crypto.createHash("sha256").update(token).digest("hex");
};
const hashVerificationOtp = (tokenHash, email, otp) => {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new EmailVerificationError("Email verification is not configured", 503, "VERIFICATION_NOT_CONFIGURED");
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) throw new EmailVerificationError("Enter a 6-digit verification code", 400, "INVALID_OTP_FORMAT");
  return crypto.createHmac("sha256", secret).update(`skillconnect:signup:${tokenHash}:${email}:${otp}`).digest("hex");
};
const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
const cooldownError = (lastSentAt) => {
  const error = new EmailVerificationError("Please wait before requesting another code", 429, "OTP_RESEND_COOLDOWN");
  error.retryAfter = Math.max(1, Math.ceil((lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS - Date.now()) / 1000));
  return error;
};
const publicSignup = (pending) => ({
  email: pending.email,
  expiresAt: pending.expiresAt,
  emailVerification: {
    status: pending.otpExpiresAt.getTime() <= Date.now() ? "expired" : pending.attempts >= OTP_MAX_ATTEMPTS ? "locked" : "sent",
    expiresAt: pending.otpExpiresAt,
    resendAvailableAt: new Date(pending.lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS),
    attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - pending.attempts),
  },
});
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const deliverOtp = async (pending, otp) => {
  try {
    return await sendEmail({
      to: pending.email, subject: "Verify your email to join SkillConnect",
      text: `Hi ${pending.name},\n\nYour SkillConnect signup code is ${otp}. It expires in 10 minutes. Your account will only be created after you verify this code.\n\nIf you did not request this code, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;background:#effbfc;padding:28px 16px;color:#12313c"><div style="max-width:460px;margin:auto;border:1px solid #cee9ed;border-radius:20px;background:white;padding:28px"><p style="font-size:20px;font-weight:bold;color:#0891b2">SkillConnect</p><h1 style="font-size:24px">Verify your email address</h1><p style="line-height:1.6">Hi ${escapeHtml(pending.name)}, enter this code to finish signing up.</p><div style="margin:24px 0;padding:20px;border-radius:12px;background:#ecfeff;text-align:center;font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#087d95">${otp}</div><p style="font-size:14px;line-height:1.6">Expires in <strong>10 minutes</strong>. Use the newest code. Your account is created only after verification.</p><p style="font-size:12px;color:#607580">If you did not request this code, ignore this email.</p></div></div>`,
    });
  } catch { return false; }
};

const getPending = async (token, privateFields = false) => {
  const tokenHash = hashSignupToken(token);
  const pending = await PendingSignup.findOne({ tokenHash, expiresAt: { $gt: new Date(Date.now()) } }).select(privateFields ? PRIVATE_FIELDS : "email expiresAt otpExpiresAt attempts lastSentAt");
  if (!pending) throw expiredSignup();
  return pending;
};

const beginSignup = async ({ name, email, password, dateOfBirth }) => {
  if (await User.exists({ email })) throw new EmailVerificationError("An account with this email already exists. Please log in.", 409, "EMAIL_IN_USE");
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSignupToken(token);
  const otp = generateOtp();
  const otpHash = hashVerificationOtp(tokenHash, email, otp);
  await PendingSignup.init();
  const now = new Date(Date.now());
  const pendingData = { name, email, passwordHash: await bcrypt.hash(password, 12), dateOfBirth: new Date(dateOfBirth), tokenHash, otpHash, attempts: 0, lastSentAt: now, otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS), expiresAt: new Date(now.getTime() + SIGNUP_TTL_MS) };
  let previous;
  try {
    previous = await PendingSignup.findOneAndUpdate(
      { email, $or: [{ lastSentAt: { $lte: new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS) } }, { expiresAt: { $lte: now } }] },
      { $set: pendingData }, { upsert: true, returnDocument: "before", runValidators: true },
    ).select(PRIVATE_FIELDS);
  } catch (error) {
    if (error.code !== 11000) throw error;
    const current = await PendingSignup.findOne({ email }).select("lastSentAt");
    throw cooldownError(current?.lastSentAt ?? now);
  }
  if (!(await deliverOtp(pendingData, otp))) {
    try {
      const filter = { email, tokenHash };
      if (previous && previous.expiresAt.getTime() > Date.now()) {
        const { name, email, passwordHash, dateOfBirth, tokenHash, otpHash, attempts, lastSentAt, otpExpiresAt, expiresAt } = previous;
        await PendingSignup.updateOne(filter, { $set: { name, email, passwordHash, dateOfBirth, tokenHash, otpHash, attempts, lastSentAt, otpExpiresAt, expiresAt } });
      } else await PendingSignup.deleteOne(filter);
    } catch { console.error("Could not clean up pending signup after email delivery failed"); }
    throw new EmailVerificationError("Could not send your signup code. Please try again. Your account has not been created.", 503, "VERIFICATION_EMAIL_FAILED");
  }
  return { token, signup: publicSignup(pendingData) };
};

const getPendingSignup = async (token) => publicSignup(await getPending(token));

const sendVerificationOtp = async (token) => {
  const pending = await getPending(token, true);
  const now = new Date(Date.now());
  if (pending.lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS > now.getTime()) throw cooldownError(pending.lastSentAt);
  const otp = generateOtp();
  const update = { otpHash: hashVerificationOtp(pending.tokenHash, pending.email, otp), otpExpiresAt: new Date(Math.min(now.getTime() + OTP_TTL_MS, pending.expiresAt.getTime())), attempts: 0, lastSentAt: now };
  const previous = await PendingSignup.findOneAndUpdate(
    { tokenHash: pending.tokenHash, expiresAt: { $gt: now }, lastSentAt: { $lte: new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS) } },
    { $set: update }, { returnDocument: "before", runValidators: true },
  ).select(PRIVATE_FIELDS);
  if (!previous) {
    const current = await getPending(token);
    throw cooldownError(current.lastSentAt);
  }
  if (!(await deliverOtp(pending, otp))) {
    try {
      await PendingSignup.updateOne({ tokenHash: pending.tokenHash, otpHash: update.otpHash, lastSentAt: now }, { $set: { otpHash: previous.otpHash, otpExpiresAt: previous.otpExpiresAt, attempts: previous.attempts, lastSentAt: previous.lastSentAt } });
    } catch { console.error("Could not restore pending signup after resend failed"); }
    throw new EmailVerificationError("Could not send a new code. Please try again.", 503, "VERIFICATION_EMAIL_FAILED");
  }
  return publicSignup({ ...pending.toObject(), ...update });
};

const verifyEmailOtp = async (token, otp) => {
  const pending = await getPending(token, true);
  const expectedHash = hashVerificationOtp(pending.tokenHash, pending.email, otp);
  const now = new Date(Date.now());
  const challenge = await PendingSignup.findOneAndUpdate(
    { tokenHash: pending.tokenHash, expiresAt: { $gt: now }, otpExpiresAt: { $gt: now }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } }, { returnDocument: "after", runValidators: true },
  ).select(PRIVATE_FIELDS);
  if (!challenge) {
    const current = await getPending(token);
    if (current.otpExpiresAt.getTime() <= Date.now()) throw new EmailVerificationError("This code expired. Request a new one.", 400, "OTP_EXPIRED");
    throw new EmailVerificationError("Too many incorrect attempts. Request a new code.", 429, "OTP_ATTEMPTS_EXCEEDED");
  }
  const stored = Buffer.from(challenge.otpHash, "hex");
  const submitted = Buffer.from(expectedHash, "hex");
  if (stored.length !== submitted.length || !crypto.timingSafeEqual(stored, submitted)) {
    const attemptsRemaining = OTP_MAX_ATTEMPTS - challenge.attempts;
    throw Object.assign(new EmailVerificationError(attemptsRemaining ? "Incorrect verification code" : "Too many incorrect attempts. Request a new code.", attemptsRemaining ? 400 : 429, attemptsRemaining ? "OTP_INCORRECT" : "OTP_ATTEMPTS_EXCEEDED"), { attemptsRemaining });
  }
  const verifiedAt = new Date(Date.now());
  const consumed = await PendingSignup.findOneAndDelete({ tokenHash: pending.tokenHash, otpHash: challenge.otpHash, lastSentAt: challenge.lastSentAt, expiresAt: { $gt: verifiedAt }, otpExpiresAt: { $gt: verifiedAt } }).select(PRIVATE_FIELDS);
  if (!consumed) throw new EmailVerificationError("This code was already used or replaced. Use the latest code or log in.", 409, "OTP_NOT_CURRENT");
  try {
    // Use only the verified snapshot. No client-supplied account details are accepted here.
    return await User.create({ name: consumed.name, email: consumed.email, passwordHash: consumed.passwordHash, dateOfBirth: consumed.dateOfBirth, isEmailVerified: true, emailVerifiedAt: verifiedAt });
  } catch (error) {
    if (error.code === 11000) throw new EmailVerificationError("An account with this email already exists. Please log in.", 409, "EMAIL_IN_USE");
    throw error;
  }
};

module.exports = { beginSignup, getPendingSignup, sendVerificationOtp, verifyEmailOtp, hashVerificationOtp, hashSignupToken, EmailVerificationError, OTP_TTL_MS, SIGNUP_TTL_MS, OTP_RESEND_COOLDOWN_MS, OTP_MAX_ATTEMPTS };
