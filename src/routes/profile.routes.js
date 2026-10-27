const express = require("express");

const {getMyProfile, updateMyProfile, getPublicProfile, uploadProfileImage} = require("../controllers/profile.controller");
const authenticate = require("../middleware/auth.middleware");
const uploadImage = require("../middleware/upload.middleware");

const requireVerifiedEmail = require("../middleware/verified-email.middleware");
const router = express.Router();

router.post("/profile/me/image", authenticate, requireVerifiedEmail, uploadImage, uploadProfileImage);
router.get("/profile/me", authenticate, requireVerifiedEmail, getMyProfile);
router.get("/profile/:userId", authenticate, requireVerifiedEmail, getPublicProfile);
router.patch("/profile/me", authenticate, requireVerifiedEmail, updateMyProfile);

module.exports = router;