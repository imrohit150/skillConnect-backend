const mongoose = require("mongoose");

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 30,
    },
  },
  { versionKey: false },
);

module.exports = mongoose.model("WebhookEvent", webhookEventSchema);
