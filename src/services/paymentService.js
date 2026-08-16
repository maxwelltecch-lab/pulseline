/**
 * Payment/subscription billing.
 *
 * Stripe is used here as a clear, well-documented example. For a real
 * consumer app you'd typically use:
 *   - Google Play Billing (Android APK/AAB distribution)
 *   - Apple In-App Purchase (iOS)
 *   - Stripe/M-Pesa/Flutterwave (web/PWA checkout, or backend-only billing)
 * Store policies (Play/App Store) generally REQUIRE using their native IAP
 * for unlocking in-app subscriptions when distributing through their
 * stores — plan for that before launch, see docs/DEPLOYMENT.md.
 */

const Stripe = require("stripe");
const { PLAN_DEFS } = require("../models/Subscription");

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

async function createCheckoutSession(userId, planId, successUrl, cancelUrl) {
  const def = PLAN_DEFS[planId];
  if (!def) throw new Error("Unknown plan");
  if (!stripe) throw new Error("Stripe not configured — set STRIPE_SECRET_KEY in .env");

  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(def.priceUsd * 100),
          product_data: { name: `PulseLine — ${def.label} plan` },
        },
        quantity: 1,
      },
    ],
    metadata: { userId, planId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

function verifyWebhookEvent(rawBody, signature) {
  if (!stripe) throw new Error("Stripe not configured");
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { createCheckoutSession, verifyWebhookEvent };
