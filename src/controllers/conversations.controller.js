const Conversation = require("../models/conversation.model");
const ConnectionRequest = require("../models/connection-request.model");
const { userIdParamSchema } = require("../validators/connection.validators");
const Message = require("../models/message.model");
const { withPremiumStatus } = require("../utils/premium-status");

const publicUserFields = "name profileImageUrl premiumStatus premiumUntil";

const getOrCreateConversation = async (req, res) => {
  const result = userIdParamSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID",
    });
  }

  const otherUserId = result.data.userId;

  if (otherUserId === req.user) {
    return res.status(400).json({
      success: false,
      message: "You cannot start a conversation with yourself",
    });
  }

  try {
    const connection = await ConnectionRequest.findOne({
      status: "accepted",
      $or: [
        { senderId: req.user, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: req.user },
      ],
    });

    if (!connection) {
      return res.status(403).json({
        success: false,
        message: "You can only chat with your connections",
      });
    }

    const [participantOne, participantTwo] = [req.user, otherUserId].sort();

    const conversation = await Conversation.findOneAndUpdate(
      { participantOne, participantTwo },
      { $setOnInsert: { participantOne, participantTwo } },
      { returnDocument: "after", upsert: true },
    );

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Get or create conversation failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to open conversation",
    });
  }
};

const getConversations = async (req, res) => {
  try {
    const connections = await ConnectionRequest.find({
      status: "accepted",
      $or: [{ senderId: req.user }, { recipientId: req.user }],
    }).select("senderId recipientId");
    const connectedUsers = new Set(connections.map((connection) =>
      connection.senderId.toString() === req.user
        ? connection.recipientId.toString()
        : connection.senderId.toString(),
    ));
    const conversations = await Conversation.find({
      $or: [{ participantOne: req.user }, { participantTwo: req.user }],
    })
      .populate("participantOne", publicUserFields)
      .populate("participantTwo", publicUserFields);

    const inbox = await Promise.all(
      conversations.filter((conversation) => conversation.participantOne && conversation.participantTwo).map(async (conversation) => {
        const loggedInUserIsOne =
          conversation.participantOne._id.toString() === req.user;

        const lastMessage = await Message.findOne({
          conversationId: conversation._id,
        }).sort({ createdAt: -1, _id: -1 });

        return {
          conversationId: conversation._id,
          user: withPremiumStatus(loggedInUserIsOne
            ? conversation.participantTwo
            : conversation.participantOne),
          lastMessage,
          canMessage: connectedUsers.has((loggedInUserIsOne ? conversation.participantTwo : conversation.participantOne)._id.toString()),
          lastActivityAt: lastMessage
            ? lastMessage.createdAt
            : conversation.createdAt,
        };
      }),
    );

    inbox.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

    return res.status(200).json({ success: true, conversations: inbox });
  } catch (error) {
    console.error("Get conversations failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch conversations",
    });
  }
};

module.exports = { getOrCreateConversation, getConversations };
