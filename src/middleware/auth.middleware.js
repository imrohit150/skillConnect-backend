const jwt = require("jsonwebtoken");

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