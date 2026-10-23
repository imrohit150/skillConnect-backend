const mongoose = require("mongoose");

const connectionRequestSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true },
);

connectionRequestSchema.index(
  {
    senderId: 1,
    recipientId: 1,
  },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);

connectionRequestSchema.index({ recipientId: 1, status: 1 });
connectionRequestSchema.index({ senderId: 1, status: 1 });

module.exports = mongoose.model("ConnectionRequest", connectionRequestSchema);
