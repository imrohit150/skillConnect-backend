const { z } = require("zod");

const verifyEmailSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "Enter a 6-digit verification code"),
}).strict();

const resendVerificationSchema = z.object({}).strict();

module.exports = { verifyEmailSchema, resendVerificationSchema };
