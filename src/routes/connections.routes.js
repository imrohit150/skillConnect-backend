const express = require("express");
const {
  sendConnectionRequest,
  skipUser,
} = require("../controllers/connections.controller");
const authenticate = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/connections/:userId/request", authenticate, sendConnectionRequest);
router.post("/users/:userId/pass", authenticate, skipUser);

module.exports = router;