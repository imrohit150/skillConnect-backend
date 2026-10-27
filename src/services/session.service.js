const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const RefreshSession = require("../models/refresh-session.model");
const User = require("../models/user.model");

const createSession = async (userId, expectedVersion) => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error(
      "Access or Refresh token secret is not defined in environment variables",
    );
  }

  const user = await User.findById(userId).select("+sessionVersion");
  if (!user || (expectedVersion !== undefined && expectedVersion !== (user.sessionVersion ?? 0))) return null;
  const sessionVersion = user.sessionVersion ?? 0;

  const accessToken = jwt.sign({ sub: userId.toString(), ver: sessionVersion }, accessSecret, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
  });

  const refreshToken = jwt.sign({ sub: userId.toString(), ver: sessionVersion }, refreshSecret, {
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
    sessionVersion,
    expiresAt: new Date(decodedToken.exp * 1000),
  });

  return { accessToken, refreshToken };
};

const rotateSession = async (refreshToken) => {
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

  if (!refreshSecret) {
    throw new Error(
      "Refresh token secret is not defined in environment variables",
    );
  }

  let payload;

  try {
    payload = jwt.verify(refreshToken, refreshSecret);
  } catch (error) {
    if (
      ["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"].includes(
        error.name,
      )
    ) {
      return null;
    }

    throw error;
  }

  if (typeof payload === "string" || !payload.sub) {
    return null;
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const activeSession = await RefreshSession.findOneAndUpdate(
    {
      userId: payload.sub,
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { revokedAt: new Date() } },
  );

  if (!activeSession) {
    return null;
  }

  return createSession(payload.sub, payload.ver ?? 0);
};

const revokeSession = async (refreshToken) => {
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

  if (!refreshSecret) {
    throw new Error(
      "Refresh token secret is not defined in environment variables",
    );
  }

  let payload;

  try {
    payload = jwt.verify(refreshToken, refreshSecret);
  } catch (error) {
    if (
      ["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"].includes(
        error.name,
      )
    ) {
      return null;
    }

    throw error;
  }

  if (typeof payload === "string" || !payload.sub) {
    return false;
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await RefreshSession.findOneAndUpdate(
    {
      userId: payload.sub,
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { revokedAt: new Date() } },
  );

  return Boolean(session);
};

module.exports = {
  createSession,
  rotateSession,
  revokeSession
};
