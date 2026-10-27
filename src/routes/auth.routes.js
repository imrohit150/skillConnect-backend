const express = require("express");
const { authLimiter, emailVerificationLimiter } = require("../middleware/rate-limit.middleware");
const { pendingSignup, verifyEmail, resendVerification } = require("../controllers/email-verification.controller");

const {
  signup,
  login,
  refresh,
  logout,
  me,
} = require("../controllers/auth.controller");
const authenticate = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/auth/signup",authLimiter, signup);
router.post("/auth/login", authLimiter, login);
router.post("/auth/refresh", refresh);
router.post("/auth/logout", logout);
router.get("/auth/me", authenticate, me);
router.get("/auth/signup/pending", emailVerificationLimiter, pendingSignup);
router.post("/auth/email-verification/verify", emailVerificationLimiter, verifyEmail);
router.post("/auth/email-verification/resend", emailVerificationLimiter, resendVerification);

module.exports = router;
