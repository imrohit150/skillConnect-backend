const express = require("express");
const { authLimiter } = require("../middleware/rate-limit.middleware");

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

module.exports = router;
