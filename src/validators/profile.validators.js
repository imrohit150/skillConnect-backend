const { z } = require("zod");

const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    bio: z.string().max(300).optional(),
    skills: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
    experienceLevel: z
      .enum(["Beginner", "Intermediate", "Advanced"])
      .optional(),
    interests: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
    socialLinks: z
      .object({
        github: z.union([z.url(), z.literal("")]).optional(),
        linkedin: z.union([z.url(), z.literal("")]).optional(),
        portfolio: z.union([z.url(), z.literal("")]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    error: "Provide at least one profile field to update",
  });

module.exports = {
  profileUpdateSchema,
};
