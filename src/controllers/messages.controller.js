const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const {
  conversationIdParamSchema,
  messageHistoryQuerySchema,
} = require("../validators/message.validators");

const getMessages = async (req, res) => {
  const params = conversationIdParamSchema.safeParse(req.params);
  const query = messageHistoryQuerySchema.safeParse(req.query);

  if (!params.success || !query.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request parameters",
    });
  }

  const { conversationId } = params.data;
  const { before, beforeId, limit } = query.data;

  try {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      $or: [{ participantOne: req.user }, { participantTwo: req.user }],
    }).select("_id");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const filter = { conversationId };
    if (before) {
      const timestamp = new Date(before);
      if (beforeId) {
        filter.$or = [
          { createdAt: { $lt: timestamp } },
          { createdAt: timestamp, _id: { $lt: beforeId } },
        ];
      } else {
        filter.createdAt = { $lt: timestamp };
      }
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const oldest = page.at(-1);

    return res.status(200).json({
      success: true,
      messages: page.reverse(),
      hasMore,
      nextCursor: hasMore && oldest ? {
        before: oldest.createdAt.toISOString(),
        beforeId: oldest._id.toString(),
      } : null,
    });
  } catch (error) {
    console.error("Get messages failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch messages",
    });
  }
};

module.exports = { getMessages };
