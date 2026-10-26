const express = require("express");

const {getMyProfile, updateMyProfile, getPublicProfile, uploadProfileImage} = require("../controllers/profile.controller");
const authenticate = require("../middleware/auth.middleware");
const uploadImage = require("../middleware/upload.middleware");

const router = express.Router();

router.post("/profile/me/image", authenticate, uploadImage, uploadProfileImage);
router.get("/profile/me", authenticate, getMyProfile);
router.get("/profile/:userId", authenticate, getPublicProfile);
router.patch("/profile/me", authenticate, updateMyProfile);

module.exports = router;