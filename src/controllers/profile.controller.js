const User = require("../models/user.model");

const { profileUpdateSchema } = require("../validators/profile.validators");

const profileFields =
  "name email bio skills profileImageUrl premiumStatus interests experienceLevel socialLinks";

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
      user: user,
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
      { new: true, runValidators: true },
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
      user: user,
    });
  } catch (error) {
    console.error("Error updating user profile:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
};
