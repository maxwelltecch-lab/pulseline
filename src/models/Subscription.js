const { v4: uuid } = require("uuid");
const { Subscriptions, Users } = require("../config/db");

const PLAN_DEFS = {
  trial: { label: "3-Day Trial", days: 3, priceUsd: 0 },
  daily: { label: "Daily", days: 1, priceUsd: 0.99 },
  weekly: { label: "Weekly", days: 7, priceUsd: 4.49 },
  monthly: { label: "Monthly", days: 30, priceUsd: 9.99 },
  yearly: { label: "Yearly", days: 365, priceUsd: 59.99 },
};

function activate(userId, planId, paymentRef) {
  const def = PLAN_DEFS[planId];
  if (!def) throw new Error("Unknown plan");

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + def.days * 24 * 60 * 60 * 1000);

  const sub = Subscriptions.insert({
    id: uuid(),
    userId,
    planId,
    priceUsd: def.priceUsd,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: "active",
    paymentRef: paymentRef || null,
  });

  Users.update(userId, { plan: planId });
  return sub;
}

function hasClaimedTrial(userId) {
  return Subscriptions.find((s) => s.userId === userId && s.planId === "trial").length > 0;
}

function activeFor(userId) {
  const now = Date.now();
  return (
    Subscriptions.find((s) => s.userId === userId && s.status === "active" && new Date(s.expiresAt).getTime() > now).pop() ||
    null
  );
}

module.exports = { PLAN_DEFS, activate, activeFor, hasClaimedTrial };
