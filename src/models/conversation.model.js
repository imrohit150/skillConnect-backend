const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participantOne: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participantTwo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

conversationSchema.index(
  { participantOne: 1, participantTwo: 1 },
  { unique: true },
);

module.exports = mongoose.model("Conversation", conversationSchema);
