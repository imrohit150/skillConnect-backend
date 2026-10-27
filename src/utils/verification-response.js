const { EmailVerificationError } = require("../services/email-verification.service");

module.exports = (res, error) => {
  if (!(error instanceof EmailVerificationError)) {
    console.error("Email verification request failed:", error.name);
    return res.status(500).json({ success: false, message: "Unable to finish signup. Please try again or log in if your email was already verified." });
  }
  if (error.retryAfter !== undefined) res.set("Retry-After", String(error.retryAfter));
  return res.status(error.status).json({ success: false, message: error.message, code: error.code,
    ...(error.retryAfter !== undefined ? { retryAfter: error.retryAfter } : {}),
    ...(error.attemptsRemaining !== undefined ? { attemptsRemaining: error.attemptsRemaining } : {}),
  });
};
