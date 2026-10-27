const { z } = require("zod");

const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()) }).strict();
const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  newPassword: z.string().min(8).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes"),
}).strict();

module.exports = { forgotPasswordSchema, resetPasswordSchema };
