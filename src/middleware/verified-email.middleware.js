const User = require("../models/user.model");

// Runs after cookie authentication. Verification endpoints stay accessible to pending accounts.
const requireVerifiedEmail = async (req, res, next) => {
  try {
    const user = await User.findById(req.user).select("isEmailVerified");
    if (!user) return res.status(401).json({ success: false, message: "User account no longer exists" });
    if (user.isEmailVerified !== true) {
      return res.status(403).json({ success: false, code: "EMAIL_NOT_VERIFIED", message: "Verify your email address to continue." });
    }
    next();
  } catch {
    return res.status(500).json({ success: false, message: "Unable to check email verification. Please try again." });
  }
};

module.exports = requireVerifiedEmail;
