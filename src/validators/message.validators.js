const { z } = require("zod");

const conversationIdParamSchema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/, {
    error: "Conversation ID must be a valid ID",
  }),
});

const messageHistoryQuerySchema = z.object({
  before: z.iso.datetime().optional(),
  beforeId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).refine((query) => !query.beforeId || Boolean(query.before), { message: "beforeId requires before" });

const joinConversationSchema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});

const sendMessageSchema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  content: z.string().trim().min(1).max(2000),
});

module.exports = { conversationIdParamSchema, messageHistoryQuerySchema, joinConversationSchema, sendMessageSchema };
