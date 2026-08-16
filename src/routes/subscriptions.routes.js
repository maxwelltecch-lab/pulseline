const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { PLAN_DEFS, activate, activeFor, hasClaimedTrial } = require("../models/Subscription");
const { createCheckoutSession } = require("../services/paymentService");

router.get("/plans", (req, res) => {
  res.json({ plans: PLAN_DEFS });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ subscription: activeFor(req.userId) });
});

// Web/PWA checkout via Stripe. For the APK build, replace this call with
// Google Play Billing on-device purchase flow + server-side receipt
// verification (see docs/DEPLOYMENT.md).
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const { planId, successUrl, cancelUrl } = req.body;
    const session = await createCheckoutSession(req.userId, planId, successUrl, cancelUrl);
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Called by your Stripe webhook (or Play Billing purchase verification)
// once payment is confirmed.
router.post("/activate", requireAuth, (req, res) => {
  const { planId, paymentRef } = req.body;
  try {
    const sub = activate(req.userId, planId, paymentRef);
    res.json({ subscription: sub });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Redeems the 3-day trial unlocked by the share/comment/like challenge.
// Tied to the account (not the device), so reinstalling the app can't
// re-trigger it — this is what actually enforces "once per account",
// the client-side challenge is just the gate the user walks through.
router.post("/trial/claim", requireAuth, (req, res) => {
  if (hasClaimedTrial(req.userId)) {
    return res.status(409).json({ error: "Trial already used on this account" });
  }
  const sub = activate(req.userId, "trial", "challenge-redeemed");
  res.json({ subscription: sub });
});

module.exports = router;
