const crypto = require("crypto");
const User = require("../models/user.model");
const Subscription = require("../models/subscription.model");
const WebhookEvent = require("../models/webhook-event.model");
const razorpay = require("../services/razorpay.service");
const { verifyPaymentSchema } = require("../validators/payment.validators");
const { hasActivePremium } = require("../utils/premium-status");

const isValidSignature = (paymentId, subscriptionId, signature) => {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
};

const createSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user).select("_id");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const activeSubscription = await Subscription.findOne({
      userId: req.user,
      status: { $in: ["authenticated", "active"] },
    }).select("_id");

    if (activeSubscription) {
      return res.status(409).json({
        success: false,
        message: "You already have an active premium subscription",
      });
    }

    const razorpaySubscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      total_count: 12,
      customer_notify: 1,
      notes: { userId: req.user.toString() },
    });

    await Subscription.create({
      userId: req.user,
      razorpaySubscriptionId: razorpaySubscription.id,
      planId: razorpaySubscription.plan_id,
      status: razorpaySubscription.status,
    });

    return res.status(201).json({
      success: true,
      subscriptionId: razorpaySubscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error(
      "Create subscription failed:",
      error.error?.description || error.message,
    );
    return res.status(500).json({
      success: false,
      message: "Unable to create subscription",
    });
  }
};

const verifyPayment = async (req, res) => {
  const result = verifyPaymentSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment details",
    });
  }

  const {
    razorpay_payment_id: paymentId,
    razorpay_subscription_id: subscriptionId,
    razorpay_signature: signature,
  } = result.data;

  try {
    const subscription = await Subscription.findOne({
      userId: req.user,
      razorpaySubscriptionId: subscriptionId,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (!isValidSignature(paymentId, subscriptionId, signature)) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const razorpaySubscription =
      await razorpay.subscriptions.fetch(subscriptionId);

    if (!["authenticated", "active"].includes(razorpaySubscription.status)) {
      return res.status(409).json({
        success: false,
        message: "Subscription is not active yet",
      });
    }

    const periodEndSeconds =
      razorpaySubscription.current_end || razorpaySubscription.charge_at;
    const periodEnd = periodEndSeconds
      ? new Date(periodEndSeconds * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    subscription.status = razorpaySubscription.status;
    subscription.currentPeriodEnd = periodEnd;
    await subscription.save();

    await User.updateOne(
      { _id: req.user },
      { $set: { premiumStatus: true, premiumUntil: periodEnd } },
    );

    return res.status(200).json({
      success: true,
      message: "Premium activated",
      premiumUntil: periodEnd,
    });
  } catch (error) {
    console.error(
      "Verify payment failed:",
      error.error?.description || error.message,
    );
    return res.status(500).json({
      success: false,
      message: "Unable to verify payment",
    });
  }
};

const getMySubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user).select(
      "premiumStatus premiumUntil",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const subscription = await Subscription.findOne({ userId: req.user })
      .sort({ createdAt: -1 })
      .select("status currentPeriodEnd planId");

    return res.status(200).json({
      success: true,
      premiumStatus: hasActivePremium(user),
      premiumUntil: user.premiumUntil || null,
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd || null,
          }
        : null,
    });
  } catch (error) {
    console.error("Get subscription failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch subscription",
    });
  }
};

const PREMIUM_STATUSES = ["authenticated", "active"];
const HANDLED_EVENTS = [
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.pending",
  "subscription.halted",
  "subscription.paused",
  "subscription.resumed",
  "subscription.cancelled",
  "subscription.completed",
];

const isValidWebhookSignature = (rawBody, signature) => {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
};

const handleWebhook = async (req, res) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error("Webhook received but RAZORPAY_WEBHOOK_SECRET is not set");
    return res.status(503).json({ success: false });
  }

  const signature = req.get("x-razorpay-signature");
  const eventId = req.get("x-razorpay-event-id");

  if (!Buffer.isBuffer(req.body) || !signature || !eventId) {
    return res.status(400).json({ success: false });
  }

  if (!isValidWebhookSignature(req.body, signature)) {
    return res.status(400).json({ success: false });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch (error) {
    return res.status(400).json({ success: false });
  }

  if (!HANDLED_EVENTS.includes(event.event)) {
    return res.status(200).json({ success: true });
  }

  try {
    await WebhookEvent.create({ eventId, eventType: event.event });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({ success: true });
    }

    console.error("Webhook event record failed:", error.message);
    return res.status(500).json({ success: false });
  }

  try {
    const entity = event.payload?.subscription?.entity;
    const subscription = entity
      ? await Subscription.findOne({ razorpaySubscriptionId: entity.id })
      : null;

    if (subscription) {
      const periodEnd = entity.current_end
        ? new Date(entity.current_end * 1000)
        : subscription.currentPeriodEnd;

      subscription.status = entity.status;
      subscription.currentPeriodEnd = periodEnd;
      await subscription.save();

      const isPremium = PREMIUM_STATUSES.includes(entity.status);
      await User.updateOne(
        { _id: subscription.userId },
        {
          $set: {
            premiumStatus: isPremium,
            premiumUntil: periodEnd,
          },
        },
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook processing failed:", error.message);
    await WebhookEvent.deleteOne({ eventId }).catch(() => {});
    return res.status(500).json({ success: false });
  }
};

module.exports = {
  createSubscription,
  verifyPayment,
  getMySubscription,
  handleWebhook,
};
