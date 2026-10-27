const { getPendingSignup, sendVerificationOtp, verifyEmailOtp } = require("../services/email-verification.service");
const { createSession } = require("../services/session.service");
const { setAuthCookies, clearPendingSignupCookie } = require("./auth.controller");
const { verifyEmailSchema, resendVerificationSchema } = require("../validators/email-verification.validators");
const respondToError = require("../utils/verification-response");
const publicAuthUser = require("../utils/auth-user");

const pendingSignup = async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    return res.status(200).json({ success: true, signup: await getPendingSignup(req.cookies?.pendingSignup) });
  } catch (error) {
    if (error.code === "SIGNUP_EXPIRED") clearPendingSignupCookie(res);
    return respondToError(res, error);
  }
};

const verifyEmail = async (req, res) => {
  const result = verifyEmailSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ success: false, message: "Enter a 6-digit verification code", code: "INVALID_VERIFICATION_INPUT" });
  let user;
  try {
    user = await verifyEmailOtp(req.cookies?.pendingSignup, result.data.otp);
  } catch (error) {
    if (error.code === "SIGNUP_EXPIRED") clearPendingSignupCookie(res);
    return respondToError(res, error);
  }
  clearPendingSignupCookie(res);
  try {
    const tokens = await createSession(user._id, user.sessionVersion ?? 0);
    if (!tokens) throw new Error("Session could not be created");
    setAuthCookies(res, tokens);
    return res.status(201).json({ success: true, message: "Email verified and account created successfully", user: publicAuthUser(user) });
  } catch {
    return res.status(503).json({ success: false, code: "SIGNUP_LOGIN_FAILED", message: "Your email is verified and your account was created. Please log in to continue." });
  }
};

const resendVerification = async (req, res) => {
  const result = resendVerificationSchema.safeParse(req.body ?? {});
  if (!result.success) return res.status(400).json({ success: false, message: "This endpoint does not accept account details", code: "INVALID_VERIFICATION_INPUT" });
  try {
    return res.status(200).json({ success: true, message: "Verification code sent. Check your email.", signup: await sendVerificationOtp(req.cookies?.pendingSignup) });
  } catch (error) {
    if (error.code === "SIGNUP_EXPIRED") clearPendingSignupCookie(res);
    return respondToError(res, error);
  }
};

module.exports = { pendingSignup, verifyEmail, resendVerification };
