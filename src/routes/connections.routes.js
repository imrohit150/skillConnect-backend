const express = require("express");
const {
  sendConnectionRequest,
  skipUser,
  getSentRequests,
  getReceivedRequests,
  getPassedUsers,
} = require("../controllers/connections.controller");
const authenticate = require("../middleware/auth.middleware");

const router = express.Router();

router.post(
  "/connections/:userId/request",
  authenticate,
  sendConnectionRequest,
);
router.post("/users/:userId/pass", authenticate, skipUser);

router.get("/connections/requests/sent", authenticate, getSentRequests);
router.get("/connections/requests/received", authenticate, getReceivedRequests);
router.get("/users/passed", authenticate, getPassedUsers);

module.exports = router;
