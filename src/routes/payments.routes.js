const express = require("express");
const {
  createSubscription,
  verifyPayment,
  getMySubscription,
} = require("../controllers/payments.controller");
const authenticate = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/payments/subscription", authenticate, createSubscription);
router.post("/payments/verify", authenticate, verifyPayment);
router.get("/payments/subscription/me", authenticate, getMySubscription);

module.exports = router;
