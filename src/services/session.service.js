const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const RefreshSession = require("../models/refresh-session.model");

const createSession = async (userId) => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error(
      "Access or Refresh token secret is not defined in environment variables",
    );
  }

  const accessToken = jwt.sign({ sub: userId.toString() }, accessSecret, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
  });

  const refreshToken = jwt.sign({ sub: userId.toString() }, refreshSecret, {
    expiresIn: process.env.REFRESH_TOKEN_TTL || "7d",
    jwtid: crypto.randomUUID(),
  });

  const decodedToken = jwt.decode(refreshToken);

  if (!decodedToken || typeof decodedToken === "string" || !decodedToken.exp) {
    throw new Error("Could not determine refresh token expiration");
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  await RefreshSession.create({
    userId,
    tokenHash,
    expiresAt: new Date(decodedToken.exp * 1000),
  });

  return { accessToken, refreshToken };
};

module.exports = {
  createSession,
};
