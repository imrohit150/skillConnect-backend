const { z } = require("zod");

const searchUsersSchema = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    skill: z.string().trim().min(1).max(50).optional(),
    experienceLevel: z
      .enum(["Beginner", "Intermediate", "Advanced"])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })
  .strict();

module.exports = { searchUsersSchema };
