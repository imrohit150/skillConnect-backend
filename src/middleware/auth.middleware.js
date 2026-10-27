const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const authenticate = async (req, res, next) => {
  const accesToken = req.cookies?.accessToken;

  if (!accesToken) {
    return res.status(401).json({
      success: false,
      message: "Access token is missing",
    });
  }

  const accessSecret = process.env.ACCESS_TOKEN_SECRET;

  if (!accessSecret) {
    console.error(
      "Access token secret is not defined in environment variables",
    );
    return res.status(500).json({
      success: false,
      message: "Access token secret is not defined in environment variables",
    });
  }

  try {
    const payload = jwt.verify(accesToken, accessSecret);

    if (typeof payload === "string" || !payload.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid access token",
      });
    }
    const user = await User.findById(payload.sub).select("isEmailVerified +sessionVersion");
    if (!user || (payload.ver ?? 0) !== (user.sessionVersion ?? 0)) {
      return res.status(401).json({ success: false, message: "Your session expired. Please log in again." });
    }
    req.authUser = user;
    req.user = payload.sub;
    next();
  } catch (error) {
    if (["TokenExpiredError", "JsonWebTokenError"].includes(error.name)) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }

    console.error("Authentication failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to authenticate request",
    });
  }
};

module.exports = authenticate;
