const mongoose = require("mongoose");
const User = require("../models/user.model");
const { withPremiumStatus } = require("../utils/premium-status");

const { isConfigured, uploadAvatar } = require("../services/cloudinary.service");
const { profileUpdateSchema } = require("../validators/profile.validators");

const profileFields =
  "name email bio skills profileImageUrl premiumStatus premiumUntil interests experienceLevel socialLinks";

const publicProfileFields =
  "name bio skills profileImageUrl premiumStatus premiumUntil interests experienceLevel socialLinks";

const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user).select(profileFields);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: withPremiumStatus(user),
    });
  } catch (error) {
    console.error("Error fetching user profile:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateMyProfile = async (req, res) => {
  const result = profileUpdateSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid profile data",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const updates = { ...result.data };
    if (updates.socialLinks) {
      const socialLinks = updates.socialLinks;
      delete updates.socialLinks;

      for (const [key, value] of Object.entries(socialLinks)) {
        updates[`socialLinks.${key}`] = value;
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user,
      { $set: updates },
      { returnDocument: "after", runValidators: true },
    ).select(profileFields);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: withPremiumStatus(user),
    });
  } catch (error) {
    console.error("Error updating user profile:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const uploadProfileImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Image file is required",
    });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      success: false,
      message: "Image upload is not configured",
    });
  }

  try {
    const uploaded = await uploadAvatar(req.file.buffer, req.user);

    const user = await User.findByIdAndUpdate(
      req.user,
      { $set: { profileImageUrl: uploaded.secure_url } },
      { returnDocument: "after", runValidators: true },
    ).select(profileFields);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile image updated successfully",
      user: withPremiumStatus(user),
    });
  } catch (error) {
    console.error("Error uploading profile image:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getPublicProfile = async (req, res) => {
  const userId = req.params.userId;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID",
    });
  }

  try {
    const user = await User.findById(userId).select(publicProfileFields);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: withPremiumStatus(user),
    });
  } catch (error) {
    console.error("Error fetching public user profile:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
  uploadProfileImage,
};
