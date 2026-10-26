const User = require("../models/user.model");
const { sendEmail } = require("../services/email.service");
const ConnectionRequest = require("../models/connection-request.model");
const {
  userIdParamSchema,
  requestIdParamSchema,
} = require("../validators/connection.validators");
const UserPass = require("../models/user-pass.model");

const publicUserFields =
  "name bio skills profileImageUrl premiumStatus interests experienceLevel socialLinks";

const escapeHtml = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sendConnectionRequest = async (req, res) => {
  const result = userIdParamSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid recipient ID",
    });
  }

  const { userId: recipientId } = result.data;
  const senderId = req.user;

  if (senderId === recipientId) {
    return res.status(400).json({
      success: false,
      message: "Cannot send connection request to yourself",
    });
  }

  try {
    const recipient = await User.findById(recipientId).select("_id email name");

    if (!recipient) {
      return res
        .status(404)
        .json({ success: false, message: "Recipient not found" });
    }

    const sender = await User.findById(senderId).select("name");

    const existingRequest = await ConnectionRequest.findOne({
      status: { $in: ["pending", "accepted"] },
      $or: [
        { senderId: senderId, recipientId: recipientId },
        { senderId: recipientId, recipientId: senderId },
      ],
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message:
          existingRequest.status === "accepted"
            ? "You are already connected"
            : "A connection request is already pending",
      });
    }

    const request = await ConnectionRequest.create({
      senderId,
      recipientId,
    });

    try {
      await UserPass.deleteOne({ userId: senderId, passedUserId: recipientId });
    } catch (error) {
      console.error(
        "Connection request was sent, but the matching pass could not be removed:",
        error.message,
      );
    }

    if (sender) {
      sendEmail({
        to: recipient.email,
        subject: `${sender.name} wants to connect with you on SkillConnect`,
        html: `<p><strong>${escapeHtml(sender.name)}</strong> sent you a connection request on SkillConnect.</p><p>Log in to accept or ignore it.</p>`,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Connection request sent",
      request: {
        id: request._id,
        senderId: request.senderId,
        recipientId: request.recipientId,
        status: request.status,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A connection request is already pending",
      });
    }

    console.error("Send connection request failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to send connection request",
    });
  }
};

const skipUser = async (req, res) => {
  const result = userIdParamSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({ success: false, message: "Invalid user ID" });
  }

  const { userId: passedUserId } = result.data;
  const userId = req.user;

  if (userId === passedUserId) {
    return res.status(400).json({
      success: false,
      message: "Cannot skip yourself",
    });
  }

  try {
    const user = await User.findById(passedUserId).select("_id");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const existingRequest = await ConnectionRequest.findOne({
      status: { $in: ["pending", "accepted"] },
      $or: [
        { senderId: userId, recipientId: passedUserId },
        { senderId: passedUserId, recipientId: userId },
      ],
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message:
          existingRequest.status === "accepted"
            ? "You are already connected to this developer"
            : "A connection request is already pending with this developer",
      });
    }

    await UserPass.create({
      userId,
      passedUserId,
    });

    return res
      .status(201)
      .json({ success: true, message: "User skipped successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already skipped this developer",
      });
    }

    console.error("Skip developer failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to skip developer",
    });
  }
};

const unpassUser = async (req, res) => {
  const result = userIdParamSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({ success: false, message: "Invalid user ID" });
  }

  try {
    const deleted = await UserPass.findOneAndDelete({
      userId: req.user,
      passedUserId: result.data.userId,
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Passed user not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Pass removed successfully" });
  } catch (error) {
    console.error("Unpass developer failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to remove pass",
    });
  }
};

const getSentRequests = async (req, res) => {
  try {
    const sentRequests = await ConnectionRequest.find({
      senderId: req.user,
      status: "pending",
    })
      .populate("recipientId", publicUserFields)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      requests: sentRequests,
    });
  } catch (error) {
    console.error("Get sent requests failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch sent requests",
    });
  }
};

const getReceivedRequests = async (req, res) => {
  try {
    const requests = await ConnectionRequest.find({
      recipientId: req.user,
      status: "pending",
    })
      .populate("senderId", publicUserFields)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error("Get received requests failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch received requests",
    });
  }
};

const getPassedUsers = async (req, res) => {
  try {
    const passedUsers = await UserPass.find({ userId: req.user })
      .populate("passedUserId", publicUserFields)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      users: passedUsers,
    });
  } catch (error) {
    console.error("Get passed users failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch passed users",
    });
  }
};

const acceptRequest = async (req, res) => {
  const result = requestIdParamSchema.safeParse(req.params);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID",
    });
  }
  const { requestId } = result.data;

  try {
    const request = await ConnectionRequest.findOneAndUpdate(
      {
        _id: requestId,
        recipientId: req.user,
        status: "pending",
      },
      {
        $set: { status: "accepted" },
      },
      { returnDocument: "after" },
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Connection request not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Connection request accepted",
      request,
    });
  } catch (error) {
    console.error("Accept request failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to accept request",
    });
  }
};

const ignoreRequest = async (req, res) => {
  const result = requestIdParamSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID",
    });
  }

  try {
    const request = await ConnectionRequest.findOneAndUpdate(
      {
        _id: result.data.requestId,
        recipientId: req.user,
        status: "pending",
      },
      {
        $set: { status: "rejected" },
      },
      { returnDocument: "after" },
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Connection request not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Connection request ignored",
      request,
    });
  } catch (error) {
    console.error("Ignore request failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to ignore request",
    });
  }
};

const cancelRequest = async (req, res) => {
  const result = requestIdParamSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID",
    });
  }

  try {
    const request = await ConnectionRequest.findOneAndUpdate(
      {
        _id: result.data.requestId,
        senderId: req.user,
        status: "pending",
      },
      {
        $set: { status: "cancelled" },
      },
      { returnDocument: "after" },
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Connection request not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Connection request cancelled",
      request,
    });
  } catch (error) {
    console.error("Cancel request failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to cancel request",
    });
  }
};

const removeConnection = async (req, res) => {
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
      message: "You cannot remove yourself as a connection",
    });
  }

  try {
    const connection = await ConnectionRequest.findOneAndDelete({
      status: "accepted",
      $or: [
        { senderId: req.user, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: req.user },
      ],
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: "Accepted connection not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Accepted connection removed",
    });
  } catch (error) {
    console.error("Remove connection failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to remove connection",
    });
  }
};

const getConnections = async (req, res) => {
  try {
    const acceptedConnections = await ConnectionRequest.find({
      status: "accepted",
      $or: [{ senderId: req.user }, { recipientId: req.user }],
    })
      .populate("senderId", publicUserFields)
      .populate("recipientId", publicUserFields);

    const connections = acceptedConnections.map((connection) => {
      const loggedInUserIsSender =
        connection.senderId._id.toString() === req.user.toString();

      return {
        connectionId: connection._id,
        connectedAt: connection.updatedAt,
        user: loggedInUserIsSender
          ? connection.recipientId
          : connection.senderId,
      };
    });

    return res.status(200).json({
      success: true,
      connections,
    });
  } catch (error) {
    console.error("Get connections failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to get connections",
    });
  }
};

module.exports = {
  sendConnectionRequest,
  skipUser,
  unpassUser,
  getSentRequests,
  getReceivedRequests,
  getPassedUsers,
  acceptRequest,
  ignoreRequest,
  cancelRequest,
  removeConnection,
  getConnections,
};
