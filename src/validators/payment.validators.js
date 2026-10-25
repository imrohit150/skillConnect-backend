const { z } = require("zod");

const verifyPaymentSchema = z.object({
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_subscription_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(200),
});

module.exports = { verifyPaymentSchema };
