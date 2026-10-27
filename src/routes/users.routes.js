const express = require("express");
const { searchUsers } = require("../controllers/users.controller");
const authenticate = require("../middleware/auth.middleware");

const requireVerifiedEmail = require("../middleware/verified-email.middleware");
const router = express.Router();

router.get("/users", authenticate, requireVerifiedEmail, searchUsers);

module.exports = router;