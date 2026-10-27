const express = require("express");
const {
  sendConnectionRequest,
  skipUser,
  unpassUser,
  getSentRequests,
  getReceivedRequests,
  getPassedUsers,
  acceptRequest,
  ignoreRequest,
  cancelRequest,
  removeConnection,
  getConnections,
} = require("../controllers/connections.controller");
const authenticate = require("../middleware/auth.middleware");

const requireVerifiedEmail = require("../middleware/verified-email.middleware");
const router = express.Router();

router.post(
  "/connections/:userId/request",
  authenticate, requireVerifiedEmail,
  sendConnectionRequest,
);
router.post("/users/:userId/pass", authenticate, requireVerifiedEmail, skipUser);
router.delete("/users/:userId/pass", authenticate, requireVerifiedEmail, unpassUser);

router.get("/connections/requests/sent", authenticate, requireVerifiedEmail, getSentRequests);
router.get("/connections/requests/received", authenticate, requireVerifiedEmail, getReceivedRequests);
router.get("/users/passed", authenticate, requireVerifiedEmail, getPassedUsers);

router.patch(
  "/connections/requests/:requestId/accept",
  authenticate, requireVerifiedEmail,
  acceptRequest,
);
router.patch(
  "/connections/requests/:requestId/ignore",
  authenticate, requireVerifiedEmail,
  ignoreRequest,
);
router.patch(
  "/connections/requests/:requestId/cancel",
  authenticate, requireVerifiedEmail,
  cancelRequest,
);
router.delete("/connections/:userId", authenticate, requireVerifiedEmail, removeConnection);
router.get("/connections", authenticate, requireVerifiedEmail, getConnections);

module.exports = router;
