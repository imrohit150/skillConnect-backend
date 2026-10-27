const express = require("express");
const {
  createSubscription,
  verifyPayment,
  getMySubscription,
} = require("../controllers/payments.controller");
const authenticate = require("../middleware/auth.middleware");

const requireVerifiedEmail = require("../middleware/verified-email.middleware");
const router = express.Router();

router.post("/payments/subscription", authenticate, requireVerifiedEmail, createSubscription);
router.post("/payments/verify", authenticate, requireVerifiedEmail, verifyPayment);
router.get("/payments/subscription/me", authenticate, requireVerifiedEmail, getMySubscription);

module.exports = router;
