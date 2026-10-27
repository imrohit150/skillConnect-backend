const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const { signupSchema, loginSchema } = require("../validators/auth.validators");
const { beginSignup, SIGNUP_TTL_MS } = require("../services/email-verification.service");
const respondToVerificationError = require("../utils/verification-response");
const publicAuthUser = require("../utils/auth-user");
const { withPremiumStatus } = require("../utils/premium-status");
const {
  createSession,
  rotateSession,
  revokeSession,
} = require("../services/session.service");

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieSettings = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  };

  res.cookie("accessToken", accessToken, {
    ...cookieSettings,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieSettings,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookies = (res) => {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieSettings = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  };

  res.clearCookie("accessToken", cookieSettings);
  res.clearCookie("refreshToken", cookieSettings);
};

const pendingCookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", path: "/api/v1/auth" });
const clearPendingSignupCookie = (res) => res.clearCookie("pendingSignup", pendingCookieOptions());

const signup = async (req, res) => {
  const result = signupSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid input data",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const { token, signup } = await beginSignup(result.data);
    res.cookie("pendingSignup", token, { ...pendingCookieOptions(), maxAge: SIGNUP_TTL_MS });
    return res.status(202).json({ success: true, message: "Check your email to finish signing up. Your account has not been created yet.", signup });
  } catch (error) {
    return respondToVerificationError(res, error);
  }
};

const login = async (req, res) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid input data",
    });
  }

  const { email, password } = result.data;

  try {
    const user = await User.findOne({ email }).select("+sessionVersion");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.isEmailVerified !== true) return res.status(403).json({ success: false, code: "EMAIL_NOT_VERIFIED", message: "Your email must be verified during signup before you can log in." });

    const tokens = await createSession(user._id, user.sessionVersion ?? 0);
    if (!tokens) return res.status(401).json({ success: false, message: "Your credentials changed. Please log in again." });
    setAuthCookies(res, tokens);
    clearPendingSignupCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: publicAuthUser(user),
    });
  } catch (error) {
    console.error("Error during login:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const refresh = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    clearAuthCookies(res);
    return res.status(401).json({
      success: false,
      message: "Refresh token is missing",
    });
  }

  try {
    const tokens = await rotateSession(refreshToken);

    if (!tokens) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    setAuthCookies(res, tokens);

    return res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully",
    });
  } catch (error) {
    console.error("Error during token refresh:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const logout = async (req, res) => {
  clearPendingSignupCookie(res);
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await revokeSession(refreshToken);
    }

    clearAuthCookies(res);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Error during logout:", error.message);
    clearAuthCookies(res);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const me = async (req, res) => {
  try {
    const userId = req.user;
    const user = await User.findById(userId).select(
      "name email bio skills profileImageUrl premiumStatus premiumUntil isEmailVerified emailVerifiedAt",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists",
      });
    }

    return res.status(200).json({
      success: true,
      user: withPremiumStatus(user),
    });

  } catch (error) {
    console.error("Error fetching user data:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  setAuthCookies,
  clearAuthCookies,
  clearPendingSignupCookie,
  signup,
  login,
  refresh,
  logout,
  me,
};
