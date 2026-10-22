const { z } = require("zod");

const userIdParamSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, {
    error: "User ID must be a valid ID",
  }),
});

module.exports = { userIdParamSchema };
