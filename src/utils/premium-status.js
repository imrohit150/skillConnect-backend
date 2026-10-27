// The stored flag alone is not enough: a badge also needs a valid, future expiry.
const hasActivePremium = (user, now = Date.now()) => {
  if (user?.premiumStatus !== true || !user.premiumUntil) return false;
  const expiresAt = new Date(user.premiumUntil).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
};

// Call with an already-selected profile. Keep its existing response fields while
// calculating the badge status, without changing the document or exposing expiry.
const withPremiumStatus = (user, now = Date.now()) => {
  if (!user) return user;
  const profile = typeof user.toObject === "function" ? user.toObject() : { ...user };
  const premiumStatus = hasActivePremium(profile, now);
  delete profile.premiumUntil;
  return { ...profile, premiumStatus };
};

module.exports = { hasActivePremium, withPremiumStatus };
