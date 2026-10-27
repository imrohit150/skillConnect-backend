const { forgotPasswordSchema, resetPasswordSchema } = require("../validators/password-reset.validators");
const service = require("../services/password-reset.service");
const { clearAuthCookies, clearPendingSignupCookie } = require("./auth.controller");

const forgotPassword = (req, res) => {
  res.set("Cache-Control", "no-store");
  const result = forgotPasswordSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ success: false, code: "INVALID_RESET_INPUT", message: "Enter a valid email address." });
  // Email delivery runs after the identical response, avoiding account-existence timing leaks.
  setImmediate(() => {
    service.requestPasswordReset(result.data.email).catch(() => console.error("Password reset request could not be processed"));
  });
  return res.status(200).json({ success: true, message: "If an account exists for that email, we'll send a password reset link. Please check your inbox and spam folder." });
};

const resetPassword = async (req, res) => {
  res.set("Cache-Control", "no-store");
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ success: false, code: "INVALID_RESET_INPUT", message: "Enter a valid reset link and a password with at least 8 characters (up to 72 UTF-8 bytes)." });
  try {
    const user = await service.resetPassword(result.data.token, result.data.newPassword);
    clearAuthCookies(res); clearPendingSignupCookie(res);
    try { req.app.get("io")?.in(`user:${user._id}`).disconnectSockets(true); }
    catch { console.error("Could not disconnect chat after password reset"); }
    setImmediate(() => { service.notifyPasswordReset(user.email).catch(() => console.error("Password reset notification could not be sent")); });
    return res.status(200).json({ success: true, message: "Password updated. Please log in with your new password." });
  } catch (error) {
    if (error instanceof service.PasswordResetError) return res.status(400).json({ success: false, code: error.code, message: error.message });
    console.error("Password reset failed:", error.name);
    return res.status(500).json({ success: false, message: "Could not update your password. Please try again." });
  }
};

module.exports = { forgotPassword, resetPassword };
