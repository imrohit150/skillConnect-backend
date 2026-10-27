const express = require("express");
const {
  getOrCreateConversation,
  getConversations,
} = require("../controllers/conversations.controller");
const { getMessages } = require("../controllers/messages.controller");
const authenticate = require("../middleware/auth.middleware");
const requireVerifiedEmail = require("../middleware/verified-email.middleware");
const router = express.Router();

router.post("/conversations/:userId", authenticate, requireVerifiedEmail, getOrCreateConversation);
router.get("/conversations/:conversationId/messages", authenticate, requireVerifiedEmail, getMessages);
router.get("/conversations", authenticate, requireVerifiedEmail, getConversations);

module.exports = router;
