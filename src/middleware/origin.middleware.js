const { isTrustedRequestOrigin } = require("../utils/request-origin");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const protectApiOrigin = (req, res, next) => {
  if (SAFE_METHODS.has(req.method) || isTrustedRequestOrigin(req)) return next();

  return res.status(403).json({
    success: false,
    code: "ORIGIN_NOT_ALLOWED",
    message: "Request origin is not allowed",
  });
};

module.exports = protectApiOrigin;
