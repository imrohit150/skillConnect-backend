const express = require("express");
const {
  getOrCreateConversation,
  getConversations,
} = require("../controllers/conversations.controller");
const { getMessages } = require("../controllers/messages.controller");
const authenticate = require("../middleware/auth.middleware");
const router = express.Router();

router.post("/conversations/:userId", authenticate, getOrCreateConversation);
router.get("/conversations/:conversationId/messages", authenticate, getMessages);
router.get("/conversations", authenticate, getConversations);

module.exports = router;
