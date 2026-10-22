const express = require("express");

const {getMyProfile, updateMyProfile, getPublicProfile} = require("../controllers/profile.controller");
const authenticate = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/profile/me", authenticate, getMyProfile);
router.get("/profile/:userId", authenticate, getPublicProfile);
router.patch("/profile/me", authenticate, updateMyProfile);

module.exports = router;