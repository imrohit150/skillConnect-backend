const { z } = require("zod");

const { isAtLeast18 } = require("../utils/age");


const signupSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8),
  dateOfBirth: z.iso.date().refine(isAtLeast18, {
    error: "You must be at least 18 years old to sign up",
  }),
});

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

module.exports = {
  signupSchema,
  loginSchema,
};