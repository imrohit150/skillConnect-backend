const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    razorpaySubscriptionId: {
      type: String,
      required: true,
      unique: true,
    },
    planId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "created",
        "authenticated",
        "active",
        "pending",
        "halted",
        "cancelled",
        "completed",
        "expired",
        "paused",
      ],
      default: "created",
    },
    currentPeriodEnd: {
      type: Date,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
