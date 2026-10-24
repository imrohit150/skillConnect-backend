const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { parseCookie } = require("cookie");

const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const ConnectionRequest = require("../models/connection-request.model");
const {
  joinConversationSchema,
  sendMessageSchema,
} = require("../validators/message.validators");

const MESSAGE_LIMIT = 10;
const MESSAGE_WINDOW_MS = 10 * 1000;

const createRateLimiter = (limit, windowMs) => {
  let timestamps = [];

  return () => {
    const now = Date.now();
    timestamps = timestamps.filter((time) => now - time < windowMs);

    if (timestamps.length >= limit) {
      return false;
    }

    timestamps.push(now);
    return true;
  };
};

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie || "");
      const token = cookies.accessToken;
      if (!token) {
        return next(new Error("Authentication error"));
      }
      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.userId = payload.sub;
      next();
    } catch (err) {
      console.error("Socket auth failed:", err.message);
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.userId}`);

    const canSendMessage = createRateLimiter(
      MESSAGE_LIMIT,
      MESSAGE_WINDOW_MS,
    );
    const canJoinConversation = createRateLimiter(20, 10 * 1000);

    socket.on("conversation:join", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};

      if (!canJoinConversation()) {
        return reply({ success: false, message: "Too many requests" });
      }

      const result = joinConversationSchema.safeParse(payload);

      if (!result.success) {
        return reply({ success: false, message: "Invalid conversation ID" });
      }

      try {
        const conversation = await Conversation.findOne({
          _id: result.data.conversationId,
          $or: [
            { participantOne: socket.userId },
            { participantTwo: socket.userId },
          ],
        }).select("_id");

        if (!conversation) {
          return reply({ success: false, message: "Conversation not found" });
        }

        socket.join(`conversation:${conversation._id}`);
        return reply({ success: true });
      } catch (error) {
        console.error("Join conversation failed:", error.message);
        return reply({
          success: false,
          message: "Unable to join conversation",
        });
      }
    });

    socket.on("message:send", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};

      if (!canSendMessage()) {
        return reply({
          success: false,
          message: "You are sending messages too fast. Please slow down.",
        });
      }

      const result = sendMessageSchema.safeParse(payload);

      if (!result.success) {
        return reply({ success: false, message: "Invalid message" });
      }

      const { conversationId, content } = result.data;

      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          $or: [
            { participantOne: socket.userId },
            { participantTwo: socket.userId },
          ],
        });

        if (!conversation) {
          return reply({ success: false, message: "Conversation not found" });
        }

        const otherUserId =
          conversation.participantOne.toString() === socket.userId
            ? conversation.participantTwo
            : conversation.participantOne;

        const connection = await ConnectionRequest.findOne({
          status: "accepted",
          $or: [
            { senderId: socket.userId, recipientId: otherUserId },
            { senderId: otherUserId, recipientId: socket.userId },
          ],
        }).select("_id");

        if (!connection) {
          return reply({
            success: false,
            message: "You are no longer connected with this user",
          });
        }

        const message = await Message.create({
          conversationId,
          senderId: socket.userId,
          content,
        });

        io.to(`conversation:${conversationId}`).emit("message:new", message);
        return reply({ success: true, message });
      } catch (error) {
        console.error("Send message failed:", error.message);
        return reply({ success: false, message: "Unable to send message" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

module.exports = initSocket;
