const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again later.",
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const emailVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    // Include the delay in JSON because cross-origin clients cannot always read Retry-After.
    const retryAfter = Math.max(1, Math.ceil(((req.rateLimit.resetTime?.getTime() ?? Date.now() + 15 * 60 * 1000) - Date.now()) / 1000));
    res.status(429).json({ success: false, code: "VERIFICATION_RATE_LIMIT", message: "Too many verification requests. Please try again later.", retryAfter });
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.max(1, Math.ceil(((req.rateLimit.resetTime?.getTime() ?? Date.now() + 15 * 60 * 1000) - Date.now()) / 1000));
    res.status(429).json({ success: false, code: "PASSWORD_RESET_RATE_LIMIT", message: "Too many password reset attempts. Please try again later.", retryAfter });
  },
});

module.exports = { authLimiter, apiLimiter, emailVerificationLimiter, passwordResetLimiter };
