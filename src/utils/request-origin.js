const getClientOrigin = () =>
  new URL(process.env.CLIENT_URL || "http://localhost:3000").origin;

const isTrustedRequestOrigin = (req) => {
  const clientOrigin = getClientOrigin();
  const origin = req.headers.origin;

  // An explicit untrusted or opaque ("null") Origin must never fall back.
  if (origin !== undefined) return origin === clientOrigin;

  // Same-origin GET/polling requests do not always include an Origin header.
  const referer = req.headers.referer;
  if (referer !== undefined) {
    if (typeof referer !== "string" || !URL.canParse(referer)) return false;
    return new URL(referer).origin === clientOrigin;
  }

  // Browsers control Fetch Metadata; never infer trust from Host/forwarded Host.
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite !== undefined) return fetchSite === "same-origin";

  // Retain local Postman/Node-client workflows. Production fails closed.
  return process.env.NODE_ENV !== "production";
};

module.exports = { getClientOrigin, isTrustedRequestOrigin };
