const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    // Only trusted seed scripts set this; public signup/profile input cannot set it.
    demoSeed: { type: String, select: false, immutable: true },
    passwordHash: {
      type: String,
      required: true,
    },
    sessionVersion: { type: Number, default: 0, min: 0, select: false },
    passwordResetTokenHash: { type: String, select: false, index: { sparse: true } },
    passwordResetExpiresAt: { type: Date, select: false },
    passwordResetLastSentAt: { type: Date, select: false },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    profileImageUrl: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    skills: {
      type: [String],
      default: [],
    },
    premiumStatus: {
      type: Boolean,
      default: false,
    },
    premiumUntil: {
      type: Date,
    },
    interests: {
      type: [String],
      default: [],
    },
    experienceLevel: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },
    socialLinks: {
      github: {
        type: String,
        default: "",
      },
      linkedin: {
        type: String,
        default: "",
      },
      portfolio: {
        type: String,
        default: "",
      },
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

module.exports = User;
