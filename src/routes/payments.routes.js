const router = require("express").Router();
const { v4: uuid } = require("uuid");
const { requireAuth } = require("../middleware/auth.middleware");
const { PLAN_DEFS } = require("../models/Subscription");

/**
 * M-Pesa Express (STK push) and Airtel Money integration stubs.
 *
 * Real integration needs provider credentials + signed requests you can
 * only get from each provider directly:
 *
 *  - M-Pesa: Safaricom Daraja API. Register an app at
 *    https://developer.safaricom.co.ke, get a Consumer Key/Secret and a
 *    shortcode + passkey, then call the "STK Push" (Lipa na M-Pesa Online)
 *    endpoint. Safaricom calls back your `callbackUrl` with the result —
 *    you'd verify that webhook and then call Subscription.activate().
 *  - Airtel Money: Airtel's Open API (developers.airtel.africa). Similar
 *    shape — OAuth client credentials, then a "collection" request that
 *    triggers a USSD prompt on the payer's phone, confirmed via webhook.
 *
 * Neither can be completed without an active merchant account with that
 * provider, so this route returns a mock "pending" reference instead of a
 * real charge — swap the body of `initiate()` for the real API calls once
 * you have credentials, and add a `/webhook` route for each provider's
 * payment-confirmation callback (mirroring how paymentService.js handles
 * the Stripe webhook).
 */

async function initiate(provider, phone, amountUsd) {
  // TODO: replace with a real Daraja / Airtel Open API call.
  return { reference: `${provider}-${uuid().slice(0, 8)}`, status: "pending" };
}

router.post("/mobile-money", requireAuth, async (req, res) => {
  try {
    const { provider, planId, phone } = req.body;
    if (!["mpesa", "airtel"].includes(provider)) return res.status(400).json({ error: "Unknown provider" });

    const def = PLAN_DEFS[planId];
    if (!def) return res.status(400).json({ error: "Unknown plan" });
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    const result = await initiate(provider, phone, def.priceUsd);
    // In production: store { userId, planId, provider, reference } so the
    // webhook below can find it and call Subscription.activate() once the
    // provider confirms payment.
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Provider payment-confirmation webhook (Daraja callback / Airtel webhook).
// Wire your provider dashboard to POST here, verify their signature, then
// call Subscription.activate(userId, planId, reference).
router.post("/mobile-money/webhook", (req, res) => {
  res.status(501).json({ error: "Not implemented — verify provider signature, then activate the subscription." });
});

module.exports = router;
