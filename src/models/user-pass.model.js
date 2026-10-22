const mongoose = require("mongoose");

const userPassSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    passedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

userPassSchema.index({ userId: 1, passedUserId: 1 }, { unique: true });

module.exports = mongoose.model("UserPass", userPassSchema);
