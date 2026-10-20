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
    passwordHash: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    profileImageUrl: {
      type: String,
      default: "https://pixabay.com/images/download/wanderercreative-blank-profile-picture-973460_1920.png",
    },
    bio: {
      type: String,
      default: "",
    },
    skills: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

module.exports = User;
