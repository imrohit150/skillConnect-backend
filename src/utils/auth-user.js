const { hasActivePremium } = require("./premium-status");

module.exports = (user) => ({
  id: user._id, name: user.name, email: user.email, bio: user.bio,
  skills: user.skills, profileImageUrl: user.profileImageUrl, premiumStatus: hasActivePremium(user),
  isEmailVerified: user.isEmailVerified, emailVerifiedAt: user.emailVerifiedAt,
});
