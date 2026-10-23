const express = require("express");
const {
  sendConnectionRequest,
  skipUser,
  getSentRequests,
  getReceivedRequests,
  getPassedUsers,
  acceptRequest,
  ignoreRequest,
  cancelRequest,
  removeConnection,
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

router.patch(
  "/connections/requests/:requestId/accept",
  authenticate,
  acceptRequest,
);
router.patch(
  "/connections/requests/:requestId/ignore",
  authenticate,
  ignoreRequest,
);
router.patch(
  "/connections/requests/:requestId/cancel",
  authenticate,
  cancelRequest,
);
router.delete("/connections/:userId", authenticate, removeConnection);

module.exports = router;
